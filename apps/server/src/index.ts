import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { resolve } from "node:path";
import { createApp, serverPort } from "./app.ts";
import { closePdfBrowser } from "./pdf.ts";
import { createStore } from "./store.ts";

const store = createStore();
const app = createApp(store);
const webRoot = resolve(import.meta.dirname, "../../web/dist");

if (process.env.NODE_ENV === "production") {
  app.get("/*", serveStatic({ root: webRoot }));
  app.get(
    "/resumes/:resumeId",
    serveStatic({ root: webRoot, path: "index.html" }),
  );
}

const server = serve(
  {
    fetch: app.fetch,
    port: serverPort,
    hostname: process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1",
  },
  (info) => {
    console.log(`Server listening on http://localhost:${info.port}`);
  },
);

const shutdown = () => {
  server.close();
  if ("closeAllConnections" in server) server.closeAllConnections();
  void closePdfBrowser()
    .catch(console.error)
    .finally(() => store.close());
};

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
