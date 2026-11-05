import { useMemo } from "react";
import { type ResumeSummary, renderMarkdown } from "@resumeflow/shared";
import { FileText } from "lucide-react";

export function ResumeThumbnail({ resume }: { resume: ResumeSummary }) {
  const currentLang = resume.currentLanguage ?? "zh";
  const item = resume.languages?.[currentLang];
  const activeMarkdown = (item?.markdown ?? resume.markdown ?? "").trim();
  const activeTitle = (item?.title ?? resume.title).trim();
  const themeColor = resume.themeColor?.trim() || "#111827";

  const parsedHtml = useMemo(() => {
    if (!activeMarkdown) return null;
    try {
      return renderMarkdown(activeMarkdown);
    } catch {
      return null;
    }
  }, [activeMarkdown]);

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
    <div
      className="rf-thumbnail-paper"
      style={
        {
          "--rf-preview-theme": themeColor,
        } as React.CSSProperties
      }
    >
      <div
        className="rf-thumbnail-content"
        dangerouslySetInnerHTML={{ __html: parsedHtml }}
      />
      {/* 底部平滑羽化渐变，长内容自然截断 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-white to-transparent" />
    </div>
  );
}
