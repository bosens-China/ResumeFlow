import { useCallback, useEffect, useRef, useState } from "react";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useKeyPress } from "ahooks";
import { Code2, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AutoResizeTitleInput } from "@/components/auto-resize-title-input";
import { BrandLogo } from "@/components/brand-logo";
import { CssEditor } from "@/components/css-editor";
import { ResumeEditorFooter } from "@/components/resume-editor-footer";
import { ResumeEditorIconRail } from "@/components/resume-editor-icon-rail";
import { ResumeExportButton } from "@/components/resume-export-button";
import { ResumeLayoutMenu } from "@/components/resume-layout-menu";
import { getResumeFont } from "@resumeflow/shared/resume-fonts";
import { type PreviewStatus, ResumePreview } from "@/components/resume-preview";
import { Button } from "@/components/ui/button";
import { MarkdownEditor } from "@/components/markdown-editor";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useEditorWidth } from "@/hooks/use-editor-width";
import { useResumeEditor } from "@/hooks/use-resume-editor";
import { DEFAULT_RESUME_NAME, getResume } from "@/lib/resume-store";

function ResumeNotFoundPage() {
  useDocumentTitle("简历不存在");
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
      <p>简历不存在或已被删除</p>
      <Button asChild variant="outline">
        <Link to="/">返回简历列表</Link>
      </Button>
    </div>
  );
}

function ResumeErrorPage({
  error,
  reset,
}: {
  error: unknown;
  reset: () => void;
}) {
  useDocumentTitle("读取失败");
  const message = error instanceof Error ? error.message : "读取简历接口失败";
  useEffect(() => {
    toast.error(`读取接口失败: ${message}`);
  }, [message]);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
      <p className="text-sm">读取简历失败，请检查网络或后端服务</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={reset}>
          重试
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/">返回简历列表</Link>
        </Button>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/resumes/$resumeId")({
  loader: async ({ params }) => {
    const resume = await getResume(params.resumeId);
    if (!resume) throw notFound();
    return resume;
  },
  notFoundComponent: ResumeNotFoundPage,
  errorComponent: ResumeErrorPage,
  component: ResumeDetailPage,
});

