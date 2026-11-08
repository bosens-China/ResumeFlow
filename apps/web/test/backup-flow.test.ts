import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import { createServer } from "vite";
import { createApp } from "../../server/src/app.ts";
import { backupZip, exportBackup } from "../../server/src/backup.ts";
import { createStore } from "../../server/src/store.ts";

const require = createRequire(
  new URL("../../server/package.json", import.meta.url),
);
const { unzipSync, strFromU8 } =
  require("fflate") as typeof import("../../server/node_modules/fflate");
const { serve } =
  require("@hono/node-server") as typeof import("@hono/node-server");
const { chromium } = require("playwright") as typeof import("playwright");

test(
  "backup restore conflicts and Markdown exports work in the browser",
  { timeout: 60_000 },
  async () => {
    const store = createStore(":memory:");
    const single = store.create("单语言", "# 单语言");
    const multi = store.create("多语言", "# 中文", {
      languages: {
        zh: { title: "多语言", markdown: "# 中文" },
        en: { title: "English", markdown: "# English" },
      },
    });
    store.createVersion(multi.id, multi.revision, "历史");
    const backup = Buffer.from(backupZip(exportBackup(store)));
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
        viewport: { width: 1440, height: 900 },
      });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const base = vite.resolvedUrls!.local[0]!;
      await page.goto(`${base}resumes/${single.id}`);
      await page.getByRole("button", { name: "更多导出选项" }).click();
      await page
        .getByRole("menuitem", { name: "导出 Markdown (.md)" })
        .waitFor();
      assert.equal(
        await page
          .getByRole("menuitem", { name: "导出全部语言 (.zip)" })
          .count(),
        0,
      );
      await page.keyboard.press("Escape");
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(`${base}resumes/${multi.id}`);
      await page.getByRole("button", { name: "更多导出选项" }).click();
      const all = page.getByRole("menuitem", {
        name: "导出全部语言 (.zip)",
      });
      assert.equal(await all.isEnabled(), true);
      const downloadPromise = page.waitForEvent("download");
      await all.click();
      const download = await downloadPromise;
      assert.equal(download.suggestedFilename(), "多语言-Markdown.zip");
      const chunks: Buffer[] = [];
      for await (const chunk of (await download.createReadStream())!)
        chunks.push(Buffer.from(chunk));
      const files = unzipSync(Buffer.concat(chunks));
      assert.equal(strFromU8(files["zh.md"]!), "# 中文");
      assert.equal(strFromU8(files["en.md"]!), "# English");
      await page.goto(base);
      const backupDownload = page.waitForEvent("download");
      await page.getByRole("button", { name: "全量备份" }).click();
      const savedBackup = await backupDownload;
      assert.match(
        savedBackup.suggestedFilename(),
        /^resumeflow_backup_.*\.zip$/,
      );
      assert.equal(await savedBackup.failure(), null);
      const input = page.locator('input[accept=".zip,application/zip"]');
      await input.setInputFiles({
        name: "backup.zip",
        mimeType: "application/zip",
        buffer: backup,
      });
      await page.getByRole("dialog").waitFor();
      assert.match(
        await page.getByRole("dialog").innerText(),
        /还原冲突（1\/2）/,
      );
      await page.getByRole("button", { name: "保留为副本" }).click();
      assert.match(
        await page.getByRole("dialog").innerText(),
        /还原冲突（2\/2）/,
      );
      await page.getByRole("button", { name: "取消还原" }).click();
      assert.equal(store.list().length, 2);
      await input.setInputFiles({
        name: "backup.zip",
        mimeType: "application/zip",
        buffer: backup,
      });
      await page.getByRole("dialog").waitFor();
      await page.getByRole("button", { name: "保留为副本" }).click();
      const restore = page.waitForResponse("**/api/backup/restore");
      await page.getByRole("button", { name: "覆盖现有简历" }).click();
      assert.equal((await restore).status(), 200);
      await page.getByText("成功恢复 2 份简历").waitFor();
      assert.equal(store.list().length, 3);
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await vite.close();
      backend.close();
      store.close();
    }
  },
);
