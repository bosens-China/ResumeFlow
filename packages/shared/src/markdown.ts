import type { Root } from "mdast";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

export class InvalidMarkdownError extends Error {
  readonly line?: number;

  constructor(message: string, line?: number) {
    super(message);
    this.line = line;
  }
}

const classes = [
  "rf-left",
  "rf-center",
  "rf-right",
  "rf-row",
  "rf-row-2",
  "rf-row-3",
  "rf-cell",
];

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

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkDirective)
  .use(markdownRules)
  .use(remarkRehype)
  .use(rehypeSanitize, {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      div: [["className", ...classes]],
    },
  })
  .use(rehypeStringify);

export function renderMarkdown(markdown: string): string {
  return String(processor.processSync(markdown));
}
