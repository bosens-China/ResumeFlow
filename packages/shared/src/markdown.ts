import type { Root } from "mdast";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import remarkRehype from "remark-rehype";
import rehypeSanitize, {
  defaultSchema,
  type Options as SanitizeOptions,
} from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

export class InvalidMarkdownError extends Error {
  readonly line?: number;

  constructor(message: string, line?: number) {
    super(message);
    this.line = line;
  }
}

function addClass(node: unknown, cls: string) {
  const target = node as { data?: Record<string, unknown> };
  const data = target.data ?? (target.data = {});
  const hProperties = (data.hProperties ?? (data.hProperties = {})) as Record<
    string,
    unknown
  >;
  const existing = Array.isArray(hProperties.className)
    ? hProperties.className
    : [];
  hProperties.className = [...existing, cls];
}

function markdownRules() {
  return (tree: Root) => {
    const definitions = new Map<string, string>();
    visit(tree, "definition", (node) => {
      definitions.set(node.identifier, node.url);
    });
    visit(tree, (node, _index, parent) => {
      if (node.type === "image" || node.type === "imageReference") {
        const source =
          node.type === "image" ? node.url : definitions.get(node.identifier);
        if (source === undefined) return;
        const url = URL.canParse(source) ? new URL(source) : null;
        if (
          !url ||
          !["http:", "https:"].includes(url.protocol) ||
          url.username ||
          url.password
        )
          throw new InvalidMarkdownError(
            "图片只支持完整的 HTTP(S) URL",
            node.position?.start.line,
          );
        return;
      }
      if (node.type === "heading") {
        addClass(node, `rf-h${(node as { depth: number }).depth}`);
      } else if (node.type === "paragraph") {
        addClass(node, "rf-p");
      } else if (node.type === "list") {
        addClass(
          node,
          (node as { ordered?: boolean }).ordered ? "rf-ol" : "rf-ul",
        );
      } else if (node.type === "listItem") {
        addClass(node, "rf-li");
      } else if (node.type === "link") {
        addClass(node, "rf-link");
      } else if (node.type === "blockquote") {
        addClass(node, "rf-blockquote");
      } else if (node.type === "table") {
        addClass(node, "rf-table");
      } else if (node.type === "thematicBreak") {
        addClass(node, "rf-hr");
      } else if (node.type === "code" || node.type === "inlineCode") {
        addClass(node, "rf-code");
      }
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
          ![2, 3].includes(cells.length) ||
          !cells.every(
            (cell) =>
              cell.type === "containerDirective" &&
              "name" in cell &&
              cell.name === "cell",
          )
        )
          throw new InvalidMarkdownError("row 必须包含两个或三个 cell", line);
      } else if (name === "cell") {
        if (
          parent?.type !== "containerDirective" ||
          !("name" in parent) ||
          parent.name !== "row"
        ) {
          throw new InvalidMarkdownError("cell 只能放在 row 内", line);
        }
      } else if (!["left", "center", "right"].includes(name)) {
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
  .use(markdownRules)
  .use(remarkRehype)
  .use(rehypeSanitize, {
    ...defaultSchema,
    attributes: schemaAttributes,
  })
  .use(rehypeStringify);

export function renderMarkdown(markdown: string): string {
  const html = String(processor.processSync(markdown));
  return `<div class="rf-root">${html}</div>`;
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
