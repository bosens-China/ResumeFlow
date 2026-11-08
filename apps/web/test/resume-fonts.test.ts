import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { fileURLToPath } from "node:url";
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
  "font choices follow each language through saves, reloads, preview failures and Web export",
  { timeout: 60_000 },
  async () => {
    const store = createStore(":memory:");
    const resume = store.create("字体测试", "", {
      languages: {
        zh: {
          title: "中文简历",
          markdown:
            "# 张三 Resume\n\n## 工作经历\n\n**软件工程师** React 2026，业绩提升 35%。",
        },
        en: {
          title: "English Resume",
          markdown:
            "# Resume\n\n## Experience\n\n**Engineer** React 2026. 中文姓名",
        },
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
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const fontButton = page.getByRole("button", { name: "选择简历字体" });
      async function ready(family: string) {
        const handle = await page
          .locator('iframe[aria-hidden="false"]')
          .elementHandle();
        const frame = await handle!.contentFrame();
        assert.ok(frame);
        await frame.waitForFunction(
          (family) => {
            const content = document.querySelector(
              "#pages .rf-preview-content",
            );
            return (
              content &&
              getComputedStyle(content).fontFamily.includes(family) &&
              Array.from(document.fonts).some(
                (font) =>
                  font.family.includes(family) && font.status === "loaded",
              )
            );
          },
          family,
          { timeout: 15_000 },
        );
      }
      async function select(name: string) {
        await fontButton.click();
        await page.getByRole("menuitemradio").filter({ hasText: name }).click();
      }
      async function language(name: string) {
        await page.getByRole("button", { name: "切换简历语言版本" }).click();
        await page.getByRole("menu").getByText(name, { exact: true }).click();
      }
      await page.goto(`${vite.resolvedUrls!.local[0]}resumes/${resume.id}`);
      await ready("RF Source Han Sans");
      await select("MiSans");
      await ready("RF MiSans");
      await expect
        .poll(() => store.get(resume.id)?.languages?.zh?.font, {
          timeout: 10_000,
        })
        .toBe("misans");
      await language("英语");
      await ready("RF Inter");
      await select("HarmonyOS Sans");
      await ready("RF HarmonyOS Sans");
      await language("简体中文");
      await ready("RF MiSans");
      const editor = page.getByRole("textbox", { name: "Markdown 编辑器" });
      await editor.fill(
        "# 张三 Resume\n\n## 工作经历\n\n**React 工程师** 2026，业绩提升 35%。",
      );
      await expect
        .poll(() => store.get(resume.id)?.markdown, { timeout: 10_000 })
        .toContain("React 工程师");
      await page.reload();
      await ready("RF MiSans");
      assert.equal(store.get(resume.id)!.languages?.en?.font, "harmonyos-sans");
      await select("苹方");
      await ready("RF PingFang SC");
      const downloadStarted = page.waitForEvent("download");
      await page.getByRole("button", { name: "导出 PDF" }).click();
      const download = await downloadStarted;
      assert.match(
        readFileSync((await download.path())!).toString("latin1"),
        /PingFangSC/,
      );

      await page.setViewportSize({ width: 1280, height: 800 });
      assert.ok(
        await page
          .locator("header")
          .evaluate((header) => header.scrollWidth <= header.clientWidth),
      );
      await page.screenshot({ path: "/tmp/resumeflow-fonts-header.png" });
      await page.route("**/api/fonts/alibaba-puhuiti-*.ttf", (route) =>
        route.abort(),
      );
      await select("阿里普惠体");
      await page.getByRole("alert").waitFor();
      assert.equal(
        await page.getByRole("button", { name: "导出 PDF" }).isDisabled(),
        true,
      );
      await page.unroute("**/api/fonts/alibaba-puhuiti-*.ttf");
      await page.getByRole("button", { name: "重试预览" }).click();
      await ready("RF Alibaba PuHuiTi");
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await closePdfBrowser();
      await vite.close();
      await new Promise<void>((resolve, reject) =>
        backend.close((error) => (error ? reject(error) : resolve())),
      );
      store.close();
    }
  },
);
