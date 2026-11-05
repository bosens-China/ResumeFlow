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
  description: "输入无效",
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["error"],
        properties: { error: { type: "string" } },
      },
    },
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
  create: describeRoute({
    summary: "创建简历",
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
      "需当前 revision。languages 整体替换，遗漏语言会被删除；其余未提供的字段保留。",
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
    tags: ["历史版本"],
    responses: {
      201: jsonResponse(version, "历史快照；内容未变时返回已有快照"),
      404: notFound,
      409: conflict,
    },
  }),
  restoreVersion: describeRoute({
    summary: "先归档当前草稿，再从快照开始新草稿",
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
        description: "已有语言代码；省略使用当前语言",
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
            description: "预览或带语言后缀的下载文件名",
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
