import { useMemo, useRef, useState } from "react";
import { getResumeFont, type ResumeSummary } from "@resumeflow/shared";
import { FileText } from "lucide-react";
import {
  useResumePreview,
  type ResumePreviewOptions,
} from "@/hooks/use-resume-preview";
import { PREVIEW_WIDTH } from "@/lib/preview-document";

interface PageCountResult {
  key: string;
  pages: number;
  error: string;
}

// shortcut: bump cache version if pagination rules change without an app version bump.
const CACHE_PREFIX = `resumeflow_page_count_v2_${__APP_VERSION__}:`;
const memoryCache = new Map<string, PageCountResult>();

function fingerprint(value: string) {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index++) {
    hash = BigInt.asUintN(
      64,
      (hash ^ BigInt(value.charCodeAt(index))) * 0x100000001b3n,
    );
  }
  return `${value.length}:${hash.toString(16)}`;
}

function readCachedCount(id: string, key: string): PageCountResult | null {
  const memory = memoryCache.get(id);
  if (memory?.key === key) return memory;
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${id}`);
    if (!raw) return null;
    const saved = JSON.parse(raw) as PageCountResult;
    return saved.key === key &&
      Number.isSafeInteger(saved.pages) &&
      saved.pages > 0
      ? saved
      : null;
  } catch {
    return null;
  }
}

function cacheCount(id: string, result: PageCountResult) {
  memoryCache.set(id, result);
  try {
    localStorage.setItem(`${CACHE_PREFIX}${id}`, JSON.stringify(result));
  } catch {
    // The in-memory result still survives route changes when storage is unavailable.
  }
}

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
    themeColor: resume.themeColor,
    margin: resume.margin,
    lineHeight: resume.lineHeight,
    customCss: resume.customCss,
  };
  const key = fingerprint(JSON.stringify(options));
  const cached = useMemo(
    () => readCachedCount(resume.id, key),
    [resume.id, key],
  );
  const [result, setResult] = useState<PageCountResult>({
    key: "",
    pages: 0,
    error: "",
  });
  const shown = result.key === key ? result : cached;
  const current = shown?.key === key;
  const pages = current ? shown.pages : 0;

  return (
    <>
      {!current && (
        <PageMeasurement
          key={key}
          {...options}
          onStatusChange={(status) => {
            if (status.ready || status.error) {
              const next = {
                key,
                pages: status.error ? 0 : status.pages,
                error: status.error,
              };
              if (status.ready && status.imagesLoaded)
                cacheCount(resume.id, next);
              setResult(next);
            }
          }}
        />
      )}
      {!(current && shown.error) && (
        <span
          className={`inline-flex min-w-14 items-center justify-center gap-1 rounded bg-muted/70 px-1.5 py-0.5 font-medium text-muted-foreground/90 ${pages > 0 ? "" : "invisible"}`}
          title={
            pages > 0 ? `A4 预览约 ${pages} 页，最终以导出 PDF 为准` : undefined
          }
          aria-hidden={pages === 0}
        >
          <FileText className="size-3 shrink-0 opacity-70" />
          <span>{pages || 0} 页</span>
        </span>
      )}
      {current && shown.error && (
        <button
          type="button"
          className="inline-flex min-w-14 justify-center text-xs text-muted-foreground underline"
          title={shown.error}
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
