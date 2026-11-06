import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
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
        const start = element.value.indexOf("保留后文");
        element.setSelectionRange(start, element.value.length);
      });
      await insert.click();
      await page.getByRole("menuitem", { name: "右对齐" }).click();
      await page.waitForFunction(() => {
        const input = document.querySelector("textarea")!;
        return (
          document.activeElement === input &&
          input.value.slice(input.selectionStart, input.selectionEnd) ===
            "右侧内容"
        );
      });
      const twoColumns = await editor.inputValue();
      assert.ok(twoColumns.startsWith("# 姓名\n\n保留前文\n\n:::right\n"));
      assert.ok(twoColumns.endsWith(":::\n\n保留后文"));
      await page.keyboard.insertText("2025 - 至今");
      await insert.click();
      await page.getByRole("menuitem", { name: "左对齐" }).click();
      await page.waitForFunction(() => {
        const input = document.querySelector("textarea")!;
        return (
          input.value.slice(input.selectionStart, input.selectionEnd) ===
          "左侧内容"
        );
      });
      await page.keyboard.insertText("研发岗位");
      const edited = await editor.inputValue();
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
      await page.waitForFunction(
        async ({ id, markdown }) => {
          const saved = await (await fetch(`/api/resumes/${id}`)).json();
          return saved.markdown === markdown;
        },
        { id: resume.id, markdown: edited },
      );
      assert.equal(store.get(resume.id)!.languages?.en?.markdown, "# English");
      assert.equal(store.get(resume.id)!.customCss, resume.customCss);

      await page.getByRole("button", { name: "自定义样式 (CSS)" }).click();
      assert.equal(await insert.count(), 0);
      await page.getByRole("button", { name: "正文 (Markdown)" }).click();
      assert.equal(await editor.inputValue(), edited);

      await editor.fill("");
      await insert.focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(
        () => document.activeElement?.textContent?.trim() === "左对齐",
      );
      await page.keyboard.press("End");
      await page.waitForFunction(
        () => document.activeElement?.textContent?.trim() === "单元格",
      );
      await page.keyboard.press("Enter");
      for (const content of ["第一项", "第二项", "第三项", "第四项"]) {
        if (content !== "第一项") {
          await insert.click();
          await page.getByRole("menuitem", { name: "单元格" }).click();
        }
        await page.waitForFunction(() => {
          const input = document.querySelector("textarea")!;
          return (
            document.activeElement === input &&
            input.value.slice(input.selectionStart, input.selectionEnd) ===
              "单元格内容"
          );
        });
        await page.keyboard.insertText(content);
      }
      const fourColumns = await editor.inputValue();
      assert.equal((fourColumns.match(/^:::cell/gm) ?? []).length, 4);
      await frame.locator("#pages .rf-row-4 > .rf-cell").first().waitFor();
      assert.equal(
        await frame.locator("#pages .rf-row-4 > .rf-cell").count(),
        4,
      );
      assert.deepEqual(
        await frame
          .locator("#pages .rf-row-4 > .rf-cell")
          .evaluateAll((cells) =>
            cells.map((cell) => getComputedStyle(cell).textAlign),
          ),
        ["left", "center", "center", "right"],
      );

      await insert.click();
      await page.keyboard.press("Escape");
      assert.equal(await editor.inputValue(), fourColumns);
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
