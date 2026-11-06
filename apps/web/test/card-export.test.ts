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
  "card PDF exports keep the list open, use language filenames, and allow retry after failure",
  { timeout: 60_000 },
  async () => {
    const store = createStore(":memory:");
    const chinese = store.create("杨柳大模型开发", "# 杨柳");
    const english = store.create("English Resume", "# Yang Liu", {
      currentLanguage: "en",
      languages: {
        en: { title: "Yang Liu Resume", markdown: "# Yang Liu" },
        zh: { title: "中文标题", markdown: "# 杨柳" },
      },
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
    let release = () => {};
    try {
      const page = await browser.newPage();
      const base = vite.resolvedUrls!.local[0]!;
      await page.goto(base);
      const card = page.locator(`a[href="/resumes/${chinese.id}"]`);
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route(
        `**/api/resumes/${chinese.id}/pdf?*`,
        async (route) => {
          await gate;
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "PDF 生成失败" }),
          });
        },
        { times: 1 },
      );
      const started = page.waitForRequest(`**/api/resumes/${chinese.id}/pdf?*`);
      await card.getByRole("button", { name: "操作菜单" }).click();
      await page.getByRole("menuitem", { name: "导出 PDF" }).click();
      await started;
      const pending = card.getByRole("button", { name: "正在导出 PDF" });
      await pending.waitFor();
      assert.equal(await pending.isDisabled(), true);
      assert.equal(new URL(page.url()).pathname, "/");
      release();
      await page.getByText("PDF 生成失败", { exact: true }).waitFor();

      for (const [resume, filename, language] of [
        [chinese, "杨柳大模型开发.pdf", "zh"],
        [english, "Yang Liu Resume_en.pdf", "en"],
      ] as const) {
        const target = page.locator(`a[href="/resumes/${resume.id}"]`);
        const menu = target.getByRole("button", { name: "操作菜单" });
        await menu.waitFor();
        assert.equal(await menu.isEnabled(), true);
        await menu.click();
        const requestStarted = page.waitForRequest(
          `**/api/resumes/${resume.id}/pdf?*`,
        );
        const downloadStarted = page.waitForEvent("download");
        await page.getByRole("menuitem", { name: "导出 PDF" }).click();
        const request = new URL((await requestStarted).url());
        assert.equal(request.searchParams.get("lang"), language);
        assert.equal(
          request.searchParams.get("revision"),
          String(resume.revision),
        );
        const download = await downloadStarted;
        assert.equal(download.suggestedFilename(), filename);
        assert.equal(await download.failure(), null);
        assert.equal(new URL(page.url()).pathname, "/");
        assert.equal(store.get(resume.id)!.revision, resume.revision);
      }
    } finally {
      release();
      await browser.close();
      await closePdfBrowser();
      await vite.close();
      backend.close();
      store.close();
    }
  },
);
