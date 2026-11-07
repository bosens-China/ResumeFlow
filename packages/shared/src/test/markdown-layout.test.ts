import { assert, test } from "vitest";
import { getLayoutInsertionOffset, renderMarkdown } from "../markdown.ts";

const row = (
  attributes = "",
  cells = ':::cell\n左\n:::\n:::cell{align="right"}\n右\n:::',
) => `::::row${attributes}\n${cells}\n::::`;

test("explicit rows support validated column widths and cell alignment", () => {
  const html = renderMarkdown(row('{columns="2fr 24mm"}'));
  assert.match(html, /grid-template-columns: minmax\(0, 2fr\) 24mm/);
  assert.match(html, /rf-align-right/);
  assert.match(
    renderMarkdown(row('{columns="1fr auto"}')),
    /minmax\(0, max-content\)/,
  );
  assert.match(renderMarkdown(row('{columns="50% 100px"}')), /50% 100px/);
});

test("invalid widths, alignment, old syntax and orphan cells are rejected", () => {
  for (const attrs of [
    '{columns="1fr"}',
    '{columns="1fr 0fr"}',
    '{columns="1fr 101%"}',
    '{columns="1fr url(x)"}',
    '{unknown="x"}',
  ])
    assert.throws(() => renderMarkdown(row(attrs)), /columns|row/);
  assert.throws(
    () => renderMarkdown(row("", ':::cell{align="top"}\n内容\n:::')),
    /align/,
  );
  for (const name of ["left", "right", "center", "cell"])
    assert.throws(() => renderMarkdown(`:::${name}\n内容\n:::`));
  assert.throws(() => renderMarkdown("::::row\n正文\n::::"), /row 必须/);
});

test("insertion moves after the enclosing layout", () => {
  const source = `${row()}\n\n尾部正文`;
  assert.equal(
    getLayoutInsertionOffset(source, source.indexOf("左")),
    source.indexOf("\n\n尾部"),
  );
  assert.equal(getLayoutInsertionOffset("普通正文", 2), 2);
});
