import { useState } from "react";
import { getResumeFont, type ResumeSummary } from "@resumeflow/shared";
import { FileText } from "lucide-react";
import { ResumePreview, type PreviewStatus } from "@/components/resume-preview";

const ignoreReady = () => {};

export function ResumePageCount({ resume }: { resume: ResumeSummary }) {
  const [pages, setPages] = useState(0);
  const language = resume.currentLanguage ?? "zh";
  const item = resume.languages?.[language];

  function handleStatus(status: PreviewStatus) {
    setPages(status.ready && !status.error ? status.pages : 0);
  }

  return (
    <>
      {!pages && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed left-0 top-0 h-[1123px] w-[816px] opacity-0"
        >
          <ResumePreview
            content={item?.markdown ?? resume.markdown ?? ""}
            font={getResumeFont(item?.font, language).id}
            language={language}
            themeColor={resume.themeColor}
            margin={resume.margin}
            lineHeight={resume.lineHeight}
            customCss={resume.customCss}
            onReadyChange={ignoreReady}
            onStatusChange={handleStatus}
          />
        </div>
      )}
      {pages > 0 && (
        <span
          className="inline-flex items-center gap-1 rounded bg-muted/70 px-1.5 py-0.5 font-medium text-muted-foreground/90"
          title={`A4 排版页数: ${pages} 页`}
        >
          <FileText className="size-3 shrink-0 opacity-70" />
          <span>{pages} 页</span>
        </span>
      )}
    </>
  );
}
