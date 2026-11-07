import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";
import type { generateSpecs } from "hono-openapi";
import { RESUME_TEMPLATES } from "@resumeflow/shared";
import { createApp } from "../app.ts";
import { createStore } from "../store.ts";
import { closePdfBrowser } from "../pdf.ts";

test("Swagger serves a spec covering REST routes and shared input schemas", async () => {
  const store = createStore(":memory:");
  try {
    const app = createApp(store);
    const response = await app.request("/api/openapi.json", {
      headers: { host: "localhost" },
    });
    assert.equal(response.status, 200);
    const spec = (await response.json()) as Awaited<
      ReturnType<typeof generateSpecs>
    >;
    assert.match(spec.openapi, /^3\./);
    const rootPackage = JSON.parse(
      readFileSync(
        new URL("../../../../package.json", import.meta.url),
        "utf8",
      ),
    );
    assert.equal(spec.info.version, rootPackage.version);
    for (const route of app.routes) {
      if (
        route.method === "ALL" ||
        !route.path.startsWith("/api/") ||
        ["/api/docs", "/api/openapi.json"].includes(route.path)
      )
        continue;
      const path = route.path.replace(/:([^/]+)/g, "{$1}");
      const method = route.method.toLowerCase() as
        "get" | "post" | "patch" | "delete";
      assert.ok(spec.paths[path]?.[method], `${route.method} ${path}`);
    }
    assert.equal(spec.paths["/mcp"], undefined);
    assert.equal(spec.paths["/api/docs"], undefined);
    assert.ok(spec.paths["/api/resume-templates"]?.get);
    const templates = await app.request("/api/resume-templates", {
      headers: { host: "localhost" },
    });
    assert.equal(templates.status, 200);
    assert.deepEqual(
      (await templates.json()).map((item: { id: string }) => item.id),
      RESUME_TEMPLATES.map((item) => item.id),
    );
    const create = spec.paths["/api/resumes"]!.post!;
    const body = create.requestBody;
    assert.ok(body && "content" in body);
    const schema = body.content["application/json"]!.schema;
    assert.ok(schema && "properties" in schema);
    assert.ok(schema.properties?.languages);
    assert.ok(schema.properties?.customCss);
    assert.ok(
      !schema.required?.includes("title"),
      "default title remains optional",
    );
    assert.ok(create.responses["201"]);
    const validation = create.responses["400"];
    assert.ok(validation && "content" in validation);
    assert.ok(validation.content?.["application/json"]?.schema);
    assert.ok(spec.paths["/api/resumes/{id}"]!.patch!.responses["409"]);
    assert.ok(spec.paths["/api/resumes/{id}"]!.delete!.responses["204"]);
    assert.ok(
      spec.paths["/api/resumes/{id}/pdf"]!.get!.parameters?.some(
        (p) => "name" in p && p.name === "versionId",
      ),
    );
    const ui = await app.request("/api/docs", {
      headers: { host: "localhost" },
    });
    assert.equal(ui.status, 200);
    assert.match(ui.headers.get("content-type") ?? "", /text\/html/);
    assert.match(await ui.text(), /\/api\/openapi\.json/);

    const malformed = await app.request("/api/resumes", {
      method: "POST",
      headers: { host: "localhost", "content-type": "application/json" },
      body: "{",
    });
    assert.equal(malformed.status, 400);
    assert.match(malformed.headers.get("content-type") ?? "", /text\/plain/);
    assert.ok(validation.content?.["text/plain"]?.schema);
    assert.ok(malformed.headers.get("X-Request-Id"));
    const blocked = await app.request("/api/health", {
      headers: { host: "untrusted.example" },
    });
    assert.equal(blocked.status, 403);
    assert.ok(blocked.headers.get("X-Request-Id"));
  } finally {
    store.close();
  }
});

