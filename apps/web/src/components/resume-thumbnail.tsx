import { useMemo, useRef } from "react";
import { type ResumeSummary, renderMarkdown } from "@resumeflow/shared";
import { useSize } from "ahooks";
import { FileText } from "lucide-react";
import { getResumePageCss } from "@resumeflow/shared/resume-css";

export function ResumeThumbnail({ resume }: { resume: ResumeSummary }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const size = useSize(containerRef);
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

  // A4 标准纸张宽度：794px (210mm @ 96DPI)
  const A4_WIDTH = 794;
  const containerWidth = size?.width || 180;
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
      <iframe
        title="简历缩略图"
        aria-hidden="true"
        tabIndex={-1}
        sandbox=""
        srcDoc={`<!doctype html><html><head><style>${getResumePageCss({
          font: item?.font,
          language: currentLang,
          fontBaseUrl: window.location.origin,
          themeColor: resume.themeColor,
          margin: resume.margin,
          lineHeight: resume.lineHeight,
          customCss: resume.customCss,
        })}
html,body{overflow:hidden!important}</style></head><body>${parsedHtml}</body></html>`}
        style={{
          width: A4_WIDTH,
          height: 1123,
          border: 0,
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
