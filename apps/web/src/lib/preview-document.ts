import { waitForResumeFonts } from "@resumeflow/shared/resume-fonts";
import { paginatePreview } from "./preview-pagination";

export const PREVIEW_WIDTH = 816;
export const PAPER_HEIGHT = (297 * 96) / 25.4;

export interface PreviewUpdate {
  source: "resumeflow-preview-update";
  id: number;
  html: string;
  css: string;
  margin: string;
  color: string;
  countOnly: boolean;
}

// 此函数序列化到隔离 iframe；运行时依赖通过参数传入，不能引用模块作用域。
function startPreview(
  paginate: typeof paginatePreview,
  waitFonts: typeof waitForResumeFonts,
) {
  const source = document.querySelector<HTMLElement>("#source")!;
  const pages = document.querySelector<HTMLElement>("#pages")!;
  const sheet = document.querySelector<HTMLStyleElement>("#content-style")!;
  const probe = document.querySelector<HTMLElement>("#geometry")!;
  let current: PreviewUpdate | undefined;
  let rendered: PreviewUpdate | undefined;
  let animation = 0;
  let pageCount = 0;
  let outputHeight = 0;
  let appliedHtml = "";
  const reply = (data: object) =>
    parent.postMessage({ source: "resumeflow-preview", ...data }, "*");

  async function render(update: PreviewUpdate) {
    try {
      document.documentElement.style.setProperty(
        "--rf-preview-theme-color",
        update.color,
      );
      const sameLayout =
        rendered?.html === update.html &&
        rendered?.css === update.css &&
        rendered?.margin === update.margin &&
        rendered?.countOnly === update.countOnly &&
        sheet.textContent === update.css &&
        appliedHtml === update.html;
      if (!sameLayout) {
        if (sheet.textContent !== update.css) sheet.textContent = update.css;
        if (appliedHtml !== update.html) {
          source.innerHTML = update.html;
          appliedHtml = update.html;
        }
        probe.style.padding = update.margin;
        for (const rule of sheet.sheet!.cssRules) {
          if (rule.type !== CSSRule.PAGE_RULE) continue;
          const pageRule = rule as CSSPageRule;
          // shortcut: 只处理通用 @page；需要逐页支持命名页或 :first 时再扩展。
          if (pageRule.selectorText) continue;
          for (let index = 0; index < pageRule.style.length; index++) {
            const name = pageRule.style.item(index);
            if (name !== "margin" && !name.startsWith("margin-")) continue;
            probe.style.setProperty(
              name.replace("margin", "padding"),
              pageRule.style.getPropertyValue(name),
              pageRule.style.getPropertyPriority(name),
            );
          }
        }
        const geometry = getComputedStyle(probe);
        const top = Number.parseFloat(geometry.paddingTop);
        const bottom = Number.parseFloat(geometry.paddingBottom);
        const left = Number.parseFloat(geometry.paddingLeft);
        const right = Number.parseFloat(geometry.paddingRight);
        const paperWidth = (210 * 96) / 25.4;
        const paperHeight = (297 * 96) / 25.4;
        const width = paperWidth - left - right;
        if (width < 1) throw new Error("页边距过大，纸张没有可用内容区域");
        source.style.width = `${width}px`;
        source.getBoundingClientRect();
        await waitFonts();
        await Promise.all(
          Array.from(source.querySelectorAll("img"), (image) =>
            image.decode().catch(() => {}),
          ),
        );
        if (current !== update) return;
        const slices = paginate(source, paperHeight - top - bottom);
        pageCount = slices.length;
        outputHeight = pageCount * (paperHeight + 28);
        const fragment = document.createDocumentFragment();
        if (!update.countOnly) {
          for (const slice of slices) {
            const paper = document.createElement("section");
            paper.className = "rf-preview-page";
            paper.style.cssText = `width:${paperWidth}px;height:${paperHeight}px;padding:${top}px ${right}px ${bottom}px ${left}px;box-sizing:border-box;overflow:hidden;position:relative;margin:0 auto 28px;background:white;box-shadow:0 1px 4px #0002;`;
            const clip = document.createElement("div");
            clip.style.cssText = `height:${slice.end - slice.start}px;overflow:hidden;position:relative;`;
            const copy = source.cloneNode(true) as HTMLElement;
            copy.removeAttribute("id");
            copy.style.transform = `translateY(-${slice.start}px)`;
            clip.append(copy);
            paper.append(clip);
            fragment.append(paper);
          }
        }
        pages.replaceChildren(fragment);
        rendered = update;
      }
      reply({ id: update.id, pages: pageCount, height: outputHeight });
    } catch (error) {
      if (current === update) reply({ id: update.id, error: String(error) });
    }
  }

  window.addEventListener("message", (event: MessageEvent<PreviewUpdate>) => {
    const data = event.data;
    if (
      event.source !== parent ||
      data?.source !== "resumeflow-preview-update" ||
      !Number.isSafeInteger(data.id) ||
      typeof data.html !== "string" ||
      typeof data.css !== "string" ||
      typeof data.margin !== "string" ||
      typeof data.color !== "string" ||
      typeof data.countOnly !== "boolean"
    )
      return;
    current = data;
    cancelAnimationFrame(animation);
    animation = requestAnimationFrame(() => void render(data));
  });
  reply({ booted: true });
}

export function previewDocument() {
  return `<!doctype html><html><head><meta charset="utf-8"><style id="content-style"></style>
<style>
html,body{overflow:hidden;margin:0;padding:0;background:transparent}
#measure{position:absolute;left:11px;top:0;visibility:hidden;pointer-events:none;height:0;overflow:hidden}
#geometry{position:absolute;visibility:hidden;box-sizing:border-box;width:210mm;height:297mm;pointer-events:none}
#source,.rf-preview-content{display:flow-root}
#pages{display:flow-root}
</style></head><body class="rf-root"><div id="geometry"></div><div id="measure" aria-hidden="true"><div id="source" class="rf-root rf-preview-content"></div></div><div id="pages"></div>
<script>(${startPreview.toString()})(${paginatePreview.toString()},${waitForResumeFonts.toString()});</script></body></html>`;
}
