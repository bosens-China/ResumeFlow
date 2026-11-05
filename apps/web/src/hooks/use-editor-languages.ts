import type { RefObject } from "react";
import { type DraftState, getDraftLanguages } from "@/lib/resume-draft";

interface UseEditorLanguagesOptions {
  draft: RefObject<DraftState>;
  name: string;
  content: string;
  currentLang: string;
  setLanguages: (
    langs: Record<string, { title?: string; markdown: string }>,
  ) => void;
  setCurrentLang: (lang: string) => void;
  setName: (name: string) => void;
  setContent: (content: string) => void;
  checkDirty: () => void;
  save: () => Promise<boolean>;
}

export function useEditorLanguages({
  draft,
  name,
  content,
  currentLang,
  setLanguages,
  setCurrentLang,
  setName,
  setContent,
  checkDirty,
  save,
}: UseEditorLanguagesOptions) {
  function applyLanguageSwitch(
    nextLanguages: Record<string, { title?: string; markdown: string }>,
    nextLang: string,
    nextTitle: string,
    nextContent: string,
  ) {
    draft.current = {
      ...draft.current,
      languages: nextLanguages,
      currentLanguage: nextLang,
      title: nextTitle,
      markdown: nextContent,
    };
    setLanguages(nextLanguages);
    setCurrentLang(nextLang);
    setName(nextTitle);
    setContent(nextContent);
    checkDirty();
    void save();
  }

  function handleSelectLanguage(newLang: string) {
    if (newLang === currentLang) return;
    const next = getDraftLanguages(draft.current);
    const target = next[newLang] ?? {
      title: draft.current.title,
      markdown: "",
    };
    applyLanguageSwitch(
      next,
      newLang,
      target.title || draft.current.title,
      target.markdown,
    );
  }

  function handleAddLanguage(newLang: string, copyFromCurrent: boolean) {
    if (
      Object.keys(draft.current.languages).some(
        (c) => c.toLowerCase() === newLang.toLowerCase(),
      )
    ) {
      return;
    }
    const next = {
      ...getDraftLanguages(draft.current),
      [newLang]: { title: name, markdown: copyFromCurrent ? content : "" },
    };
    applyLanguageSwitch(next, newLang, name, copyFromCurrent ? content : "");
  }

  function handleDeleteLanguage(langToDelete: string) {
    const nextLanguages = getDraftLanguages(draft.current);
    delete nextLanguages[langToDelete];
    const remaining = Object.keys(nextLanguages);
    if (!remaining.length) return;
    const nextActive =
      currentLang === langToDelete ? remaining[0]! : currentLang;
    const item = nextLanguages[nextActive]!;
    applyLanguageSwitch(
      nextLanguages,
      nextActive,
      item.title || name,
      item.markdown,
    );
  }

  return {
    handleSelectLanguage,
    handleAddLanguage,
    handleDeleteLanguage,
  };
}
