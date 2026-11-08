import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import { createApp } from "../app.ts";
import { createStore } from "../store.ts";
import { backupZip, exportBackup } from "../backup.ts";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

test("Markdown archive contains all languages and rejects a single language", async () => {
  const store = createStore(":memory:");
  const app = createApp(store);
  try {
    const single = store.create("单语言", "# 中文");
    assert.equal(
      (
        await app.request(
          `http://localhost/api/resumes/${single.id}/markdown-all`,
          { headers: { Host: "localhost" } },
        )
      ).status,
      400,
    );
    const multi = store.create("多语言", "# 中文", {
      languages: {
        zh: { title: "中文", markdown: "# 中文" },
        en: { title: "English", markdown: "# English" },
      },
    });
    const res = await app.request(
      `http://localhost/api/resumes/${multi.id}/markdown-all`,
      { headers: { Host: "localhost" } },
    );
    assert.equal(res.status, 200);
    const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
    assert.equal(strFromU8(files["zh.md"]!), "# 中文");
    assert.equal(strFromU8(files["en.md"]!), "# English");
  } finally {
    store.close();
  }
});

test("Markdown export API returns text/markdown and respects language and versions", async () => {
  const store = createStore(":memory:");
  const app = createApp(store);
  try {
    const resume = store.create("张三简历", "# 中文简历内容", {
      languages: {
        zh: { title: "张三简历", markdown: "# 中文简历内容" },
        en: {
          title: "Resume of Zhang San",
          markdown: "# English Resume Content",
        },
      },
    });

    // 默认当前语言 (zh)
    const resZh = await app.request(
      `http://localhost/api/resumes/${resume.id}/markdown?download=1`,
      { headers: { Host: "localhost" } },
    );
    assert.equal(resZh.status, 200);
    assert.equal(
      resZh.headers.get("content-type"),
      "text/markdown; charset=utf-8",
    );
    assert.ok(
      resZh.headers
        .get("content-disposition")
        ?.includes(encodeURIComponent("张三简历.md")),
    );
    assert.equal(await resZh.text(), "# 中文简历内容");

    // 指定 en 语言
    const resEn = await app.request(
      `http://localhost/api/resumes/${resume.id}/markdown?lang=en&download=1`,
      { headers: { Host: "localhost" } },
    );
    assert.equal(resEn.status, 200);
    assert.ok(
      resEn.headers
        .get("content-disposition")
        ?.includes(encodeURIComponent("Resume of Zhang San_en.md")),
    );
    assert.equal(await resEn.text(), "# English Resume Content");

    // 保存版本快照并修改草稿，测试快照导出
    const versionRes = store.createVersion(resume.id, 1, "投递前快照");
    assert.equal(versionRes.status, "ok");
    const versionId = (versionRes as { version: { id: string } }).version.id;

    store.update(resume.id, 1, { markdown: "# 修改后的草稿" });

    const resSnapshot = await app.request(
      `http://localhost/api/resumes/${resume.id}/markdown?versionId=${versionId}`,
      { headers: { Host: "localhost" } },
    );
    assert.equal(resSnapshot.status, 200);
    assert.equal(await resSnapshot.text(), "# 中文简历内容");
  } finally {
    store.close();
  }
});

