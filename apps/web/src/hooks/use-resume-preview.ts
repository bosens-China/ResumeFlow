import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  InvalidMarkdownError,
  renderMarkdown,
} from "@resumeflow/shared/markdown";
import {
  DEFAULT_THEME_COLOR,
  getResumePageCss,
  RESUME_PAGE_MARGIN,
  type ResumeStyleOptions,
} from "@resumeflow/shared/resume-css";
import {
  PAPER_HEIGHT,
  previewDocument,
  type PreviewUpdate,
} from "@/lib/preview-document";

export interface PreviewStatus {
  pages: number;
  ready: boolean;
  error: string;
  imagesLoaded?: boolean;
}

export interface ResumePreviewOptions extends ResumeStyleOptions {
  content: string;
  countOnly?: boolean;
  onReadyChange?: (content: string | null) => void;
  onStatusChange?: (status: PreviewStatus) => void;
}

export function useResumePreview(
  {
    content,
    font,
    language,
    themeColor,
    margin,
    lineHeight,
    customCss,
    countOnly = false,
    onReadyChange,
    onStatusChange,
  }: ResumePreviewOptions,
  iframe: RefObject<HTMLIFrameElement | null>,
) {
  const booted = useRef(false);
  const pending = useRef<{
    update: PreviewUpdate;
    key: string;
    content: string;
  } | null>(null);
  const sequence = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callbacks = useRef({ onReadyChange, onStatusChange });
  const [retry, setRetry] = useState(0);
  const doc = useMemo(() => previewDocument(), []);
  const parsed = useMemo(() => {
    try {
      return { html: renderMarkdown(content), error: "" };
    } catch (cause) {
      return {
        html: "",
        error:
          cause instanceof InvalidMarkdownError
            ? `第 ${cause.line ?? "?"} 行：${cause.message}`
            : String(cause),
      };
    }
  }, [content]);
  const key = JSON.stringify([
    content,
    font,
    language,
    themeColor,
    margin,
    lineHeight,
    customCss,
    countOnly,
    retry,
  ]);
  const [result, setResult] = useState({
    key: "",
    pages: 0,
    height: PAPER_HEIGHT,
    error: "",
    imagesLoaded: false,
  });

  useEffect(() => {
    callbacks.current = { onReadyChange, onStatusChange };
  });

  useEffect(() => {
    function receive(event: MessageEvent) {
      const data = event.data as {
        source?: unknown;
        booted?: unknown;
        id?: unknown;
        error?: unknown;
        pages?: unknown;
        height?: unknown;
        imagesLoaded?: unknown;
      } | null;
      if (
        event.source !== iframe.current?.contentWindow ||
        data?.source !== "resumeflow-preview"
      )
        return;
      if (data.booted === true) {
        booted.current = true;
        if (pending.current)
          iframe.current?.contentWindow?.postMessage(
            pending.current.update,
            "*",
          );
        return;
      }
      const request = pending.current;
      if (!request || data.id !== request.update.id) return;
      if (typeof data.error === "string") {
        const error = data.error;
        clearTimeout(timer.current);
        setResult((old) => ({ ...old, key: request.key, error }));
      } else if (
        typeof data.pages === "number" &&
        typeof data.height === "number" &&
        Number.isSafeInteger(data.pages) &&
        data.pages > 0 &&
        Number.isFinite(data.height) &&
        data.height > 0
      ) {
        clearTimeout(timer.current);
        setResult({
          key: request.key,
          pages: data.pages,
          height: data.height,
          error: "",
          imagesLoaded: data.imagesLoaded === true,
        });
        callbacks.current.onReadyChange?.(request.content);
      }
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [iframe]);

  useEffect(() => {
    callbacks.current.onReadyChange?.(null);
    const id = ++sequence.current;
    if (parsed.error) {
      pending.current = null;
      return;
    }
    const update: PreviewUpdate = {
      source: "resumeflow-preview-update",
      id,
      html: parsed.html,
      css: getResumePageCss({
        themeColor: "var(--rf-preview-theme-color, #000000)",
        font,
        language,
        margin,
        lineHeight,
        customCss,
        fontBaseUrl: window.location.origin,
      }),
      margin: margin?.trim() || RESUME_PAGE_MARGIN,
      color: themeColor?.trim() || DEFAULT_THEME_COLOR,
      countOnly,
    };
    pending.current = { update, key, content };
    if (booted.current) iframe.current?.contentWindow?.postMessage(update, "*");
    timer.current = setTimeout(() => {
      setResult((old) => ({ ...old, key, error: "分页预览超时，请重试" }));
    }, 10_000);
    return () => clearTimeout(timer.current);
  }, [
    key,
    content,
    font,
    language,
    themeColor,
    margin,
    lineHeight,
    customCss,
    countOnly,
    parsed,
    iframe,
  ]);

  const error = parsed.error || (result.key === key ? result.error : "");
  const ready = result.key === key && result.pages > 0 && !error;
  useEffect(() => {
    callbacks.current.onStatusChange?.({
      pages: result.pages,
      ready,
      error,
      imagesLoaded: result.imagesLoaded,
    });
  }, [result.pages, result.imagesLoaded, ready, error]);

  return {
    doc,
    height: result.height,
    error,
    ready,
    retry,
    retryPreview: () => {
      booted.current = false;
      pending.current = null;
      setRetry((value) => value + 1);
    },
  };
}
