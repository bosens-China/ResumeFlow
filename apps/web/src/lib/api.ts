import { hc } from "hono/client";
import type { AppType } from "@resumeflow/server";

// 开发环境下通过 Vite proxy 转发 /api 到后端
export const api = hc<AppType>("/");
