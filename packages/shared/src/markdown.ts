import type { Root } from "mdast";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, {
  defaultSchema,
  type Options as SanitizeOptions,
} from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import {
  htmlLayout,
  InvalidMarkdownError,
  validateHtmlImages,
} from "./html-rules.js";
import { renderResumeIconHtml } from "./resume-icons.js";

export { InvalidMarkdownError } from "./html-rules.js";

function markdownRules() {
  return (tree: Root) => {
    visit(tree, (node, _index, parent) => {
      if (
        !["containerDirective", "leafDirective", "textDirective"].includes(
          node.type,
        )
      )
        return;
      const directive = node as typeof node & {
        name: string;
        children?: Root["children"];
        attributes?: Record<string, string | null>;
        data?: Record<string, unknown>;
      };
      const line = node.position?.start.line;

      if (directive.name === "icon") {
        if (node.type !== "textDirective")
          throw new InvalidMarkdownError("icon 只支持行内指令", line);
        let iconName = "";
        if (
          directive.attributes &&
          typeof directive.attributes.name === "string"
        ) {
          iconName = directive.attributes.name.trim();
        } else if (directive.children && directive.children.length > 0) {
          const first = directive.children[0];
          if (first && "value" in first && typeof first.value === "string") {
            iconName = first.value.trim();
          }
        }
        if (!iconName) {
          throw new InvalidMarkdownError("icon 指令必须指定图标名称", line);
        }
        const svgHtml = renderResumeIconHtml(iconName);
        if (!svgHtml) {
          throw new InvalidMarkdownError(`未知的图标名称: ${iconName}`, line);
        }
        Object.assign(node, {
          type: "html",
          value: svgHtml,
          children: undefined,
        });
        return;
      }

      if (node.type !== "containerDirective")
        throw new InvalidMarkdownError(`不支持 ${directive.name} 指令`, line);

      const name = directive.name;
      const attrs = directive.attributes ?? {};
      const classes = [name === "row" ? "rf-row" : `rf-${name}`];
      if (name === "row") {
        const cells = directive.children ?? [];
        if (
          cells.length === 0 ||
          !cells.every(
            (cell) =>
              cell.type === "containerDirective" &&
              "name" in cell &&
              cell.name === "cell",
          )
        )
          throw new InvalidMarkdownError("row 必须包含至少一个 cell", line);
        classes.push(`rf-row-${cells.length}`);
        if (Object.keys(attrs).some((key) => key !== "columns"))
          throw new InvalidMarkdownError("row 只支持 columns 属性", line);
        if ("columns" in attrs) {
          const columns = attrs.columns?.trim().split(/\s+/) ?? [];
          if (
            columns.length !== cells.length ||
            columns.some((column) => {
              const match = /^([1-9]\d*)(fr|mm|px|%)$/.exec(column);
              return (
                column !== "auto" &&
                (!match ||
                  Number(match[1]) < 1 ||
                  Number(match[1]) > (match[2] === "%" ? 100 : 1000))
              );
            })
          )
            throw new InvalidMarkdownError(
              "columns 须与 cell 数量一致，使用 auto 或正整数 fr、mm、px、%",
              line,
            );
          classes.push(`rf-cols-${columns.join("-").replaceAll("%", "pct")}`);
        }
      } else if (name === "cell") {
        if (
          !parent ||
          parent.type !== "containerDirective" ||
          !("name" in parent) ||
          parent.name !== "row"
        )
          throw new InvalidMarkdownError("cell 必须位于 row 内", line);
        if (
          Object.keys(attrs).some((key) => key !== "align") ||
          ("align" in attrs &&
            !["left", "center", "right"].includes(attrs.align ?? ""))
        )
          throw new InvalidMarkdownError(
            "cell 的 align 只支持 left、center、right",
            line,
          );
        if (attrs.align) classes.push(`rf-align-${attrs.align}`);
      } else {
        throw new InvalidMarkdownError(`不支持 ${name} 指令`, line);
      }

      const data = directive.data ?? (directive.data = {});
      data.hName = "div";
      data.hProperties = {
        className: classes,
      };
    });
  };
}

const allowRfRegex = /^rf-[a-z0-9_-]+$/;
const schemaAttributes = structuredClone(
  defaultSchema.attributes ?? {},
) as NonNullable<SanitizeOptions["attributes"]>;

