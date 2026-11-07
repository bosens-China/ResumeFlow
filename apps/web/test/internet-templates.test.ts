import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "vitest";
import {
  INTERNET_RESUME_TEMPLATES,
  RESUME_TEMPLATES,
} from "@resumeflow/shared/templates";
import { renderMarkdown } from "@resumeflow/shared/markdown";
import { getResumePageCss } from "@resumeflow/shared/resume-css";
import { formatAndValidateCss } from "@resumeflow/shared/css-tools";
import { previewDocument } from "../src/lib/preview-document";
import { readResumeFont } from "../../server/src/fonts";
import { pagedScriptPath, resumeHtml } from "../../server/src/pdf";
import { createStore } from "../../server/src/store";

const require = createRequire(
  new URL("../../server/package.json", import.meta.url),
);

test.each(["ui-blue-header", "backend-sidebar"])(
  "%s reaches the paper edge in PDF pagination",
  { timeout: 60_000 },
  async (id) => {
    const template = INTERNET_RESUME_TEMPLATES.find((item) => item.id === id)!;
    const store = createStore(":memory:");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.hostname === "resumeflow.invalid") {
          const font = await readResumeFont(url.pathname.split("/").at(-1)!);
          assert.ok(font);
          return route.fulfill({
            ...font,
            headers: { "Access-Control-Allow-Origin": "*" },
          });
        }
        return route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>',
        });
      });
      const resume = store.create(template.name, template.markdown, {
        margin: template.margin,
        themeColor: template.themeColor,
        customCss: template.customCss,
      });
      await page.setContent(resumeHtml(resume), { waitUntil: "load" });
      await page.evaluate(() => {
        (
          window as typeof window & { PagedConfig: { auto: boolean } }
        ).PagedConfig = { auto: false };
      });
      await page.addScriptTag({ path: pagedScriptPath });
      await page.evaluate(async () => {
        const paged = (
          window as typeof window & {
            PagedPolyfill: {
              removeStyles(): unknown[];
              preview(
                html: string,
                styles: unknown[],
                target: Element,
              ): Promise<unknown>;
            };
          }
        ).PagedPolyfill;
        const source = document.querySelector("#source")!;
        const html = source.innerHTML;
        source.remove();
        await paged.preview(
          html,
          paged.removeStyles(),
          document.querySelector("#pages")!,
        );
      });
      assert.equal(await page.locator(".pagedjs_page").count(), 1);
      const bounds = await page
        .locator(".pagedjs_page")
        .evaluate((paper, id) => {
          const page = paper.getBoundingClientRect();
          const header = paper
            .querySelector(
              id === "backend-sidebar"
                ? ".rf-row > .rf-cell:last-child"
                : ".rf-row",
            )!
            .getBoundingClientRect();
          return {
            top: header.top - page.top,
            left: header.left - page.left,
            right: page.right - header.right,
            bottom: page.bottom - header.bottom,
          };
        }, id);
      assert.ok(
        Math.abs(bounds.top) < 1 &&
          Math.abs(bounds.right) < 1 &&
          Math.abs(id === "backend-sidebar" ? bounds.bottom : bounds.left) < 1,
        JSON.stringify(bounds),
      );
    } finally {
      await browser.close();
      store.close();
    }
  },
);
const { chromium } = require("playwright") as typeof import("playwright");

