import { useEffect, useRef, useState } from "react";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useKeyPress, useLocalStorageState } from "ahooks";
import { Code2, FileText, PanelRight } from "lucide-react";
import { toast } from "sonner";
import { AutoResizeTitleInput } from "@/components/auto-resize-title-input";
import { BrandLogo } from "@/components/brand-logo";
import { CssEditor } from "@/components/css-editor";
import { ResumeEditorFooter } from "@/components/resume-editor-footer";
import { ResumeEditorSidebar } from "@/components/resume-editor-sidebar";
import { ResumeExportButton } from "@/components/resume-export-button";
import { getResumeFont } from "@resumeflow/shared/resume-fonts";
import { type PreviewStatus, ResumePreview } from "@/components/resume-preview";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDocumentTitle } from "@/hooks/use-document-title";
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
  const editor = useResumeEditor(resume);
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

  const [editorWidth = 520, setEditorWidth] = useLocalStorageState<number>(
    "resumeflow_editor_width",
    {
      defaultValue: () =>
        typeof window !== "undefined"
          ? Math.max(380, Math.min(window.innerWidth * 0.45, 600))
          : 520,
    },
  );
  const [sidebarOpen = true, setSidebarOpen] = useLocalStorageState<boolean>(
    "resumeflow_editor_sidebar_open",
    {
      defaultValue: () =>
        typeof window === "undefined" || window.innerWidth > 1440,
    },
  );
  const [isDragging, setIsDragging] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // 快捷键 Cmd+S / Ctrl+S 触发保存
  useKeyPress(["meta.s", "ctrl.s"], (e) => {
    e.preventDefault();
    void editor.saveVersion();
  });

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const containerRect = mainRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    const minEditorWidth = 320;
    const minPreviewWidth = 400 + (sidebarOpen ? 272 : 0);
    const maxEditorWidth = Math.max(
      minEditorWidth,
      containerRect.width - minPreviewWidth,
    );
    const clamped = Math.min(
      maxEditorWidth,
      Math.max(minEditorWidth, e.clientX - containerRect.left),
    );
    setEditorWidth(clamped);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-5">
        <div className="flex items-center gap-4 min-w-0">
          <BrandLogo />

          <div className="h-4 w-px bg-border shrink-0" />

          <div className="flex items-center gap-2 min-w-0">
            <AutoResizeTitleInput
              value={editor.name}
              placeholder="请输入简历名称"
              onChange={(e) => editor.updateTitle(e.target.value)}
              onBlur={() => void editor.commitName()}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />

            {editor.saveNotice && (
              <span className="text-xs text-muted-foreground select-none shrink-0 animate-in fade-in duration-150">
                {editor.saveNotice}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            disabled={!editor.isDirty() || editor.isPublishing}
            onClick={() => void editor.saveVersion()}
            className="h-8 gap-1.5 px-3 text-xs font-medium cursor-pointer"
            aria-label="保存并发布版本 (⌘S)"
          >
            <span>保存</span>
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

          <div className="h-4 w-px bg-border shrink-0 mx-1" />

          <Button
            size="sm"
            variant={sidebarOpen ? "secondary" : "outline"}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-8 gap-1.5 px-2.5 text-xs font-medium cursor-pointer"
            title={sidebarOpen ? "收起工具栏" : "展开工具栏"}
            aria-label={sidebarOpen ? "收起工具栏" : "展开工具栏"}
          >
            <PanelRight className="size-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">工具栏</span>
          </Button>
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
            width: `clamp(320px, ${editorWidth}px, calc(100vw - ${sidebarOpen ? 672 : 400}px))`,
          }}
          className="relative flex min-h-0 flex-col border-r bg-background shrink-0"
        >
          <div className="flex h-9 items-center justify-between border-b bg-muted/20 px-3 shrink-0">
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
                {editor.customCss.trim() && (
                  <span className="size-1.5 rounded-full bg-primary" />
                )}
              </button>
            </div>
          </div>

          {activeTab === "markdown" ? (
            <Textarea
              value={editor.content}
              onChange={(e) => editor.updateMarkdown(e.target.value)}
              spellCheck={false}
              aria-label="Markdown 编辑器"
              placeholder="在这里使用 Markdown 编写简历，支持 :::center、::::row 与 :::cell 排版指令…"
              className="h-full flex-1 resize-none rounded-none border-0 p-6 font-mono text-sm leading-relaxed shadow-none focus-visible:ring-0"
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

        <section className="min-h-0 flex-1 min-w-0 bg-muted/30 overflow-hidden relative">
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

        <ResumeEditorSidebar
          open={Boolean(sidebarOpen)}
          font={font}
          onChangeFont={editor.handleChangeFont}
          themeColor={editor.themeColor}
          onChangeThemeColor={editor.handleChangeThemeColor}
          margin={editor.margin}
          onChangeMargin={editor.handleChangeMargin}
          lineHeight={editor.lineHeight}
          onChangeLineHeight={editor.handleChangeLineHeight}
          currentLanguage={editor.currentLang}
          languages={editor.languages}
          onSelectLanguage={editor.handleSelectLanguage}
          onAddLanguage={editor.handleAddLanguage}
          onDeleteLanguage={editor.handleDeleteLanguage}
          versions={editor.history.versions}
          busyVersions={editor.history.busy}
          isDirty={editor.isDirty()}
          onSelectVersion={editor.history.switchToVersion}
          onSaveCurrent={() => editor.saveVersion()}
        />
      </main>

      <ResumeEditorFooter
        charCount={editor.content.length}
        activeTab={activeTab}
        saveStatus={editor.status}
        isPublishing={editor.isPublishing}
        isDirty={editor.isDirty()}
        previewPages={previewStatus.pages}
        previewReady={previewStatus.ready}
        previewError={previewStatus.error}
      />
    </div>
  );
}