function ResumeDetailPage() {
  const resume = Route.useLoaderData();
  const [markdownEpoch, setMarkdownEpoch] = useState(0);
  const lastSelectionRef = useRef<{
    lang: string;
    start: number;
    end: number;
  } | null>(null);
  const resetSelection = useCallback(() => {
    lastSelectionRef.current = null;
    setMarkdownEpoch((epoch) => epoch + 1);
  }, []);
  const editor = useResumeEditor(resume, resetSelection);
  const font = getResumeFont(
    editor.languages[editor.currentLang]?.font,
    editor.currentLang,
  ).id;
  useDocumentTitle(editor.name.trim() || DEFAULT_RESUME_NAME);
  const [activeTab, setActiveTab] = useState<"markdown" | "css">("markdown");
  const [previewedContent, setPreviewedContent] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>({
    pages: 0,
    ready: false,
    error: "",
  });

  const {
    editorWidth,
    isDragging,
    mainRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useEditorWidth();
  const markdownRef = useRef<ReactCodeMirrorRef>(null);

  useEffect(() => {
    lastSelectionRef.current = null;
  }, [editor.currentLang, resume.id]);

  const handleMarkdownSelection = (start: number, end: number) => {
    lastSelectionRef.current = { lang: editor.currentLang, start, end };
  };

  const handleInsertIcon = (iconName: string) => {
    const insertText = `:icon[${iconName}] `;
    const saved =
      lastSelectionRef.current?.lang === editor.currentLang
        ? lastSelectionRef.current
        : null;

    const currentStart = saved?.start ?? editor.content.length;
    const currentEnd = saved?.end ?? editor.content.length;
    const start = Math.min(currentStart, editor.content.length);
    const end = Math.min(currentEnd, editor.content.length);
    const before = editor.content.slice(0, start);
    const after = editor.content.slice(end);
    const nextContent = `${before}${insertText}${after}`;
    const nextCursor = start + insertText.length;

    const view = activeTab === "markdown" ? markdownRef.current?.view : null;
    if (view) {
      view.dispatch({
        changes: { from: start, to: end, insert: insertText },
        selection: { anchor: nextCursor },
        scrollIntoView: true,
      });
    } else {
      setActiveTab("markdown");
      editor.updateMarkdown(nextContent);
    }
    lastSelectionRef.current = {
      lang: editor.currentLang,
      start: nextCursor,
      end: nextCursor,
    };
    toast.success(`已插入图标 :icon[${iconName}]`);

    requestAnimationFrame(() => {
      const view = markdownRef.current?.view;
      if (view) {
        view.dispatch({
          selection: { anchor: nextCursor },
          scrollIntoView: true,
        });
        view.focus();
      }
    });
  };

  useKeyPress(["meta.s", "ctrl.s"], (e) => {
    e.preventDefault();
    void editor.saveVersion();
  });

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-background/95 backdrop-blur-sm px-5">
        <div className="flex items-center gap-4 min-w-0">
          <BrandLogo />

          <div className="h-4 w-px bg-border/80 shrink-0" />

          <div className="flex items-center min-w-0">
            <AutoResizeTitleInput
              value={editor.name}
              placeholder="请输入简历名称"
              onChange={(e) => editor.updateTitle(e.target.value)}
              onBlur={() => void editor.commitName()}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            size="sm"
            variant="outline"
            disabled={!editor.isDirty() || editor.isPublishing}
            onClick={() => void editor.saveVersion()}
            className={`h-8 gap-1.5 px-3 text-xs font-medium cursor-pointer transition-colors ${
              editor.isPublishing
                ? "border-blue-300 bg-blue-50/70 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300 cursor-wait"
                : editor.isDirty()
                  ? "border-blue-300 bg-blue-50/60 text-blue-700 hover:bg-blue-100/70 hover:text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                  : "text-muted-foreground"
            }`}
            aria-label="保存并发布版本 (⌘S)"
          >
            {editor.isPublishing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : editor.isDirty() ? (
              <span className="size-1.5 rounded-full bg-blue-600 animate-pulse" />
            ) : null}
            <span>{editor.isPublishing ? "保存中…" : "保存"}</span>
          </Button>

          <ResumeExportButton
            currentLanguage={editor.currentLang}
            languages={editor.languages}
            disabled={
              previewedContent !== editor.content ||
              editor.status !== "saved" ||
              editor.exporting
            }
            exporting={editor.exporting}
            onExport={(lang) => void editor.exportPdf(lang)}
          />
        </div>
      </header>

      {editor.status === "conflict" && (
        <div
          role="alert"
          className="flex items-center gap-3 border-b bg-amber-50 px-5 py-2 text-sm text-amber-900"
        >
          <span>
            Agent 或其他页面修改了这份简历。你的输入仍保留在编辑器中。
          </span>
          <Button size="sm" variant="outline" onClick={editor.useRemote}>
            使用最新版本
          </Button>
          <Button size="sm" onClick={() => void editor.overwriteRemote()}>
            用我的内容覆盖
          </Button>
        </div>
      )}

      <main
        ref={mainRef}
        className={`flex min-h-0 flex-1 relative overflow-x-auto overflow-y-hidden ${
          isDragging ? "select-none cursor-col-resize" : ""
        }`}
      >
        <section
          style={{
            width: `clamp(320px, ${editorWidth}px, calc(100vw - 876px))`,
          }}
          className="relative flex min-h-0 flex-col border-r bg-background shrink-0"
        >
          <div className="flex min-h-9 flex-wrap items-center justify-between gap-1 border-b border-border/80 bg-muted/30 px-3 py-1 shrink-0">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab("markdown")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === "markdown"
                    ? "bg-background text-foreground shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="size-3.5" />
                <span>正文 (Markdown)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("css")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === "css"
                    ? "bg-background text-foreground shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Code2 className="size-3.5" />
                <span>自定义样式 (CSS)</span>
              </button>
            </div>
            {activeTab === "markdown" && (
              <ResumeLayoutMenu editorRef={markdownRef} />
            )}
          </div>

          {activeTab === "markdown" ? (
            <MarkdownEditor
              key={markdownEpoch}
              editorRef={markdownRef}
              value={editor.content}
              onChange={editor.updateMarkdown}
              onSelectionChange={handleMarkdownSelection}
              ariaLabel="Markdown 编辑器"
              placeholder="在这里使用 Markdown 编写简历，支持 ::::row 与 :::cell 排版指令…"
              className="h-full flex-1"
            />
          ) : (
            <CssEditor
              value={editor.customCss}
              onChange={editor.updateCustomCss}
              error={editor.cssError}
              onFormat={editor.formatCss}
              isFormatting={editor.isFormattingCss}
            />
          )}
        </section>

        <div
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label="调整编辑器大小"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="group relative -ml-1 flex w-2 z-20 cursor-col-resize items-center justify-center hover:bg-primary/10 active:bg-primary/20 transition-colors"
        >
          <div
            className={`h-8 w-1 rounded-full transition-colors ${
              isDragging ? "bg-primary" : "bg-border group-hover:bg-primary/60"
            }`}
          />
        </div>

        <section className="min-h-0 flex-1 min-w-0 bg-slate-100/70 dark:bg-slate-900/60 overflow-hidden relative">
          {isDragging && (
            <div className="absolute inset-0 z-30 cursor-col-resize" />
          )}
          <ResumePreview
            content={editor.content}
            font={font}
            language={editor.currentLang}
            themeColor={editor.themeColor}
            margin={editor.margin}
            lineHeight={editor.lineHeight}
            customCss={editor.customCss}
            onReadyChange={setPreviewedContent}
            onStatusChange={setPreviewStatus}
          />
        </section>

        <ResumeEditorIconRail
          font={font}
          onChangeFont={editor.handleChangeFont}
          themeColor={editor.themeColor}
          onChangeThemeColor={editor.handleChangeThemeColor}
          margin={editor.margin}
          onChangeMargin={editor.handleChangeMargin}
          lineHeight={editor.lineHeight}
          onChangeLineHeight={editor.handleChangeLineHeight}
          onInsertIcon={handleInsertIcon}
          currentLanguage={editor.currentLang}
          languages={editor.languages}
          onSelectLanguage={(lang) => {
            if (lang !== editor.currentLang) resetSelection();
            editor.handleSelectLanguage(lang);
          }}
          onAddLanguage={(lang, copy) => {
            resetSelection();
            editor.handleAddLanguage(lang, copy);
          }}
          onDeleteLanguage={(lang) => {
            if (lang === editor.currentLang) resetSelection();
            editor.handleDeleteLanguage?.(lang);
          }}
          versions={editor.history.versions}
          busyVersions={editor.history.busy}
          isDirty={editor.isDirty()}
          onSelectVersion={(id) => editor.history.switchToVersion(id)}
          onSaveCurrent={() => editor.saveVersion()}
        />
      </main>

      <ResumeEditorFooter
        charCount={editor.content.length}
        activeTab={activeTab}
        saveStatus={editor.status}
        isPublishing={editor.isPublishing}
        isDirty={editor.isDirty()}
        saveNotice={editor.saveNotice}
        previewPages={previewStatus.pages}
        previewReady={previewStatus.ready}
        previewError={previewStatus.error}
      />
    </div>
  );
}
