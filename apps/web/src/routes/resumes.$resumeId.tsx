import { useCallback, useEffect, useRef, useState } from "react";
import type { Resume, ResumeChangedEvent } from "@resumeflow/shared";
import {
  Link,
  createFileRoute,
  notFound,
  useBlocker,
} from "@tanstack/react-router";
import { ArrowLeft, Check, Download, Loader2 } from "lucide-react";
import { ResumePreview } from "@/components/resume-preview";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ApiError,
  DEFAULT_RESUME_NAME,
  getResume,
  updateResume,
} from "@/lib/resume-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/resumes/$resumeId")({
  loader: async ({ params }) => {
    const resume = await getResume(params.resumeId);
    if (!resume) throw notFound();
    return resume;
  },
  notFoundComponent: () => (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
      <p>简历不存在或已被删除</p>
      <Button asChild variant="outline">
        <Link to="/">返回简历列表</Link>
      </Button>
    </div>
  ),
  component: ResumeDetailPage,
});

type SaveStatus = "saved" | "saving" | "error" | "conflict";

const AUTOSAVE_DELAY = 400;

/**
 * 宽度随内容实时自适应的内联输入框
 * 原理：通过同单元格的隐形镜像 span 撑开 grid 容器，让真实 input 的宽度 100% 像素级贴合文字长度
 */
function AutoResizeTitleInput({
  value,
  placeholder,
  onChange,
  onBlur,
  onKeyDown,
  className,
}: {
  value: string;
  placeholder?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
}) {
  return (
    <div className="inline-grid grid-cols-[minmax(0,1fr)] items-center max-w-[420px] min-w-[60px]">
      {/* 隐形镜像文本：严格保持与 input 一致的字号字重内边距 */}
      <span
        aria-hidden="true"
        className="invisible col-start-1 row-start-1 whitespace-pre px-2 py-1 text-sm font-semibold select-none pointer-events-none"
      >
        {value || placeholder || " "}
      </span>

      {/* 真实输入框：绝对铺满镜像撑开的实际宽度 */}
      <input
        type="text"
        size={1}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label="简历名称"
        className={cn(
          "col-start-1 row-start-1 w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-semibold shadow-none transition-colors",
          "hover:bg-muted/50 focus-visible:border-input focus-visible:bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          className,
        )}
      />
    </div>
  );
}

