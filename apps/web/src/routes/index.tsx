import { useEffect, useState } from "react";
import type { ResumeSummary } from "@resumeflow/shared";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import { ResumeCard } from "@/components/resume-card";
import { ResumeFlowLogo } from "@/components/resume-flow-logo";
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
import { Input } from "@/components/ui/input";
import {
  createResume,
  deleteResume,
  duplicateResume,
  importLegacyDrafts,
  legacyDraftCount,
  listResumes,
  updateResume,
} from "@/lib/resume-store";
import { useDocumentTitle } from "@/hooks/use-document-title";

function ResumeListErrorPage({
  error,
  reset,
}: {
  error: unknown;
  reset: () => void;
}) {
  useDocumentTitle();
  const message = error instanceof Error ? error.message : "读取简历列表失败";

  useEffect(() => {
    toast.error(`读取接口失败: ${message}`);
  }, [message]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground py-24">
      <p className="text-sm">读取简历列表失败，请检查网络或后端服务</p>
      <Button variant="outline" size="sm" onClick={reset}>
        重试
      </Button>
    </div>
  );
}

export const Route = createFileRoute("/")({
  loader: () => listResumes(),
  errorComponent: ResumeListErrorPage,
  component: ResumeListPage,
});

function ResumeListPage() {
  useDocumentTitle();
  const initialResumes = Route.useLoaderData();
  const [resumes, setResumes] = useState<ResumeSummary[]>(initialResumes);
  const [legacyCount, setLegacyCount] = useState(legacyDraftCount);
  const navigate = useNavigate();

  // 重命名 Dialog 状态
  const [renameTarget, setRenameTarget] = useState<ResumeSummary | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // 删除确认 AlertDialog 状态
  const [deleteTarget, setDeleteTarget] = useState<ResumeSummary | null>(null);

  useEffect(() => {
    const events = new EventSource("/api/events");
    const refresh = () => {
      void listResumes()
        .then(setResumes)
        .catch((cause: unknown) => {
          const msg =
            cause instanceof Error ? cause.message : "读取简历列表失败";
          toast.error(`读取接口失败: ${msg}`);
        });
    };
    events.addEventListener("open", refresh);
    events.addEventListener("resume-changed", refresh);
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
      const msg = cause instanceof Error ? cause.message : String(cause);
      toast.error(msg);
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
      const msg = cause instanceof Error ? cause.message : String(cause);
      toast.error(msg);
      await reload();
    }
  }

  async function handleDuplicate(resume: ResumeSummary, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await duplicateResume(resume.id);
      await reload();
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : String(cause);
      toast.error(msg);
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
      const msg = cause instanceof Error ? cause.message : String(cause);
      toast.error(msg);
      await reload();
    }
  }

  return (
    <div className="min-h-full flex flex-col bg-background">
      {/* 顶部全局通栏导航栏：与详情页 Header 高度与通栏风格保持完全一致 */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <ResumeFlowLogo className="size-4.5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-base">
              ResumeFlow
            </span>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              简流
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
                  .catch((cause: unknown) => {
                    const msg =
                      cause instanceof Error ? cause.message : String(cause);
                    toast.error(msg);
                  })
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

        {/* 拟物纸张卡片网格布局：无简历时展示空状态，有简历时展示真实微缩列表 */}
        {resumes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 py-24 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted/80 text-muted-foreground">
              <FileText className="size-6" />
            </div>
            <h3 className="text-base font-semibold">暂无简历</h3>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              点击右上角「新建简历」或下方按钮开始创建你的第一份简历，支持
              Markdown 实时排版与高保真导出。
            </p>
            <Button onClick={handleCreate} className="mt-4 gap-1.5" size="sm">
              <Plus className="size-4" />
              新建第一份简历
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {resumes.map((resume) => (
              <ResumeCard
                key={resume.id}
                resume={resume}
                openRename={openRename}
                handleDuplicate={handleDuplicate}
                openDelete={openDelete}
              />
            ))}
          </div>
        )}
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
