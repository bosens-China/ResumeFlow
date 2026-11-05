import { randomUUID } from "node:crypto";
import { createMiddleware } from "hono/factory";
import pino, { type Logger } from "pino";

declare module "hono" {
  interface ContextVariableMap {
    logger: Logger;
  }
}

export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  base: { service: "resumeflow" },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(process.env.NODE_ENV === "production"
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            singleLine: true,
            translateTime: "SYS:HH:MM:ss.l",
            ignore: "pid,hostname",
          },
        },
      }),
});

export const requestLogger = createMiddleware(async (c, next) => {
  const start = performance.now();
  const requestId = randomUUID();
  const log = logger.child({
    requestId,
    method: c.req.method,
    path: c.req.path,
  });
  c.set("logger", log);
  await next();
  c.header("X-Request-Id", requestId);
  const status = c.res.status;
  const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
  log[level](
    {
      status,
      durationMs: Math.round((performance.now() - start) * 100) / 100,
      ...(status >= 500 && c.error ? { err: c.error } : {}),
    },
    "HTTP request",
  );
});
