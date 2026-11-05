import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateResumePageCount } from "@resumeflow/shared";
import {
  getLanguageLabel,
  getLanguageName,
  PRESET_LANGUAGES,
} from "../src/lib/format.ts";

test("language name resolution for presets and custom codes", () => {
  // 1. 预设语言能够正确解析
  assert.equal(getLanguageName("zh"), "简体中文");
  assert.equal(getLanguageName("en"), "英语");
  assert.equal(getLanguageName("ja"), "日语");

  // 2. PRESET_LANGUAGES 数组完备
  assert.ok(PRESET_LANGUAGES.length >= 8);
  assert.ok(PRESET_LANGUAGES.some((p) => p.code === "en"));

  // 3. 自定义标准 BCP 47 语言智能解析（如 ru, pt, it）
  const ruName = getLanguageName("ru");
  assert.ok(ruName === "俄语" || ruName === "俄文");

  // 4. 未知/非标准自定义代码优雅回退
  assert.equal(getLanguageName("my-custom-lang"), "my-custom-lang");

  // 5. 完整标签格式化
  assert.equal(getLanguageLabel("zh"), "简体中文 (zh)");
  assert.equal(getLanguageLabel("en"), "英语 (en)");
  assert.equal(getLanguageLabel("my-custom-lang"), "my-custom-lang");
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
