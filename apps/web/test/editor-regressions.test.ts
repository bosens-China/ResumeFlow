import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "vitest";
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
  "language drafts survive pending saves and destructive menu operations",
  { timeout: 60_000 },
  async () => {
    const store = createStore(":memory:");
    const resume = store.create("中文", "# 中文", {
      languages: {
        zh: { title: "中文", markdown: "# 中文" },
        en: { title: "English", markdown: "# English" },
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
        port: 0,
        proxy: { "/api": `http://127.0.0.1:${address.port}` },
      },
    });
    await vite.listen();
    const browser = await chromium.launch({ headless: true });
    let release = () => {};
    try {
      const page = await browser.newPage();
      await page.route("**/api/events", (route) => route.abort());
      await page.goto(`${vite.resolvedUrls!.local[0]}resumes/${resume.id}`);
      await page.getByRole("button", { name: "展开工具栏" }).click();
      const editor = page.getByRole("textbox", { name: "Markdown 编辑器" });
      await editor.waitFor();
      let gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let blockNext = true;
      await page.route("**/api/resumes/*", async (route) => {
        if (route.request().method() === "PATCH" && blockNext) {
          blockNext = false;
          await gate;
        }
        await route.continue();
      });
      const started = page.waitForRequest(
        (request) => request.method() === "PATCH",
      );
      await editor.fill("# 第一次修改");
      await started;
      await editor.fill("# 请求发出后的修改");
      await page.getByRole("button", { name: "切换简历语言版本" }).click();
      await page.getByRole("menu").getByText("英语", { exact: true }).click();
      assert.equal(await editor.inputValue(), "# English");
      release();
      await page.getByText("已保存", { exact: true }).waitFor();
      assert.equal(
        store.get(resume.id)!.languages?.zh?.markdown,
        "# 请求发出后的修改",
      );

      await page.getByRole("button", { name: "切换简历语言版本" }).click();
      await page.getByRole("menuitem", { name: "添加语言版本…" }).click();
      await page
        .getByPlaceholder("例如: en, en-US, zh-HK, ru, fr-CA")
        .fill("ZH");
      await page
        .getByRole("alert")
        .filter({ hasText: "该语言版本已存在" })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "添加语言", exact: true })
          .isEnabled(),
        false,
      );
      await page.getByRole("button", { name: "取消", exact: true }).click();

      gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      blockNext = true;
      const deletionStarted = page.waitForRequest(
        (request) => request.method() === "PATCH",
      );
      await editor.fill("# 未保存的英文");
      await deletionStarted;
      await page.getByRole("button", { name: "切换简历语言版本" }).click();
      await page
        .getByRole("button", { name: "删除 zh 语言版本" })
        .click({ force: true });
      await page.getByRole("alertdialog").waitFor();
      assert.ok(store.get(resume.id)!.languages?.zh);
      await page.getByRole("button", { name: "确认删除", exact: true }).click();
      assert.equal(await editor.inputValue(), "# 未保存的英文");
      release();
      await page.waitForFunction(async (id) => {
        const response = await fetch(`/api/resumes/${id}`);
        const saved = await response.json();
        return !saved.languages.zh;
      }, resume.id);
      assert.equal(store.get(resume.id)!.languages?.zh, undefined);
      assert.equal(
        store.get(resume.id)!.languages?.en?.markdown,
        "# 未保存的英文",
      );

      const layout = store.create(
        "排版",
        "# 简历\n\n第一行  \n第二行\n\n| 默认 | 居中列 | 右列 |\n| --- | :---: | ---: |\n| A | B | C |\n\n:::center\n# 居中标题\n\n居中说明\n\n| 表头 |\n| --- |\n| 内容 |\n:::\n\n::::row\n:::cell\n岗位\n:::\n:::cell\n日期\n:::\n::::\n\n:::left\n左对齐\n:::\n\n:::right\n右对齐\n\n| 表头 |\n| --- |\n| 内容 |\n:::",
        {
          customCss:
            "/* </style><script>window.injected = true</script><style> */",
        },
      );
      await page.goto(`${vite.resolvedUrls!.local[0]}resumes/${layout.id}`);
      await page
        .getByRole("button", { name: "导出 PDF", exact: true })
        .waitFor();
      await page.waitForFunction(() =>
        [...document.querySelectorAll("button")].some(
          (button) =>
            button.textContent?.includes("导出 PDF") && !button.disabled,
        ),
      );
      const iframe = await page
        .locator('iframe[aria-hidden="false"]')
        .elementHandle();
      const frame = await iframe!.contentFrame();
      assert.ok(frame);
      assert.equal(await frame.locator(".rf-left").count(), 1);
      assert.equal(await frame.locator(".rf-right").count(), 1);
      assert.equal(await frame.locator(".rf-p br").count(), 1);
      const alignment = await frame.evaluate(() => {
        const left = document.querySelector(".rf-left")!;
        const right = document.querySelector(".rf-right")!;
        const cells = document.querySelectorAll(".rf-row .rf-cell");
        return {
          header: getComputedStyle(document.querySelector("h1 + p")!).textAlign,
          title: getComputedStyle(document.querySelector("h1")!).textAlign,
          center: getComputedStyle(document.querySelector(".rf-center")!)
            .textAlign,
          centeredTitle: getComputedStyle(
            document.querySelector(".rf-center h1")!,
          ).textAlign,
          leftTop: cells[0]!.getBoundingClientRect().top,
          rightTop: cells[1]!.getBoundingClientRect().top,
          left: getComputedStyle(left).textAlign,
          right: getComputedStyle(right).textAlign,
          defaultTable: getComputedStyle(document.querySelector("table th")!)
            .textAlign,
          centerTable: getComputedStyle(
            document.querySelector(".rf-center th")!,
          ).textAlign,
          rightTable: getComputedStyle(document.querySelector(".rf-right td")!)
            .textAlign,
          columnAlignments: [
            ...document.querySelectorAll("table:first-of-type th[align]"),
          ].map((cell) =>
            getComputedStyle(cell).textAlign.replace(/^-webkit-/, ""),
          ),
        };
      });
      assert.notEqual(alignment.header, "center");
      assert.notEqual(alignment.title, "center");
      assert.equal(alignment.center, "center");
      assert.equal(alignment.centeredTitle, "center");
      assert.equal(alignment.left, "left");
      assert.equal(alignment.right, "right");
      assert.ok(["left", "start"].includes(alignment.defaultTable));
      assert.equal(alignment.centerTable, "center");
      assert.equal(alignment.rightTable, "right");
      assert.deepEqual(alignment.columnAlignments, ["center", "right"]);
      assert.ok(Math.abs(alignment.leftTop - alignment.rightTop) <= 1);
      const bounds = await frame.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        height: document.documentElement.clientHeight,
        scrollHeight: document.documentElement.scrollHeight,
        injected: (window as typeof window & { injected?: boolean }).injected,
      }));
      assert.equal(bounds.injected, undefined);
      assert.equal(bounds.width, bounds.scrollWidth);
      assert.ok(bounds.scrollHeight <= bounds.height + 1);
      const downloadStarted = page.waitForEvent("download");
      await page.getByRole("button", { name: "导出 PDF", exact: true }).click();
      const download = await downloadStarted;
      assert.equal(download.suggestedFilename(), "排版.pdf");
    } finally {
      release();
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
