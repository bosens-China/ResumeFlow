import { validator } from "hono-openapi";
import { z } from "zod/v4";
import { formatAndValidateCss } from "@resumeflow/shared/css-tools";
import { RESUME_FONT_IDS } from "@resumeflow/shared/resume-fonts";
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
    "完整 Markdown 正文，会替换目标语言原文。使用 ::::row 包裹 :::cell 分栏；row 的 columns 可指定 auto、正整数 fr/mm/px/% 列宽，cell 的 align 可指定 left/center/right。支持安全 HTML（含 img，危险标签和属性会被移除）。所有图片必须使用完整 HTTP(S) URL。顶部 h1 后、首个 h2–h6 前的图片默认采用头像裁剪，进入模块后为普通图片；HTML 标题遵循相同规则",
  );
const font = z
  .enum(RESUME_FONT_IDS)
  .optional()
  .describe(
    "目标语言的字体 ID：source-han-sans、alibaba-puhuiti、misans、harmonyos-sans、inter、pingfang-sc。未设置时中文默认 source-han-sans，其他语言默认 inter；不影响其他语言",
  );
const languageItem = z.object({
  title: title.optional(),
  markdown: markdown,
  font,
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
    "全部语言共用的纸张页边距，使用 CSS margin 语法，例如 10mm 或 12mm 15mm；空字符串恢复默认",
  );
const lineHeight = z
  .number()
  .min(0.5)
  .max(2.0)
  .optional()
  .describe(
    "全部语言共用的排版行距与垂直间距倍率，默认 1.0；例如 0.9 为紧凑排版，1.1 为宽松排版",
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
    "切换当前显示语言，例如 zh、en；必须存在于更新后的 languages 中，或在同一请求为该语言提供 markdown（可为空）。title/markdown 默认写入切换后的语言；用 markdown 新增当前语言时，若指定 language，须与当前语言一致",
  );
const languages = z
  .record(languageCode, languageItem)
  .optional()
  .describe(
    "完整语言集合，会整体替换而非合并；遗漏的语言将删除。修改前先读取当前简历，保留其他语言，并确保包含 currentLanguage",
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
  lineHeight,
  customCss,
  currentLanguage,
  languages,
  font,
});
const updateFields = {
  revision,
  title: title.optional(),
  markdown: markdown.optional(),
  themeColor,
  margin,
  lineHeight,
  customCss,
  currentLanguage,
  languages,
  font,
  language: languageCode
    .optional()
    .describe(
      "只指定 title/markdown/font 的写入语言，不切换当前语言；省略时使用 currentLanguage 或原当前语言。可用于新增语言正文，不会自动翻译",
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
  id: z.uuid().describe("简历 UUID，可从简历列表或创建结果获取"),
});
export const versionIdInput = idInput.extend({
  versionId: z
    .uuid()
    .describe("历史快照 UUID，可从历史快照列表获取；不同于 revision"),
});
export const deleteInput = z.object({ revision });
export const pdfInput = versionIdInput.partial({ versionId: true }).extend({
  language: languageCode
    .optional()
    .describe(
      "要导出的已有语言代码，省略时使用所选草稿或快照的当前语言；不存在时返回错误",
    ),
});

export function jsonValidator<T extends z.ZodType>(schema: T) {
  return validator("json", schema, (result, c) => {
    if (!result.success)
      return c.json(
        { error: result.error.map((issue) => issue.message).join("；") },
        400,
      );
  });
}

export const versionCreateInput = z.object({
  revision,
  title: title.describe("历史快照的名称，例如 投递前；不会修改简历名称"),
});
export const versionRestoreInput = deleteInput;
