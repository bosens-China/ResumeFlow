import { createRequire } from "node:module";

export const APP_VERSION = (
  createRequire(import.meta.url)("../package.json") as { version: string }
).version;
