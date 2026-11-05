import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "vitest";

const source = `
  import { Hono } from 'hono';
  import { HTTPException } from 'hono/http-exception';
  import { logger, requestLogger } from './src/logger.ts';
  const app = new Hono();
  app.use('*', requestLogger);
  app.onError((error, c) => error instanceof HTTPException
    ? error.getResponse() : c.json({error: '内部错误'}, 500));
  app.get('/ok', c => c.json({ok: true}));
  app.get('/error', () => { throw new Error('test failure'); });
  app.get('/forbidden', () => { throw new HTTPException(403); });
  for (const path of ['/ok?token=private-query', '/missing', '/error', '/forbidden']) {
    const response = await app.request(path, { headers: {
      authorization: 'Bearer private-header', cookie: 'private-cookie'
    }});
    if (!response.headers.get('X-Request-Id')) throw new Error('missing request ID');
  }
  logger.info('Server listening');
`;

test("production logs are JSON with request context, levels and serialized errors", () => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", source],
    {
      cwd: new URL("../..", import.meta.url),
      env: { ...process.env, NODE_ENV: "production" },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!result.stdout.includes("\u001b["));
  assert.doesNotMatch(
    result.stdout,
    /private-query|private-header|private-cookie/,
  );
  const logs = result.stdout
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(logs.length, 5);
  assert.deepEqual(
    logs.slice(0, 4).map((log) => log.level),
    [30, 40, 50, 40],
  );
  assert.deepEqual(
    logs.slice(0, 4).map((log) => log.status),
    [200, 404, 500, 403],
  );
  for (const log of logs.slice(0, 4)) {
    assert.equal(log.service, "resumeflow");
    assert.equal(log.method, "GET");
    assert.match(log.time, /^\d{4}-.*Z$/);
    assert.match(log.requestId, /^[0-9a-f-]{36}$/);
    assert.ok(log.durationMs >= 0);
  }
  assert.match(logs[2].err.stack, /test failure/);
});

test("development logs use color and readable structured fields", () => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", source],
    {
      cwd: new URL("../..", import.meta.url),
      env: { ...process.env, NODE_ENV: "development" },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes("\u001b["));
  assert.match(result.stdout, /INFO|WARN|ERROR/);
  assert.match(result.stdout, /requestId.*durationMs/);
  assert.doesNotMatch(
    result.stdout,
    /private-query|private-header|private-cookie/,
  );
});
