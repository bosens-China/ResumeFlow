import { type Context } from "hono";
import { readFileSync } from "node:fs";
import { logger } from "hono/logger";
import { streamSSE } from "hono/streaming";
import { validator } from "hono/validator";
import { createMcpHonoApp } from "@modelcontextprotocol/hono";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod/v4";
import type { HealthResponse } from "@resumeflow/shared";
import { createStore, type ResumeStore } from "./store.ts";
import { InvalidMarkdownError, renderMarkdown } from "./markdown.ts";
import { pagedScriptPath, resumePdf } from "./pdf.ts";

const pagedScript = readFileSync(pagedScriptPath);
export const serverPort = Number(
  process.env.PORT ?? (process.env.NODE_ENV === "production" ? 3000 : 10127),
);

const title = z.string().trim().min(1).max(120);
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
  });
const createInput = z.object({
  title: title.default("未命名简历"),
  markdown: markdown.default(""),
});
const updateFields = {
  revision: z.number().int().positive(),
  title: title.optional(),
  markdown: markdown.optional(),
};
const updateInput = z
  .object(updateFields)
  .refine((value) => value.title !== undefined || value.markdown !== undefined);
const idInput = z.object({ id: z.uuid() });

function validationError(error: z.ZodError) {
  return error.issues.map((issue) => issue.message).join("；");
}

function jsonValidator<T extends z.ZodType>(schema: T) {
  return validator("json", (value, c) => {
    const parsed = schema.safeParse(value);
    if (!parsed.success)
      return c.json({ error: validationError(parsed.error) }, 400);
    return parsed.data as z.output<T>;
  });
}

function mcpHandler(store: ResumeStore) {
  return createMcpHandler(() => {
    const server = new McpServer({ name: "resumeflow", version: "0.1.0" });
    const text = (value: unknown) => ({
      content: [{ type: "text" as const, text: JSON.stringify(value) }],
    });
    const error = (message: string) => ({
      isError: true,
      content: [{ type: "text" as const, text: message }],
    });

    server.registerTool(
      "list_resumes",
      { description: "列出简历", inputSchema: z.object({}) },
      async () => text(store.list()),
    );
    server.registerTool(
      "create_resume",
      { description: "创建简历", inputSchema: createInput },
      async (input) => text(store.create(input.title, input.markdown)),
    );
    server.registerTool(
      "get_resume",
      { description: "读取简历", inputSchema: idInput },
      async ({ id }) => {
        const resume = store.get(id);
        return resume ? text(resume) : error("简历不存在");
      },
    );
    server.registerTool(
      "update_resume",
      {
        description: "修改名称或 Markdown 正文，需提供当前 revision",
        inputSchema: z.object({ id: z.uuid(), ...updateFields }),
      },
      async ({ id, revision, title, markdown: body }) => {
        if (title === undefined && body === undefined)
          return error("需要修改名称或正文");
        const result = store.update(id, revision, { title, markdown: body });
        if (result.status === "not_found") return error("简历不存在");
        if (result.status === "conflict")
          return error(`版本冲突，当前内容：${JSON.stringify(result.current)}`);
        return text(result.resume);
      },
    );
    server.registerTool(
      "duplicate_resume",
      { description: "创建指定简历的副本", inputSchema: idInput },
      async ({ id }) => {
        const original = store.get(id);
        return original
          ? text(store.create(`${original.title} (副本)`, original.markdown))
          : error("简历不存在");
      },
    );
    server.registerTool(
      "delete_resume",
      {
        description: "删除简历，需提供当前 revision",
        inputSchema: z.object({
          id: z.uuid(),
          revision: z.number().int().positive(),
        }),
      },
      async ({ id, revision }) => {
        const result = store.delete(id, revision);
        if (result.status === "not_found") return error("简历不存在");
        if (result.status === "conflict")
          return error(`版本冲突，当前内容：${JSON.stringify(result.current)}`);
        return text({ deleted: true, id });
      },
    );
    server.registerTool(
      "export_resume_pdf",
      { description: "获取当前简历的 PDF 下载地址", inputSchema: idInput },
      async ({ id }) => {
        const resume = store.get(id);
        if (!resume) return error("简历不存在");
        const base =
          process.env.RESUMEFLOW_PUBLIC_URL ?? `http://127.0.0.1:${serverPort}`;
        return text({
          url: `${base}/api/resumes/${id}/pdf?revision=${resume.revision}&download=1`,
          revision: resume.revision,
        });
      },
    );
    return server;
  });
}

