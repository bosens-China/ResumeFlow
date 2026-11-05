interface ResumeEditorFooterProps {
  charCount: number;
  activeTab: "markdown" | "css";
  saveStatus: "saved" | "saving" | "error" | "conflict";
  isPublishing: boolean;
  isDirty: boolean;
  previewPages: number;
  previewReady: boolean;
  previewError: string;
}

export function ResumeEditorFooter({
  charCount,
  activeTab,
  saveStatus,
  isPublishing,
  isDirty,
  previewPages,
  previewReady,
  previewError,
}: ResumeEditorFooterProps) {
  return (
    <footer className="flex h-8 shrink-0 items-center justify-between border-t bg-background px-4 text-xs text-muted-foreground select-none z-10">
      {/* 左侧：字符统计、编辑模式与暂存状态 */}
      <div className="flex items-center gap-3">
        <span className="font-mono">{charCount} 字符</span>
        <span className="h-3 w-px bg-border" />
        <span>{activeTab === "markdown" ? "Markdown 编辑" : "自定义 CSS"}</span>
        <span className="h-3 w-px bg-border" />
        <span className="flex items-center gap-1.5">
          {saveStatus === "saving" ? (
            <>
              <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>正在暂存…</span>
            </>
          ) : isPublishing ? (
            <>
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              <span>正在发布…</span>
            </>
          ) : isDirty ? (
            <>
              <span className="size-1.5 rounded-full bg-amber-500" />
              <span>草稿未保存</span>
            </>
          ) : (
            <>
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>已保存</span>
            </>
          )}
        </span>
      </div>

      {/* 右侧：分页实时预览（原预览区顶部的核心信息）与规格提示 */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          {previewError ? (
            <span className="text-destructive">分页预览失败</span>
          ) : previewReady ? (
            <>
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>{previewPages} 页 · 输入实时预览</span>
            </>
          ) : (
            <>
              <span className="size-1.5 rounded-full bg-muted-foreground animate-pulse" />
              <span>正在生成分页预览…</span>
            </>
          )}
        </div>
        <span className="h-3 w-px bg-border" />
        <span>A4 标准 (210 × 297mm)</span>
        <span className="h-3 w-px bg-border" />
        <span className="font-mono text-[11px] opacity-80">⌘S 保存</span>
      </div>
    </footer>
  );
}
