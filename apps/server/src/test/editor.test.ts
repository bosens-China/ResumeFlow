import assert from "node:assert/strict";
import { test } from "vitest";
import { chromium } from "playwright";
import { createApp } from "../app.ts";
import { InvalidMarkdownError, renderMarkdown } from "../markdown.ts";
import { resumeHtml } from "../pdf.ts";
import { createStore } from "../store.ts";
import { getResumePdfFilename } from "@resumeflow/shared";

test("PDF filenames omit the default Chinese suffix", () => {
  assert.equal(getResumePdfFilename("简历"), "简历.pdf");
  assert.equal(getResumePdfFilename("简历", "zh"), "简历.pdf");
  assert.equal(getResumePdfFilename("Resume", "en"), "Resume_en.pdf");
});

test("alignment and line breaks follow explicit Markdown syntax", () => {
  const html = renderMarkdown(
    'AI Agent｜7年研发经验  \n[邮箱](mailto:hello@example.com)\n\n::::row\n:::cell{align="center"}\n居中内容\n:::\n::::\n\n::::row\n:::cell\n岗位\n:::\n:::cell\n2025 - 至今\n:::\n::::',
  );
  assert.match(html, /7年研发经验<br>\n<a/);
  assert.match(html, /rf-align-center/);
  assert.match(html, /<div class="rf-row rf-row-2">/);
  assert.doesNotMatch(renderMarkdown("第一行\n第二行"), /<br>/);
  for (const code of [
    "```md\n::: left\n\n示例\n:::\n```",
    "    ::: left\n    示例\n    :::",
    "`::: left`",
    "\\::: left",
  ]) {
    const rendered = renderMarkdown(code);
    assert.match(rendered, /::: left/);
    assert.doesNotMatch(rendered, /class="rf-left"/);
  }
  assert.throws(
    () => renderMarkdown(":::unknown\n文字\n:::"),
    InvalidMarkdownError,
  );
  assert.throws(
    () => renderMarkdown("::::row\n:::cell\n![图](/image.png)\n:::\n::::"),
    (error) => error instanceof InvalidMarkdownError && error.line === 3,
  );
});

test("styles cannot close the HTML style element through any style field", async () => {
  const store = createStore(":memory:");
  const browser = await chromium.launch({ headless: true });
  try {
    const resume = store.create("安全样式", "# 简历");
    const payload = "</StYlE><script>window.injected=1</script><style>";
    const page = await browser.newPage();
    for (const field of ["customCss", "themeColor", "margin"] as const) {
      const html = resumeHtml({ ...resume, [field]: payload });
      assert.equal((html.match(/<\/style>/gi) ?? []).length, 1);
      await page.setContent(html);
      assert.equal(await page.locator("script").count(), 0);
      assert.equal(
        await page.evaluate(
          () => (window as typeof window & { injected?: number }).injected,
        ),
        undefined,
      );
    }
  } finally {
    await browser.close();
    store.close();
  }
});

test("language updates and copies keep top-level fields in sync with the active language", async () => {
  const store = createStore(":memory:");
  try {
    const resume = store.create("默认标题", "", {
      languages: {
        zh: { title: "中文", markdown: "# 中文" },
        en: { title: "English", markdown: "# English" },
      },
    });
    assert.equal(resume.title, "中文");
    assert.equal(resume.markdown, "# 中文");
    const result = store.update(resume.id, resume.revision, {
      language: "en",
      title: "Updated English",
      markdown: "# Updated English",
    });
    assert.equal(result.status, "ok");
    const updated = store.get(resume.id)!;
    assert.equal(updated.currentLanguage, "zh");
    assert.equal(updated.title, "中文");
    assert.equal(updated.markdown, "# 中文");
    assert.equal(updated.languages?.en?.markdown, "# Updated English");
    const response = await createApp(store).request(
      `/api/resumes/${resume.id}/duplicate`,
      {
        method: "POST",
        headers: { Host: "localhost" },
      },
    );
    assert.equal(response.status, 201);
    const copy = await response.json();
    assert.equal(copy.languages.zh.title, copy.title);
    assert.equal(copy.languages.en.markdown, "# Updated English");
    assert.equal(store.get(resume.id)!.title, "中文");
  } finally {
    store.close();
  }
});
