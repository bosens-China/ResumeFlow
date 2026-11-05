import { type Context } from "hono";
import { readFileSync } from "node:fs";
import { logger } from "hono/logger";
import { streamSSE } from "hono/streaming";
import { validator } from "hono/validator";
import { HTTPException } from "hono/http-exception";
import { createMcpHonoApp } from "@modelcontextprotocol/hono";
import { getResumePdfFilename, type HealthResponse } from "@resumeflow/shared";
import { createStore, duplicateResume } from "./store.ts";
import { mcpHandler } from "./mcp.ts";
import {
  getPdfSource,
  ResumeOperationError,
  unwrapResult,
} from "./resume-operations.ts";
import {
  createInput,
  updateInput,
  jsonValidator,
  versionCreateInput,
  versionRestoreInput,
  deleteInput,
} from "./schemas.ts";
import { pagedScriptPath, resumePdf } from "./pdf.ts";

const pagedScript = readFileSync(pagedScriptPath);
export const serverPort = Number(
  process.env.PORT ?? (process.env.NODE_ENV === "production" ? 3000 : 10127),
);

export function createApp(store = createStore()) {
  const handler = mcpHandler(store);
  const app = createMcpHonoApp({
    host: "0.0.0.0",
    allowedHosts: ["localhost", "127.0.0.1"],
  });
  app.use("*", logger());
  app.onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse();
    if (error instanceof ResumeOperationError)
      return c.json(
        {
          error: error.message,
          ...(error.current ? { current: error.current } : {}),
        },
        error.status,
      );
    console.error(error);
    return c.json({ error: "内部错误" }, 500);
  });

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
      const { title, markdown, ...rest } = c.req.valid("json");
      return c.json(store.create(title, markdown, rest), 201);
    })
    .get("/api/resumes/:id", (c) => {
      const resume = store.get(c.req.param("id"));
      return resume ? c.json(resume) : c.json({ error: "简历不存在" }, 404);
    })
    .get("/api/resumes/:id/versions", (c) =>
      store.get(c.req.param("id"))
        ? c.json(store.listVersions(c.req.param("id")))
        : c.json({ error: "简历不存在" }, 404),
    )
    .get("/api/resumes/:id/versions/:versionId", (c) => {
      const version = store.getVersion(
        c.req.param("id"),
        c.req.param("versionId"),
      );
      return version ? c.json(version) : c.json({ error: "版本不存在" }, 404);
    })
    .post(
      "/api/resumes/:id/versions",
      jsonValidator(versionCreateInput),
      (c) => {
        const { revision, title } = c.req.valid("json");
        const result = unwrapResult(
          store.createVersion(c.req.param("id"), revision, title),
        );
        return c.json(result.version, 201);
      },
    )
    .post(
      "/api/resumes/:id/versions/:versionId/restore",
      jsonValidator(versionRestoreInput),
      (c) => {
        const result = unwrapResult(
          store.restoreVersion(
            c.req.param("id"),
            c.req.param("versionId"),
            c.req.valid("json").revision,
          ),
          "版本不存在",
        );
        return c.json(result.resume);
      },
    )
    .patch("/api/resumes/:id", jsonValidator(updateInput), (c) => {
      const { revision, ...patch } = c.req.valid("json");
      const result = unwrapResult(
        store.update(c.req.param("id"), revision, patch),
      );
      return c.json(result.resume);
    })
    .post("/api/resumes/:id/duplicate", (c) => {
      const copy = duplicateResume(store, c.req.param("id"));
      return copy ? c.json(copy, 201) : c.json({ error: "简历不存在" }, 404);
    })
    .delete(
      "/api/resumes/:id",
      validator("query", (query) => query),
      (c) => {
        const parsed = deleteInput.safeParse({
          revision: Number(c.req.query("revision")),
        });
        if (!parsed.success) return c.json({ error: "缺少有效 revision" }, 400);
        unwrapResult(store.delete(c.req.param("id"), parsed.data.revision));
        return c.body(null, 204);
      },
    )
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
    .get(
      "/api/resumes/:id/pdf",
      validator("query", (query) => query),
      async (c) => {
        const versionId = c.req.query("versionId");
        const { resume, language, title } = getPdfSource(
          store,
          c.req.param("id"),
          {
            versionId,
            revision: c.req.query("revision"),
            language: c.req.query("lang") || c.req.query("language"),
          },
        );
        try {
          const pdf = await resumePdf(resume, language);
          const disposition =
            c.req.query("download") === "1"
              ? `attachment; filename="resume.pdf"; filename*=UTF-8''${encodeURIComponent(getResumePdfFilename(title, language))}`
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
      },
    )
    .all("/mcp", (c: Context) =>
      handler.fetch(c.req.raw, { parsedBody: c.get("parsedBody") }),
    );

  return routes;
}

export type AppType = ReturnType<typeof createApp>;
