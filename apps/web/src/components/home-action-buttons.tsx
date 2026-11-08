import { useRef, useState } from "react";
import {
  ChevronDown,
  Database,
  Download,
  FileText,
  Plus,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BackupConflictDialog } from "@/components/backup-conflict-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  exportBackup,
  importBackupFile,
  inspectBackupFile,
  importMarkdownFile,
  type BackupConflict,
  type BackupDecision,
} from "@/lib/resume-store";

export function HomeActionButtons({
  onCreate,
  onImportSuccess,
  onRestoreSuccess,
}: {
  onCreate: () => void;
  onImportSuccess: (id: string) => void;
  onRestoreSuccess: () => void;
}) {
  const mdInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, setPending] = useState<{
    archive: string;
    conflicts: BackupConflict[];
  } | null>(null);

  const openMenu = () => {
    if (isImporting) return;
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setMenuOpen(true);
  };

  const scheduleClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setMenuOpen(false);
    }, 150);
  };

  async function handleMdFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const created = await importMarkdownFile(file);
      toast.success(`已成功从 "${file.name}" 创建简历`);
      onImportSuccess(created.id);
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : "导入 Markdown 失败";
      toast.error(msg);
    } finally {
      setIsImporting(false);
      if (mdInputRef.current) mdInputRef.current.value = "";
    }
  }

  async function handleJsonFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const result = await inspectBackupFile(file);
      if (result.conflicts.length) setPending(result);
      else await restore(result.archive, []);
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : "导入备份包失败";
      toast.error(msg);
    } finally {
      setIsImporting(false);
      if (jsonInputRef.current) jsonInputRef.current.value = "";
    }
  }

  async function restore(archive: string, decisions: BackupDecision[]) {
    setPending(null);
    setIsImporting(true);
    try {
      const result = await importBackupFile(archive, decisions);
      toast.success(`成功恢复 ${result.count} 份简历`);
      onRestoreSuccess();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "导入备份包失败");
    } finally {
      setIsImporting(false);
    }
  }

  async function handleExportAll() {
    try {
      await exportBackup();
      toast.success("全量备份下载已开始");
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : "全量备份导出失败";
      toast.error(msg);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {pending && (
        <BackupConflictDialog
          conflicts={pending.conflicts}
          onCancel={() => setPending(null)}
          onConfirm={(decisions) => void restore(pending.archive, decisions)}
        />
      )}
      <input
        ref={mdInputRef}
        type="file"
        accept=".md,text/markdown"
        className="hidden"
        onChange={handleMdFile}
      />
      <input
        ref={jsonInputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={handleJsonFile}
      />

      <div
        className="inline-flex"
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
      >
        <DropdownMenu
          open={isImporting ? false : menuOpen}
          onOpenChange={(next) => {
            if (closeTimerRef.current) {
              clearTimeout(closeTimerRef.current);
              closeTimerRef.current = null;
            }
            setMenuOpen(next);
          }}
          modal={false}
        >
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isImporting}
              onPointerDown={(e) => {
                if (menuOpen) e.preventDefault();
              }}
              className="h-8 gap-1.5 px-2.5 text-xs font-medium cursor-pointer"
            >
              <Upload className="size-3.5" />
              <span>{isImporting ? "导入中…" : "导入"}</span>
              <ChevronDown className="size-3 opacity-60 transition-transform duration-200 group-aria-expanded/button:rotate-180" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-44"
            onMouseEnter={openMenu}
            onMouseLeave={scheduleClose}
          >
            <DropdownMenuItem
              onSelect={() => {
                setMenuOpen(false);
                mdInputRef.current?.click();
              }}
              className="gap-2 text-xs cursor-pointer"
            >
              <FileText className="size-3.5" />
              导入 Markdown (.md)
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setMenuOpen(false);
                jsonInputRef.current?.click();
              }}
              className="gap-2 text-xs cursor-pointer"
            >
              <Database className="size-3.5" />
              导入全量备份 (.zip)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleExportAll}
        className="h-8 gap-1.5 px-2.5 text-xs font-medium cursor-pointer"
        title="备份全部简历（含多语言、样式与历史版本）为 ZIP"
      >
        <Download className="size-3.5" />
        <span>全量备份</span>
      </Button>

      <Button
        onClick={onCreate}
        size="sm"
        className="h-8 gap-1.5 px-3 text-xs font-medium shadow-xs cursor-pointer"
      >
        <Plus className="size-3.5" />
        新建简历
      </Button>
    </div>
  );
}
