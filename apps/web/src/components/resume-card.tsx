import type { MouseEvent } from "react";
import type { ResumeSummary } from "@resumeflow/shared";
import { Link } from "@tanstack/react-router";
import { Clock, Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateTime } from "@/lib/format";

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
  return (
    <div className="group relative flex flex-col rounded-xl border border-border bg-card shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-md">
      {/* 可点击区域：进入详情 */}
      <Link
        to="/resumes/$resumeId"
        params={{ resumeId: resume.id }}
        className="flex flex-col flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl overflow-hidden"
      >
        {/* 上层：微缩 A4 纸张拟物视觉区 */}
        <div className="relative aspect-[1/1.22] w-full overflow-hidden bg-muted/40 p-4 flex items-center justify-center border-b">
          <div className="h-full w-[82%] rounded bg-white p-3 shadow-xs transition-all duration-200 group-hover:scale-[1.03] group-hover:shadow-sm flex flex-col gap-1.5 overflow-hidden select-none">
            {/* 纸张内的简历排版骨架示意 */}
            <div className="h-2 w-1/3 bg-foreground/70 rounded-xs mx-auto mb-0.5" />
            <div className="h-1 w-1/2 bg-foreground/20 rounded-xs mx-auto mb-2" />

            <div className="h-1.5 w-1/4 bg-foreground/50 rounded-xs mb-0.5" />
            <div className="h-px w-full bg-border mb-1" />
            <div className="flex justify-between gap-2">
              <div className="h-1 w-2/5 bg-foreground/30 rounded-xs" />
              <div className="h-1 w-1/5 bg-foreground/20 rounded-xs" />
            </div>
            <div className="h-1 w-4/5 bg-foreground/15 rounded-xs" />
            <div className="h-1 w-3/5 bg-foreground/15 rounded-xs mb-1.5" />

            <div className="h-1.5 w-1/4 bg-foreground/50 rounded-xs mb-0.5" />
            <div className="h-px w-full bg-border mb-1" />
            <div className="flex justify-between gap-2">
              <div className="h-1 w-1/3 bg-foreground/30 rounded-xs" />
              <div className="h-1 w-1/4 bg-foreground/20 rounded-xs" />
            </div>
            <div className="h-1 w-2/3 bg-foreground/15 rounded-xs" />
          </div>
        </div>

        {/* 下层：标题与操作栏 */}
        <div className="p-3.5 flex flex-col gap-1.5 flex-1 justify-between bg-card">
          <div className="flex items-start justify-between gap-2">
            <span
              className="text-sm font-semibold truncate tracking-tight text-foreground group-hover:text-primary transition-colors"
              title={resume.title}
            >
              {resume.title}
            </span>

            {/* 三点操作菜单 */}
            <div
              className="relative shrink-0 -mr-1 -mt-0.5"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground/70 hover:text-foreground"
                    aria-label="操作菜单"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem
                    onClick={(e) => openRename(resume, e)}
                    className="gap-2 text-xs"
                  >
                    <Pencil className="size-3.5" />
                    重命名
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => handleDuplicate(resume, e)}
                    className="gap-2 text-xs"
                  >
                    <Copy className="size-3.5" />
                    创建副本
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => openDelete(resume, e)}
                    className="gap-2 text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                    删除简历
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* 底部时间戳 */}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
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
