import { assert, test } from "vitest";
import { estimateResumePageCount, renderMarkdown } from "../markdown.ts";
import { getResumeIcon, renderResumeIconHtml } from "../resume-icons.ts";

test("icon directives render sanitized inline SVGs with aliases", () => {
  const html = renderMarkdown(
    ":icon[phone] 138-0000-0000 · :icon[github] user",
  );
  assert.match(
    html,
    /<span class="rf-icon rf-icon-phone" data-icon="phone" aria-hidden="true">/,
  );
  assert.match(
    html,
    /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 24 24"/,
  );
  assert.match(
    html,
    /<span class="rf-icon rf-icon-github" data-icon="github" aria-hidden="true">/,
  );

  // 测试别名 :icon[tel] 解析为 phone
  const aliasHtml = renderMarkdown(":icon[tel] 123456");
  assert.match(aliasHtml, /rf-icon-phone/);

  // 测试属性语法 :icon{name="wechat"}
  const attrHtml = renderMarkdown(':icon{name="wechat"} wxid');
  assert.match(attrHtml, /rf-icon-wechat/);

  // 测试包含 ellipse 元素的 database 图标不会被清洗掉顶部
  const dbHtml = renderMarkdown(":icon[database] PostgreSQL");
  assert.match(dbHtml, /<ellipse cx="12" cy="5" rx="9" ry="3"/);
  assert.match(dbHtml, /rf-icon-database/);
});

test("unknown icons or missing icon names throw InvalidMarkdownError", () => {
  assert.throws(
    () => renderMarkdown(":icon[unknown-icon-name]"),
    /未知的图标名称/,
  );
  assert.throws(() => renderMarkdown(":icon[]"), /icon 指令必须指定图标名称/);
  assert.throws(
    () => renderMarkdown(':::icon{name="phone"}\nimportant content\n:::'),
    /icon 只支持行内指令/,
  );
});

test("resume icons dictionary provides metadata and valid SVG content", () => {
  const phone = getResumeIcon("phone");
  assert.ok(phone);
  assert.equal(phone.category, "contact");
  assert.ok(renderResumeIconHtml("phone"));
  assert.equal(getResumeIcon("not-exists"), undefined);
});

test("estimateResumePageCount accurately calculates A4 pages for standard and long resumes", () => {
  assert.equal(estimateResumePageCount(""), 1);
  assert.equal(estimateResumePageCount("   "), 1);

  const defaultMd =
    "# 姓名\n\n:::center\n职位 · 城市 · 电话 · 邮箱\n:::\n\n## 工作经历\n\n::::row\n:::cell\n### 公司名称 · 职位\n:::\n:::cell\n2022 - 至今\n:::\n::::\n\n- 工作内容描述\n";
  assert.equal(estimateResumePageCount(defaultMd), 1);

  const longMd =
    "# 姓名\n" +
    "## 工作经历\n### 某某公司\n- 很多工作经历内容描述很多很多很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长\n".repeat(
      12,
    );
  assert.equal(estimateResumePageCount(longMd), 2);
});
