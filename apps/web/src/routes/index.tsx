import { useEffect, useState } from "react";
import type { ResumeSummary } from "@resumeflow/shared";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Clock,
  Copy,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import {
  createResume,
  deleteResume,
  duplicateResume,
  importLegacyDrafts,
  legacyDraftCount,
  listResumes,
  updateResume,
} from "@/lib/resume-store";

export const Route = createFileRoute("/")({
  loader: () => listResumes(),
  component: ResumeListPage,
});

function ResumeListPage() {
  const initialResumes = Route.useLoaderData();
  const [resumes, setResumes] = useState<ResumeSummary[]>(initialResumes);
  const [error, setError] = useState("");
  const [legacyCount, setLegacyCount] = useState(legacyDraftCount);
  const navigate = useNavigate();

  // 重命名 Dialog 状态
  const [renameTarget, setRenameTarget] = useState<ResumeSummary | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // 删除确认 AlertDialog 状态
  const [deleteTarget, setDeleteTarget] = useState<ResumeSummary | null>(null);

  useEffect(() => {
    const events = new EventSource("/api/events");
    events.addEventListener("resume-changed", () => {
      void listResumes()
        .then(setResumes)
        .catch((cause: unknown) => setError(String(cause)));
    });
    return () => events.close();
  }, []);

  async function reload() {
    const list = await listResumes();
    setResumes(list);
  }

  async function handleCreate() {
    try {
      const resume = await createResume();
      await navigate({
        to: "/resumes/$resumeId",
        params: { resumeId: resume.id },
      });
    } catch (cause) {
      setError(String(cause));
    }
  }

  function openRename(resume: ResumeSummary, e: React.MouseEvent) {
    e.stopPropagation();
    setRenameTarget(resume);
    setRenameValue(resume.title);
  }

  async function handleConfirmRename() {
    if (!renameTarget) return;
    const next = renameValue.trim();
    if (!next) return;
    try {
      await updateResume(renameTarget.id, renameTarget.revision, {
        title: next,
      });
      setRenameTarget(null);
      await reload();
    } catch (cause) {
      setError(String(cause));
      await reload();
    }
  }

  async function handleDuplicate(resume: ResumeSummary, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await duplicateResume(resume.id);
      await reload();
    } catch (cause) {
      setError(String(cause));
    }
  }

  function openDelete(resume: ResumeSummary, e: React.MouseEvent) {
    e.stopPropagation();
    setDeleteTarget(resume);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteResume(deleteTarget.id, deleteTarget.revision);
      setDeleteTarget(null);
      await reload();
    } catch (cause) {
      setError(String(cause));
      await reload();
    }
  }

  return (
    <div className="min-h-full flex flex-col bg-background">
      {/* 顶部全局通栏导航栏：与详情页 Header 高度与通栏风格保持完全一致 */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <FileText className="size-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-base">
              ResumeFlow
            </span>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              简历编辑器
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleCreate}
            className="gap-1.5 shadow-sm font-medium"
          >
            <Plus className="size-4" />
            新建简历
          </Button>
        </div>
      </header>

      {/* 主体通栏内容区：宽度不再局限于窄版，充分利用 PC / 笔记本屏幕 */}
      <main className="flex-1 w-full px-6 lg:px-10 py-8">
        {error && (
          <p
            role="alert"
            className="mb-4 rounded-md border border-destructive px-4 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {legacyCount > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-md border px-4 py-2 text-sm">
            <span>发现 {legacyCount} 份旧版浏览器草稿，可导入 SQLite。</span>
            <Button
              variant="outline"
              onClick={() =>
                void importLegacyDrafts()
                  .then(async () => {
                    setLegacyCount(legacyDraftCount());
                    await reload();
                  })
                  .catch((cause: unknown) => setError(String(cause)))
              }
            >
              导入旧草稿
            </Button>
          </div>
        )}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">我的简历库</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              管理与编写你的简历，支持实时双栏/三栏排版与高保真导出
            </p>
          </div>

          <div className="text-xs text-muted-foreground font-medium">
            共 {resumes.length} 份简历
          </div>
        </div>

        {/* 业界经典的拟物纸张卡片网格布局 */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {/* 快捷新建简历卡片：置于网格第一个位置 */}
          <div
            onClick={handleCreate}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            className="group flex flex-col h-full cursor-pointer rounded-xl border border-dashed border-border bg-card/40 transition-all duration-200 hover:-translate-y-1 hover:border-foreground/30 hover:bg-muted/40 hover:shadow-md"
          >
            <div className="aspect-[1/1.22] w-full flex flex-col items-center justify-center p-6 text-muted-foreground transition-colors group-hover:text-foreground">
              <div className="mb-3 flex size-12 items-center justify-center rounded-full border border-dashed border-border/80 bg-background shadow-xs transition-transform duration-200 group-hover:scale-110 group-hover:border-foreground/40">
                <Plus className="size-5" />
              </div>
              <span className="text-sm font-semibold">新建一份简历</span>
              <span className="mt-1 text-center text-xs text-muted-foreground">
                空白模板 · Markdown 驱动
              </span>
            </div>

            <div className="mt-auto border-t p-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>立即创建</span>
              <Plus className="size-3.5" />
            </div>
          </div>

          {/* 已有简历列表：上部微缩纸张骨架 + 下部信息条 */}
          {resumes.map((resume) => (
            <div
              key={resume.id}
              className="group relative flex flex-col rounded-xl border border-border bg-card shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-md"
            >
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
          ))}
        </div>
      </main>

      {/* 重命名 Dialog */}
      <Dialog
        open={!!renameTarget}
        onOpenChange={(open) => !open && setRenameTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>重命名简历</DialogTitle>
            <DialogDescription>
              请输入新的简历名称，完成后点击保存。
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="请输入简历名称"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmRename();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              取消
            </Button>
            <Button
              onClick={handleConfirmRename}
              disabled={!renameValue.trim()}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 AlertDialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除此简历？</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除简历「{deleteTarget?.title}」，此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
