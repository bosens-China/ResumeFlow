import { useState } from "react";
import { getResumePdfFilename } from "@resumeflow/shared";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { DraftState } from "@/lib/resume-draft";

export function useResumeExport(
  id: string,
  save: () => Promise<boolean>,
  getSource: () => { draft: DraftState; revision: number; versionId?: string },
) {
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);

  async function exportPdf(language?: string) {
    if (!(await save())) return;
    setExporting(true);
    setExportError("");
    const { draft, revision, versionId } = getSource();
    const lang = language ?? draft.currentLanguage;
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
      const title = draft.languages[lang]?.title || draft.title;
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
  return { exportPdf, exportError, exporting };
}
