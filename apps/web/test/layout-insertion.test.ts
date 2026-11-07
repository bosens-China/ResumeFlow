import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { createServer } from "vite";
import { createApp } from "../../server/src/app.ts";
import { createStore } from "../../server/src/store.ts";
import { closePdfBrowser } from "../../server/src/pdf.ts";

const require = createRequire(
  new URL("../../server/package.json", import.meta.url),
);
const { serve } =
  require("@hono/node-server") as typeof import("@hono/node-server");
const { chromium } = require("playwright") as typeof import("playwright");

test(
  "layout insertion preserves text, saves the current language, and supports keyboard and PDF export",
  { timeout: 60_000 },
  async () => {
    const store = createStore(":memory:");
    const original = "# 姓名\n\n保留前文保留后文";
    const resume = store.create("杨柳大模型开发", original, {
      languages: {
        zh: { title: "杨柳大模型开发", markdown: original },
        en: { title: "Resume", markdown: "# English" },
      },
      customCss: "h1 {\n  color: navy;\n}\n",
    });
    const backend = serve({
      fetch: createApp(store).fetch,
      hostname: "127.0.0.1",
      port: 0,
    });
    await new Promise<void>((resolve) => backend.once("listening", resolve));
    const address = backend.address();
    assert.ok(address && typeof address !== "string");
    const vite = await createServer({
      root: fileURLToPath(new URL("..", import.meta.url)),
      server: {
        host: "127.0.0.1",
        port: 0,
        proxy: { "/api": `http://127.0.0.1:${address.port}` },
      },
    });
    await vite.listen();
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 800 },
      });
      await page.goto(`${vite.resolvedUrls!.local[0]}resumes/${resume.id}`);
      const editor = page.getByRole("textbox", { name: "Markdown 编辑器" });
      await editor.waitFor();
      const insert = page.getByRole("button", { name: "插入语法" });
      const panel = editor.locator("..");
      const buttonBox = await insert.boundingBox();
      const panelBox = await panel.boundingBox();
      assert.ok(buttonBox && panelBox);
      assert.ok(buttonBox.x >= panelBox.x);
      assert.ok(buttonBox.x + buttonBox.width <= panelBox.x + panelBox.width);

      await editor.evaluate((element) => {
        element.focus();
      });
      await editor.press("Control+End");
      for (let i = 0; i < "保留后文".length; i++)
        await editor.press("Shift+ArrowLeft");
      await insert.click();
      assert.deepEqual(await page.getByRole("menuitem").allTextContents(), [
        "左右同行",
        "左中右同行",
        "等宽分栏",
      ]);
      await page.getByRole("menuitem", { name: "左右同行" }).click();
      await page.waitForFunction(() => {
        return window.getSelection()?.toString() === "左侧内容";
      });
      await page.keyboard.insertText("研发岗位");
      await editor.evaluate((element) => {
        const line = [...element.querySelectorAll(".cm-line")].find((node) =>
          node.textContent?.includes("右侧内容"),
        );
        const text = line?.firstChild;
        if (!text) throw new Error("right cell is missing");
        const start = text.textContent!.indexOf("右侧内容");
        window
          .getSelection()!
          .setBaseAndExtent(text, start, text, start + "右侧内容".length);
      });
      await page.keyboard.insertText("2025 - 至今");
      const edited = await editor.innerText();
      const markdown = await editor
        .locator(".cm-line")
        .allTextContents()
        .then((lines) => lines.join("\n"));
      assert.ok(edited.includes("研发岗位"));
      const frame = page.frameLocator('iframe[title="简历分页预览"]');
      await frame.locator("#pages .rf-row-2 > .rf-cell").first().waitFor();
      assert.equal(
        await frame.locator("#pages .rf-row-2 > .rf-cell").count(),
        2,
      );
      assert.equal(
        await frame.locator("#pages .rf-row-2 > .rf-cell").first().innerText(),
        "研发岗位",
      );
      assert.equal(
        await frame.locator("#pages .rf-row-2 > .rf-cell").last().innerText(),
        "2025 - 至今",
      );
      await expect
        .poll(() => store.get(resume.id)?.markdown, { timeout: 10_000 })
        .toBe(markdown);
      assert.equal(store.get(resume.id)!.languages?.en?.markdown, "# English");
      assert.equal(store.get(resume.id)!.customCss, resume.customCss);

      await page.getByRole("button", { name: "自定义样式 (CSS)" }).click();
      assert.equal(await insert.count(), 0);
      const cssEditor = page.locator(".cm-content");
      await cssEditor.fill("h1{color: red}");
      await expect
        .poll(() => store.get(resume.id)?.customCss, { timeout: 10_000 })
        .toBe("h1{color: red}");
      assert.equal(
        await cssEditor.evaluate(
          (element) => element === document.activeElement,
        ),
        true,
      );
      assert.equal(await cssEditor.innerText(), "h1{color: red}");
      await page.getByRole("button", { name: "正文 (Markdown)" }).click();
      assert.equal(await editor.innerText(), edited);

      await editor.fill("");
      await insert.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("menuitem", { name: "等宽分栏" }).waitFor();
      await page.keyboard.press("End");
      await page.waitForFunction(
        () => document.activeElement?.textContent?.trim() === "等宽分栏",
      );
      await page.keyboard.press("Enter");
      const equalColumns = await editor.innerText();
      assert.ok(equalColumns.includes("::::row"));
      assert.equal((equalColumns.match(/^:::cell/gm) ?? []).length, 2);
      await frame.locator("#pages .rf-row-2 > .rf-cell").first().waitFor();
      await insert.click();
      await page.keyboard.press("Escape");
      assert.equal(await editor.innerText(), equalColumns);
      assert.equal(
        await insert.evaluate((element) => element === document.activeElement),
        true,
      );

      const exportButton = page.getByRole("button", {
        name: "导出当前语言 PDF，悬停可选择其他语言",
      });
      await page.waitForFunction(() =>
        [...document.querySelectorAll("button")].some(
          (button) =>
            button.textContent?.includes("导出 PDF") && !button.disabled,
        ),
      );
      const downloadStarted = page.waitForEvent("download");
      await exportButton.click();
      assert.equal(
        (await downloadStarted).suggestedFilename(),
        "杨柳大模型开发.pdf",
      );
    } finally {
      await browser.close();
      await closePdfBrowser();
      await vite.close();
      backend.close();
      store.close();
    }
  },
);
