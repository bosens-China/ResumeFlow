import type { Resume, ResumeVersion } from "./index.js";

export function getResumeMarkdownFilename(title: string, language = "zh") {
  return `${title}${language === "zh" ? "" : `_${language}`}.md`;
}

export function getResumeBackupFilename(title?: string) {
  if (title) {
    return `${title}_backup.zip`;
  }
  const date = new Date().toISOString().slice(0, 10);
  return `resumeflow_backup_${date}.zip`;
}

export interface ResumeBackupItem {
  resume: Resume;
  versions?: ResumeVersion[];
}

export interface ResumeBackupData {
  version: 1;
  generator: "ResumeFlow";
  exportedAt: string;
  resumes: ResumeBackupItem[];
}
