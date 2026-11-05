import { useState } from "react";
import { ChevronDown, History } from "lucide-react";
import type { ResumeVersionSummary } from "@resumeflow/shared";
import { Button } from "@/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateTime } from "@/lib/format";

interface ResumeVersionDropdownProps {
  versions: ResumeVersionSummary[];
  busy: boolean;
  isDirty: boolean;
  onSelectVersion: (versionId: string) => Promise<boolean>;
  onSaveCurrent: () => Promise<boolean>;
}

export function ResumeVersionDropdown({
  versions,
  busy,
  isDirty,
  onSelectVersion,
  onSaveCurrent,
}: ResumeVersionDropdownProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingTarget, setPendingTarget] =
    useState<ResumeVersionSummary | null>(null);

  function handleItemClick(version: ResumeVersionSummary) {
    setMenuOpen(false);
    if (isDirty) {
      // 需求 3：内容未保存时先提示
      setPendingTarget(version);
    } else {
      // 内容已保存，直接切换内容并回到最新时间线
      void onSelectVersion(version.id);
    }
  }

  async function handleConfirmDiscardAndSwitch() {
    if (!pendingTarget) return;
    const targetId = pendingTarget.id;
    setPendingTarget(null);
    await onSelectVersion(targetId);
  }

  async function handleConfirmSaveAndSwitch() {
    if (!pendingTarget) return;
    const targetId = pendingTarget.id;
    setPendingTarget(null);
    const saved = await onSaveCurrent();
    if (saved) {
      await onSelectVersion(targetId);
    }
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            aria-label="查看简历历史版本记录"
            className="h-8 gap-1.5 px-2.5 text-xs font-medium"
          >
            <History className="size-3.5 shrink-0 text-muted-foreground" />
            <span>版本记录</span>
            {versions.length > 0 && (
              <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {versions.length}
              </span>
            )}
            <ChevronDown className="size-3 opacity-60 ml-0.5" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64 p-1.5">
          <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1 font-medium">
            历史版本记录
          </DropdownMenuLabel>

          <div className="max-h-72 overflow-y-auto space-y-0.5">
            {versions.map((version) => (
              <DropdownMenuItem
                key={version.id}
                onSelect={() => handleItemClick(version)}
                className="items-center cursor-pointer py-1.5 px-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate text-foreground">
                    {version.title}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatDateTime(version.createdAt)}
                  </div>
                </div>
              </DropdownMenuItem>
            ))}

            {!versions.length && (
              <p className="px-2 py-4 text-xs text-muted-foreground text-center">
                尚未保存版本记录，点击“保存”即可发布版本
              </p>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 需求 3：切换历史版本时的未保存确认对话框 */}
      <AlertDialog
        open={pendingTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPendingTarget(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>当前有未保存的修改</AlertDialogTitle>
            <AlertDialogDescription>
              切换至「{pendingTarget?.title}
              」将丢失当前未保存的修改。建议先保存当前内容后再切换。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              onClick={() => void handleConfirmDiscardAndSwitch()}
            >
              放弃修改并切换
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => void handleConfirmSaveAndSwitch()}
            >
              保存并切换
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
