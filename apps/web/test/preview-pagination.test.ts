import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { afterAll, beforeAll, test } from "vitest";
import {
  paginatePreview,
  type PreviewSlice,
} from "../src/lib/preview-pagination";
import {
  previewDocument,
  type PreviewUpdate,
} from "../src/lib/preview-document";

const require = createRequire(
  new URL("../../server/package.json", import.meta.url),
);
const { chromium } = require("playwright") as typeof import("playwright");
let browser: import("playwright").Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

async function layout(html: string, css = "", height = 100) {
  const page = await browser.newPage();
  await page.setContent(
    `<style>body{margin:0}#root{display:flow-root;width:240px;font:16px/24px Arial}p,h2,ul,li{margin:0}h2{font-size:20px;line-height:24px}${css}</style><main id="root">${html}</main>`,
  );
  await page.addScriptTag({
    content: `window.paginate=${paginatePreview.toString()}`,
  });
  const result = await page.evaluate((height) => {
    const root = document.querySelector<HTMLElement>("#root")!;
    const paginate = (window as unknown as { paginate: typeof paginatePreview })
      .paginate;
    const pages = paginate(root, height);
    const range = document.createRange();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const origin = root.getBoundingClientRect().top;
    const lines: { top: number; bottom: number }[] = [];
    while (walker.nextNode()) {
      range.selectNodeContents(walker.currentNode);
      for (const rect of range.getClientRects())
        if (rect.width > 0)
          lines.push({ top: rect.top - origin, bottom: rect.bottom - origin });
    }
    return { pages, lines, height: root.scrollHeight };
  }, height);
  await page.close();
  return result;
}

function assertContinuous(
  pages: PreviewSlice[],
  height: number,
  capacity = 100,
) {
  assert.equal(pages[0]!.start, 0);
  assert.ok(Math.abs(pages.at(-1)!.end - height) <= 1);
  pages.forEach((page, index) => {
    assert.ok(page.end - page.start <= capacity + 0.1);
    if (index) assert.equal(page.start, pages[index - 1]!.end);
  });
}

test("keeps short blocks, headings, table rows and side-by-side rows together", async () => {
  const blocks = await layout(
    '<p style="height:60px">第一段</p><p style="height:60px">第二段</p>',
  );
  assert.deepEqual(blocks.pages, [
    { start: 0, end: 60 },
    { start: 60, end: 120 },
  ]);
  const headings = await layout(
    '<p style="height:70px">前文</p><h2>经历</h2><p>后续内容</p>',
  );
  assert.equal(headings.pages[0]!.end, 70);
  for (const html of [
    '<div class="rf-row" style="display:grid;grid-template-columns:1fr 1fr;height:60px"><p>左栏</p><p>右栏</p></div>',
    '<table style="border-spacing:0"><tbody><tr style="height:60px"><td>表格行</td><td>日期</td></tr></tbody></table>',
    '<img alt="图片" style="display:block;width:40px;height:60px">',
  ]) {
    const result = await layout(`<p style="height:60px">前文</p>${html}`);
    assert.equal(result.pages[0]!.end, 60);
    assertContinuous(result.pages, result.height);
  }
});

test("keeps heading glyphs that extend above their line box on the next page", async () => {
  const result = await layout(
    '<p style="height:100px">前文</p><h3 style="font:32px/16px Arial;margin:0">Heading</h3><p>后续内容</p>',
  );
  assertContinuous(result.pages, result.height);
  for (const { end } of result.pages.slice(0, -1))
    assert.ok(
      !result.lines.some(
        (line) => line.top < end - 0.01 && line.bottom > end + 0.01,
      ),
      `cut through heading glyph bounds at ${end}`,
    );
});

test("splits long Chinese, mixed inline text and list items between actual text lines", async () => {
  for (const content of [
    `<p>${"中文简历项目经验与结果".repeat(100)}</p>`,
    `<p>${"中文 <strong>Engineer 2026</strong> <em>业绩提升</em> <a>链接</a> ".repeat(60)}</p>`,
    `<ul><li>${"长列表条目中的文字内容".repeat(100)}</li></ul>`,
  ]) {
    const result = await layout(content);
    assert.ok(result.pages.length > 2);
    assertContinuous(result.pages, result.height);
    for (const { end } of result.pages.slice(0, -1))
      assert.ok(
        !result.lines.some(
          (line) => line.top < end - 0.01 && line.bottom > end + 0.01,
        ),
        `cut through a text line at ${end}`,
      );
  }
});

