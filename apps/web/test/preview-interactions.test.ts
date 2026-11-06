import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import { test } from "vitest";
import { createServer, preview } from "vite";
import { createApp } from "../../server/src/app.ts";
import { createStore } from "../../server/src/store.ts";

const require = createRequire(
  new URL("../../server/package.json", import.meta.url),
);
const { serve } =
  require("@hono/node-server") as typeof import("@hono/node-server");
const { chromium } = require("playwright") as typeof import("playwright");

test(
  "typing preserves the iframe, cards share page counts, and templates use HTML preview",
  { timeout: 60_000 },
  async () => {
    const store = createStore(":memory:");
    const markdown = `# 实时预览\n\n${Array.from({ length: 16 }, (_, index) => `## 项目 ${index + 1}\n\n负责中文与 English 混合排版的研发工作。\n\n- 优化编辑反馈与性能\n- **成果**：完成交付，支持多个语言版本。`).join("\n\n")}`;
    const resume = store.create("预览验收", markdown);
    const backend = serve({
      fetch: createApp(store).fetch,
      hostname: "127.0.0.1",
      port: 0,
    });
    await new Promise<void>((resolve) => backend.once("listening", resolve));
    const address = backend.address();
    assert.ok(address && typeof address !== "string");
    const options = {
      root: fileURLToPath(new URL("..", import.meta.url)),
      server: {
        host: "127.0.0.1",
        port: 0,
        proxy: { "/api": `http://127.0.0.1:${address.port}` },
      },
    };
    const production = process.env.PREVIEW_TEST_BUILD === "1";
    const vite = production
      ? await preview({ ...options, preview: options.server })
      : await createServer(options);
    if ("listen" in vite) await vite.listen();
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      });
      const errors: string[] = [];
      let pagedRequests = 0;
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (request.url().includes("/api/pagedjs.js")) pagedRequests++;
      });
      await page.addInitScript(() => {
        const timings: number[] = [];
        (window as unknown as { previewTimings: number[] }).previewTimings =
          timings;
        let input = 0;
        document.addEventListener("input", (event) => {
          if (
            (event.target as HTMLElement).getAttribute("aria-label") ===
            "Markdown 编辑器"
          )
            input = performance.now();
        });
        addEventListener("message", (event) => {
          if (
            input &&
            event.data?.source === "resumeflow-preview" &&
            event.data?.pages
          ) {
            timings.push(performance.now() - input);
            input = 0;
          }
        });
      });
      const base = vite.resolvedUrls!.local[0]!;
      await page.goto(`${base}resumes/${resume.id}`);
      const iframe = page.locator('iframe[title="简历分页预览"]');
      const handle = await iframe.elementHandle();
      const frame = await handle!.contentFrame();
      assert.ok(frame);
      await frame.locator(".rf-preview-page").first().waitFor();
      const initialPages = await frame.locator(".rf-preview-page").count();
      assert.ok(initialPages > 1);
      await frame.evaluate(() => {
        document.documentElement.dataset.persistent = "yes";
      });
      const sourceDoc = await iframe.getAttribute("srcdoc");
      const editor = page.getByRole("textbox", { name: "Markdown 编辑器" });
      await editor.fill(`${markdown}\n\n即时输入 `);
      await editor.press("End");
      await editor.pressSequentially("abcdefghijklmnopqrst", { delay: 30 });
      await frame.waitForFunction(() =>
        document
          .querySelector("#pages")
          ?.textContent?.includes("abcdefghijklmnopqrst"),
      );
      assert.equal(await iframe.getAttribute("srcdoc"), sourceDoc);
      assert.equal(
        await frame.evaluate(() => document.documentElement.dataset.persistent),
        "yes",
      );
      const timings = await page.evaluate(
        () =>
          (window as unknown as { previewTimings: number[] }).previewTimings,
      );
      assert.ok(timings.length >= 5, "should produce feedback during typing");
      timings.sort((a, b) => a - b);
      writeFileSync(
        `/tmp/resumeflow-preview-${production ? "production" : "dev"}-timings.json`,
        JSON.stringify({
          pages: initialPages,
          updates: timings.length,
          p50: timings[Math.floor(timings.length * 0.5)],
          p95: timings[Math.floor(timings.length * 0.95)],
          timings,
        }),
      );
      console.info(
        `HTML preview ${production ? "production" : "dev"}: ${initialPages} pages, ${timings.length} updates, p50=${timings[Math.floor(timings.length * 0.5)]!.toFixed(1)}ms, p95=${timings[Math.floor(timings.length * 0.95)]!.toFixed(1)}ms (input to DOM update acknowledgement)`,
      );
      await page.setViewportSize({ width: 1280, height: 800 });
      assert.equal(
        await frame.locator(".rf-preview-page").count(),
        initialPages,
      );
      await page.screenshot({ path: "/tmp/resumeflow-html-preview.png" });
      await page.waitForFunction(
        async (id) =>
          (await (await fetch(`/api/resumes/${id}`)).json()).markdown.includes(
            "abcdefghijklmnopqrst",
          ),
        resume.id,
      );
      const finalPages = await frame.locator(".rf-preview-page").count();
      await page.goto(base);
      const card = page.locator(`a[href="/resumes/${resume.id}"]`);
      const badge = card.locator('[title^="A4 预览约"]');
      await badge.waitFor();
      assert.equal(await badge.innerText(), `${finalPages} 页`);
      assert.equal(
        await page.locator('iframe[title="计算简历页数"]').count(),
        0,
      );
      await page.evaluate(async (id) => {
        const resume = await (await fetch(`/api/resumes/${id}`)).json();
        await fetch(`/api/resumes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            revision: resume.revision,
            markdown: "# 更新后的单页简历",
          }),
        });
      }, resume.id);
      await page.waitForFunction(
        (id) =>
          document.querySelector(
            `a[href="/resumes/${id}"] [title^="A4 预览约"]`,
          )?.textContent === "1 页",
        resume.id,
      );
      await page.goto(`${base}templates`);
      await page.locator('[title^="A4 预览约"]').first().waitFor();
      const templatePages = await page
        .locator('[title^="A4 预览约"]')
        .first()
        .innerText();
      await page.getByText("点击预览模板").first().click({ force: true });
      const dialogFrame = page.frameLocator('iframe[title="简历分页预览"]');
      await dialogFrame.locator(".rf-preview-page").first().waitFor();
      assert.equal(
        `${await dialogFrame.locator(".rf-preview-page").count()} 页`,
        templatePages,
      );
      assert.equal(pagedRequests, 0);
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      if ("close" in vite) await vite.close();
      else
        await new Promise<void>((resolve, reject) =>
          vite.httpServer.close((error) => (error ? reject(error) : resolve())),
        );
      await new Promise<void>((resolve, reject) =>
        backend.close((error) => (error ? reject(error) : resolve())),
      );
      store.close();
    }
  },
);