test("ZIP backup restores full data and handles each conflict atomically", async () => {
  const store = createStore(":memory:");
  const app = createApp(store);
  const headers = { Host: "localhost", "Content-Type": "application/json" };
  const post = (path: string, body: unknown) =>
    app.request(`http://localhost${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  try {
    const first = store.create("中文简历", "# 原稿", {
      languages: {
        zh: { title: "中文简历", markdown: "# 原稿", font: "inter" },
        en: { title: "English", markdown: "# Original" },
      },
      customCss: "p { color: red; }",
      themeColor: "#123456",
    });
    const second = store.create("第二份", "# 第二份");
    store.createVersion(first.id, first.revision, "历史");
    const exported = await app.request(`http://localhost/api/backup`, {
      headers: { Host: "localhost" },
    });
    assert.equal(exported.status, 200);
    assert.equal(exported.headers.get("content-type"), "application/zip");
    const bytes = new Uint8Array(await exported.arrayBuffer());
    const files = unzipSync(bytes);
    assert.ok(files["backup.json"]);
    assert.ok(Object.keys(files).some((key) => key.endsWith("/en.md")));
    const archive = Buffer.from(bytes).toString("base64");
    const target = createStore(":memory:");
    try {
      const targetApp = createApp(target);
      const restored = await targetApp.request(
        "http://localhost/api/backup/restore",
        {
          method: "POST",
          headers,
          body: JSON.stringify({ archive, decisions: [] }),
        },
      );
      assert.equal(restored.status, 200);
      assert.equal(target.get(first.id)?.languages?.en?.markdown, "# Original");
      assert.equal(target.get(first.id)?.languages?.zh?.font, "inter");
      assert.equal(
        target.listVersions(first.id)[0]?.id,
        store.listVersions(first.id)[0]?.id,
      );
    } finally {
      target.close();
    }
    const corrupted = JSON.parse(strFromU8(files["backup.json"]!));
    delete corrupted.resumes.find(
      (item: { versions: unknown[] }) => item.versions.length,
    ).versions[0].resume;
    const invalidJson = strToU8(JSON.stringify(corrupted));
    const invalid = Buffer.from(
      zipSync({
        "backup.json": invalidJson,
        "backup.sha256": strToU8(
          createHash("sha256").update(invalidJson).digest("hex"),
        ),
      }),
    ).toString("base64");
    assert.equal(
      (await post("/api/backup/restore", { archive: invalid, decisions: [] }))
        .status,
      400,
    );
    assert.equal(store.list().length, 2);
    const one = await app.request(
      `http://localhost/api/backup?id=${first.id}`,
      { headers: { Host: "localhost" } },
    );
    assert.equal(one.status, 200);
    assert.ok(
      one.headers
        .get("content-disposition")
        ?.includes(encodeURIComponent("中文简历_backup.zip")),
    );
    store.update(first.id, first.revision, { markdown: "# 修改" });
    const inspection = await post("/api/backup/inspect", { archive });
    const { conflicts } = (await inspection.json()) as {
      conflicts: { id: string; token: string }[];
    };
    assert.equal(conflicts.length, 2);
    const decisions = conflicts.map((c) => ({
      ...c,
      action: c.id === first.id ? "overwrite" : "copy",
    }));
    assert.equal(
      (await post("/api/backup/restore", { archive, decisions: [] })).status,
      409,
    );
    assert.equal(store.list().length, 2);
    store.createVersion(second.id, second.revision, "确认后新增");
    assert.equal(
      (await post("/api/backup/restore", { archive, decisions })).status,
      409,
    );
    assert.equal(store.get(first.id)?.markdown, "# 修改");
    assert.equal(store.list().length, 2);
    const fresh = (await (
      await post("/api/backup/inspect", { archive })
    ).json()) as { conflicts: { id: string; token: string }[] };
    const choices = fresh.conflicts.map((c) => ({
      ...c,
      action: c.id === first.id ? "overwrite" : "copy",
    }));
    const restored = await post("/api/backup/restore", {
      archive,
      decisions: choices,
    });
    assert.equal(restored.status, 200);
    assert.equal(store.list().length, 3);
    assert.equal(store.get(first.id)?.markdown, "# 原稿");
    assert.equal(store.get(first.id)?.languages?.en?.markdown, "# Original");
    assert.equal(store.get(first.id)?.customCss, "p { color: red; }");
    assert.equal(store.listVersions(first.id).length, 1);
    assert.equal(store.listVersions(second.id).length, 1);
    const copy = store
      .list()
      .find((r) => r.id !== first.id && r.id !== second.id)!;
    assert.equal(copy.markdown, second.markdown);
    assert.equal(
      (await post("/api/backup/inspect", { archive: "invalid" })).status,
      400,
    );
  } finally {
    store.close();
  }
});

test("database errors roll back every resume in a backup", async () => {
  const directory = mkdtempSync(join(tmpdir(), "resumeflow-backup-test-"));
  const path = join(directory, "test.sqlite");
  const source = createStore(":memory:");
  const target = createStore(path);
  try {
    source.create("失败", "# 失败");
    source.create("成功", "# 成功");
    const data = exportBackup(source);
    data.resumes.sort((a, b) =>
      a.resume.title === "成功" ? -1 : b.resume.title === "成功" ? 1 : 0,
    );
    const archive = Buffer.from(backupZip(data)).toString("base64");
    const db = new DatabaseSync(path);
    db.exec(
      "CREATE TRIGGER fail_restore BEFORE INSERT ON resumes WHEN NEW.title = '失败' BEGIN SELECT RAISE(ABORT, 'test failure'); END",
    );
    db.close();
    const events: unknown[] = [];
    target.subscribe((event) => events.push(event));
    const result = await createApp(target).request(
      "http://localhost/api/backup/restore",
      {
        method: "POST",
        headers: { Host: "localhost", "Content-Type": "application/json" },
        body: JSON.stringify({ archive, decisions: [] }),
      },
    );
    assert.equal(result.status, 500);
    assert.equal(target.list().length, 0);
    assert.equal(events.length, 0);
  } finally {
    source.close();
    target.close();
    rmSync(path, { force: true });
    rmdirSync(directory);
  }
});

test("MCP backup tools return a ZIP URL, inspect conflicts and require choices", async () => {
  const store = createStore(":memory:");
  const app = createApp(store);
  const call = async (name: string, args: object) => {
    const response = await app.request("http://localhost/mcp", {
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
        params: { name, arguments: args },
      }),
    });
    const line = (await response.text())
      .split("\n")
      .find((part) => part.startsWith("data: "))!;
    return (
      JSON.parse(line.slice(6)) as {
        result: { isError?: boolean; content: { text: string }[] };
      }
    ).result;
  };
  try {
    const resume = store.create("测试", "# 内容");
    const result = await call("export_backup", { id: resume.id });
    const { url } = JSON.parse(result.content[0]!.text) as { url: string };
    const response = await app.request(url, { headers: { Host: "localhost" } });
    const archive = Buffer.from(await response.arrayBuffer()).toString(
      "base64",
    );
    const inspect = await call("inspect_backup", { archive });
    const { conflicts } = JSON.parse(inspect.content[0]!.text) as {
      conflicts: { id: string; token: string }[];
    };
    assert.equal(conflicts.length, 1);
    assert.equal(
      (await call("import_backup", { archive, decisions: [] })).isError,
      true,
    );
    assert.equal(
      (
        await call("import_backup", {
          archive,
          decisions: [{ ...conflicts[0], action: "copy" }],
        })
      ).isError,
      undefined,
    );
    assert.equal(store.list().length, 2);
  } finally {
    store.close();
  }
});
