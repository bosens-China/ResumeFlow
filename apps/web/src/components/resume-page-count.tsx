import { useRef, useState } from "react";
import { getResumeFont, type ResumeSummary } from "@resumeflow/shared";
import { FileText } from "lucide-react";
import {
  useResumePreview,
  type ResumePreviewOptions,
} from "@/hooks/use-resume-preview";
import { PREVIEW_WIDTH } from "@/lib/preview-document";

function PageMeasurement(props: ResumePreviewOptions) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const preview = useResumePreview({ ...props, countOnly: true }, iframe);
  return (
    <iframe
      ref={iframe}
      title="计算简历页数"
      srcDoc={preview.doc}
      sandbox="allow-scripts"
      aria-hidden="true"
      tabIndex={-1}
      className="pointer-events-none fixed left-0 top-0 h-px opacity-0 border-0"
      style={{ width: PREVIEW_WIDTH }}
    />
  );
}

export function ResumePageCount({ resume }: { resume: ResumeSummary }) {
  const language = resume.currentLanguage ?? "zh";
  const item = resume.languages?.[language];
  const options = {
    content: item?.markdown ?? resume.markdown ?? "",
    font: getResumeFont(item?.font, language).id,
    language,
    margin: resume.margin,
    lineHeight: resume.lineHeight,
    customCss: resume.customCss,
  };
  const key = JSON.stringify(options);
  const [result, setResult] = useState({ key: "", pages: 0, error: "" });
  const current = result.key === key;
  const pages = current ? result.pages : 0;

  return (
    <>
      {!current && (
        <PageMeasurement
          key={key}
          {...options}
          onStatusChange={(status) => {
            if (status.ready || status.error)
              setResult({
                key,
                pages: status.error ? 0 : status.pages,
                error: status.error,
              });
          }}
        />
      )}
      {pages > 0 && (
        <span
          className="inline-flex items-center gap-1 rounded bg-muted/70 px-1.5 py-0.5 font-medium text-muted-foreground/90"
          title={`A4 预览约 ${pages} 页，最终以导出 PDF 为准`}
        >
          <FileText className="size-3 shrink-0 opacity-70" />
          <span>{pages} 页</span>
        </span>
      )}
      {current && result.error && (
        <button
          type="button"
          className="text-xs text-muted-foreground underline"
          title={result.error}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setResult({ key: "", pages: 0, error: "" });
          }}
        >
          重试页数
        </button>
      )}
    </>
  );
}
