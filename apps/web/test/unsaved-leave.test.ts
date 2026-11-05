import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { createApp } from "../../server/src/app.ts";
import { createStore } from "../../server/src/store.ts";

const require = createRequire(
  new URL("../../server/package.json", import.meta.url),
);
const { serve } =
  require("@hono/node-server") as typeof import("@hono/node-server");
const { chromium } = require("playwright") as typeof import("playwright");

test(
  "leaving warns only for changes without a manually saved version",
  { timeout: 60_000 },
  async () => {
    const store = createStore(":memory:");
    const resume = store.create("简历", "# 初稿");
    const backend = serve({
      fetch: createApp(store).fetch,
      hostname: "127.0.0.1",
      port: 0,
    });
    await new Promise<void>((resolve) => backend.once("listening", resolve));
    const address = backend.address();
    assert.ok(address && typeof address !== "string");
    const cacheDir = await mkdtemp(join(tmpdir(), "resumeflow-leave-"));
    const vite = await createServer({
      root: fileURLToPath(new URL("..", import.meta.url)),
      cacheDir,
      server: {
        port: 0,
        proxy: { "/api": `http://127.0.0.1:${address.port}` },
      },
    });
    await vite.listen();
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      });
      const page = await context.newPage();
      await page.route("**/api/events", (route) => route.abort());
      const url = `${vite.resolvedUrls!.local[0]}resumes/${resume.id}`;
      await page.goto(url);
      const editor = page.getByRole("textbox", { name: "Markdown 编辑器" });
      const save = page.getByRole("button", { name: "保存并发布版本 (⌘S)" });
      const back = page.getByRole("link", {
        name: "ResumeFlow 简流 - 返回首页",
      });
      await editor.click();
      const shouldWarn = () =>
        page.evaluate(() => {
          const event = new Event("beforeunload", { cancelable: true });
          window.dispatchEvent(event);
          return event.defaultPrevented;
        });
      assert.equal(
        await shouldWarn(),
        false,
        "unchanged content leaves silently",
      );

      const autosaved = page.waitForResponse(
        (response) => response.request().method() === "PATCH",
      );
      await editor.fill("# 自动暂存但未手动保存");
      assert.equal(await shouldWarn(), true, "warn before autosave");
      await autosaved;
      assert.equal(
        await shouldWarn(),
        true,
        "autosave does not dismiss the warning",
      );

      // 确认站内返回也走同一未保存判断，取消后仍可继续编辑。
      let confirmations = 0;
      page.on("dialog", async (confirmation) => {
        confirmations++;
        await confirmation.dismiss();
      });
      await back.click();
      await page.waitForTimeout(100);
      assert.equal(confirmations, 1, "in-app navigation asks before leaving");
      assert.equal(page.url(), url);

      await editor.fill("# 初稿");
      assert.equal(
        await shouldWarn(),
        false,
        "reverting all changes leaves silently",
      );

      await editor.fill("# 手动保存的版本");
      await save.click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLButtonElement>(
            '[aria-label="保存并发布版本 (⌘S)"]',
          )!.disabled,
      );
      assert.equal(
        await shouldWarn(),
        false,
        "manual save dismisses the warning",
      );
      await page.reload();
      await editor.waitFor();
      assert.equal(confirmations, 1, "saved content reloads without a dialog");
      assert.equal(await editor.inputValue(), "# 手动保存的版本");

      await page.getByPlaceholder("请输入简历名称").fill("未保存的新名称");
      assert.equal(await shouldWarn(), true, "title edits are also protected");
      await page.getByPlaceholder("请输入简历名称").fill("简历");
      await back.click();
      await page.waitForURL(vite.resolvedUrls!.local[0]!);
      assert.equal(
        confirmations,
        1,
        "unchanged content navigates without a dialog",
      );

      await page.goto(url);
      await editor.click();
      await editor.fill("# 关闭前的修改");
      page.removeAllListeners("dialog");
      const closing = page.waitForEvent("dialog");
      await page.close({ runBeforeUnload: true });
      const closeDialog = await closing;
      assert.equal(closeDialog.type(), "beforeunload");
      await closeDialog.dismiss();
      assert.equal(page.isClosed(), false);
      assert.equal(await editor.inputValue(), "# 关闭前的修改");

      page.once("dialog", (confirmation) => confirmation.accept());
      await back.click();
      await page.waitForURL(vite.resolvedUrls!.local[0]!);
      assert.equal(store.get(resume.id)!.markdown, "# 关闭前的修改");
    } finally {
      await browser.close();
      await vite.close();
      await rm(cacheDir, { recursive: true, force: true });
      await new Promise<void>((resolve, reject) =>
        backend.close((error) => (error ? reject(error) : resolve())),
      );
      store.close();
    }
  },
);
