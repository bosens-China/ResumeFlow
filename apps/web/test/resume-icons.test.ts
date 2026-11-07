import assert from "node:assert/strict";
import { test } from "vitest";
import {
  RESUME_ICONS,
  RESUME_ICON_CATEGORIES,
  getResumeIcon,
  renderResumeIconHtml,
} from "@resumeflow/shared/resume-icons";
import { renderMarkdown } from "@resumeflow/shared/markdown";

test("all predefined icons produce valid SVGs with dimensions and aria labels", () => {
  assert.ok(RESUME_ICONS.length >= 30);
  for (const icon of RESUME_ICONS) {
    const html = renderResumeIconHtml(icon.name);
    assert.ok(html, `Icon ${icon.name} should render HTML`);
    assert.ok(html.includes(`data-icon="${icon.name}"`));
    assert.ok(html.includes('aria-hidden="true"'));
    assert.ok(html.includes("<svg"));
    assert.ok(html.includes("</svg>"));
  }
});

test("icon categories and aliases resolve correctly", () => {
  const categoryIds = RESUME_ICON_CATEGORIES.map((c) => c.id);
  assert.ok(categoryIds.includes("all"));
  assert.ok(categoryIds.includes("contact"));
  assert.ok(categoryIds.includes("social"));
  assert.ok(categoryIds.includes("section"));
  assert.ok(categoryIds.includes("tech"));

  // 别名测试
  assert.equal(getResumeIcon("tel")?.name, "phone");
  assert.equal(getResumeIcon("email")?.name, "mail");
  assert.equal(getResumeIcon("location")?.name, "map-pin");
  assert.equal(getResumeIcon("wx")?.name, "wechat");
  assert.equal(getResumeIcon("work")?.name, "briefcase");
  assert.equal(getResumeIcon("education")?.name, "graduation-cap");
  assert.equal(getResumeIcon("team")?.name, "users");
  assert.equal(getResumeIcon("growth")?.name, "trending-up");
  assert.equal(getResumeIcon("english")?.name, "languages");
  assert.equal(getResumeIcon("app")?.name, "smartphone");
  assert.equal(getResumeIcon("money")?.name, "dollar-sign");
  assert.equal(getResumeIcon("design")?.name, "palette");
  assert.equal(getResumeIcon("bot")?.name, "bot");
  assert.equal(getResumeIcon("robot")?.name, "bot");
  assert.equal(getResumeIcon("agent")?.name, "bot");
  assert.equal(getResumeIcon("llm")?.name, "bot");
  assert.equal(getResumeIcon("ai")?.name, "bot");
});

test("markdown engine renders :icon directives seamlessly with surrounding text", () => {
  const md =
    "# 候选人\n\n" +
    ":icon[phone] 138-0000-0000 · :icon[mail] test@example.com · :icon[github] dev\n\n" +
    "## :icon[briefcase] 工作经历\n" +
    "- 核心研发工程师\n";

  const rendered = renderMarkdown(md);
  assert.ok(rendered.includes("rf-icon-phone"));
  assert.ok(rendered.includes("rf-icon-mail"));
  assert.ok(rendered.includes("rf-icon-github"));
  assert.ok(rendered.includes("rf-icon-briefcase"));
  assert.ok(rendered.includes("138-0000-0000"));
});

test("all icons provide names and labels", () => {
  for (const icon of RESUME_ICONS) {
    assert.ok(icon.label && icon.label.trim().length > 0);
    assert.ok(icon.name && icon.name.trim().length > 0);
  }
});
