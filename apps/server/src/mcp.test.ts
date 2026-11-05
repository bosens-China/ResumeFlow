import assert from "node:assert/strict";
import { test } from "node:test";
import type { Resume } from "@resumeflow/shared";
import { createApp } from "./app.ts";
import { closePdfBrowser } from "./pdf.ts";
import { createStore } from "./store.ts";

test("MCP exposes the same resume operations and revision protection", async () => {
  const store = createStore(":memory:");
  const app = createApp(store);
  async function call(name: string, args: Record<string, unknown>) {
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
    assert.equal(response.status, 200);
    const line = (await response.text())
      .split("\n")
      .find((item) => item.startsWith("data: "));
    assert.ok(line);
    const message = JSON.parse(line.slice(6)) as {
      result: { isError?: boolean; content: { text: string }[] };
    };
    return message.result;
  }
  try {
    assert.equal(
      (await call("create_resume", { markdown: ":::unknown\n文字\n:::" }))
        .isError,
      true,
    );
    const created = JSON.parse(
      (
        await call("create_resume", {
          title: `${"a".repeat(114)}😀bbbb`,
          markdown: "# 简历",
        })
      ).content[0]!.text,
    ) as Resume;
    const listed = JSON.parse(
      (await call("list_resumes", {})).content[0]!.text,
    ) as Resume[];
    assert.equal(listed[0]?.id, created.id);
    const copy = JSON.parse(
      (await call("duplicate_resume", { id: created.id })).content[0]!.text,
    ) as Resume;
    assert.ok(copy.title.length <= 120);
    assert.equal(copy.title.isWellFormed(), true);
    assert.equal(copy.markdown, created.markdown);
    const restCopy = await app.request(
      `http://localhost/api/resumes/${created.id}/duplicate`,
      { method: "POST", headers: { Host: "localhost" } },
    );
    const restCopyBody = (await restCopy.json()) as Resume;
    assert.equal(restCopyBody.title, copy.title);
    const updated = JSON.parse(
      (
        await call("update_resume", {
          id: copy.id,
          revision: copy.revision,
          title: copy.title,
          markdown: "# 更新",
          themeColor: "#2563eb",
          margin: "12mm 15mm",
          customCss: ".rf-h2 { font-size: 14pt; }",
          language: "en",
        })
      ).content[0]!.text,
    ) as Resume;
    assert.equal(updated.themeColor, "#2563eb");
    assert.equal(updated.margin, "12mm 15mm");
    assert.equal(updated.customCss, ".rf-h2 { font-size: 14pt; }");
    assert.equal(updated.languages?.en?.markdown, "# 更新");
    assert.equal(updated.markdown, copy.markdown);
    assert.equal(updated.currentLanguage, copy.currentLanguage);
    assert.equal(
      (
        await call("update_resume", {
          id: copy.id,
          revision: copy.revision,
          title: "过期",
        })
      ).isError,
      true,
    );
    const fetched = JSON.parse(
      (await call("get_resume", { id: copy.id })).content[0]!.text,
    ) as Resume;
    assert.equal(fetched.revision, updated.revision);
    assert.equal(fetched.themeColor, "#2563eb");
    const exportedEn = JSON.parse(
      (
        await call("export_resume_pdf", {
          id: copy.id,
          language: "en",
        })
      ).content[0]!.text,
    ) as { url: string; revision: number };
    assert.match(exportedEn.url, /lang=en/);
    const exported = JSON.parse(
      (await call("export_resume_pdf", { id: copy.id })).content[0]!.text,
    ) as { url: string; revision: number };
    assert.equal(exported.revision, updated.revision);
    const pdf = await app.request(exported.url, {
      headers: { Host: "localhost" },
    });
    assert.equal(pdf.status, 200);
    assert.equal(
      new TextDecoder().decode((await pdf.arrayBuffer()).slice(0, 5)),
      "%PDF-",
    );
    assert.equal(
      (await call("delete_resume", { id: copy.id, revision: copy.revision }))
        .isError,
      true,
    );
    assert.equal(
      (await call("delete_resume", { id: copy.id, revision: updated.revision }))
        .isError,
      undefined,
    );
    assert.equal((await call("get_resume", { id: copy.id })).isError, true);
  } finally {
    store.close();
    await closePdfBrowser();
  }
});