test("handles explicit breaks, empty input and oversized elements without gaps or loops", async () => {
  assert.deepEqual((await layout("")).pages, [{ start: 0, end: 0 }]);
  const forced = await layout(
    '<p>第一段</p><p style="break-before:page">第二段</p>',
  );
  assert.equal(forced.pages.length, 2);
  assert.equal(forced.pages[0]!.end, 24);
  const oversized = await layout(
    '<img style="height:350px;width:100px;display:block">',
  );
  assert.equal(oversized.pages.length, 4);
  assertContinuous(oversized.pages, oversized.height);
});

test("persistent runtime coalesces updates, supports count-only and skips layout for colors", async () => {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setContent(
    '<iframe title="preview" sandbox="allow-scripts" style="width:816px;height:1200px"></iframe>',
  );
  await page.evaluate((doc) => {
    (window as unknown as { replies: unknown[] }).replies = [];
    addEventListener("message", (event) =>
      (window as unknown as { replies: unknown[] }).replies.push(event.data),
    );
    document.querySelector("iframe")!.srcdoc = doc;
  }, previewDocument());
  await page.waitForFunction(() =>
    (window as unknown as { replies: { booted?: boolean }[] }).replies.some(
      (item) => item.booted,
    ),
  );
  const frame = page.frames()[1]!;
  const update: PreviewUpdate = {
    source: "resumeflow-preview-update",
    id: 1,
    html: `<p>${"中文预览文字".repeat(1500)}</p>`,
    css: "body{font:16px/24px Arial}p{margin:0;color:var(--rf-preview-theme-color)}",
    margin: "14mm",
    color: "#000000",
    countOnly: false,
  };
  const send = async (updates: PreviewUpdate[]) => {
    await page.evaluate((updates) => {
      for (const update of updates)
        document
          .querySelector("iframe")!
          .contentWindow!.postMessage(update, "*");
    }, updates);
    const id = updates.at(-1)!.id;
    await page.waitForFunction(
      (id) =>
        (window as unknown as { replies: { id?: number }[] }).replies.some(
          (item) => item.id === id,
        ),
      id,
    );
    return page.evaluate(
      (id) =>
        (
          window as unknown as {
            replies: { id?: number; pages: number; error?: string }[];
          }
        ).replies.find((item) => item.id === id)!,
      id,
    );
  };
  const first = await send([update]);
  assert.equal(first.error, undefined);
  assert.ok(first.pages > 1);
  await frame
    .locator(".rf-preview-page")
    .first()
    .evaluate((node) => node.setAttribute("data-retained", "yes"));
  await send([{ ...update, id: 2, color: "#ff0000" }]);
  assert.equal(
    await frame
      .locator(".rf-preview-page")
      .first()
      .getAttribute("data-retained"),
    "yes",
  );
  const count = await send([{ ...update, id: 3, countOnly: true }]);
  assert.equal(count.pages, first.pages);
  assert.equal(await frame.locator(".rf-preview-page").count(), 0);
  await send([
    { ...update, id: 4 },
    { ...update, id: 5, html: "<p>最终输入</p>" },
  ]);
  assert.equal(await frame.locator("#pages p").innerText(), "最终输入");
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("https://preview.test/delayed.svg", async (route) => {
    await gate;
    await route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>',
    });
  });
  await page.evaluate(
    (update) =>
      document.querySelector("iframe")!.contentWindow!.postMessage(update, "*"),
    {
      ...update,
      id: 6,
      css: update.css + "p{font-size:32px}",
      html: '<p>等待图片的旧内容</p><img src="https://preview.test/delayed.svg">',
    },
  );
  await frame.locator("#source img").waitFor({ state: "attached" });
  await send([{ ...update, id: 7, html: "<p>最终输入</p>" }]);
  release();
  await frame.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  assert.equal(await frame.locator("#pages p").innerText(), "最终输入");
  assert.equal(
    await frame
      .locator("#pages p")
      .evaluate((node) => getComputedStyle(node).fontSize),
    "16px",
  );
  const customPage = await send([
    {
      ...update,
      id: 8,
      css: `${update.css}@page { margin: 30mm; margin-left: 20mm; }`,
    },
  ]);
  assert.equal(customPage.error, undefined);
  assert.ok(customPage.pages > first.pages);
  assert.deepEqual(
    await frame.evaluate(() => {
      const geometry = getComputedStyle(document.querySelector("#geometry")!);
      return [geometry.paddingTop, geometry.paddingLeft];
    }),
    ["113.386px", "75.5906px"],
  );
  assert.deepEqual(errors, []);
  await page.close();
});
