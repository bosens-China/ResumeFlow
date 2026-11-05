import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import type { ResumeVersion } from "@resumeflow/shared";
import { createStore } from "./store.ts";
import { createApp } from "./app.ts";
import { closePdfBrowser } from "./pdf.ts";

test("snapshots survive reopen, preserve all languages and styles, and never change", () => {
  const dir = mkdtempSync(join(tmpdir(), "resumeflow-versions-"));
  const path = join(dir, "db.sqlite");
  let store = createStore(path);
  try {
    const original = store.create("初稿", "# 初稿", {
      languages: {
        zh: { title: "初稿", markdown: "# 初稿" },
        en: { markdown: "# Original" },
      },
      themeColor: "#2563eb",
      margin: "10mm",
      customCss: ".rf-p { color: red; }",
    });
    const result = store.createVersion(
      original.id,
      original.revision,
      "投递前",
    );
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    const snapshot = result.version;
    store.update(original.id, original.revision, {
      markdown: "# 最新草稿",
      themeColor: "#000000",
      languages: { zh: { title: "初稿", markdown: "# 最新草稿" } },
    });
    const head = store.get(original.id)!;
    assert.equal(store.listVersions(original.id).length, 1);
    assert.equal(
      store.restoreVersion(original.id, snapshot.id, original.revision).status,
      "conflict",
    );
    assert.equal(store.listVersions(original.id).length, 1);
    store.close();
    store = createStore(path);
    assert.deepEqual(store.getVersion(original.id, snapshot.id), snapshot);
    const restored = store.restoreVersion(
      original.id,
      snapshot.id,
      head.revision,
    );
    assert.equal(restored.status, "ok");
    if (restored.status !== "ok") return;
    assert.equal(restored.resume.markdown, "# 初稿");
    assert.equal(restored.resume.languages?.en?.markdown, "# Original");
    assert.equal(restored.resume.themeColor, original.themeColor);
    assert.equal(restored.resume.customCss, original.customCss);
    assert.equal(restored.resume.margin, original.margin);
    const archived = store
      .listVersions(original.id)
      .find((version) => version.id !== snapshot.id)!;
    assert.equal(archived.title, "恢复前的草稿");
    assert.deepEqual(store.getVersion(original.id, archived.id)!.resume, head);
    store.update(original.id, restored.resume.revision, {
      markdown: "# 分支修改",
    });
    assert.deepEqual(store.getVersion(original.id, snapshot.id), snapshot);
    assert.equal(
      store.getVersion(store.create("其他简历").id, snapshot.id),
      undefined,
    );
    store.delete(original.id, store.get(original.id)!.revision);
    assert.deepEqual(store.listVersions(original.id), []);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("failed restoration rolls back the automatic archive and leaves the draft intact", () => {
  const dir = mkdtempSync(join(tmpdir(), "resumeflow-rollback-"));
  const path = join(dir, "db.sqlite");
  const store = createStore(path);
  try {
    const resume = store.create("原稿", "# 原稿");
    const result = store.createVersion(resume.id, 1, "旧版本");
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    const connection = new DatabaseSync(path);
    connection.exec(
      "CREATE TRIGGER fail_restore BEFORE UPDATE ON resumes BEGIN SELECT RAISE(ABORT, 'restore failed'); END",
    );
    connection.close();
    assert.throws(
      () => store.restoreVersion(resume.id, result.version.id, 1),
      /restore failed/,
    );
    assert.deepEqual(store.get(resume.id), resume);
    assert.equal(store.listVersions(resume.id).length, 1);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("old databases upgrade and REST/MCP share immutable history and PDF exports", async () => {
  const dir = mkdtempSync(join(tmpdir(), "resumeflow-migration-"));
  const path = join(dir, "db.sqlite");
  const legacy = new DatabaseSync(path);
  legacy.exec(
    "CREATE TABLE resumes (id TEXT PRIMARY KEY, title TEXT NOT NULL, markdown TEXT NOT NULL, revision INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
  );
  legacy
    .prepare("INSERT INTO resumes VALUES (?, ?, ?, ?, ?, ?)")
    .run(
      "legacy-resume",
      "旧简历",
      "# 原有正文",
      1,
      "2026-11-01T00:00:00.000Z",
      "2026-11-01T00:00:00.000Z",
    );
  legacy.close();
  const store = createStore(path);
  assert.equal(store.get("legacy-resume")!.markdown, "# 原有正文");
  assert.equal(
    store.createVersion("legacy-resume", 1, "迁移后快照").status,
    "ok",
  );
  const app = createApp(store);
  const headers = { Host: "localhost", "Content-Type": "application/json" };
  async function mcp(name: string, args: Record<string, unknown>) {
    const response = await app.request("/mcp", {
      method: "POST",
      headers: { ...headers, Accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    });
    const line = (await response.text())
      .split("\n")
      .find((line) => line.startsWith("data: "))!;
    return JSON.parse(line.slice(6)).result as {
      isError?: boolean;
      content: { text: string }[];
    };
  }
  try {
    const resume = store.create("简历", "# 旧内容");
    const created = await app.request(`/api/resumes/${resume.id}/versions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ revision: 1, title: "发布版" }),
    });
    assert.equal(created.status, 201);
    const version = (await created.json()) as ResumeVersion;
    assert.equal(
      JSON.parse(
        (await mcp("list_resume_versions", { id: resume.id })).content[0]!.text,
      )[0].title,
      "发布版",
    );
    assert.deepEqual(
      JSON.parse(
        (
          await mcp("get_resume_version", {
            id: resume.id,
            versionId: version.id,
          })
        ).content[0]!.text,
      ),
      version,
    );
    assert.equal(
      (
        await mcp("create_resume_version", {
          id: resume.id,
          revision: 1,
          title: "另一标题",
        })
      ).isError,
      undefined,
    );
    store.update(resume.id, 1, { markdown: "# 新内容" });
    assert.equal(
      (
        await mcp("restore_resume_version", {
          id: resume.id,
          versionId: version.id,
          revision: 1,
        })
      ).isError,
      true,
    );
    assert.equal(
      (
        await app.request(`/api/resumes/${resume.id}/versions`, {
          method: "POST",
          headers,
          body: JSON.stringify({ revision: 2, title: " " }),
        })
      ).status,
      400,
    );
    const link = JSON.parse(
      (await mcp("export_resume_pdf", { id: resume.id, versionId: version.id }))
        .content[0]!.text,
    ) as { url: string };
    assert.ok(link.url.includes(`versionId=${version.id}`));
    const pdf = await app.request(link.url, { headers: { Host: "localhost" } });
    assert.equal(pdf.status, 200);
    assert.equal(
      new TextDecoder().decode((await pdf.arrayBuffer()).slice(0, 5)),
      "%PDF-",
    );
    assert.equal(
      (
        await mcp("restore_resume_version", {
          id: resume.id,
          versionId: version.id,
          revision: 2,
        })
      ).isError,
      undefined,
    );
    assert.equal(store.get(resume.id)!.markdown, "# 旧内容");
    assert.deepEqual(store.getVersion(resume.id, version.id), version);
  } finally {
    store.close();
    await closePdfBrowser();
    rmSync(dir, { recursive: true, force: true });
  }
});
