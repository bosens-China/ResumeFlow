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
    const imageResume = store.create(
      "图片简历",
      "# 图片\n\n![头像](https://example.com/avatar.png)",
    );
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
      const imageUrl = "https://example.com/avatar.png";
      await page.route(imageUrl, (route) => route.abort());
      await page.goto(base);
      const imageCard = page.locator(`a[href="/resumes/${imageResume.id}"]`);
      await imageCard.locator('[title^="A4 预览约"]').waitFor();
      const cached = () =>
        page.evaluate(
          (id) =>
            Object.keys(localStorage).some(
              (key) =>
                key.startsWith("resumeflow_page_count_v2_") &&
                key.endsWith(`:${id}`),
            ),
          imageResume.id,
        );
      assert.equal(await cached(), false);
      await page.unroute(imageUrl);
      let loaded = 0;
      await page.route(imageUrl, (route) => {
        loaded++;
        return route.fulfill({
          contentType: "image/png",
          body: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XnE0AAAAASUVORK5CYII=",
            "base64",
          ),
        });
      });
      await page.reload();
      await imageCard.locator('[title^="A4 预览约"]').waitFor();
      assert.ok(loaded > 0);
      assert.equal(await cached(), true);
      const card = page.locator(`a[href="/resumes/${chinese.id}"]`);
      const thumbnail = card.locator(".rf-thumbnail-paper > div").first();
      assert.equal(
        await thumbnail.evaluate((element) =>
          element.shadowRoot?.querySelector("body")?.textContent?.trim(),
        ),
        "杨柳",
      );
      assert.equal(
        await thumbnail.evaluate((element) =>
          getComputedStyle(element).getPropertyValue("--rf-theme-color").trim(),
        ),
        "#000000",
      );
      assert.equal(await card.locator('iframe[title="简历缩略图"]').count(), 0);
      await page.getByRole("link", { name: "模板中心" }).click();
      await page.getByRole("link", { name: "我的简历" }).click();
      assert.equal(
        await card
          .locator(".rf-thumbnail-paper > div")
          .first()
          .evaluate((element) =>
            element.shadowRoot?.querySelector("body")?.textContent?.trim(),
          ),
        "杨柳",
      );
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
      const failed = page.waitForResponse(`**/api/resumes/${chinese.id}/pdf?*`);
      release();
      assert.equal((await failed).status(), 500);

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
