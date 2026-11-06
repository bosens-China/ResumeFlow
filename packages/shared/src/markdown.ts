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
import { automaticLayouts } from "./markdown-layout.js";
import {
  htmlLayout,
  InvalidMarkdownError,
  validateHtmlImages,
} from "./html-rules.js";

export { InvalidMarkdownError } from "./html-rules.js";

function markdownRules() {
  return (tree: Root) => {
    visit(tree, (node) => {
      if (
        !["containerDirective", "leafDirective", "textDirective"].includes(
          node.type,
        )
      )
        return;
      const directive = node as typeof node & {
        name: string;
        children?: Root["children"];
        data?: Record<string, unknown>;
      };
      const line = node.position?.start.line;
      if (node.type !== "containerDirective")
        throw new InvalidMarkdownError(`不支持 ${directive.name} 指令`, line);

      const name = directive.name;
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
      } else if (!["cell", "left", "center", "right"].includes(name)) {
        throw new InvalidMarkdownError(`不支持 ${name} 指令`, line);
      }

      const data = directive.data ?? (directive.data = {});
      data.hName = "div";
      data.hProperties = {
        className:
          name === "row"
            ? ["rf-row", `rf-row-${directive.children!.length}`]
            : [`rf-${name}`],
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
schemaAttributes["*"].push(["className", allowRfRegex]);

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkDirective)
  .use(automaticLayouts)
  .use(markdownRules)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(validateHtmlImages)
  .use(rehypeSanitize, {
    ...defaultSchema,
    attributes: schemaAttributes,
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
