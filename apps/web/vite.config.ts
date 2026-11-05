import fs from "node:fs";
import path from "node:path";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const rootPkg = JSON.parse(
  fs.readFileSync(
    path.resolve(import.meta.dirname, "../../package.json"),
    "utf-8",
  ),
) as { version?: string };

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(rootPkg.version || "0.0.0"),
  },
  plugins: [
    // 必须放在 react 插件之前
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@resumeflow/shared/css-tools": path.resolve(
        import.meta.dirname,
        "../../packages/shared/src/css-tools.ts",
      ),
      "@resumeflow/shared/markdown": path.resolve(
        import.meta.dirname,
        "../../packages/shared/src/markdown.ts",
      ),
      "@resumeflow/shared/resume-css": path.resolve(
        import.meta.dirname,
        "../../packages/shared/src/resume-css.ts",
      ),
      "@resumeflow/shared": path.resolve(
        import.meta.dirname,
        "../../packages/shared/src/index.ts",
      ),
    },
  },
  server: {
    port: 10128,
    proxy: {
      "/api": "http://127.0.0.1:10127",
    },
  },
});