test(
  "internet templates render complete single-page resumes in the preview",
  { timeout: 60_000 },
  async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({
        viewport: { width: 900, height: 1200 },
      });
      await page.route("https://preview.test/api/fonts/*", async (route) => {
        const font = await readResumeFont(
          new URL(route.request().url()).pathname.split("/").at(-1)!,
        );
        assert.ok(font);
        await route.fulfill({
          ...font,
          headers: { "Access-Control-Allow-Origin": "*" },
        });
      });
      await page.route("**/photo-1534528741775-53994a69daeb**", (route) =>
        route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#cbd5e1"/></svg>',
        }),
      );
      await page.setContent(
        '<iframe title="preview" sandbox="allow-scripts" style="width:850px;height:1160px;border:0"></iframe>',
      );
      await page.evaluate((doc) => {
        (
          window as unknown as {
            replies: {
              id?: number;
              booted?: boolean;
              pages?: number;
              error?: string;
            }[];
          }
        ).replies = [];
        addEventListener("message", (event) =>
          (window as unknown as { replies: unknown[] }).replies.push(
            event.data,
          ),
        );
        document.querySelector("iframe")!.srcdoc = doc;
      }, previewDocument());
      await page.waitForFunction(() =>
        (window as unknown as { replies: { booted?: boolean }[] }).replies.some(
          (reply) => reply.booted,
        ),
      );

      for (const [index, template] of INTERNET_RESUME_TEMPLATES.entries()) {
        assert.ok(RESUME_TEMPLATES.some((item) => item.id === template.id));
        assert.equal(
          (await formatAndValidateCss(template.customCss ?? "")).valid,
          true,
        );
        const html = renderMarkdown(template.markdown);
        for (const heading of ["专业技能", "项目经历", "工作经历", "教育经历"])
          assert.ok(html.includes(heading), `${template.id} 缺少${heading}`);
        assert.doesNotMatch(html, /<h2[^>]*>个人信息<\/h2>/);
        const id = index + 1;
        await page.evaluate(
          (update) =>
            document
              .querySelector("iframe")!
              .contentWindow!.postMessage(update, "*"),
          {
            source: "resumeflow-preview-update",
            id,
            html,
            css: getResumePageCss({
              themeColor: template.themeColor,
              margin: template.margin,
              customCss: template.customCss,
              fontBaseUrl: "https://preview.test",
            }),
            margin: template.margin,
            color: template.themeColor,
            countOnly: false,
          },
        );
        await page.waitForFunction(
          (id) =>
            (window as unknown as { replies: { id?: number }[] }).replies.some(
              (reply) => reply.id === id,
            ),
          id,
        );
        const reply = await page.evaluate(
          (id) =>
            (
              window as unknown as {
                replies: { id?: number; pages?: number; error?: string }[];
              }
            ).replies.find((item) => item.id === id)!,
          id,
        );
        assert.equal(reply.error, undefined, template.id);
        assert.equal(reply.pages, 1, `${template.id} 应完整显示在一页`);
        if (template.id === "backend-sidebar") {
          const bounds = await page
            .frames()[1]!
            .locator("#pages .rf-preview-page")
            .evaluate((paper) => {
              const page = paper.getBoundingClientRect();
              const sidebar = paper
                .querySelector(".rf-row > .rf-cell:last-child")!
                .getBoundingClientRect();
              const section = paper
                .querySelector("h2")!
                .getBoundingClientRect();
              return {
                top: sidebar.top - page.top,
                right: page.right - sidebar.right,
                bottom: page.bottom - sidebar.bottom,
                bodyInset: section.left - page.left,
              };
            });
          assert.ok(
            Math.abs(bounds.top) < 1 &&
              Math.abs(bounds.right) < 1 &&
              Math.abs(bounds.bottom) < 1,
            JSON.stringify(bounds),
          );
          assert.ok(bounds.bodyInset > 40, JSON.stringify(bounds));
        }
        if (template.id === "qa-classic") {
          const frame = page.frames()[1]!;
          assert.equal(
            await frame
              .locator("#pages .rf-row > .rf-cell:last-child")
              .first()
              .evaluate((cell) => getComputedStyle(cell).textAlign),
            "left",
          );
        }
        if (template.id === "ui-blue-header") {
          const frame = page.frames()[1]!;
          const bounds = await frame
            .locator("#pages .rf-preview-page")
            .evaluate((paper) => {
              const page = paper.getBoundingClientRect();
              const header = paper
                .querySelector(".rf-row")!
                .getBoundingClientRect();
              const section = paper
                .querySelector("h2")!
                .getBoundingClientRect();
              return {
                top: header.top - page.top,
                left: header.left - page.left,
                right: page.right - header.right,
                bodyInset: section.left - page.left,
              };
            });
          assert.ok(
            Math.abs(bounds.top) < 1 &&
              Math.abs(bounds.left) < 1 &&
              Math.abs(bounds.right) < 1,
            JSON.stringify(bounds),
          );
          assert.ok(bounds.bodyInset > 40, JSON.stringify(bounds));
        }
      }
    } finally {
      await browser.close();
    }
  },
);
