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
      assert.equal(await editor.inputValue(), "# 原始内容");
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
              'textarea[aria-label="Markdown 编辑器"]',
            ) as HTMLTextAreaElement
          )?.value === "# 断线期间更新",
        null,
        { timeout: 15000 },
      );
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
