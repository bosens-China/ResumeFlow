import assert from "node:assert/strict";
import { test } from "vitest";
import { createApp } from "../app.ts";
import { createStore } from "../store.ts";

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

test("REST and MCP accept explicit rows and four cells", async () => {
  const store = createStore(":memory:");
  try {
    const app = createApp(store);
    const markdown =
      '::::row{columns="1fr auto"}\n:::cell\n岗位\n:::\n:::cell\n日期\n:::\n::::';
    const created = await app.request("/api/resumes", {
      method: "POST",
      headers: { Host: "localhost", "Content-Type": "application/json" },
      body: JSON.stringify({ title: "自动排版", markdown }),
    });
    assert.equal(created.status, 201);
    const resume = await created.json();
    const cells = Array.from(
      { length: 4 },
      (_, index) => `:::cell\n第${index}项\n:::`,
    ).join("\n\n");
    const updated = await rpc(app, "tools/call", {
      name: "update_resume",
      arguments: {
        id: resume.id,
        revision: resume.revision,
        markdown: `::::row\n${cells}\n::::`,
      },
    });
    assert.notEqual(updated.isError, true);
    assert.equal(store.get(resume.id)!.markdown, `::::row\n${cells}\n::::`);
  } finally {
    store.close();
  }
});

test("REST and MCP accept HTML and reject invalid HTML image URLs without writes", async () => {
  const store = createStore(":memory:");
  try {
    const app = createApp(store);
    const headers = { Host: "localhost", "Content-Type": "application/json" };
    const markdown =
      '# 简历\n\n<img src="https://example.com/photo.png" width="96">\n\n## 经历\n\n<span>内容</span>';
    const created = await app.request("/api/resumes", {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "HTML 简历", markdown }),
    });
    assert.equal(created.status, 201);
    const resume = await created.json();
    assert.equal(resume.markdown, markdown);
    const result = await rpc(app, "tools/call", {
      name: "update_resume",
      arguments: {
        id: resume.id,
        revision: resume.revision,
        markdown: markdown + "\n\n<strong>更新</strong>",
      },
    });
    assert.notEqual(result.isError, true);
    const saved = store.get(resume.id)!;
    const invalid = '<img src="/local-photo.png">';
    const rejected = await app.request(`/api/resumes/${resume.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ revision: saved.revision, markdown: invalid }),
    });
    assert.equal(rejected.status, 400);
    const mcpRejected = await rpc(app, "tools/call", {
      name: "update_resume",
      arguments: { id: resume.id, revision: saved.revision, markdown: invalid },
    });
    assert.equal(mcpRejected.isError, true);
    assert.deepEqual(store.get(resume.id), saved);
  } finally {
    store.close();
  }
});

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

test("REST and MCP require explicit content when switching to a new language", async () => {
  const store = createStore(":memory:");
  try {
    const app = createApp(store);
    const resume = store.create("中文", "# 中文");
    const headers = { Host: "localhost", "Content-Type": "application/json" };
    const update = (patch: Record<string, unknown>) =>
      app.request(`/api/resumes/${resume.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(patch),
      });
    const call = (patch: Record<string, unknown>) =>
      rpc(app, "tools/call", {
        name: "update_resume",
        arguments: { id: resume.id, ...patch },
      });

    for (const patch of [
      { revision: 1, currentLanguage: "fr", themeColor: "red" },
      {
        revision: 1,
        currentLanguage: "fr",
        language: "en",
        markdown: "# English",
      },
      { revision: 1, languages: { en: { markdown: "# English" } } },
      { revision: 1, currentLanguage: "constructor" },
    ]) {
      const response = await update(patch);
      assert.equal(response.status, 400);
      const result = await call(patch);
      assert.equal(result.isError, true);
      assert.deepEqual(store.get(resume.id), resume);
    }

    const empty = await update({
      revision: 1,
      currentLanguage: "fr",
      markdown: "",
    });
    assert.equal(empty.status, 200);
    assert.equal(store.get(resume.id)!.languages!.fr!.markdown, "");
    const copied = await call({
      revision: 2,
      currentLanguage: "en",
      language: "en",
      markdown: "# 中文",
    });
    assert.notEqual(copied.isError, true);
    assert.equal(store.get(resume.id)!.languages!.en!.markdown, "# 中文");
    const collection = await update({
      revision: 3,
      currentLanguage: "de",
      languages: { ...store.get(resume.id)!.languages, de: { markdown: "" } },
    });
    assert.equal(collection.status, 200);
    assert.equal(store.get(resume.id)!.currentLanguage, "de");
    const existing = await call({ revision: 4, currentLanguage: "fr" });
    assert.notEqual(existing.isError, true);
    assert.equal(store.get(resume.id)!.markdown, "");
    const restCopy = await update({
      revision: 5,
      currentLanguage: "es",
      markdown: "# 中文",
    });
    assert.equal(restCopy.status, 200);
    assert.equal(store.get(resume.id)!.markdown, "# 中文");
    const mcpEmpty = await call({
      revision: 6,
      currentLanguage: "ja",
      markdown: "",
    });
    assert.notEqual(mcpEmpty.isError, true);
    assert.equal(store.get(resume.id)!.markdown, "");
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

test("MCP discovery includes resume templates", async () => {
  const store = createStore(":memory:");
  try {
    const result = await rpc(createApp(store), "tools/list", {});
    assert.equal(result.tools.length, 12);
    assert.ok(
      result.tools.some((tool) => tool.name === "list_resume_templates"),
    );
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
    const invalidMcp = await call("create_resume", { customCss: invalidCss });
    assert.equal(invalidMcp.isError, true);
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
