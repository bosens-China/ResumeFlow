import assert from "node:assert/strict";
import { test } from "vitest";
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