test("HTTP clients can edit, snapshot, download, restore and delete without MCP", async () => {
  const store = createStore(":memory:");
  const app = createApp(store);
  const headers = { host: "localhost" };
  const write = (path: string, method: "POST" | "PATCH", body: unknown) =>
    app.request(path, {
      method,
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    const spec = (await (
      await app.request("/api/openapi.json", { headers })
    ).json()) as Awaited<ReturnType<typeof generateSpecs>>;
    const patchBody = spec.paths["/api/resumes/{id}"]!.patch!.requestBody;
    assert.ok(patchBody && "content" in patchBody);
    const patchSchema = patchBody.content["application/json"]!.schema;
    assert.ok(patchSchema && "properties" in patchSchema);
    assert.ok(patchSchema.required?.includes("revision"));
    assert.ok(patchSchema.properties?.language);
    assert.ok(patchSchema.properties?.lineHeight);
    assert.ok(patchSchema.properties?.font);
    const snapshotBody =
      spec.paths["/api/resumes/{id}/versions"]!.post!.requestBody;
    assert.ok(snapshotBody && "content" in snapshotBody);
    const snapshotSchema = snapshotBody.content["application/json"]!.schema;
    assert.ok(snapshotSchema && "properties" in snapshotSchema);
    assert.deepEqual(snapshotSchema.required?.toSorted(), [
      "revision",
      "title",
    ]);
    const pdfResponse =
      spec.paths["/api/resumes/{id}/pdf"]!.get!.responses["200"];
    assert.ok(pdfResponse && "content" in pdfResponse);
    assert.ok(pdfResponse.content?.["application/pdf"]);
    assert.ok(pdfResponse.headers?.["Content-Disposition"]);

    const createdResponse = await write("/api/resumes", "POST", {
      title: "中文简历",
      markdown: "# 中文",
      lineHeight: 1.1,
      margin: "12mm",
      languages: {
        zh: { title: "中文简历", markdown: "# 中文", font: "source-han-sans" },
        en: { title: "English", markdown: "# English", font: "inter" },
      },
    });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    const path = `/api/resumes/${created.id}`;
    const editedResponse = await write(path, "PATCH", {
      revision: created.revision,
      language: "en",
      currentLanguage: "en",
      title: "Saved English",
      markdown: "# Saved English\n\nExperience",
      customCss: ".rf-h1 { color: navy; }",
    });
    assert.equal(editedResponse.status, 200);
    const edited = await editedResponse.json();
    assert.equal(edited.languages.zh.markdown, "# 中文");
    assert.equal(edited.languages.en.font, "inter");
    assert.equal(edited.lineHeight, 1.1);
    assert.equal(edited.margin, "12mm");
    const conflict = await write(path, "PATCH", {
      revision: created.revision,
      title: "stale",
    });
    assert.equal(conflict.status, 409);
    assert.deepEqual((await conflict.json()).current, edited);
    const snapshotResponse = await write(`${path}/versions`, "POST", {
      revision: edited.revision,
      title: "投递前",
    });
    assert.equal(snapshotResponse.status, 201);
    const snapshot = await snapshotResponse.json();
    const versions = await (
      await app.request(`${path}/versions`, { headers })
    ).json();
    assert.ok(versions.some((item: { id: string }) => item.id === snapshot.id));
    const storedSnapshot = await (
      await app.request(`${path}/versions/${snapshot.id}`, { headers })
    ).json();
    assert.deepEqual(storedSnapshot, snapshot);
    const draftResponse = await write(path, "PATCH", {
      revision: edited.revision,
      title: "New draft",
    });
    assert.equal(draftResponse.status, 200);
    const draft = await draftResponse.json();
    const download = await app.request(
      `${path}/pdf?versionId=${snapshot.id}&revision=${created.revision}&lang=en&download=1`,
      { headers },
    );
    assert.equal(download.status, 200);
    assert.equal(download.headers.get("content-type"), "application/pdf");
    assert.ok(
      download.headers
        .get("content-disposition")
        ?.endsWith(encodeURIComponent("Saved English_en.pdf")),
    );
    assert.equal(
      Buffer.from(await download.arrayBuffer())
        .subarray(0, 5)
        .toString(),
      "%PDF-",
    );
    const restoredResponse = await write(
      `${path}/versions/${snapshot.id}/restore`,
      "POST",
      { revision: draft.revision },
    );
    assert.equal(restoredResponse.status, 200);
    const restored = await restoredResponse.json();
    assert.equal(restored.title, "Saved English");
    assert.equal(restored.customCss, edited.customCss);
    const copied = await write(`${path}/duplicate`, "POST", {});
    assert.equal(copied.status, 201);
    const deleted = await app.request(`${path}?revision=${restored.revision}`, {
      method: "DELETE",
      headers,
    });
    assert.equal(deleted.status, 204);
    assert.equal((await app.request(path, { headers })).status, 404);
  } finally {
    await closePdfBrowser();
    store.close();
  }
});
