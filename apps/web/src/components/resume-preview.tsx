import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import {
  InvalidMarkdownError,
  renderMarkdown,
} from "@resumeflow/shared/markdown";
import {
  getResumePageCss,
  type ResumeStyleOptions,
} from "@resumeflow/shared/resume-css";
import {
  waitForResumeFonts,
  type ResumeFontId,
} from "@resumeflow/shared/resume-fonts";

const PAGE_WIDTH = 816;

interface Parsed {
  html: string;
  error: string;
}
interface Frame {
  id: number;
  source: string;
  retry: number;
  doc: string;
  height: number;
  pages: number;
}

function parse(content: string): Parsed {
  try {
    return { html: renderMarkdown(content), error: "" };
  } catch (cause) {
    const error =
      cause instanceof InvalidMarkdownError
        ? `第 ${cause.line ?? "?"} 行：${cause.message}`
        : String(cause);
    return { html: "", error };
  }
}

function previewDocument(
  html: string,
  id: number,
  styles?: ResumeStyleOptions,
) {
  const pageCss = getResumePageCss({
    ...styles,
    fontBaseUrl: window.location.origin,
  });
  return `<!doctype html><html><head><meta charset="utf-8">
<style>${pageCss}</style>
<style media="screen">
  html, body { overflow: hidden; margin: 0; padding: 0; background: transparent; }
  .pagedjs_pages { display: flex; flex-direction: column; align-items: center; padding: 0 0 24px; }
  .pagedjs_page {
    margin: 0 auto 28px;
    background: #ffffff;
    box-sizing: border-box;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 2px;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 8px 16px -4px rgba(0, 0, 0, 0.06), 0 2px 4px -2px rgba(0, 0, 0, 0.04);
  }
</style>
<script>window.PagedConfig={auto:false};</script><script src="/api/pagedjs.js"></script>
</head><body class="rf-root"><main id="source" class="rf-root">${html}</main><div id="pages"></div>
<script>(async()=>{
  const source=document.querySelector('#source'); const content=source.innerHTML;
  await (${waitForResumeFonts.toString()})();
  source.remove();
  const paged=window.PagedPolyfill;
  await paged.preview(content,paged.removeStyles(),document.querySelector('#pages'));
  await (${waitForResumeFonts.toString()})();
  parent.postMessage({source:'resumeflow-preview',id:${id},height:document.documentElement.scrollHeight,pages:document.querySelectorAll('.pagedjs_page').length},'*');
})().catch(error=>parent.postMessage({source:'resumeflow-preview',id:${id},error:String(error)},'*'));</script>
</body></html>`;
}

export interface PreviewStatus {
  pages: number;
  ready: boolean;
  error: string;
}

