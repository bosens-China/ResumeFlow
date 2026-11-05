import { assert, test } from "vitest";
import { estimateResumePageCount } from "../markdown.ts";

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
