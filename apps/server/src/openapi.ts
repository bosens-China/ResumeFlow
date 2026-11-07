import {
  describeRoute,
  resolver,
  type GenerateSpecOptions,
} from "hono-openapi";
import { z } from "zod/v4";
import { createInput, deleteInput } from "./schemas.ts";

const resume = createInput
  .extend({
    id: z.string(),
    revision: deleteInput.shape.revision,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .meta({ ref: "Resume" });
const resumeTemplate = z
  .object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    targetRole: z.string(),
    description: z.string(),
    tags: z.array(z.string()),
    themeColor: z.string(),
    margin: z.string(),
    customCss: z.string().optional(),
    markdown: z.string(),
  })
  .meta({ ref: "ResumeTemplate" });
const versionSummary = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
});
const version = versionSummary
  .extend({ resume })
  .meta({ ref: "ResumeVersion" });
const error = z.object({ error: z.string(), current: resume.optional() });

function jsonResponse(schema: z.ZodType, description: string) {
  return {
    description,
    content: { "application/json": { schema: resolver(schema) } },
  };
}

const notFound = jsonResponse(error, "简历或历史版本不存在");
const conflict = jsonResponse(
  error,
  "revision 过期；current 为最新草稿，请读取核对后重试",
);
export const validationResponse = {
  description: "输入无效；字段校验失败返回 JSON，JSON 语法错误可能返回纯文本",
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["error"],
        properties: { error: { type: "string" } },
      },
    },
    "text/plain": { schema: { type: "string" } },
  },
} satisfies Exclude<
  GenerateSpecOptions["defaultValidationErrorResponse"],
  boolean
>;

