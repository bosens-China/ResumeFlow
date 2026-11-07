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
  "history viewing preserves the draft and editing restores it before saving and exporting",
  { timeout: 60000 },
  async () => {
    const store = createStore(":memory:");
    const resume = store.create("简历", "# 初稿", {
      themeColor: "#2563eb",
      languages: {
        zh: { title: "简历", markdown: "# 初稿" },
        en: { markdown: "# English" },
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
    try {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
      });
      await page.goto(`${vite.resolvedUrls!.local[0]}resumes/${resume.id}`);
      const editor = page.getByRole("textbox", { name: "Markdown 编辑器" });
      await editor.waitFor();

      const saveButton = page.getByRole("button", {
        name: "保存并发布版本 (⌘S)",
      });
      const versionsButton = page.getByRole("button", {
        name: "查看简历历史版本记录",
      });

      // 1. 初始状态：无修改，保存按钮 disabled
      assert.ok(await saveButton.isDisabled());
      assert.equal(store.listVersions(resume.id).length, 0);

      // 2. 修改内容，保存按钮高亮激活
      await editor.fill("# 第一阶段内容");
      assert.ok(!(await saveButton.isDisabled()));

      // 点击保存 -> 相当于发布版本，存入版本记录中
      await saveButton.click();
      await page.waitForTimeout(500);
      assert.equal(store.listVersions(resume.id).length, 1);
      const v1 = store.listVersions(resume.id)[0]!;
      assert.equal(v1.title, "版本 1");
      assert.equal(
        store.getVersion(resume.id, v1.id)!.resume.markdown,
        "# 第一阶段内容",
      );

      // 3. 重复点击保存：内容没变化跳过，不会出现新版本记录
      assert.ok(await saveButton.isDisabled());
      assert.equal(store.listVersions(resume.id).length, 1);

      // 4. 再次修改内容，保存发布版本 2
      await editor.fill("# 第二阶段内容（最新）");
      assert.ok(!(await saveButton.isDisabled()));
      await saveButton.click();
      await page.waitForTimeout(500);
      assert.equal(store.listVersions(resume.id).length, 2);
      const v2 = store.listVersions(resume.id)[0]!;
      assert.equal(v2.title, "版本 2");

      // 查看快照不会覆盖当前草稿，也不会生成归档。
      await versionsButton.click();
      await page.getByRole("menuitem").filter({ hasText: "版本 1" }).click();
      await page.waitForTimeout(300);

      // 编辑器内容切换到版本 1
      assert.equal(await editor.innerText(), "# 第一阶段内容");
      assert.equal(store.get(resume.id)!.markdown, "# 第二阶段内容（最新）");
      assert.equal(store.listVersions(resume.id).length, 2);

      const exportButton = page.getByRole("button", {
        name: "导出当前语言 PDF，悬停可选择其他语言",
        exact: true,
      });
      const snapshotRequest = page.waitForRequest((request) =>
        request.url().includes("/pdf?"),
      );
      const snapshotDownload = page.waitForEvent("download");
      await exportButton.click();
      assert.equal(
        new URL((await snapshotRequest).url()).searchParams.get("versionId"),
        v1.id,
      );
      await snapshotDownload;
      assert.equal(store.get(resume.id)!.markdown, "# 第二阶段内容（最新）");

      // 第一次编辑会归档当前草稿，再以新 revision 保存，不出现冲突。
      const savedEdit = page.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          response.url().endsWith(`/api/resumes/${resume.id}`),
      );
      await editor.fill("# 从历史继续编辑");
      assert.equal((await savedEdit).status(), 200);
      assert.equal(store.get(resume.id)!.markdown, "# 从历史继续编辑");
      const archive = store
        .listVersions(resume.id)
        .find((version) => version.title === "恢复前的草稿");
      assert.ok(archive);
      assert.equal(
        store.getVersion(resume.id, archive.id)!.resume.markdown,
        "# 第二阶段内容（最新）",
      );
      assert.equal(
        store.getVersion(resume.id, v1.id)!.resume.markdown,
        "# 第一阶段内容",
      );
      assert.equal(store.listVersions(resume.id).length, 3);
      assert.equal(
        await page
          .getByText(
            "Agent 或其他页面修改了这份简历。你的输入仍保留在编辑器中。",
          )
          .count(),
        0,
      );

      const draftRequest = page.waitForRequest((request) =>
        request.url().includes("/pdf?"),
      );
      const draftDownload = page.waitForEvent("download");
      await exportButton.click();
      const draftUrl = new URL((await draftRequest).url());
      assert.equal(draftUrl.searchParams.get("versionId"), null);
      assert.equal(
        draftUrl.searchParams.get("revision"),
        String(store.get(resume.id)!.revision),
      );
      await draftDownload;

      // 6. 若修改了内容但未保存，点击切换版本时提示确认
      await editor.fill("# 未保存的临时修改");
      await versionsButton.click();
      await page.getByRole("menuitem").filter({ hasText: "版本 2" }).click();

      // 弹出提示对话框
      await page.getByText("当前有未保存的修改").waitFor();
      // 选择放弃并切换
      await page.getByRole("button", { name: "放弃修改并切换" }).click();
      await page.waitForTimeout(300);

      // 编辑器成功切换为版本 2 的内容
      assert.equal(await editor.innerText(), "# 第二阶段内容（最新）");
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

test(
  "failed publication can be retried and edits made during publication stay unpublished",
  { timeout: 60000 },
  async () => {
    const store = createStore(":memory:");
    const resume = store.create("原名称", "# 初稿");
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
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
      });
      await page.goto(`${vite.resolvedUrls!.local[0]}resumes/${resume.id}`);
      const editor = page.getByRole("textbox", { name: "Markdown 编辑器" });
      const saveButton = page.getByRole("button", {
        name: "保存并发布版本 (⌘S)",
      });
      const versionUrl = `**/api/resumes/${resume.id}/versions`;
      await editor.fill("# 发布的正文");
      await page.route(versionUrl, async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "模拟快照写入失败" }),
          });
        } else await route.continue();
      });
      await saveButton.click();
      await page.getByText("模拟快照写入失败", { exact: true }).waitFor();
      await page.waitForFunction(
        () =>
          !document.querySelector<HTMLButtonElement>(
            '[aria-label="保存并发布版本 (⌘S)"]',
          )!.disabled,
      );
      assert.equal(store.listVersions(resume.id).length, 0);
      assert.equal(await editor.innerText(), "# 发布的正文");

      await page.unroute(versionUrl);
      await saveButton.click();
      await page.waitForFunction(
        async (id) =>
          (await (await fetch(`/api/resumes/${id}/versions`)).json()).length ===
          1,
        resume.id,
      );
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLButtonElement>(
            '[aria-label="保存并发布版本 (⌘S)"]',
          )!.disabled,
      );

      let committedSnapshot = () => {};
      const started = new Promise<void>((resolve) => {
        committedSnapshot = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route(versionUrl, async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        const response = await route.fetch();
        committedSnapshot();
        await gate;
        await route.fulfill({ response });
      });
      await editor.fill("# 第二次发布");
      await saveButton.click();
      await started;
      const title = page.getByPlaceholder("请输入简历名称");
      await title.fill("发布期间的新名称");
      await title.blur();
      await page.waitForFunction(
        async (id) =>
          (await (await fetch(`/api/resumes/${id}`)).json()).title ===
          "发布期间的新名称",
        resume.id,
      );
      release();
      await page.waitForFunction(
        () =>
          !document.querySelector<HTMLButtonElement>(
            '[aria-label="保存并发布版本 (⌘S)"]',
          )!.disabled,
      );
      const version = store.listVersions(resume.id)[0]!;
      assert.equal(
        store.getVersion(resume.id, version.id)!.resume.title,
        "原名称",
      );
      assert.equal(store.get(resume.id)!.title, "发布期间的新名称");

      await page.unroute(versionUrl);
      await saveButton.click();
      await page.waitForFunction(
        async (id) =>
          (await (await fetch(`/api/resumes/${id}/versions`)).json()).length ===
          3,
        resume.id,
      );
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLButtonElement>(
            '[aria-label="保存并发布版本 (⌘S)"]',
          )!.disabled,
      );
      assert.equal(
        store.getVersion(resume.id, store.listVersions(resume.id)[0]!.id)!
          .resume.title,
        "发布期间的新名称",
      );
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
