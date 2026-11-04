import { chromium, type Browser } from "playwright";
import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";
import { readFile, realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Resume } from "@resumeflow/shared";
import { resumePageCss } from "@resumeflow/shared/resume-css";
import { renderMarkdown } from "./markdown.ts";

export const pagedScriptPath = fileURLToPath(
  new URL("../dist/paged.polyfill.js", import.meta.resolve("pagedjs")),
);

let browserPromise: Promise<Browser> | undefined;
const blockedAddresses = new BlockList();
const proxyAddresses = new BlockList();
// 本机代理可能把公网 HTTPS 域名解析到 198.18/15，TLS 仍校验原域名。
proxyAddresses.addSubnet("198.18.0.0", 15);
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blockedAddresses.addSubnet(address, prefix);
for (const [address, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["64:ff9b::", 96],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
] as const)
  blockedAddresses.addSubnet(address, prefix, "ipv6");

async function imageResponse(url: URL, baseUrl: string) {
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("不支持的图片地址");
  const local = url.origin === baseUrl;
  if (local) {
    const root = fileURLToPath(
      new URL(
        process.env.NODE_ENV === "production"
          ? "../../web/dist/"
          : "../../web/public/",
        import.meta.url,
      ),
    );
    const file = await realpath(
      resolve(root, `.${decodeURIComponent(url.pathname)}`),
    );
    const inside = relative(root, file);
    if (
      !inside ||
      inside === ".." ||
      inside.startsWith(`..${sep}`) ||
      isAbsolute(inside)
    )
      throw new Error("本机图片地址不允许访问");
    const contentType = (
      {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".avif": "image/avif",
        ".svg": "image/svg+xml",
      } as Record<string, string>
    )[extname(file).toLowerCase()];
    if (!contentType || (await stat(file)).size > 5_000_000)
      throw new Error("图片格式不受支持或超过 5 MB");
    return { body: await readFile(file), contentType };
  }
  const addresses = await lookup(url.hostname, { all: true });
  const target = addresses.find(
    ({ address, family }) =>
      !blockedAddresses.check(address, family === 4 ? "ipv4" : "ipv6") ||
      (url.protocol === "https:" &&
        !isIP(url.hostname) &&
        family === 4 &&
        proxyAddresses.check(address)),
  );
  if (!target) throw new Error("图片地址不允许访问");

  return new Promise<{ body: Buffer; contentType: string }>(
    (resolve, reject) => {
      const request = (url.protocol === "https:" ? https : http).get(
        url,
        {
          hostname: target.address,
          servername: url.hostname,
          headers: { Host: url.host },
          timeout: 10_000,
        },
        (response) => {
          const contentType = String(
            response.headers["content-type"] ?? "",
          ).split(";")[0];
          const allowed = /^image\/(?:png|jpeg|webp|gif|avif|svg\+xml)$/;
          if (response.statusCode !== 200 || !allowed.test(contentType)) {
            response.destroy();
            reject(new Error("图片响应无效或格式不受支持"));
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          response.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > 5_000_000) request.destroy(new Error("图片超过 5 MB"));
            else chunks.push(chunk);
          });
          response.on("end", () =>
            resolve({ body: Buffer.concat(chunks), contentType }),
          );
          response.on("error", reject);
        },
      );
      request.on("timeout", () => request.destroy(new Error("图片加载超时")));
      request.on("error", reject);
    },
  );
}

function browser() {
  return (browserPromise ??= chromium
    .launch({ headless: true })
    .catch((error: unknown) => {
      browserPromise = undefined;
      throw error;
    }));
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]!,
  );
}

export function resumeHtml(resume: Resume, baseUrl: string) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <base href="${baseUrl}/">
  <title>${escapeHtml(resume.title)}</title>
  <style>${resumePageCss}</style>
</head>
<body><main id="source">${renderMarkdown(resume.markdown)}</main><div id="pages"></div></body>
</html>`;
}

export async function resumePdf(
  resume: Resume,
  baseUrl: string,
): Promise<Buffer> {
  const page = await (
    await browser()
  ).newPage({ viewport: { width: 794, height: 1123 } });
  try {
    const imageErrors: string[] = [];
    await page.route("**/*", async (route) => {
      if (route.request().resourceType() !== "image") return route.abort();
      try {
        const image = await imageResponse(
          new URL(route.request().url()),
          baseUrl,
        );
        await route.fulfill(image);
      } catch (error) {
        imageErrors.push(String(error));
        await route.abort();
      }
    });
    await page.setContent(resumeHtml(resume, baseUrl), { waitUntil: "load" });
    if (imageErrors.length) throw new Error(imageErrors.join("；"));
    await page.evaluate(() => {
      (
        window as typeof window & { PagedConfig: { auto: boolean } }
      ).PagedConfig = { auto: false };
    });
    await page.addScriptTag({ path: pagedScriptPath });
    await page.evaluate("document.fonts.ready");
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
    await page.evaluate(() =>
      Promise.all(
        Array.from(document.images, (image) => image.decode().catch(() => {})),
      ),
    );
    if (imageErrors.length) throw new Error(imageErrors.join("；"));
    return Buffer.from(
      await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
      }),
    );
  } finally {
    await page.close();
  }
}

export async function closePdfBrowser() {
  if (browserPromise) await (await browserPromise).close();
  browserPromise = undefined;
}
