import assert from "node:assert/strict";
import { test } from "vitest";
import type { generateSpecs } from "hono-openapi";
import { createApp } from "../app.ts";
import { createStore } from "../store.ts";

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
