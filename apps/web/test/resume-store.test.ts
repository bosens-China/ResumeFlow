import assert from "node:assert/strict";
import { test } from "vitest";
import { createApp } from "../../server/src/app.ts";
import { createStore } from "../../server/src/store.ts";
import { api } from "../src/lib/api.ts";
import {
  ApiError,
  createResume,
  deleteResume,
  duplicateResume,
  getResume,
  importBackupFile,
  inspectBackupFile,
  importMarkdownFile,
  listResumes,
  updateResume,
} from "../src/lib/resume-store.ts";

test("hc requests preserve resume operations and revision conflicts", async () => {
  const store = createStore(":memory:");
  const app = createApp(store);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = new URL(String(input), "http://localhost");
    const headers = new Headers(init?.headers);
    headers.set("Host", "localhost");
    return app.request(url.toString(), { ...init, headers });
  };
  try {
    const created = await createResume({ title: "测试", markdown: "# 简历" });
    assert.equal((await listResumes()).length, 1);
    assert.equal((await getResume(created.id))?.title, "测试");
    const updated = await updateResume(created.id, created.revision, {
      title: "更新",
    });
    await assert.rejects(
      updateResume(created.id, created.revision, { title: "旧版本" }),
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 409 &&
        error.current?.revision === updated.revision,
    );
    const pdf = await api.api.resumes[":id"].pdf.$get({
      param: { id: created.id },
      query: { revision: String(created.revision) },
    });
    assert.equal(pdf.status, 409);
    const copy = await duplicateResume(created.id);
    await deleteResume(copy.id, copy.revision);
    assert.equal(await getResume(copy.id), undefined);
    await assert.rejects(
      deleteResume(updated.id, created.revision),
      (error: unknown) => error instanceof ApiError && error.status === 409,
    );
    await deleteResume(updated.id, updated.revision);
    assert.equal((await listResumes()).length, 0);

    // 测试 importMarkdownFile
    const mdFile = new File(["# 开发者简历\n\n经历描述"], "张三_高级前端.md", {
      type: "text/markdown",
    });
    const importedFromMd = await importMarkdownFile(mdFile);
    assert.equal(importedFromMd.title, "张三_高级前端");
    assert.equal(importedFromMd.markdown, "# 开发者简历\n\n经历描述");

    const backupResponse = await globalThis.fetch("/api/backup");
    const backupFile = new File([await backupResponse.blob()], "backup.zip", {
      type: "application/zip",
    });
    const inspection = await inspectBackupFile(backupFile);
    assert.equal(inspection.conflicts.length, 1);
    const restoreResult = await importBackupFile(
      inspection.archive,
      inspection.conflicts.map(({ id, token }) => ({
        id,
        token,
        action: "copy",
      })),
    );
    assert.equal(restoreResult.count, 1);
    const all = await listResumes();
    assert.equal(all.length, 2);
    assert.ok(all.every((r) => r.title === importedFromMd.title));
  } finally {
    globalThis.fetch = originalFetch;
    store.close();
  }
});