export function createApp(store = createStore()) {
  const handler = mcpHandler(store);
  const app = createMcpHonoApp({
    host: "0.0.0.0",
    allowedHosts: ["localhost", "127.0.0.1"],
  });
  app.use("*", logger());

  const routes = app
    .get("/api/health", (c) =>
      c.json<HealthResponse>({ status: "ok", time: new Date().toISOString() }),
    )
    .get("/api/pagedjs.js", (c) =>
      c.body(new Uint8Array(pagedScript), 200, {
        "Content-Type": "text/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      }),
    )
    .get("/api/resumes", (c) => c.json(store.list()))
    .post("/api/resumes", jsonValidator(createInput), (c) => {
      const { title, markdown } = c.req.valid("json");
      return c.json(store.create(title, markdown), 201);
    })
    .get("/api/resumes/:id", (c) => {
      const resume = store.get(c.req.param("id"));
      return resume ? c.json(resume) : c.json({ error: "简历不存在" }, 404);
    })
    .patch("/api/resumes/:id", jsonValidator(updateInput), (c) => {
      const { revision, title, markdown } = c.req.valid("json");
      const result = store.update(c.req.param("id"), revision, {
        title,
        markdown,
      });
      if (result.status === "not_found")
        return c.json({ error: "简历不存在" }, 404);
      if (result.status === "conflict")
        return c.json({ error: "版本冲突", current: result.current }, 409);
      return c.json(result.resume);
    })
    .post("/api/resumes/:id/duplicate", (c) => {
      const original = store.get(c.req.param("id"));
      return original
        ? c.json(
            store.create(`${original.title} (副本)`, original.markdown),
            201,
          )
        : c.json({ error: "简历不存在" }, 404);
    })
    .delete("/api/resumes/:id", (c) => {
      const revision = Number(c.req.query("revision"));
      if (!Number.isSafeInteger(revision) || revision < 1)
        return c.json({ error: "缺少有效 revision" }, 400);
      const result = store.delete(c.req.param("id"), revision);
      if (result.status === "not_found")
        return c.json({ error: "简历不存在" }, 404);
      if (result.status === "conflict")
        return c.json({ error: "版本冲突", current: result.current }, 409);
      return c.body(null, 204);
    })
    .get("/api/events", (c) =>
      streamSSE(c, async (stream) => {
        await new Promise<void>((resolve) => {
          const unsubscribe = store.subscribe((event) => {
            void stream
              .writeSSE({
                event: "resume-changed",
                data: JSON.stringify(event),
              })
              .catch(() => {});
          });
          stream.onAbort(() => {
            unsubscribe();
            resolve();
          });
          void stream.writeSSE({ event: "ready", data: "{}" });
        });
      }),
    )
    .get("/api/resumes/:id/pdf", async (c) => {
      const resume = store.get(c.req.param("id"));
      if (!resume) return c.json({ error: "简历不存在" }, 404);
      const requested = c.req.query("revision");
      if (requested && requested !== String(resume.revision))
        return c.json({ error: "版本冲突", current: resume }, 409);
      try {
        const pdf = await resumePdf(resume);
        const disposition =
          c.req.query("download") === "1"
            ? `attachment; filename="resume.pdf"; filename*=UTF-8''${encodeURIComponent(resume.title)}.pdf`
            : 'inline; filename="resume.pdf"';
        return c.body(new Uint8Array(pdf), 200, {
          "Content-Type": "application/pdf",
          "Content-Disposition": disposition,
          "Cache-Control": "no-store",
          "X-Resume-Revision": String(resume.revision),
        });
      } catch (error) {
        console.error("PDF generation failed", error);
        return c.json({ error: "PDF 生成失败" }, 500);
      }
    })
    .all("/mcp", (c: Context) =>
      handler.fetch(c.req.raw, { parsedBody: c.get("parsedBody") }),
    );

  return routes;
}

export type AppType = ReturnType<typeof createApp>;
