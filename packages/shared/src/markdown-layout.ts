import type { Root } from "mdast";

interface LayoutNode {
  type: string;
  name?: string;
  children?: LayoutNode[];
}

const positions = ["left", "center", "right"];

function groupLayouts(parent: LayoutNode) {
  if (!parent.children) return;
  for (const child of parent.children) groupLayouts(child);
  if (parent.type === "containerDirective" && parent.name === "row") return;

  const children: LayoutNode[] = [];
  let group: LayoutNode[] = [];

  function flush() {
    if (!group.length) return;
    if (group[0].name !== "cell" && group.length === 1) {
      children.push(group[0]);
    } else {
      const slots = group.some((node) => node.name === "center")
        ? positions
        : ["left", "right"];
      const cells =
        group[0].name === "cell"
          ? group
          : slots.map((name) => ({
              type: "containerDirective",
              name: "cell",
              children: group.filter((node) => node.name === name),
            }));
      children.push({
        type: "containerDirective",
        name: "row",
        children: cells,
      });
    }
    group = [];
  }

  for (const node of parent.children) {
    const layout =
      node.type === "containerDirective" &&
      (node.name === "cell" || positions.includes(node.name ?? ""));
    if (!layout) {
      flush();
      children.push(node);
      continue;
    }
    if (
      group.length &&
      ((group[0].name === "cell") !== (node.name === "cell") ||
        (node.name !== "cell" && group.some((item) => item.name === node.name)))
    )
      flush();
    group.push(node);
  }
  flush();
  parent.children = children;
}

export function automaticLayouts() {
  return (tree: Root) => groupLayouts(tree);
}
