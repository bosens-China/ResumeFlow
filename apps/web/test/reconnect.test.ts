import assert from "node:assert/strict";
import { createRequire } from "node:module";
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
  "the editor and list refresh after the event stream reconnects",
  { timeout: 60_000 },
  async () => {
    const store = createStore(":memory:");
    const resume = store.create("原始名称", "# 原始内容");
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
      const page = await browser.newPage();
      await page.route("**/api/events", (route) => route.abort());
      const stream = page.waitForRequest("**/api/events");
      await page.goto(`${vite.resolvedUrls!.local[0]}resumes/${resume.id}`);
      await stream;
      const editor = page.getByRole("textbox", { name: "Markdown 编辑器" });
      await editor.waitFor();
      assert.equal(await editor.innerText(), "# 原始内容");
      await editor.focus();
      await editor.press("Control+Home");
      await editor.press("Shift+ArrowRight");
      await editor.press("Shift+ArrowRight");
      assert.equal(
        store.update(resume.id, resume.revision, { markdown: "# 断线期间更新" })
          .status,
        "ok",
      );
      await page.unroute("**/api/events");
      await page.waitForFunction(
        () =>
          (
            document.querySelector(
              '.cm-content[aria-label="Markdown 编辑器"]',
            ) as HTMLElement
          )?.innerText === "# 断线期间更新",
        null,
        { timeout: 15000 },
      );
      await editor.focus();
      await editor.press("Control+Home");
      await editor.press("Shift+ArrowRight");
      await editor.evaluate((element) => {
        element.dataset.focusProbe = "1";
      });
      const current = store.get(resume.id)!;
      assert.equal(
        store.update(resume.id, current.revision, {
          themeColor: "#e11d48",
        }).status,
        "ok",
      );
      await page
        .getByRole("button", { name: "设置简历主题色 (当前: #e11d48)" })
        .waitFor();
      assert.equal(await editor.getAttribute("data-focus-probe"), "1");
      assert.equal(
        await editor.evaluate((element) => element === document.activeElement),
        true,
      );
      assert.equal(await page.evaluate(() => getSelection()?.toString()), "#");
      await editor.press("Control+End");
      await page.getByRole("button", { name: "选择并插入简历图标" }).click();
      await page
        .getByRole("button", { name: "插入 电话 图标 (:icon[phone])" })
        .click();
      await page
        .getByText("简历图标库", { exact: true })
        .waitFor({ state: "hidden" });
      await page.waitForFunction(
        () =>
          document.activeElement?.getAttribute("aria-label") ===
          "Markdown 编辑器",
      );
      assert.equal(await editor.innerText(), "# 断线期间更新:icon[phone] ");
      await page.getByRole("button", { name: "自定义样式 (CSS)" }).click();
      await page.locator(".cm-content").click();
      assert.equal(
        await page
          .locator(".cm-cursor")
          .first()
          .evaluate((element) => getComputedStyle(element).borderLeftWidth),
        "3px",
      );
      await page.getByRole("button", { name: "选择并插入简历图标" }).click();
      await page
        .getByRole("button", { name: "插入 邮箱 图标 (:icon[mail])" })
        .click();
      await page
        .getByText("简历图标库", { exact: true })
        .waitFor({ state: "hidden" });
      await page.waitForFunction(
        () =>
          document.activeElement?.getAttribute("aria-label") ===
          "Markdown 编辑器",
      );
      assert.equal(
        await editor.innerText(),
        "# 断线期间更新:icon[phone] :icon[mail] ",
      );
      page.once("dialog", (dialog) => dialog.accept());
      await page.route("**/api/events", (route) => route.abort());
      const listStream = page.waitForRequest("**/api/events");
      await page.goto(vite.resolvedUrls!.local[0]!);
      await listStream;
      store.create("断线期间创建", "# 简历");
      await page.unroute("**/api/events");
      await page.getByText("断线期间创建").waitFor({ timeout: 15000 });
    } finally {
      await browser.close();
      await vite.close();
      await new Promise<void>((resolve, reject) =>
        backend.close((error) => (error ? reject(error) : resolve())),
      );
      store.close();
    }
  },
);
