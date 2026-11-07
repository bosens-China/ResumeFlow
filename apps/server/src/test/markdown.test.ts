import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";
import { chromium } from "playwright";
import { getResumePageCss } from "@resumeflow/shared/resume-css";
import { RESUME_TEMPLATES } from "@resumeflow/shared";
import { InvalidMarkdownError, renderMarkdown } from "../markdown.ts";

test("safe HTML mixes with Markdown while executable content is removed", () => {
  const html = renderMarkdown(`<div>

**加粗** <span>正文</span><br><em>强调</em><sup>2</sup>

<img src="https://example.com/photo.png" width="160" height="80" alt="照片" onerror="alert(1)" style="position:fixed" srcset="https://example.com/other.png 2x">
<a href="javascript:alert(1)" onclick="alert(1)">链接</a>
<script>alert(1)</script><iframe src="https://example.com"></iframe>
<style>body{display:none}</style><object data="https://example.com"></object>
<svg onload="alert(1)"><script>alert(1)</script></svg>

</div>`);
  for (const tag of ["div", "strong", "span", "br", "em", "sup", "img", "a"])
    assert.match(html, new RegExp(`<${tag}(?:[ >])`));
  assert.match(html, /width="160" height="80" alt="照片"/);
  assert.match(html, /class="rf-img"/);
  assert.doesNotMatch(
    html,
    /<(script|iframe|style|object|svg)\b|onerror|onclick|onload|srcset|style=|javascript:/,
  );
  assert.match(renderMarkdown('`<img src="/example.png">`'), /&#x3C;img/);
});

test("HTML and Markdown images share URL validation and error locations", () => {
  for (const source of [
    "/photo.png",
    "./photo.png",
    "file:///tmp/photo.png",
    "data:image/png;base64,AAAA",
    "blob:https://example.com/id",
    "javascript:alert(1)",
    "https://user:password@example.com/photo.png",
  ]) {
    for (const image of [`![照片](${source})`, `<img src="${source}">`])
      assert.throws(
        () => renderMarkdown(`正文\n\n${image}`),
        (error) => error instanceof InvalidMarkdownError && error.line === 3,
      );
  }
  assert.throws(
    () => renderMarkdown('<img alt="缺少地址">'),
    InvalidMarkdownError,
  );
  assert.throws(
    () => renderMarkdown('<img src="&#106;avascript:alert(1)">'),
    InvalidMarkdownError,
  );
  assert.match(
    renderMarkdown("![照片][photo]\n\n[photo]: https://example.com/photo.png"),
    /<img src="https:\/\/example.com\/photo.png"/,
  );
});

test("only images after the initial h1 and before the first h2–h6 become avatars", () => {
  for (let level = 2; level <= 6; level++) {
    for (const heading of [
      "#".repeat(level) + " 模块",
      `<h${level}>模块</h${level}>`,
    ]) {
      const html = renderMarkdown(`![之前](https://example.com/before.png)

::::row
:::cell{align="center"}
# 姓名

![头像](https://example.com/avatar.png)
:::
::::

${heading}

::::row
:::cell
作品
:::
:::cell
<img src="https://example.com/work.png" class="rf-avatar" alt="作品">
:::
::::

# 后续标题

![后续图片](https://example.com/later.png)`);
      assert.equal((html.match(/rf-avatar/g) ?? []).length, 1);
      assert.match(html, /alt="头像" class="rf-img rf-avatar"/);
      assert.match(
        html.match(/<img[^>]*alt="作品"[^>]*>/)![0],
        /class="rf-img"/,
      );
    }
  }
  assert.doesNotMatch(
    renderMarkdown(
      "## 模块\n\n# 后续标题\n\n![图](https://example.com/image.png)",
    ),
    /rf-avatar/,
  );
  assert.match(
    renderMarkdown(
      '<h1>姓名</h1>\n\n<img src="https://example.com/avatar.png">',
    ),
    /class="rf-img rf-avatar"/,
  );
});

test("paper, templates and thumbnails crop header photos without cropping module images", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route("**/*", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"/>',
      }),
    );
    const row = (content: string) =>
      `::::row\n:::cell\n${content}\n:::\n:::cell\n![图](https://example.com/image.png)\n:::\n::::`;
    const markdown = `${row("# 姓名")}\n\n## 作品\n\n${row("普通图片")}\n\n<img src="https://example.com/other.png" width="160">`;
    const thumbnailCss = readFileSync(
      new URL("../../../web/src/index.css", import.meta.url),
      "utf8",
    );
    for (const styles of [getResumePageCss(), thumbnailCss]) {
      for (const templateCss of [
        "",
        ...RESUME_TEMPLATES.map((item) => item.customCss ?? ""),
      ]) {
        await page.setContent(
          `<style>${styles}\n${templateCss}</style><div class="rf-thumbnail-canvas">${renderMarkdown(markdown)}</div>`,
          { waitUntil: "load" },
        );
        const images = await page.locator("img").evaluateAll((nodes) =>
          nodes.map((node) => {
            const rect = node.getBoundingClientRect();
            return { width: rect.width, ratio: rect.width / rect.height };
          }),
        );
        assert.ok(Math.abs(images[0]!.ratio - 0.75) < 0.01);
        assert.ok(
          Math.abs(images[1]!.ratio - 2) < 0.01,
          JSON.stringify({
            thumbnail: styles === thumbnailCss,
            templateCss,
            images,
          }),
        );
        assert.equal(images[2]!.width, 160);
        assert.ok(Math.abs(images[2]!.ratio - 2) < 0.01);
      }
    }
  } finally {
    await browser.close();
  }
});
