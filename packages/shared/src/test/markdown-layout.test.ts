import { assert, test } from "vitest";
import { getLayoutInsertionOffset, renderMarkdown } from "../markdown.ts";

const block = (name: string, content: string) => `:::${name}\n${content}\n:::`;
const rowCount = (html: string) =>
  (html.match(/class="rf-row rf-row-/g) ?? []).length;

test.each([
  ["left", "center", "right"],
  ["right", "center", "left"],
  ["center", "right", "left"],
  ["left", "right", "center"],
  ["center", "left", "right"],
  ["right", "left", "center"],
])("position directives follow their slots: %s, %s, %s", (...names) => {
  const html = renderMarkdown(
    names.map((name) => block(name, `${name}内容`)).join("\n\n"),
  );
  assert.equal(rowCount(html), 1);
  assert.match(html, /rf-row-3/);
  assert.ok(html.indexOf("left内容") < html.indexOf("center内容"));
  assert.ok(html.indexOf("center内容") < html.indexOf("right内容"));
});

test("right followed by left forms one row, while standalone alignment spans the block", () => {
  const html = renderMarkdown(
    `${block("right", "日期")}\n\n${block("left", "岗位")}`,
  );
  assert.equal(rowCount(html), 1);
  assert.match(html, /rf-row-2/);
  assert.ok(html.indexOf("岗位") < html.indexOf("日期"));
  for (const name of ["left", "center", "right"]) {
    const single = renderMarkdown(block(name, "单独内容"));
    assert.equal(rowCount(single), 0);
    assert.match(single, new RegExp(`class="rf-${name}"`));
  }
});

test.each([1, 2, 3, 4, 5, 8])("%i adjacent cells form one row", (count) => {
  const html = renderMarkdown(
    Array.from({ length: count }, (_, i) => block("cell", `第${i}项`)).join(
      "\n\n",
    ),
  );
  assert.equal(rowCount(html), 1);
  assert.match(html, new RegExp(`rf-row-${count}`));
  assert.equal((html.match(/class="rf-cell"/g) ?? []).length, count);
});

test("normal content, repeated positions and cell mode create new groups", () => {
  const pair = `${block("left", "岗位")}\n\n${block("right", "日期")}`;
  for (const separator of ["正文", "## 标题", "---"]) {
    assert.equal(
      rowCount(renderMarkdown(`${pair}\n\n${separator}\n\n${pair}`)),
      2,
    );
  }
  assert.equal(rowCount(renderMarkdown(`${pair}\n\n${pair}`)), 2);
  assert.equal(
    rowCount(renderMarkdown(`${pair}\n\n${block("cell", "单元格")}`)),
    2,
  );
  assert.equal(rowCount(renderMarkdown(`\`\`\`md\n${pair}\n\`\`\``)), 0);
});

test("center keeps its middle slot when a side is absent", () => {
  for (const side of ["left", "right"]) {
    const html = renderMarkdown(
      `${block("center", "中间")}\n\n${block(side, "侧边")}`,
    );
    assert.match(html, /rf-row-3/);
    assert.equal((html.match(/class="rf-cell"/g) ?? []).length, 3);
    assert.match(html, /<div class="rf-cell"><\/div>/);
  }
});

test("explicit rows keep their boundary and accept four cells", () => {
  const cells = Array.from({ length: 4 }, (_, i) => block("cell", `${i}`)).join(
    "\n",
  );
  assert.equal(rowCount(renderMarkdown(`::::row\n${cells}\n::::`)), 1);
  assert.throws(() => renderMarkdown("::::row\n正文\n::::"), /row 必须/);
});

test("insertion moves after the enclosing layout without changing ordinary text positions", () => {
  const source = `${block("left", "已有内容")}\n\n尾部正文`;
  assert.equal(
    getLayoutInsertionOffset(source, source.indexOf("已有")),
    source.indexOf("\n\n尾部"),
  );
  const nested = `::::row\n${block("cell", "已有内容")}\n::::`;
  assert.equal(
    getLayoutInsertionOffset(nested, nested.indexOf("已有")),
    nested.length,
  );
  assert.equal(getLayoutInsertionOffset("普通正文", 2), 2);
  const code = `\`\`\`md\n${block("left", "示例")}\n\`\`\``;
  assert.equal(
    getLayoutInsertionOffset(code, code.indexOf("示例")),
    code.indexOf("示例"),
  );
});
