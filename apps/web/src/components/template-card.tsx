import { useMemo, useState } from "react";
import type { ResumeSummary, ResumeTemplate } from "@resumeflow/shared";
import { Check, Eye, Sparkles } from "lucide-react";
import { ResumePreview } from "@/components/resume-preview";
import { ResumeThumbnail } from "@/components/resume-thumbnail";
import { ResumePageCount } from "@/components/resume-page-count";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function TemplateCard({
  template,
  onUse,
  loading = false,
}: {
  template: ResumeTemplate;
  onUse: (template: ResumeTemplate) => Promise<void> | void;
  loading?: boolean;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);

  // 构造轻量 Resume 视图对象以复用微缩排版组件
  const fakeResume = useMemo<ResumeSummary>(
    () => ({
      id: template.id,
      title: template.name,
      markdown: template.markdown,
      themeColor: template.themeColor,
      margin: template.margin,
      customCss: template.customCss,
      revision: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }),
    [template],
  );

  return (
    <>
      <div
        onClick={() => setPreviewOpen(true)}
        className="group relative flex flex-1 flex-col rounded-xl border border-border bg-card shadow-xs transition-all duration-300 ease-out hover:-translate-y-1 hover:border-foreground/25 hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.1),0_4px_8px_-4px_rgba(0,0,0,0.06)] cursor-pointer overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* 上层：微缩 A4 纸张真实排版展示区（与 ResumeCard 严格保持一致规格） */}
        <div className="relative aspect-[1/1.24] w-full overflow-hidden bg-muted/30 p-3.5 flex items-center justify-center border-b transition-colors duration-300 ease-out group-hover:bg-muted/45 select-none">
          <div
            className="h-full aspect-[210/297] rounded-xs bg-white shadow-xs transition-shadow duration-300 ease-out group-hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] overflow-hidden select-none"
            style={{
              boxShadow:
                "0 1px 3px rgba(0, 0, 0, 0.05), 0 6px 12px -2px rgba(0, 0, 0, 0.04)",
              border: "1px solid rgba(0, 0, 0, 0.08)",
            }}
          >
            <ResumeThumbnail resume={fakeResume} />
          </div>

          {/* 悬停快捷预览浮层 */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100">
            <span className="flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
              <Eye className="size-3.5" />
              点击预览模板
            </span>
          </div>
        </div>

        {/* 下层：标题、描述与操作栏（无 tag，纯净卡片排版） */}
        <div className="flex flex-1 flex-col justify-between gap-3 bg-card p-3.5">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span
                className="truncate text-sm font-semibold tracking-tight text-foreground transition-colors duration-200 group-hover:text-primary"
                title={template.name}
              >
                {template.name}
              </span>
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {template.category}
              </span>
            </div>

            {/* 描述信息：自然排版的简炼段落 */}
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {template.description}
            </p>
            <div className="text-[11px]">
              <ResumePageCount resume={fakeResume} />
            </div>
          </div>

          {/* 底部操作与速览栏：左侧适用角色，右侧使用模板 */}
          <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground/75">
            <span
              className="truncate text-muted-foreground/80 pr-2 text-xs"
              title={template.targetRole}
            >
              {template.targetRole}
            </span>
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                void onUse(template);
              }}
              disabled={loading}
              className="h-7 shrink-0 gap-1 px-3 text-xs font-medium shadow-xs"
            >
              <Sparkles className="size-3.5" />
              使用模板
            </Button>
          </div>
        </div>
      </div>

      {/* 模板与编辑器共用 HTML 分页预览。 */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-[94vw] max-w-[95vw] sm:max-w-[960px] md:max-w-[1000px] h-[90vh] flex flex-col p-6 gap-3 overflow-hidden">
          <DialogHeader className="shrink-0">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-lg font-bold">
                {template.name}
              </DialogTitle>
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {template.targetRole}
              </span>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              {template.description}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-hidden rounded-lg border bg-muted/30 relative">
            {previewOpen && (
              <ResumePreview
                content={template.markdown}
                themeColor={template.themeColor}
                margin={template.margin}
                customCss={template.customCss}
                onReadyChange={() => {}}
              />
            )}
          </div>

          <DialogFooter className="shrink-0 flex items-center justify-between sm:justify-between pt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="size-3.5 text-emerald-600" />
              <span>精简单段骨架，纯虚构脱敏信息，开箱即用</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewOpen(false)}
              >
                关闭
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={loading}
                onClick={() => {
                  setPreviewOpen(false);
                  void onUse(template);
                }}
              >
                <Sparkles className="size-3.5" />
                以此模板创建简历
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
