import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { type ResumeSummary, renderMarkdown } from "@resumeflow/shared";
import { FileText } from "lucide-react";
import {
  getResumePageCss,
  RESUME_PAGE_MARGIN,
} from "@resumeflow/shared/resume-css";

export function ResumeThumbnail({ resume }: { resume: ResumeSummary }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(180);
  const currentLang = resume.currentLanguage ?? "zh";
  const item = resume.languages?.[currentLang];
  const activeMarkdown = (item?.markdown ?? resume.markdown ?? "").trim();
  const activeTitle = (item?.title ?? resume.title).trim();

  const parsedHtml = useMemo(() => {
    if (!activeMarkdown) return null;
    try {
      return renderMarkdown(activeMarkdown);
    } catch {
      return null;
    }
  }, [activeMarkdown]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => setContainerWidth(container.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [parsedHtml]);

  useLayoutEffect(() => {
    const host = shadowRef.current;
    if (!host || !parsedHtml) return;
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    const style =
      shadow.querySelector("style") ??
      shadow.appendChild(document.createElement("style"));
    const html =
      shadow.querySelector("html") ??
      shadow.appendChild(document.createElement("html"));
    const body =
      html.querySelector("body") ??
      html.appendChild(document.createElement("body"));
    style.textContent = `${getResumePageCss({
      font: item?.font,
      language: currentLang,
      fontBaseUrl: window.location.origin,
      themeColor: resume.themeColor,
      margin: resume.margin,
      lineHeight: resume.lineHeight,
      customCss: resume.customCss,
    }).replaceAll(
      ":root",
      ":host",
    )}\nbody{box-sizing:border-box;width:794px;min-height:1123px;padding:${resume.margin?.trim() || RESUME_PAGE_MARGIN};overflow:hidden}`;
    body.innerHTML = parsedHtml;
  }, [
    parsedHtml,
    currentLang,
    item?.font,
    resume.themeColor,
    resume.margin,
    resume.lineHeight,
    resume.customCss,
  ]);

  // A4 标准纸张宽度：794px (210mm @ 96DPI)
  const A4_WIDTH = 794;
  const scale = containerWidth / A4_WIDTH;

  if (!parsedHtml) {
    return (
      <div className="rf-thumbnail-paper flex flex-col items-center justify-center p-4 text-center select-none">
        <div className="mb-2 flex size-8 items-center justify-center rounded-full bg-muted/70 text-muted-foreground/60">
          <FileText className="size-4" />
        </div>
        <span className="truncate max-w-[85%] text-xs font-medium text-foreground/75">
          {activeTitle || "空白简历"}
        </span>
        <span className="mt-0.5 text-[10px] text-muted-foreground/50">
          暂无正文内容
        </span>
        <div className="mt-3 flex w-3/4 flex-col gap-1.5 opacity-25">
          <div className="h-1 w-full rounded-xs bg-muted-foreground/40" />
          <div className="mx-auto h-1 w-2/3 rounded-xs bg-muted-foreground/30" />
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="rf-thumbnail-paper">
      <div
        ref={shadowRef}
        aria-hidden="true"
        style={{
          width: A4_WIDTH,
          height: 1123,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      />
      {/* 底部平滑羽化渐变，长内容自然截断 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-white to-transparent" />
    </div>
  );
}
