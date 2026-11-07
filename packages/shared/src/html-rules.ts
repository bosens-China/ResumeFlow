import type { Root } from "hast";
import { visit } from "unist-util-visit";

export class InvalidMarkdownError extends Error {
  readonly line?: number;

  constructor(message: string, line?: number) {
    super(message);
    this.line = line;
  }
}

export function validateHtmlImages() {
  return (tree: Root) => {
    // 在清洗前校验，避免不合法的 src 被过滤后绕过保存校验。
    visit(tree, "element", (node) => {
      if (node.tagName !== "img") return;
      const source = node.properties.src;
      const url =
        typeof source === "string" && URL.canParse(source)
          ? new URL(source)
          : null;
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
    });
  };
}

const elementClasses: Record<string, string> = {
  a: "link",
  blockquote: "blockquote",
  code: "code",
  hr: "hr",
  img: "img",
  li: "li",
  ol: "ol",
  p: "p",
  pre: "code",
  table: "table",
  ul: "ul",
};

export function htmlLayout() {
  return (tree: Root) => {
    let inHeader = false;
    let headerEnded = false;
    visit(tree, "element", (node) => {
      const tag = node.tagName;
      if (/^h[2-6]$/.test(tag)) {
        inHeader = false;
        headerEnded = true;
      } else if (tag === "h1" && !headerEnded) {
        inHeader = true;
      }
      const classes = Array.isArray(node.properties.className)
        ? node.properties.className.filter((name) => name !== "rf-avatar")
        : [];
      const columns = classes.find(
        (name) =>
          typeof name === "string" &&
          /^rf-cols-(?:auto|[1-9]\d{0,3}(?:fr|mm|px|pct))(?:-(?:auto|[1-9]\d{0,3}(?:fr|mm|px|pct)))*$/.test(
            name,
          ),
      );
      if (tag === "div" && typeof columns === "string") {
        node.properties.style = `grid-template-columns: ${columns
          .slice(8)
          .split("-")
          .map((column) =>
            column === "auto"
              ? "minmax(0, max-content)"
              : column.endsWith("fr")
                ? `minmax(0, ${column})`
                : column.replace("pct", "%"),
          )
          .join(" ")}`;
      }
      const name = /^h[1-6]$/.test(tag) ? tag : elementClasses[tag];
      if (name) classes.push(`rf-${name}`);
      if (tag === "img" && inHeader) classes.push("rf-avatar");
      if (classes.length) node.properties.className = [...new Set(classes)];
      else delete node.properties.className;
    });
  };
}
