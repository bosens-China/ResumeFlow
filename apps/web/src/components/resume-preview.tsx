import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import {
  InvalidMarkdownError,
  renderMarkdown,
} from "@resumeflow/shared/markdown";
import { resumePageCss } from "@resumeflow/shared/resume-css";

const PAGE_WIDTH = 794;

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

function previewDocument(html: string, id: number) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<style>${resumePageCss}</style>
<style media="screen">body { background:#f4f4f5; } .pagedjs_page { margin:0 0 20px; background:#fff; box-shadow:0 4px 16px #0002; }</style>
<script>window.PagedConfig={auto:false};</script><script src="/api/pagedjs.js"></script>
</head><body><main id="source">${html}</main><div id="pages"></div>
<script>(async()=>{
  const source=document.querySelector('#source'); const content=source.innerHTML; source.remove();
  await document.fonts.ready;
  const paged=window.PagedPolyfill;
  await paged.preview(content,paged.removeStyles(),document.querySelector('#pages'));
  parent.postMessage({source:'resumeflow-preview',id:${id},height:document.documentElement.scrollHeight,pages:document.querySelectorAll('.pagedjs_page').length},'*');
})().catch(error=>parent.postMessage({source:'resumeflow-preview',id:${id},error:String(error)},'*'));</script>
</body></html>`;
}

export function ResumePreview({
  content,
  revision,
  onReadyChange,
}: {
  content: string;
  revision: number;
  onReadyChange: (content: string | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const iframe = useRef<(HTMLIFrameElement | null)[]>([null, null]);
  const active = useRef(0);
  const requestId = useRef(0);
  const completedId = useRef(0);
  const generation = useRef({ html: "", content: "", retry: 0 });
  const [scale, setScale] = useState(1);
  const [retry, setRetry] = useState(0);
  const parsed = useMemo(() => parse(content), [content]);
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
    const el = container.current;
    if (!el) return;
    const resize = () =>
      setScale(Math.min(1, Math.max(0.3, (el.clientWidth - 48) / PAGE_WIDTH)));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    onReadyChange(null);
    const id = ++requestId.current;
    generation.current = { html: parsed.html, content, retry };
    if (parsed.error) return;
    const timer = setTimeout(() => {
      const index = 1 - active.current;
      setFrames((old) => {
        const next = [...old] as [Frame | null, Frame | null];
        next[index] = {
          id,
          source: parsed.html,
          retry,
          doc: previewDocument(parsed.html, id),
          height: 1123,
          pages: 0,
        };
        return next;
      });
    }, 180);
    const timeout = setTimeout(() => {
      if (requestId.current === id && completedId.current !== id)
        setFailure({
          html: parsed.html,
          retry,
          message: "分页预览超时，请重试",
        });
    }, 10_000);
    return () => {
      clearTimeout(timer);
      clearTimeout(timeout);
    };
  }, [content, parsed.html, parsed.error, retry, onReadyChange]);

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
    failure?.html === parsed.html && failure.retry === retry
      ? failure.message
      : "";
  const ready =
    visible?.source === parsed.html &&
    visible.retry === retry &&
    !!visible.pages;
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
      <div className="mx-auto mb-2 w-fit text-xs text-muted-foreground">
        {parsed.error || previewError
          ? "分页预览失败"
          : ready
            ? `${visible.pages} 页 · 已保存版本 ${revision} · 输入实时预览`
            : "正在生成分页预览…"}
      </div>
      <div
        className="relative mx-auto"
        style={{
          width: PAGE_WIDTH * scale,
          height: (visible?.height ?? 1123) * scale,
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
                className="absolute left-0 top-0 border-0"
                style={{
                  width: PAGE_WIDTH,
                  height: frame.height,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  visibility: activeIndex === index ? "visible" : "hidden",
                }}
              />
            ),
        )}
      </div>
    </div>
  );
}