function ResumeDetailPage() {
  const resume = Route.useLoaderData();
  const [name, setName] = useState(resume.title);
  const [content, setContent] = useState(resume.markdown);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [message, setMessage] = useState("");
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [remote, setRemote] = useState<Resume | null>(null);
  const [revision, setRevision] = useState(resume.revision);
  const [previewedContent, setPreviewedContent] = useState<string | null>(null);
  const draft = useRef({ title: resume.title, markdown: resume.markdown });
  const committed = useRef(resume);
  const conflicting = useRef<Resume | null>(null);
  const saving = useRef<Promise<boolean> | null>(null);

  const save = useCallback(async (): Promise<boolean> => {
    if (conflicting.current) return false;
    if (saving.current) return saving.current;
    const task = (async () => {
      while (!conflicting.current) {
        const base = committed.current;
        const current = draft.current;
        const nextTitle = current.title.trim();
        const patch = {
          ...(nextTitle && nextTitle !== base.title
            ? { title: nextTitle }
            : {}),
          ...(current.markdown !== base.markdown
            ? { markdown: current.markdown }
            : {}),
        };
        if (!Object.keys(patch).length) {
          setStatus("saved");
          return true;
        }
        setStatus("saving");
        try {
          const updated = await updateResume(resume.id, base.revision, patch);
          committed.current = updated;
          setRevision(updated.revision);
        } catch (cause) {
          if (
            cause instanceof ApiError &&
            cause.status === 409 &&
            cause.current
          ) {
            conflicting.current = cause.current;
            setRemote(cause.current);
            setStatus("conflict");
          } else {
            setMessage(cause instanceof Error ? cause.message : "保存失败");
            setStatus("error");
          }
          return false;
        }
      }
      return false;
    })();
    saving.current = task;
    try {
      return await task;
    } finally {
      saving.current = null;
    }
  }, [resume.id]);

  useBlocker({
    shouldBlockFn: async () => !(await save()),
    enableBeforeUnload: () =>
      draft.current.title !== committed.current.title ||
      draft.current.markdown !== committed.current.markdown ||
      !!saving.current,
  });

  useEffect(() => {
    if (content === committed.current.markdown || conflicting.current) return;
    setStatus("saving");
    const timer = setTimeout(() => {
      void save();
    }, AUTOSAVE_DELAY);
    return () => clearTimeout(timer);
  }, [content, save]);

  useEffect(() => {
    const events = new EventSource("/api/events");
    events.addEventListener("resume-changed", (raw) => {
      const event = JSON.parse(
        (raw as MessageEvent).data,
      ) as ResumeChangedEvent;
      if (event.id !== resume.id) return;
      void (async () => {
        if (saving.current) await saving.current;
        const latest = await getResume(resume.id);
        if (!latest) {
          setMessage("简历已被删除");
          setStatus("error");
          return;
        }
        if (latest.revision <= committed.current.revision) return;
        if (
          draft.current.title !== committed.current.title ||
          draft.current.markdown !== committed.current.markdown
        ) {
          conflicting.current = latest;
          setRemote(latest);
          setStatus("conflict");
          return;
        }
        committed.current = latest;
        draft.current = { title: latest.title, markdown: latest.markdown };
        setName(latest.title);
        setContent(latest.markdown);
        setRevision(latest.revision);
        setStatus("saved");
      })().catch((cause: unknown) => {
        setMessage(String(cause));
        setStatus("error");
      });
    });
    return () => events.close();
  }, [resume.id]);

  async function commitName() {
    const next = name.trim();
    if (!next) {
      draft.current.title = committed.current.title || DEFAULT_RESUME_NAME;
      setName(draft.current.title);
      return;
    }
    setName(next);
    draft.current.title = next;
    await save();
  }

  function useRemote() {
    if (!remote) return;
    committed.current = remote;
    draft.current = { title: remote.title, markdown: remote.markdown };
    conflicting.current = null;
    setName(remote.title);
    setContent(remote.markdown);
    setRevision(remote.revision);
    setRemote(null);
    setStatus("saved");
  }

  async function overwriteRemote() {
    if (!remote) return;
    committed.current = remote;
    conflicting.current = null;
    setRemote(null);
    setRevision(remote.revision);
    await save();
  }

  async function exportPdf() {
    if (!(await save())) return;
    setExporting(true);
    setExportError("");
    try {
      const response = await fetch(
        `/api/resumes/${resume.id}/pdf?revision=${committed.current.revision}`,
      );
      if (!response.ok)
        throw new Error(((await response.json()) as { error: string }).error);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${committed.current.title}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : "PDF 导出失败");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* 顶部工具栏：通栏结构，与首页统一 */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-5">
        {/* 左侧：返回按钮 + 分割线 + 自适应宽度标题 + 紧跟其后的保存状态徽标 */}
        <div className="flex items-center gap-3 min-w-0">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="返回简历列表"
          >
            <Link to="/">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>

          <div className="h-4 w-px bg-border shrink-0" />

          {/* 标题与保存徽标：紧密结合 */}
          <div className="flex items-center gap-2 min-w-0">
            {/* 宽度随输入文字长度 100% 自动贴合的标题输入框 */}
            <AutoResizeTitleInput
              value={name}
              placeholder="请输入简历名称"
              onChange={(e) => {
                draft.current.title = e.target.value;
                setName(e.target.value);
              }}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />

            {/* 保存状态徽标：紧贴标题末尾，shrink-0 绝对不换行 */}
            <div className="shrink-0 flex items-center">
              {status === "saving" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/90 px-2.5 py-0.5 text-xs font-medium text-amber-700 select-none whitespace-nowrap">
                  <Loader2 className="size-3 animate-spin text-amber-600" />
                  <span>保存中…</span>
                </span>
              ) : status === "saved" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50/80 px-2.5 py-0.5 text-xs font-medium text-emerald-700 select-none whitespace-nowrap">
                  <Check className="size-3 text-emerald-600 stroke-[2.5]" />
                  <span>已保存</span>
                </span>
              ) : (
                <span className="text-xs text-destructive">
                  {status === "conflict" ? "编辑冲突" : "保存失败"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 右侧：导出 PDF 主操作按钮 */}
        <div className="flex items-center gap-3 shrink-0">
          <Button
            onClick={() => void exportPdf()}
            disabled={
              previewedContent !== content || status !== "saved" || exporting
            }
            className="gap-1.5 shadow-sm font-medium"
          >
            <Download className="size-4" />
            {exporting ? "导出中…" : "导出 PDF"}
          </Button>
        </div>
      </header>

      {status === "conflict" && (
        <div
          role="alert"
          className="flex items-center gap-3 border-b bg-amber-50 px-5 py-2 text-sm text-amber-900"
        >
          <span>
            Agent 或其他页面修改了这份简历。你的输入仍保留在编辑器中。
          </span>
          <Button size="sm" variant="outline" onClick={useRemote}>
            使用最新版本
          </Button>
          <Button size="sm" onClick={() => void overwriteRemote()}>
            用我的内容覆盖
          </Button>
        </div>
      )}
      {status === "error" && (
        <div
          role="alert"
          className="flex items-center gap-3 border-b px-5 py-2 text-sm text-destructive"
        >
          <span>{message}</span>
          <Button size="sm" variant="outline" onClick={() => void save()}>
            重试保存
          </Button>
        </div>
      )}
      {exportError && (
        <div
          role="alert"
          className="border-b px-5 py-2 text-sm text-destructive"
        >
          PDF 导出失败：{exportError}
        </div>
      )}

      {/* 主体双栏区域：左侧编辑器 + 右侧实时渲染 */}
      <main className="grid min-h-0 flex-1 grid-cols-2">
        <section className="relative flex min-h-0 flex-col border-r bg-background">
          <Textarea
            value={content}
            onChange={(e) => {
              draft.current.markdown = e.target.value;
              setContent(e.target.value);
            }}
            spellCheck={false}
            aria-label="Markdown 编辑器"
            placeholder="在这里使用 Markdown 编写简历，支持 :::center、::::row 与 :::cell 排版指令…"
            className="h-full flex-1 resize-none rounded-none border-0 p-6 font-mono text-sm leading-relaxed shadow-none focus-visible:ring-0"
          />
        </section>

        <section className="min-h-0 bg-muted/30">
          <ResumePreview
            content={content}
            revision={revision}
            onReadyChange={setPreviewedContent}
          />
        </section>
      </main>
    </div>
  );
}
