import type { Resume, ResumeLanguageItem } from "@resumeflow/shared";
import { DEFAULT_RESUME_NAME } from "./resume-store";

export interface DraftState {
  title: string;
  markdown: string;
  currentLanguage: string;
  languages: Record<string, ResumeLanguageItem>;
  themeColor: string;
  margin: string;
  lineHeight: number;
  customCss: string;
}

export function getInitialDraft(r: Resume): DraftState {
  const lang = r.currentLanguage || "zh";
  const langs =
    r.languages && Object.keys(r.languages).length > 0
      ? structuredClone(r.languages)
      : { [lang]: { title: r.title, markdown: r.markdown } };
  return {
    title: langs[lang]?.title || r.title,
    markdown: langs[lang]?.markdown ?? r.markdown,
    currentLanguage: lang,
    languages: langs,
    themeColor: r.themeColor || "",
    margin: r.margin || "",
    lineHeight: r.lineHeight ?? 1,
    customCss: r.customCss || "",
  };
}

export function getDraftLanguages(current: DraftState) {
  return {
    ...current.languages,
    [current.currentLanguage]: {
      ...current.languages[current.currentLanguage],
      title: current.title.trim() || DEFAULT_RESUME_NAME,
      markdown: current.markdown,
    },
  };
}

export function computeResumePatch(
  base: Resume,
  current: DraftState,
): {
  patch: Record<string, unknown>;
  updatedLanguages: DraftState["languages"];
} {
  const nextTitle = current.title.trim() || DEFAULT_RESUME_NAME;
  const updatedLanguages = getDraftLanguages(current);
  const diffs = {
    title: nextTitle !== base.title ? nextTitle : undefined,
    markdown: current.markdown !== base.markdown ? current.markdown : undefined,
    currentLanguage:
      current.currentLanguage !== (base.currentLanguage || "zh")
        ? current.currentLanguage
        : undefined,
    languages:
      JSON.stringify(updatedLanguages) !== JSON.stringify(base.languages ?? {})
        ? updatedLanguages
        : undefined,
    themeColor:
      (current.themeColor || "") !== (base.themeColor || "")
        ? current.themeColor
        : undefined,
    margin:
      (current.margin || "") !== (base.margin || "")
        ? current.margin
        : undefined,
    lineHeight:
      (current.lineHeight ?? 1) !== (base.lineHeight ?? 1)
        ? current.lineHeight
        : undefined,
    customCss:
      (current.customCss || "") !== (base.customCss || "")
        ? current.customCss
        : undefined,
  };
  const patch = Object.fromEntries(
    Object.entries(diffs).filter(([, v]) => v !== undefined),
  );
  return { patch, updatedLanguages };
}

export function isDraftModified(base: Resume, current: DraftState): boolean {
  return Object.keys(computeResumePatch(base, current).patch).length > 0;
}
