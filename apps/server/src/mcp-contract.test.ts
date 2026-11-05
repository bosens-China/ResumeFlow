import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "./app.ts";
import { createStore } from "./store.ts";

async function rpc(
  app: ReturnType<typeof createApp>,
  method: string,
  params: Record<string, unknown>,
  origin = "http://localhost:18080",
) {
  const response = await app.request(`${origin}/mcp`, {
    method: "POST",
    headers: {
      Host: new URL(origin).host,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  assert.equal(response.status, 200);
  const line = (await response.text())
    .split("\n")
    .find((item) => item.startsWith("data: "));
  assert.ok(line);
  return JSON.parse(line.slice(6)).result as {
    isError?: boolean;
    content: { text: string }[];
    tools: {
      name: string;
      inputSchema: { properties: Record<string, { description?: string }> };
    }[];
  };
}

test("REST and MCP reject empty updates and missing export languages without writes", async () => {
  const store = createStore(":memory:");
  try {
    const app = createApp(store);
    const resume = store.create("中文", "# 中文");
    const call = (name: string, args: Record<string, unknown>) =>
      rpc(app, "tools/call", { name, arguments: args });
    const headers = { Host: "localhost", "Content-Type": "application/json" };
    const empty = await app.request(`/api/resumes/${resume.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ revision: 1 }),
    });
    assert.equal(empty.status, 400);
    assert.match(await empty.text(), /缺少修改字段/);
    assert.equal(
      (await call("update_resume", { id: resume.id, revision: 1 })).isError,
      true,
    );
    const exportArgs = { id: resume.id, language: "fr" };
    assert.equal((await call("export_resume_pdf", exportArgs)).isError, true);
    const missingLanguage = await app.request(
      `/api/resumes/${resume.id}/pdf?lang=fr`,
      { headers: { Host: "localhost" } },
    );
    assert.equal(missingLanguage.status, 400);
    assert.match(await missingLanguage.text(), /语言版本不存在/);
    for (const language of ["constructor", "__proto__"])
      assert.equal(
        (await call("export_resume_pdf", { id: resume.id, language })).isError,
        true,
      );
    assert.deepEqual(store.get(resume.id), resume);

    const updated = await call("update_resume", {
      id: resume.id,
      revision: 1,
      language: "en",
      title: "English",
      markdown: "# English",
    });
    assert.equal(updated.isError, undefined);
    const current = store.get(resume.id)!;
    assert.equal(current.markdown, "# 中文");
    assert.equal(current.languages?.en?.markdown, "# English");
    const stale = await app.request(`/api/resumes/${resume.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ revision: 1, title: "过期" }),
    });
    assert.equal(stale.status, 409);
    assert.deepEqual(
      (await stale.json()).current,
      JSON.parse(JSON.stringify(current)),
    );
    const conflict = await call("delete_resume", {
      id: resume.id,
      revision: 1,
    });
    assert.equal(conflict.isError, true);
    assert.match(conflict.content[0]!.text, /版本冲突/);
    assert.deepEqual(store.get(resume.id), current);

    const missing = "00000000-0000-4000-8000-000000000000";
    const notFound = await app.request(`/api/resumes/${missing}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ revision: 1, title: "不存在" }),
    });
    assert.equal(notFound.status, 404);
    assert.equal(
      (
        await call("update_resume", {
          id: missing,
          revision: 1,
          title: "不存在",
        })
      ).isError,
      true,
    );
  } finally {
    store.close();
  }
});

test("MCP download links follow the external request port and an explicit public URL", async () => {
  const original = process.env.RESUMEFLOW_PUBLIC_URL;
  delete process.env.RESUMEFLOW_PUBLIC_URL;
  const store = createStore(":memory:");
  try {
    const app = createApp(store);
    const resume = store.create("端口测试", "# 简历");
    const args = { name: "export_resume_pdf", arguments: { id: resume.id } };
    for (const origin of ["http://localhost:18080", "http://127.0.0.1:24567"]) {
      const result = await rpc(app, "tools/call", args, origin);
      assert.equal(result.isError, undefined);
      const { url } = JSON.parse(result.content[0]!.text) as { url: string };
      assert.equal(new URL(url).origin, origin);
      assert.equal(new URL(url).searchParams.get("revision"), "1");
    }
    process.env.RESUMEFLOW_PUBLIC_URL = "https://resumes.example.com/tools/";
    const result = await rpc(app, "tools/call", args);
    const { url } = JSON.parse(result.content[0]!.text) as { url: string };
    assert.equal(new URL(url).origin, "https://resumes.example.com");
    assert.equal(new URL(url).pathname, `/tools/api/resumes/${resume.id}/pdf`);
  } finally {
    store.close();
    if (original === undefined) delete process.env.RESUMEFLOW_PUBLIC_URL;
    else process.env.RESUMEFLOW_PUBLIC_URL = original;
  }
});

test("MCP discovery includes language replacement and revision instructions", async () => {
  const store = createStore(":memory:");
  try {
    const result = await rpc(createApp(store), "tools/list", {});
    assert.equal(result.tools.length, 11);
    const properties = result.tools.find(
      (tool) => tool.name === "update_resume",
    )!.inputSchema.properties;
    assert.match(properties.languages!.description!, /整体替换/);
    assert.match(properties.language!.description!, /不切换/);
    assert.match(properties.currentLanguage!.description!, /切换/);
    assert.match(properties.revision!.description!, /冲突/);
  } finally {
    store.close();
  }
});

test("REST and MCP reject invalid CSS without saving any part of the request", async () => {
  const store = createStore(":memory:");
  const events: unknown[] = [];
  store.subscribe((event) => events.push(event));
  const app = createApp(store);
  const headers = { Host: "localhost", "Content-Type": "application/json" };
  const call = (name: string, args: Record<string, unknown>) =>
    rpc(app, "tools/call", { name, arguments: args });
  const invalidCss = ".rf-h2 {";
  const validCss = "@page { margin: 10mm; }\n.rf-p { color: red; }";
  try {
    const invalidCreate = await app.request("/api/resumes", {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "无效", customCss: invalidCss }),
    });
    assert.equal(invalidCreate.status, 400);
    assert.match((await invalidCreate.json()).error, /CSS 语法错误.*第 1 行/);
    const invalidMcp = await call("create_resume", { customCss: invalidCss });
    assert.equal(invalidMcp.isError, true);
    assert.match(invalidMcp.content[0]!.text, /CSS 语法错误.*第 1 行/);
    assert.equal(store.list().length, 0);
    assert.equal(events.length, 0);

    const created = await call("create_resume", {
      title: "有效",
      customCss: validCss,
    });
    assert.equal(created.isError, undefined);
    const resume = store.get(store.list()[0]!.id)!;
    assert.equal(resume.customCss, validCss);
    const patch = {
      revision: resume.revision,
      title: "不应写入",
      markdown: "# 不应写入",
      customCss: invalidCss,
    };
    const invalidUpdate = await app.request(`/api/resumes/${resume.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(patch),
    });
    assert.equal(invalidUpdate.status, 400);
    const updateMcp = await call("update_resume", { id: resume.id, ...patch });
    assert.equal(updateMcp.isError, true);
    assert.match(updateMcp.content[0]!.text, /CSS 语法错误.*第 1 行/);
    assert.deepEqual(store.get(resume.id), resume);
    assert.equal(events.length, 1);

    const titleOnly = await app.request(`/api/resumes/${resume.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ revision: resume.revision, title: "仅改标题" }),
    });
    assert.equal(titleOnly.status, 200);
    const current = store.get(resume.id)!;
    assert.equal(current.customCss, validCss);
    const cleared = await call("update_resume", {
      id: resume.id,
      revision: current.revision,
      customCss: "",
    });
    assert.equal(cleared.isError, undefined);
    assert.equal(store.get(resume.id)!.customCss, undefined);
  } finally {
    store.close();
  }
});
