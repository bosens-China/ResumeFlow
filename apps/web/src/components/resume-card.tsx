import type { MouseEvent } from "react";
import type { ResumeSummary } from "@resumeflow/shared";
import { Link } from "@tanstack/react-router";
import {
  Clock,
  Copy,
  Download,
  Languages,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { ResumeThumbnail } from "@/components/resume-thumbnail";
import { ResumePageCount } from "@/components/resume-page-count";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateTime, getLanguageName } from "@/lib/format";
import { useResumeExport } from "@/hooks/use-resume-export";

export function ResumeCard({
  resume,
  openRename,
  handleDuplicate,
  openDelete,
}: {
  resume: ResumeSummary;
  openRename: (resume: ResumeSummary, event: MouseEvent) => void;
  handleDuplicate: (resume: ResumeSummary, event: MouseEvent) => void;
  openDelete: (resume: ResumeSummary, event: MouseEvent) => void;
}) {
  const { exportPdf, exporting } = useResumeExport(resume.id, null, () => ({
    draft: resume,
    revision: resume.revision,
  }));
  const currentLang = resume.currentLanguage ?? "zh";
  const item = resume.languages?.[currentLang];
  const activeTitle = (item?.title ?? resume.title).trim();
  const langCodes = Object.keys(
    resume.languages && Object.keys(resume.languages).length > 0
      ? resume.languages
      : { [currentLang]: true },
  );
  const langCount = langCodes.length;
  const currentLangName = getLanguageName(currentLang);

  return (
    <div className="group relative flex flex-col rounded-xl border border-border bg-card shadow-xs transition-all duration-300 ease-out hover:-translate-y-1 hover:border-foreground/25 hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.1),0_4px_8px_-4px_rgba(0,0,0,0.06)]">
      {/* 可点击区域：进入详情 */}
      <Link
        to="/resumes/$resumeId"
        params={{ resumeId: resume.id }}
        className="flex flex-1 flex-col rounded-xl overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* 上层：微缩 A4 纸张真实内容视觉区 */}
        <div className="relative aspect-[1/1.24] w-full overflow-hidden bg-muted/30 p-3.5 flex items-center justify-center border-b transition-colors duration-300 ease-out group-hover:bg-muted/45">
          <div
            className="h-full aspect-[210/297] rounded-xs bg-white shadow-xs transition-shadow duration-300 ease-out group-hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] overflow-hidden select-none"
            style={{
              boxShadow:
                "0 1px 3px rgba(0, 0, 0, 0.05), 0 6px 12px -2px rgba(0, 0, 0, 0.04)",
              border: "1px solid rgba(0, 0, 0, 0.08)",
            }}
          >
            <ResumeThumbnail resume={resume} />
          </div>
        </div>

        {/* 下层：标题、元信息与操作栏 */}
        <div className="flex flex-1 flex-col justify-between gap-2 bg-card p-3.5">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-start justify-between gap-2">
              <span
                className="truncate text-sm font-semibold tracking-tight text-foreground transition-colors duration-200 group-hover:text-primary"
                title={activeTitle}
              >
                {activeTitle}
              </span>

              {/* 三点操作菜单 */}
              <div
                className="relative -mr-1 -mt-0.5 shrink-0 cursor-pointer"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 cursor-pointer text-muted-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
                      aria-label={exporting ? "正在导出 PDF" : "操作菜单"}
                      disabled={exporting}
                    >
                      {exporting ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : (
                        <MoreHorizontal className="size-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem
                      onClick={(e) => openRename(resume, e)}
                      className="gap-2 text-xs cursor-pointer"
                    >
                      <Pencil className="size-3.5" />
                      重命名
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => handleDuplicate(resume, e)}
                      className="gap-2 text-xs cursor-pointer"
                    >
                      <Copy className="size-3.5" />
                      创建副本
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(event) => {
                        event.stopPropagation();
                        void exportPdf();
                      }}
                      className="gap-2 text-xs cursor-pointer"
                    >
                      <Download className="size-3.5" />
                      导出 PDF
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => openDelete(resume, e)}
                      className="gap-2 text-xs cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                      删除简历
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* 元信息小标签栏：语言数量与页数 */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                className="inline-flex items-center gap-1 rounded bg-muted/70 px-1.5 py-0.5 font-medium text-muted-foreground/90"
                title={`当前主语言: ${currentLangName} (${currentLang})${langCount > 1 ? `，共 ${langCount} 个语言版本` : ""}`}
              >
                <Languages className="size-3 shrink-0 opacity-70" />
                <span>
                  {langCount > 1
                    ? `${langCount} 语 (${currentLang})`
                    : currentLangName}
                </span>
              </span>

              <ResumePageCount resume={resume} />
            </div>
          </div>

          {/* 底部时间戳 */}
          <div className="flex items-center gap-1.5 border-t border-border/40 pt-1.5 text-[11px] text-muted-foreground/75">
            <Clock className="size-3 shrink-0 opacity-70" />
            <span className="truncate">
              修改于 {formatDateTime(resume.updatedAt)}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
