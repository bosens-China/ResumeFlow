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
  "dragging the help button does not open its menu, while click and keyboard do",
  { timeout: 60_000 },
  async () => {
    const store = createStore(":memory:");
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
      await page.goto(vite.resolvedUrls!.local[0]);
      const button = page.locator(
        'button[aria-label="帮助、反馈与 AI 接入 (可拖拽)"]',
      );
      const box = await button.boundingBox();
      assert.ok(box);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      assert.equal(await button.getAttribute("aria-expanded"), "false");
      await page.mouse.move(box.x - 100, box.y - 80, { steps: 5 });
      assert.equal(await button.getAttribute("aria-expanded"), "false");
      await page.mouse.up();
      assert.equal(await button.getAttribute("aria-expanded"), "false");
      const movedBox = await button.boundingBox();
      assert.ok(movedBox && movedBox.x < box.x - 50);
      await button.click();
      assert.equal(await button.getAttribute("aria-expanded"), "true");
      await page.mouse.click(movedBox.x + 18, movedBox.y + 18);
      assert.equal(await button.getAttribute("aria-expanded"), "false");
      await button.click();
      await page.keyboard.press("Escape");
      assert.equal(await button.getAttribute("aria-expanded"), "false");
      await button.focus();
      await page.keyboard.press("Enter");
      assert.equal(await button.getAttribute("aria-expanded"), "true");
      await page.getByRole("menuitem", { name: /接入 AI/ }).click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      const copied: string[] = [];
      await page.exposeFunction("captureCopiedText", (value: string) =>
        copied.push(value),
      );
      await page.evaluate(() => {
        Object.defineProperty(navigator, "clipboard", {
          value: {
            writeText: (value: string) =>
              (
                window as Window & {
                  captureCopiedText: (value: string) => Promise<void>;
                }
              ).captureCopiedText(value),
          },
        });
      });
      await dialog.getByRole("button", { name: "复制代码" }).first().click();
      await page.getByText("已复制到剪贴板", { exact: true }).waitFor();
      assert.equal(copied.length, 1);
      assert.equal(copied[0], "npx skills add bosens-China/ResumeFlow");
      assert.ok(
        await dialog
          .getByText(".cursor/mcp.json", { exact: true })
          .first()
          .isVisible(),
      );
      await dialog.getByRole("button", { name: "Claude", exact: true }).click();
      assert.ok(
        await dialog
          .getByText(".mcp.json", { exact: true })
          .first()
          .isVisible(),
      );
      await dialog.getByRole("button", { name: "Codex / 通用" }).click();
      assert.ok(
        await dialog
          .getByText("config.toml", { exact: true })
          .first()
          .isVisible(),
      );
      const overflow = await dialog.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      );
      assert.equal(overflow, false);
    } finally {
      await browser.close();
      await vite.close();
      backend.close();
      store.close();
    }
  },
);