export function ResumePreview({
  content,
  font,
  language,
  themeColor,
  margin,
  lineHeight,
  customCss,
  onReadyChange,
  onStatusChange,
}: {
  content: string;
  font?: ResumeFontId;
  language?: string;
  themeColor?: string;
  margin?: string;
  lineHeight?: number;
  customCss?: string;
  onReadyChange: (content: string | null) => void;
  onStatusChange?: (status: PreviewStatus) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const iframe = useRef<(HTMLIFrameElement | null)[]>([null, null]);
  const active = useRef(0);
  const requestId = useRef(0);
  const completedId = useRef(0);
  const generation = useRef({
    html: "",
    content: "",
    retry: 0,
    themeColor,
    margin,
    lineHeight,
    customCss,
    font,
    language,
  });
  const [retry, setRetry] = useState(0);
  const parsed = useMemo(() => parse(content), [content]);
  const source = useMemo(
    () =>
      JSON.stringify([
        parsed.html,
        font,
        language,
        themeColor,
        margin,
        lineHeight,
        customCss,
      ]),
    [parsed.html, font, language, themeColor, margin, lineHeight, customCss],
  );
  const [frames, setFrames] = useState<[Frame | null, Frame | null]>([
    null,
    null,
  ]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [failure, setFailure] = useState<{
    html: string;
    retry: number;
    message: string;
  } | null>(null);

  useEffect(() => {
    onReadyChange(null);
    const id = ++requestId.current;
    generation.current = {
      html: source,
      content,
      retry,
      themeColor,
      margin,
      lineHeight,
      customCss,
      font,
      language,
    };
    if (parsed.error) return;
    const timer = setTimeout(() => {
      const index = 1 - active.current;
      setFrames((old) => {
        const next = [...old] as [Frame | null, Frame | null];
        next[index] = {
          id,
          source,
          retry,
          doc: previewDocument(parsed.html, id, {
            themeColor,
            margin,
            lineHeight,
            customCss,
            font,
            language,
          }),
          height: 1123,
          pages: 0,
        };
        return next;
      });
    }, 180);
    const timeout = setTimeout(() => {
      if (requestId.current === id && completedId.current !== id)
        setFailure({
          html: source,
          retry,
          message: "分页预览超时，请重试",
        });
    }, 10_000);
    return () => {
      clearTimeout(timer);
      clearTimeout(timeout);
    };
  }, [
    content,
    parsed.html,
    parsed.error,
    source,
    retry,
    themeColor,
    margin,
    lineHeight,
    customCss,
    font,
    language,
    onReadyChange,
  ]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        source?: string;
        id?: number;
        height?: number;
        pages?: number;
        error?: string;
      };
      if (
        data?.source !== "resumeflow-preview" ||
        data.id !== requestId.current
      )
        return;
      const index = iframe.current.findIndex(
        (item) => item?.contentWindow === event.source,
      );
      if (index < 0) return;
      if (data.error) {
        completedId.current = data.id;
        setFailure({ ...generation.current, message: data.error });
        return;
      }
      setFrames((old) => {
        if (old[index]?.id !== data.id) return old;
        const next = [...old] as [Frame | null, Frame | null];
        next[index] = {
          ...old[index]!,
          height: data.height ?? 1123,
          pages: data.pages ?? 1,
        };
        return next;
      });
      active.current = index;
      completedId.current = data.id;
      onReadyChange(generation.current.content);
      setActiveIndex(index);
      setFailure(null);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onReadyChange]);

  const visible = frames[activeIndex];
  const previewError =
    failure?.html === source && failure.retry === retry ? failure.message : "";
  const ready =
    visible?.source === source && visible.retry === retry && !!visible.pages;

  useEffect(() => {
    onStatusChange?.({
      pages: visible?.pages ?? 0,
      ready,
      error: parsed.error || previewError,
    });
  }, [visible?.pages, ready, parsed.error, previewError, onStatusChange]);

  return (
    <div
      ref={container}
      className="relative h-full overflow-auto bg-muted/50 py-6"
    >
      {(parsed.error || previewError) && (
        <div
          role="alert"
          className="sticky top-2 z-10 mx-auto mb-4 flex max-w-lg items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 shadow-sm"
        >
          <AlertCircle className="size-4 shrink-0" />
          {parsed.error || previewError}
          {previewError && (
            <button
              type="button"
              className="ml-auto underline"
              onClick={() => setRetry((value) => value + 1)}
            >
              重试预览
            </button>
          )}
        </div>
      )}
      <div
        className="relative mx-auto"
        style={{
          width: PAGE_WIDTH,
          height: visible?.height ?? 1123,
        }}
      >
        {frames.map(
          (frame, index) =>
            frame && (
              <iframe
                key={index}
                ref={(node) => {
                  iframe.current[index] = node;
                }}
                title="简历分页预览"
                srcDoc={frame.doc}
                sandbox="allow-scripts"
                aria-hidden={activeIndex !== index}
                className="absolute left-0 top-0 border-0"
                style={{
                  width: PAGE_WIDTH,
                  height: frame.height,
                  opacity: activeIndex === index ? 1 : 0,
                  pointerEvents: activeIndex === index ? "auto" : "none",
                }}
              />
            ),
        )}
      </div>
    </div>
  );
}
