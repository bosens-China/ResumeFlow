import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BackupConflict, BackupDecision } from "@/lib/resume-store";

export function BackupConflictDialog({
  conflicts,
  onCancel,
  onConfirm,
}: {
  conflicts: BackupConflict[];
  onCancel: () => void;
  onConfirm: (decisions: BackupDecision[]) => void;
}) {
  const [decisions, setDecisions] = useState<BackupDecision[]>([]);
  const conflict = conflicts[decisions.length];
  if (!conflict) return null;
  function choose(action: BackupDecision["action"]) {
    const next = [
      ...decisions,
      { id: conflict!.id, token: conflict!.token, action },
    ];
    if (next.length === conflicts.length) onConfirm(next);
    else setDecisions(next);
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            还原冲突（{decisions.length + 1}/{conflicts.length}）
          </DialogTitle>
          <DialogDescription>
            备份中的“{conflict.title}”与现有“{conflict.currentTitle}
            ”是同一份简历。覆盖会替换现有正文、所有语言、样式和历史快照；保留副本会新增一份简历。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            取消还原
          </Button>
          <Button variant="outline" onClick={() => choose("copy")}>
            保留为副本
          </Button>
          <Button onClick={() => choose("overwrite")}>覆盖现有简历</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
