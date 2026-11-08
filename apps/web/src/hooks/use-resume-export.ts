import { useState } from "react";
import {
  getResumePdfFilename,
  getResumeMarkdownFilename,
  type Resume,
} from "@resumeflow/shared";
import { toast } from "sonner";
import { api } from "@/lib/api";

export function useResumeExport(
  id: string,
  save: (() => Promise<boolean>) | null,
  getSource: () => {
    draft: Pick<Resume, "title" | "currentLanguage" | "languages">;
    revision: number;
    versionId?: string;
  },
) {
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);

  async function exportPdf(language?: string) {
    if (save && !(await save())) return;
    setExporting(true);
    setExportError("");
    const { draft, revision, versionId } = getSource();
    const lang = language ?? draft.currentLanguage ?? "zh";
    try {
      const response = await api.api.resumes[":id"].pdf.$get({
        param: { id },
        query: {
          revision: String(revision),
          lang,
          ...(versionId ? { versionId } : {}),
        },
      });
      if (!response.ok)
        throw new Error(((await response.json()) as { error: string }).error);
      const title = draft.languages?.[lang]?.title || draft.title;
      const url = URL.createObjectURL(await response.blob());
      Object.assign(document.createElement("a"), {
        href: url,
        download: getResumePdfFilename(title, lang),
      }).click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : "PDF 导出失败";
      setExportError(msg);
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  }

  async function exportMarkdown(language?: string) {
    if (save && !(await save())) return;
    const { draft, versionId } = getSource();
    const lang = language ?? draft.currentLanguage ?? "zh";
    try {
      const title = draft.languages?.[lang]?.title || draft.title;
      const url = `/api/resumes/${encodeURIComponent(id)}/markdown?lang=${encodeURIComponent(lang)}&download=1${versionId ? `&versionId=${encodeURIComponent(versionId)}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("导出 Markdown 失败");
      }
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), {
        href: downloadUrl,
        download: getResumeMarkdownFilename(title, lang),
      }).click();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : "Markdown 导出失败";
      toast.error(msg);
    }
  }

  async function exportMarkdownAll() {
    if (save && !(await save())) return;
    const { draft, versionId, revision } = getSource();
    try {
      const url = `/api/resumes/${encodeURIComponent(id)}/markdown-all?revision=${revision}${versionId ? `&versionId=${encodeURIComponent(versionId)}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("导出全部语言失败");
      const downloadUrl = URL.createObjectURL(await response.blob());
      Object.assign(document.createElement("a"), {
        href: downloadUrl,
        download: `${draft.title}-Markdown.zip`,
      }).click();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "导出全部语言失败");
    }
  }

  return {
    exportPdf,
    exportMarkdown,
    exportMarkdownAll,
    exportError,
    exporting,
  };
}
