import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "./app.ts";
import { InvalidMarkdownError, renderMarkdown } from "./markdown.ts";
import { closePdfBrowser, resumePdf } from "./pdf.ts";
import { createStore } from "./store.ts";

test("SQLite survives reopen and rejects stale revisions", () => {
  const dir = mkdtempSync(join(tmpdir(), "resumeflow-"));
  const path = join(dir, "resumes.sqlite");
  try {
    let store = createStore(path);
    const created = store.create("初始名称", "# 简历");
    assert.equal(store.update(created.id, 1, { title: "新名称" }).status, "ok");
    assert.equal(
      store.update(created.id, 1, { markdown: "# 旧内容" }).status,
      "conflict",
    );
    store.close();

    store = createStore(path);
    assert.deepEqual(store.get(created.id), {
      ...created,
      title: "新名称",
      revision: 2,
      updatedAt: store.get(created.id)!.updatedAt,
    });
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("layout directives render as safe HTML and reject unsupported syntax", () => {
  const html = renderMarkdown(
    "::::row\n:::cell\n**左**\n:::\n:::cell\n右\n:::\n::::",
  );
  assert.match(html, /rf-row-2/);
  assert.match(html, /<strong>左<\/strong>/);
  assert.match(html, /rf-cell/);
  assert.throws(
    () => renderMarkdown(":::unknown\n文字\n:::"),
    InvalidMarkdownError,
  );
  assert.doesNotMatch(renderMarkdown("<script>alert(1)</script>"), /<script>/);
});

test("REST and MCP share committed resume state", async () => {
  const store = createStore(":memory:");
  try {
    const app = createApp(store);
    const createdResponse = await app.request("http://localhost/api/resumes", {
      method: "POST",
      headers: { Host: "localhost", "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()) as {
      id: string;
      revision: number;
    };

    const mcpResponse = await app.request("http://localhost/mcp", {
      method: "POST",
      headers: {
        Host: "localhost",
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "update_resume",
          arguments: {
            id: created.id,
            revision: created.revision,
            markdown: "# Agent 修改",
          },
        },
      }),
    });
    assert.equal(mcpResponse.status, 200);
    assert.match(await mcpResponse.text(), /Agent 修改/);

    const readResponse = await app.request(
      `http://localhost/api/resumes/${created.id}`,
      { headers: { Host: "localhost" } },
    );
    assert.equal(
      ((await readResponse.json()) as { markdown: string }).markdown,
      "# Agent 修改",
    );

    const staleResponse = await app.request(
      `http://localhost/api/resumes/${created.id}`,
      {
        method: "PATCH",
        headers: { Host: "localhost", "Content-Type": "application/json" },
        body: JSON.stringify({ revision: created.revision, title: "过期修改" }),
      },
    );
    assert.equal(staleResponse.status, 409);

    const invalidResponse = await app.request("http://localhost/api/resumes", {
      method: "POST",
      headers: { Host: "localhost", "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: ":::unknown\n文字\n:::" }),
    });
    assert.equal(invalidResponse.status, 400);
    assert.equal(store.list().length, 1);

    const duplicate = await app.request(
      `http://localhost/api/resumes/${created.id}/duplicate`,
      {
        method: "POST",
        headers: { Host: "localhost" },
      },
    );
    assert.equal(duplicate.status, 201);
    const copy = (await duplicate.json()) as {
      id: string;
      revision: number;
      markdown: string;
    };
    assert.equal(copy.markdown, "# Agent 修改");
    const deleted = await app.request(
      `http://localhost/api/resumes/${copy.id}?revision=${copy.revision}`,
      {
        method: "DELETE",
        headers: { Host: "localhost" },
      },
    );
    assert.equal(deleted.status, 204);
    assert.equal(store.list().length, 1);
  } finally {
    store.close();
  }
});

test("SSE reports committed changes", async () => {
  const store = createStore(":memory:");
  const controller = new AbortController();
  try {
    const response = await createApp(store).request(
      "http://localhost/api/events",
      {
        headers: { Host: "localhost" },
        signal: controller.signal,
      },
    );
    assert.equal(response.status, 200);
    const reader = response.body!.getReader();
    assert.match(
      new TextDecoder().decode((await reader.read()).value),
      /event: ready/,
    );
    const resume = store.create("更新通知", "");
    const event = new TextDecoder().decode((await reader.read()).value);
    assert.match(event, /event: resume-changed/);
    assert.match(event, new RegExp(resume.id));
  } finally {
    controller.abort();
    store.close();
  }
});

test("PDF endpoint returns a real PDF for the saved revision", async () => {
  const store = createStore(":memory:");
  try {
    const resume = store.create("PDF 测试", "# 测试简历");
    const response = await createApp(store).request(
      `http://localhost/api/resumes/${resume.id}/pdf?revision=1`,
      { headers: { Host: "localhost" } },
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/pdf");
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");

    const markdown =
      "# 多页测试\n\n" +
      Array.from(
        { length: 70 },
        (_, i) =>
          `- 项目 ${i + 1}：负责系统设计、实现和上线；优化接口性能与用户体验，完成跨团队协作。`,
      ).join("\n");
    const long = store.create("多页", markdown);
    const longResponse = await createApp(store).request(
      `http://localhost/api/resumes/${long.id}/pdf`,
      { headers: { Host: "localhost" } },
    );
    const pdf = Buffer.from(await longResponse.arrayBuffer());
    assert.equal(longResponse.status, 200);
    assert.ok(
      (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length >= 2,
    );
  } finally {
    store.close();
    await closePdfBrowser();
  }
});

test("PDF includes same-origin images and rejects private remote addresses", async () => {
  const baseUrl = "http://127.0.0.1:10127";
  const store = createStore(":memory:");
  try {
    const pdf = await resumePdf(
      store.create("图片测试", "![图标](/favicon.svg)"),
      baseUrl,
    );
    assert.equal(pdf.toString("latin1", 0, 5), "%PDF-");
    await assert.rejects(
      () =>
        resumePdf(
          store.create("禁止私网", "![头像](http://127.0.0.1:9999/image.png)"),
          baseUrl,
        ),
      /图片地址不允许访问/,
    );
  } finally {
    store.close();
    await closePdfBrowser();
  }
});
