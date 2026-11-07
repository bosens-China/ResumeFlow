import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { chromium } from "playwright";
import {
  RESUME_FONTS,
  getResumeFont,
  waitForResumeFonts,
  type Resume,
} from "@resumeflow/shared";
import { createApp } from "../app.ts";
import { closePdfBrowser, resumeHtml, resumePdf } from "../pdf.ts";
import { createStore, duplicateResume } from "../store.ts";

async function call(
  app: ReturnType<typeof createApp>,
  name: string,
  args: Record<string, unknown>,
) {
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
    .find((item) => item.startsWith("data: "));
  assert.ok(line);
  return JSON.parse(line.slice(6)).result as {
    isError?: boolean;
    content: { text: string }[];
  };
}

test("language fonts survive edits, persistence, copies and history; REST/MCP reject unknown fonts", async () => {
  const directory = mkdtempSync(join(tmpdir(), "resumeflow-fonts-"));
  const path = join(directory, "resumes.sqlite");
  let store = createStore(path);
  try {
    assert.equal(getResumeFont(undefined, "zh").id, "source-han-sans");
    assert.equal(getResumeFont(undefined, "zh-TW").id, "source-han-sans");
    for (const language of ["en", "fr", "ja"])
      assert.equal(getResumeFont(undefined, language).id, "inter");
    const app = createApp(store);
    const created = await call(app, "create_resume", {
      title: "中文",
      markdown: "# 中文",
      font: "misans",
      languages: {
        zh: { title: "中文", markdown: "# 中文" },
        en: { title: "English", markdown: "# English", font: "inter" },
      },
    });
    const resume = JSON.parse(created.content[0]!.text) as Resume;
    assert.equal(resume.languages?.zh?.font, "misans");
    const edited = store.update(resume.id, resume.revision, {
      title: "编辑后",
    });
    assert.equal(edited.status, "ok");
    let current = store.get(resume.id)!;
    assert.equal(current.languages?.zh?.font, "misans");
    const version = store.createVersion(
      current.id,
      current.revision,
      "字体快照",
    );
    assert.equal(version.status, "ok");
    if (version.status !== "ok") throw new Error("快照创建失败");
    const response = await app.request(`/api/resumes/${current.id}`, {
      method: "PATCH",
      headers: { Host: "localhost", "Content-Type": "application/json" },
      body: JSON.stringify({
        revision: current.revision,
        language: "en",
        font: "harmonyos-sans",
      }),
    });
    assert.equal(response.status, 200);
    current = store.get(current.id)!;
    assert.equal(current.currentLanguage, "zh");
    assert.equal(current.languages?.zh?.font, "misans");
    assert.equal(current.languages?.en?.font, "harmonyos-sans");
    const copy = duplicateResume(store, current.id)!;
    assert.equal(copy.languages?.zh?.font, "misans");
    assert.equal(copy.languages?.en?.font, "harmonyos-sans");
    const invalid = {
      id: current.id,
      revision: current.revision,
      title: "不能写入",
      font: "PingFang SC",
    };
    assert.equal((await call(app, "update_resume", invalid)).isError, true);
    const rejected = await app.request(`/api/resumes/${current.id}`, {
      method: "PATCH",
      headers: { Host: "localhost", "Content-Type": "application/json" },
      body: JSON.stringify({
        ...invalid,
        font: undefined,
        languages: {
          zh: { markdown: "changed", font: "https://example.com/font.ttf" },
        },
      }),
    });
    assert.equal(rejected.status, 400);
    assert.deepEqual(store.get(current.id), current);
    assert.equal(
      store.restoreVersion(current.id, version.version.id, current.revision)
        .status,
      "ok",
    );
    store.close();
    store = createStore(path);
    assert.equal(store.get(current.id)!.languages?.zh?.font, "misans");
    assert.equal(store.get(current.id)!.languages?.en?.font, "inter");
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("all bundled fonts embed in PDFs and Web/MCP exports use the same saved language", async () => {
  const store = createStore(":memory:");
  const app = createApp(store);
  const expected = [
    /SourceHanSansSC/,
    /AlibabaPuHuiTi/,
    /MiSans/,
    /HarmonyOS_Sans_SC/,
    /Inter/,
    /PingFangSC/,
  ];
  try {
    for (const [index, font] of RESUME_FONTS.entries()) {
      const resume = store.create(
        "字体",
        "# 简历 Resume\n\n## Experience 工作经历\n\n**React 2026** 软件工程师，业绩提升 35%。\n\nEnglish résumé with *italics*.",
        { font: font.id },
      );
      const pdf = await resumePdf(resume);
      assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
      assert.match(pdf.toString("latin1"), expected[index]!);
      for (const face of font.faces) {
        const resource = await app.request(`/api/fonts/${face.file}`, {
          headers: { Host: "localhost", Origin: "null" },
        });
        assert.equal(resource.status, 200);
        assert.equal(resource.headers.get("Access-Control-Allow-Origin"), "*");
      }
    }
    const resume = store.create("默认", "", {
      languages: {
        zh: { title: "中文", markdown: "# 中文", font: "misans" },
        en: {
          title: "English",
          markdown: "# Resume\n\nEnglish **2026**",
          font: "inter",
        },
      },
    });
    const result = await call(app, "export_resume_pdf", {
      id: resume.id,
      language: "en",
    });
    const { url } = JSON.parse(result.content[0]!.text) as { url: string };
    const web = await app.request(
      `/api/resumes/${resume.id}/pdf?lang=en&revision=${resume.revision}`,
      { headers: { Host: "localhost" } },
    );
    const mcp = await app.request(url, { headers: { Host: "localhost" } });
    const webPdf = Buffer.from(await web.arrayBuffer());
    const mcpPdf = Buffer.from(await mcp.arrayBuffer());
    assert.equal(web.status, 200);
    assert.equal(mcp.status, 200);
    const normalize = (pdf: Buffer) =>
      pdf
        .toString("latin1")
        .replace(/\/CreationDate \(.*?\)|\/ModDate \(.*?\)/g, "");
    assert.equal(normalize(webPdf), normalize(mcpPdf));
    assert.equal(
      (
        await app.request("/api/fonts/not-a-font.ttf", {
          headers: { Host: "localhost" },
        })
      ).status,
      404,
    );
  } finally {
    await closePdfBrowser();
    store.close();
  }
});

test("the shared pagination guard rejects missing required fonts", async () => {
  const store = createStore(":memory:");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route("**/*", (route) => route.abort());
    await page.setContent(
      resumeHtml(
        store.create("English", "# Resume", { currentLanguage: "en" }),
      ),
    );
    await assert.rejects(page.evaluate(waitForResumeFonts));
  } finally {
    await browser.close();
    store.close();
  }
});
