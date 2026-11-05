import { validator } from "hono/validator";
import { z } from "zod/v4";
import { formatAndValidateCss } from "@resumeflow/shared/css-tools";
import { InvalidMarkdownError, renderMarkdown } from "./markdown.ts";

const title = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .describe("简历名称，1–120 字符；多语言简历按目标语言分别保存");
const markdown = z
  .string()
  .max(1_000_000)
  .superRefine((value, context) => {
    try {
      renderMarkdown(value);
    } catch (error) {
      if (error instanceof InvalidMarkdownError) {
        context.addIssue({
          code: "custom",
          message: `第 ${error.line ?? "?"} 行：${error.message}`,
        });
      } else throw error;
    }
  })
  .describe(
    "完整 Markdown 正文，会替换目标语言原文。支持 :::left/center/right 及 ::::row 中的 :::cell；图片必须使用完整 HTTP(S) URL",
  );
const languageItem = z.object({
  title: title.optional(),
  markdown: markdown,
});
const themeColor = z
  .string()
  .max(50)
  .optional()
  .describe("全部语言共用的主题色，例如 #2563eb；空字符串恢复默认");
const margin = z
  .string()
  .max(50)
  .optional()
  .describe(
    "全部语言共用的 CSS 页边距，例如 10mm 或 12mm 15mm；空字符串恢复默认",
  );
const customCss = z
  .string()
  .max(100_000)
  .superRefine(async (value, context) => {
    const result = await formatAndValidateCss(value);
    if (!result.valid)
      context.addIssue({
        code: "custom",
        message: `CSS 语法错误: ${result.error}`,
      });
  })
  .optional()
  .describe(
    "全部语言共用的完整 CSS，会替换原样式；空字符串清除。可使用 .rf-root、.rf-h1、.rf-h2、.rf-p 等选择器。保存前校验语法，错误会返回位置且不会写入数据",
  );
const languageCode = z.string().min(1).max(20);
const currentLanguage = languageCode
  .optional()
  .describe(
    "切换当前显示语言，例如 zh、en；应指向 languages 中已有的语言。与 title/markdown 一起提交时，这些字段默认写入切换后的语言",
  );
const languages = z
  .record(languageCode, languageItem)
  .optional()
  .describe(
    "完整语言集合，会整体替换而非合并；遗漏的语言将删除。新增或删除前先 get_resume，保留其他语言，并确保包含 currentLanguage",
  );
const revision = z
  .number()
  .int()
  .positive()
  .describe(
    "最近读取的当前草稿 revision，用于防止覆盖他人修改。冲突后重新读取并核对内容，不要盲目重试覆盖",
  );

export const createInput = z.object({
  title: title.default("未命名简历"),
  markdown: markdown.default(""),
  themeColor,
  margin,
  customCss,
  currentLanguage,
  languages,
});
const updateFields = {
  revision,
  title: title.optional(),
  markdown: markdown.optional(),
  themeColor,
  margin,
  customCss,
  currentLanguage,
  languages,
  language: languageCode
    .optional()
    .describe(
      "只指定 title/markdown 的写入语言，不切换当前语言；省略时使用 currentLanguage 或原当前语言。可用于新增语言正文，不会自动翻译",
    ),
};
export const updateInput = z
  .object(updateFields)
  .refine(
    (value) =>
      Object.keys(updateFields).some(
        (key) =>
          key !== "revision" &&
          value[key as keyof typeof updateFields] !== undefined,
      ),
    { message: "缺少修改字段" },
  );
export const idInput = z.object({
  id: z.uuid().describe("简历 UUID，可从 list_resumes 或 create_resume 获取"),
});
export const versionIdInput = idInput.extend({
  versionId: z
    .uuid()
    .describe("历史快照 UUID，可从 list_resume_versions 获取；不同于 revision"),
});
export const deleteInput = z.object({ revision });
export const pdfInput = versionIdInput.partial({ versionId: true }).extend({
  language: languageCode
    .optional()
    .describe(
      "要导出的已有语言代码，省略时使用所选草稿或快照的当前语言；不存在时返回错误",
    ),
});

function validationError(error: z.ZodError) {
  return error.issues.map((issue) => issue.message).join("；");
}

export function jsonValidator<T extends z.ZodType>(schema: T) {
  return validator("json", async (value, c) => {
    const parsed = await schema.safeParseAsync(value);
    if (!parsed.success)
      return c.json({ error: validationError(parsed.error) }, 400);
    return parsed.data as z.output<T>;
  });
}

export const versionCreateInput = z.object({
  revision,
  title: title.describe("历史快照的名称，例如 投递前；不会修改简历名称"),
});
export const versionRestoreInput = deleteInput;
