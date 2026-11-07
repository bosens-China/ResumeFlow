import type { RefObject } from "react";
import {
  type Resume,
  type ResumeVersion,
  formatAndValidateCss,
} from "@resumeflow/shared";
import { restoreResumeVersion } from "./resume-versions";
import { ApiError, updateResume } from "./resume-store";
import {
  type DraftState,
  computeResumePatch,
  isDraftModified,
} from "./resume-draft";
import type { SaveStatus } from "@/hooks/use-resume-editor";

interface ResumeSaveOptions {
  resumeId: string;
  draft: RefObject<DraftState>;
  committed: RefObject<Resume>;
  selectedVersion: RefObject<ResumeVersion | null>;
  conflicting: RefObject<Resume | null>;
  saving: RefObject<Promise<boolean> | null>;
  setStatus: (status: SaveStatus) => void;
  setCssError: (error: string | null) => void;
  setMessage: (message: string) => void;
  setRemote: (resume: Resume | null) => void;
  setLanguages: (languages: DraftState["languages"]) => void;
}

export async function saveResumeDraft({
  resumeId,
  draft,
  committed,
  selectedVersion,
  conflicting,
  saving,
  setStatus,
  setCssError,
  setMessage,
  setRemote,
  setLanguages,
}: ResumeSaveOptions): Promise<boolean> {
  if (conflicting.current) return false;
  if (saving.current) return saving.current;

  const task = (async () => {
    while (!conflicting.current) {
      try {
        const version = selectedVersion.current;
        if (version) {
          if (!isDraftModified(version.resume, draft.current)) {
            setStatus("saved");
            return true;
          }
          committed.current = await restoreResumeVersion(
            resumeId,
            version.id,
            committed.current.revision,
          );
          selectedVersion.current = null;
        }
        const base = committed.current;
        const current = draft.current;

        if (current.customCss.trim()) {
          const cssText = current.customCss;
          const cssCheck = await formatAndValidateCss(cssText);
          if (current !== draft.current || current.customCss !== cssText)
            continue;
          if (!cssCheck.valid) {
            setCssError(cssCheck.error);
            setMessage(`CSS 语法错误: ${cssCheck.error}`);
            setStatus("error");
            return false;
          }
          setCssError(null);
        } else {
          setCssError(null);
        }

        const { patch, updatedLanguages } = computeResumePatch(base, current);
        if (Object.keys(patch).length === 0) {
          setStatus("saved");
          return true;
        }

        setStatus("saving");
        current.languages = updatedLanguages;
        setLanguages(updatedLanguages);
        const updated = await updateResume(resumeId, base.revision, patch);
        committed.current = updated;
      } catch (cause) {
        if (
          cause instanceof ApiError &&
          cause.status === 409 &&
          cause.current
        ) {
          conflicting.current = cause.current;
          setRemote(cause.current);
          setStatus("conflict");
        } else {
          setMessage(cause instanceof Error ? cause.message : "保存失败");
          setStatus("error");
        }
        return false;
      }
    }
    return false;
  })();

  saving.current = task;
  try {
    return await task;
  } finally {
    saving.current = null;
  }
}