for (const attrs of Object.values(schemaAttributes)) {
  if (!Array.isArray(attrs)) continue;
  const classDef = attrs.find(
    (a): a is [string, ...(string | RegExp)[]] =>
      Array.isArray(a) && a[0] === "className",
  );
  if (classDef) {
    classDef.push(allowRfRegex);
  } else {
    attrs.push(["className", allowRfRegex]);
  }
}
if (!schemaAttributes["*"]) schemaAttributes["*"] = [];
schemaAttributes["*"].push(
  ["className", allowRfRegex],
  "ariaHidden",
  "aria-hidden",
);

const svgTagNames = [
  ...(defaultSchema.tagNames ?? []),
  "svg",
  "path",
  "circle",
  "ellipse",
  "rect",
  "line",
  "polyline",
  "polygon",
  "g",
];

const sanitizeAttributes: SanitizeOptions["attributes"] = {
  ...schemaAttributes,
  span: [...(schemaAttributes.span ?? []), "dataIcon", "data-icon"],
  svg: [
    "className",
    "viewBox",
    "width",
    "height",
    "fill",
    "stroke",
    "strokeWidth",
    "stroke-width",
    "strokeLinecap",
    "stroke-linecap",
    "strokeLinejoin",
    "stroke-linejoin",
    "xmlns",
  ],
  path: [
    "d",
    "fill",
    "stroke",
    "strokeWidth",
    "stroke-width",
    "strokeLinecap",
    "stroke-linecap",
    "strokeLinejoin",
    "stroke-linejoin",
  ],
  circle: ["cx", "cy", "r", "fill", "stroke", "strokeWidth", "stroke-width"],
  ellipse: [
    "cx",
    "cy",
    "rx",
    "ry",
    "fill",
    "stroke",
    "strokeWidth",
    "stroke-width",
  ],
  rect: [
    "x",
    "y",
    "width",
    "height",
    "rx",
    "ry",
    "fill",
    "stroke",
    "strokeWidth",
    "stroke-width",
  ],
  line: [
    "x1",
    "y1",
    "x2",
    "y2",
    "stroke",
    "strokeWidth",
    "stroke-width",
    "strokeLinecap",
    "stroke-linecap",
  ],
  polyline: [
    "points",
    "fill",
    "stroke",
    "strokeWidth",
    "stroke-width",
    "strokeLinecap",
    "stroke-linecap",
    "strokeLinejoin",
    "stroke-linejoin",
  ],
  polygon: [
    "points",
    "fill",
    "stroke",
    "strokeWidth",
    "stroke-width",
    "strokeLinecap",
    "stroke-linecap",
    "strokeLinejoin",
    "stroke-linejoin",
  ],
  g: ["fill", "stroke"],
};

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkDirective)
  .use(markdownRules)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(validateHtmlImages)
  .use(rehypeSanitize, {
    ...defaultSchema,
    tagNames: svgTagNames,
    attributes: sanitizeAttributes,
  })
  .use(htmlLayout)
  .use(rehypeStringify);

export function renderMarkdown(markdown: string): string {
  const html = String(processor.processSync(markdown));
  return `<div class="rf-root">${html}</div>`;
}

export function getLayoutInsertionOffset(markdown: string, offset: number) {
  let insertion = offset;
  visit(processor.parse(markdown), (node) => {
    if (node.type !== "containerDirective") return;
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (
      start !== undefined &&
      end !== undefined &&
      start <= offset &&
      offset < end
    )
      insertion = Math.max(insertion, end);
  });
  return insertion;
}

/** 基于 Markdown 内容与排版规则智能预估 A4 纸张页数 */
export function estimateResumePageCount(
  markdown: string,
  _margin?: string,
): number {
  if (!markdown || !markdown.trim()) return 1;
  const lines = markdown.split("\n");
  let totalHeightMm = 0;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      totalHeightMm += 3;
    } else if (line.startsWith("# ")) {
      totalHeightMm += 16;
    } else if (line.startsWith("## ")) {
      totalHeightMm += 15;
    } else if (line.startsWith("### ")) {
      totalHeightMm += 9;
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const wrapped = Math.max(1, Math.ceil(line.length / 45));
      totalHeightMm += wrapped * 6.5;
    } else if (line.startsWith("::::") || line.startsWith(":::")) {
      totalHeightMm += 0.5;
    } else {
      const wrapped = Math.max(1, Math.ceil(line.length / 50));
      totalHeightMm += wrapped * 6.5;
    }
  }
  const pageHeightMm = 255;
  return Math.max(1, Math.ceil(totalHeightMm / pageHeightMm));
}
