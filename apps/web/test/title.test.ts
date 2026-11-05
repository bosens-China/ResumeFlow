import assert from "node:assert/strict";
import { test } from "vitest";
import { getDocumentTitle } from "../src/lib/constants.ts";
import { DEFAULT_RESUME_NAME } from "../src/lib/resume-store.ts";

test("document title generation for home and detail pages", () => {
  // 首页：没有传标题或为空时显示产品全称（ResumeFlow 简流）
  assert.equal(getDocumentTitle(), "ResumeFlow 简流");
  assert.equal(getDocumentTitle(""), "ResumeFlow 简流");
  assert.equal(getDocumentTitle("   "), "ResumeFlow 简流");
  assert.equal(getDocumentTitle(null), "ResumeFlow 简流");
  assert.equal(getDocumentTitle(undefined), "ResumeFlow 简流");

  // 详情页：具体简历名称 + 简流
  assert.equal(getDocumentTitle("资深全栈工程师"), "资深全栈工程师 - 简流");
  assert.equal(
    getDocumentTitle(`  ${DEFAULT_RESUME_NAME}  `),
    "未命名简历 - 简流",
  );
  assert.equal(getDocumentTitle("简历不存在"), "简历不存在 - 简流");
});
