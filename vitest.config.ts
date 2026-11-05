import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "apps/*/test/**/*.test.ts",
      "apps/*/src/test/**/*.test.ts",
      "packages/*/src/test/**/*.test.ts",
    ],
    maxWorkers: 3,
    testTimeout: 30_000,
  },
});