export const apiDocs = {
  font: describeRoute({
    summary: "获取预览与 PDF 共用的内置字体",
    tags: ["系统"],
    responses: {
      200: { description: "本地字体文件" },
      404: { description: "字体不存在" },
    },
  }),
  health: describeRoute({
    summary: "健康检查",
    tags: ["系统"],
    responses: {
      200: jsonResponse(
        z.object({ status: z.literal("ok"), time: z.string() }),
        "服务正常",
      ),
    },
  }),
  pagedjs: describeRoute({
    summary: "获取网页与 PDF 共用的分页脚本",
    tags: ["系统"],
    responses: {
      200: {
        description: "Paged.js 脚本",
        content: { "text/javascript": { schema: { type: "string" } } },
      },
    },
  }),
  list: describeRoute({
    summary: "列出简历",
    tags: ["简历"],
    responses: { 200: jsonResponse(z.array(resume), "简历列表") },
  }),
  listTemplates: describeRoute({
    summary: "列出预设简历模板",
    tags: ["简历"],
    responses: {
      200: jsonResponse(z.array(resumeTemplate), "预设模板列表"),
    },
  }),
  create: describeRoute({
    summary: "创建简历",
    description:
      "提交 JSON 对象；空对象使用默认名称和空正文创建。可通过 languages 提供多语言内容。",
    tags: ["简历"],
    responses: { 201: jsonResponse(resume, "已创建") },
  }),
  get: describeRoute({
    summary: "读取简历",
    tags: ["简历"],
    responses: { 200: jsonResponse(resume, "当前草稿"), 404: notFound },
  }),
  update: describeRoute({
    summary: "修改简历",
    description:
      "需当前 revision 及至少一个修改字段。languages 整体替换，遗漏语言会被删除；其余未提供的字段保留。language 仅指定写入语言，currentLanguage 切换当前语言，不自动翻译正文。",
    tags: ["简历"],
    responses: {
      200: jsonResponse(resume, "修改后的草稿"),
      404: notFound,
      409: conflict,
    },
  }),
  duplicate: describeRoute({
    summary: "创建简历副本",
    tags: ["简历"],
    responses: { 201: jsonResponse(resume, "已创建副本"), 404: notFound },
  }),
  delete: describeRoute({
    summary: "永久删除简历及其全部历史快照",
    tags: ["简历"],
    parameters: [
      {
        in: "query",
        name: "revision",
        required: true,
        description: "当前草稿修订号",
        schema: { type: "integer", minimum: 1 },
      },
    ],
    responses: {
      204: { description: "已删除，无响应体" },
      400: validationResponse,
      404: notFound,
      409: conflict,
    },
  }),
  listVersions: describeRoute({
    summary: "列出历史快照",
    tags: ["历史版本"],
    responses: {
      200: jsonResponse(z.array(versionSummary), "历史快照列表"),
      404: notFound,
    },
  }),
  getVersion: describeRoute({
    summary: "读取历史快照",
    tags: ["历史版本"],
    responses: { 200: jsonResponse(version, "不可变快照"), 404: notFound },
  }),
  createVersion: describeRoute({
    summary: "以当前草稿创建命名快照",
    description:
      "先保存正文和样式，再提交当前 revision 和快照 title。返回的 id 为 versionId；内容未变时复用已有快照。",
    tags: ["历史版本"],
    responses: {
      201: jsonResponse(version, "历史快照；内容未变时返回已有快照"),
      404: notFound,
      409: conflict,
    },
  }),
  restoreVersion: describeRoute({
    summary: "先归档当前草稿，再从快照开始新草稿",
    description:
      "路径 versionId 指定历史快照；JSON 中 revision 为当前草稿修订号。原快照保持不变，返回恢复后的草稿和新 revision。",
    tags: ["历史版本"],
    responses: {
      200: jsonResponse(resume, "恢复后的当前草稿"),
      404: notFound,
      409: conflict,
    },
  }),
  events: describeRoute({
    summary: "订阅简历变更通知（SSE）",
    description:
      "连接时发送 ready 事件；变更时发送 resume-changed，data 为 JSON：{ id, revision, deleted?, versionsChanged? }。",
    tags: ["系统"],
    responses: {
      200: {
        description: "持续事件流",
        content: { "text/event-stream": { schema: { type: "string" } } },
      },
    },
  }),
  pdf: describeRoute({
    summary: "导出已保存的简历或历史快照 PDF",
    description:
      "直接返回 application/pdf 二进制，不是下载链接或 JSON。导出当前稿建议携带最近读取的 revision；导出快照使用 versionId。下载时设置 download=1，并采用 Content-Disposition 中 UTF-8 filename* 提供的文件名。",
    tags: ["简历"],
    parameters: [
      {
        in: "query",
        name: "revision",
        description: "可选，当前草稿修订号；过期返回 409，指定快照时忽略",
        schema: { type: "integer", minimum: 1 },
      },
      {
        in: "query",
        name: "versionId",
        description: "可选，历史快照 UUID",
        schema: { type: "string" },
      },
      {
        in: "query",
        name: "lang",
        description:
          "已有语言代码；省略使用所选草稿或快照的当前语言，不存在时返回 400",
        schema: { type: "string" },
      },
      {
        in: "query",
        name: "language",
        description: "lang 的别名；同时提供时 lang 优先",
        schema: { type: "string" },
      },
      {
        in: "query",
        name: "download",
        description: "设为 1 下载，否则内联预览",
        schema: { type: "string", enum: ["1"] },
      },
    ],
    responses: {
      200: {
        description: "PDF 文件",
        headers: {
          "X-Resume-Revision": {
            description: "导出内容的修订号",
            schema: { type: "string" },
          },
          "Content-Disposition": {
            description:
              "download=1 时为附件，filename* 为 UTF-8 文件名：zh 使用标题.pdf，其他语言使用标题_语言代码.pdf；快照采用快照中的标题",
            schema: { type: "string" },
          },
        },
        content: {
          "application/pdf": { schema: { type: "string", format: "binary" } },
        },
      },
      400: validationResponse,
      404: notFound,
      409: conflict,
      500: jsonResponse(error, "PDF 生成失败"),
    },
  }),
};
