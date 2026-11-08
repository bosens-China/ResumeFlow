import { createHash } from "node:crypto";
import type { Resume, ResumeBackupItem } from "@resumeflow/shared";

export function getBackupConflictToken(
  resume: Resume,
  versionIds: string[],
  item: ResumeBackupItem,
) {
  return createHash("sha256")
    .update(JSON.stringify([resume, [...versionIds].sort(), item]))
    .digest("hex");
}
