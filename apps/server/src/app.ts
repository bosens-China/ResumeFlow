import { Hono, type Context } from "hono";
import { readFileSync } from "node:fs";
import { swaggerUI } from "@hono/swagger-ui";
import { openAPIRouteHandler } from "hono-openapi";
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
import { readResumeFont } from "./fonts.ts";
import { requestLogger } from "./logger.ts";
import { apiDocs, validationResponse } from "./openapi.ts";
import { APP_VERSION } from "./app-version.ts";

const pagedScript = readFileSync(pagedScriptPath);
export const serverPort = Number(
  process.env.PORT ?? (process.env.NODE_ENV === "production" ? 3000 : 10127),
);

export function createApp(store = createStore()) {
  const handler = mcpHandler(store);
  const app = new Hono().use("*", requestLogger).route(
    "/",
    createMcpHonoApp({
      host: "0.0.0.0",
      allowedHosts: ["localhost", "127.0.0.1"],
    }),
  );
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
    return c.json({ error: "内部错误" }, 500);
  });

  const routes = app
    .get("/api/health", apiDocs.health, (c) =>
      c.json<HealthResponse>({ status: "ok", time: new Date().toISOString() }),
    )
    .get("/api/pagedjs.js", apiDocs.pagedjs, (c) =>
      c.body(new Uint8Array(pagedScript), 200, {
        "Content-Type": "text/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      }),
    )
    .get("/api/fonts/:file", apiDocs.font, async (c) => {
      const font = await readResumeFont(c.req.param("file"));
      if (!font) return c.notFound();
      return c.body(new Uint8Array(font.body), 200, {
        "Content-Type": font.contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=31536000, immutable",
      });
    })
    .get("/api/resumes", apiDocs.list, (c) => c.json(store.list()))
    .post("/api/resumes", apiDocs.create, jsonValidator(createInput), (c) => {
      const { title, markdown, ...rest } = c.req.valid("json");
      return c.json(store.create(title, markdown, rest), 201);
    })
    .get("/api/resumes/:id", apiDocs.get, (c) => {
      const resume = store.get(c.req.param("id"));
      return resume ? c.json(resume) : c.json({ error: "简历不存在" }, 404);
    })
    .get("/api/resumes/:id/versions", apiDocs.listVersions, (c) =>
      store.get(c.req.param("id"))
        ? c.json(store.listVersions(c.req.param("id")))
        : c.json({ error: "简历不存在" }, 404),
    )
    .get("/api/resumes/:id/versions/:versionId", apiDocs.getVersion, (c) => {
      const version = store.getVersion(
        c.req.param("id"),
        c.req.param("versionId"),
      );
      return version ? c.json(version) : c.json({ error: "版本不存在" }, 404);
    })
    .post(
      "/api/resumes/:id/versions",
      apiDocs.createVersion,
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
      apiDocs.restoreVersion,
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
    .patch(
      "/api/resumes/:id",
      apiDocs.update,
      jsonValidator(updateInput),
      (c) => {
        const { revision, ...patch } = c.req.valid("json");
        const result = unwrapResult(
          store.update(c.req.param("id"), revision, patch),
        );
        return c.json(result.resume);
      },
    )
    .post("/api/resumes/:id/duplicate", apiDocs.duplicate, (c) => {
      const copy = duplicateResume(store, c.req.param("id"));
      return copy ? c.json(copy, 201) : c.json({ error: "简历不存在" }, 404);
    })
    .delete(
      "/api/resumes/:id",
      apiDocs.delete,
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
    .get("/api/events", apiDocs.events, (c) =>
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
      apiDocs.pdf,
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
          c.get("logger").error({ err: error }, "PDF generation failed");
          return c.json({ error: "PDF 生成失败" }, 500);
        }
      },
    )
    .all("/mcp", (c: Context) =>
      handler.fetch(c.req.raw, { parsedBody: c.get("parsedBody") }),
    );

  app.get(
    "/api/openapi.json",
    openAPIRouteHandler(app, {
      documentation: {
        info: {
          title: "ResumeFlow API",
          version: APP_VERSION,
          description:
            "本机单用户简历、历史版本与 PDF 接口。MCP 使用 /mcp，通过协议发现工具。",
        },
      },
      exclude: ["/api/docs", "/api/openapi.json", "/mcp"],
      excludeStaticFile: false,
      defaultValidationErrorResponse: validationResponse,
    }),
  );
  app.get("/api/docs", swaggerUI({ url: "/api/openapi.json" }));

  return routes;
}

export type AppType = ReturnType<typeof createApp>;
