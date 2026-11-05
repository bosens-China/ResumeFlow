import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Resume,
  type ResumeChangedEvent,
  type ResumeVersion,
  formatAndValidateCss,
} from "@resumeflow/shared";
import { useBlocker } from "@tanstack/react-router";
import { toast } from "sonner";
import { useEditorLanguages } from "./use-editor-languages";
import { useResumeVersions } from "./use-resume-versions";
import { useResumeExport } from "./use-resume-export";
import { restoreResumeVersion } from "@/lib/resume-versions";
import {
  ApiError,
  DEFAULT_RESUME_NAME,
  getResume,
  updateResume,
} from "@/lib/resume-store";
import {
  type DraftState,
  computeResumePatch,
  getInitialDraft,
  isDraftModified,
} from "@/lib/resume-draft";

export type SaveStatus = "saved" | "saving" | "error" | "conflict";
const AUTOSAVE_DELAY = 400;

export function useResumeEditor(resume: Resume) {
  const [initial] = useState(() => getInitialDraft(resume));
  const [currentLang, setCurrentLang] = useState(initial.currentLanguage);
  const [languages, setLanguages] = useState(initial.languages);
  const [themeColor, setThemeColor] = useState(initial.themeColor);
  const [margin, setMargin] = useState(initial.margin);
  const [customCss, setCustomCss] = useState(initial.customCss);
  const [cssError, setCssError] = useState<string | null>(null);
  const [isFormattingCss, setIsFormattingCss] = useState(false);
  const [name, setName] = useState(initial.title);
  const [content, setContent] = useState(initial.markdown);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [message, setMessage] = useState("");
  const [remote, setRemote] = useState<Resume | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const draft = useRef<DraftState>(initial);
  const committed = useRef(resume);
  const lastPublished = useRef(resume);
  const selectedVersion = useRef<ResumeVersion | null>(null);
  const conflicting = useRef<Resume | null>(null);
  const saving = useRef<Promise<boolean> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSaveNotice = useCallback((text: string, autoHide = false) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setSaveNotice(text);
    if (autoHide) {
      noticeTimer.current = setTimeout(() => setSaveNotice(null), 1500);
    }
  }, []);

  const syncStateFromResume = useCallback((target: Resume, viewing = false) => {
    const next = getInitialDraft(target);
    draft.current = next;
    if (!viewing) {
      committed.current = target;
      selectedVersion.current = null;
    }
    lastPublished.current = target;
    setName(next.title);
    setContent(next.markdown);
    setCurrentLang(next.currentLanguage);
    setLanguages(next.languages);
    setThemeColor(next.themeColor);
    setMargin(next.margin);
    setCustomCss(next.customCss);
    setCssError(null);
    setDirty(false);
  }, []);

  const loadVersion = useCallback(
    async (version: ResumeVersion) => {
      if (saving.current) await saving.current;
      selectedVersion.current = version;
      syncStateFromResume(version.resume, true);
    },
    [syncStateFromResume],
  );
  const history = useResumeVersions(resume.id, committed, loadVersion);

  const checkDirty = useCallback(() => {
    setDirty(isDraftModified(lastPublished.current, draft.current));
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
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
              resume.id,
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
            if (cssCheck.formatted !== current.customCss) {
              current.customCss = cssCheck.formatted;
              setCustomCss(cssCheck.formatted);
            }
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
          const updated = await updateResume(resume.id, base.revision, patch);
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
  }, [resume.id]);

  async function saveVersion(title?: string): Promise<boolean> {
    if (!isDraftModified(lastPublished.current, draft.current)) {
      showSaveNotice("已保存", true);
      return true;
    }

    setPublishing(true);
    showSaveNotice("保存中…", false);
    try {
      const version = (await save())
        ? await history.publishVersion(title)
        : null;
      if (!version) {
        showSaveNotice("保存失败", true);
        return false;
      }
      lastPublished.current = version.resume;
      checkDirty();
      showSaveNotice("已保存", true);
      return true;
    } finally {
      setPublishing(false);
    }
  }

  const exporter = useResumeExport(resume.id, save, () => ({
    draft: draft.current,
    revision: committed.current.revision,
    versionId: selectedVersion.current?.id,
  }));

  useBlocker({
    shouldBlockFn: async () => !(await save()),
    enableBeforeUnload: () => dirty || !!saving.current,
  });

  // 编辑时自动防抖暂存
  useEffect(() => {
    if (
      (content === committed.current.markdown &&
        customCss === (committed.current.customCss || "")) ||
      conflicting.current
    )
      return;

    setStatus("saving");
    const timer = setTimeout(() => {
      void save().then((ok) => {
        if (ok) {
          setStatus("saved");
          showSaveNotice("已保存", true);
        }
      });
    }, AUTOSAVE_DELAY);
    return () => clearTimeout(timer);
  }, [content, customCss, save, showSaveNotice]);

  useEffect(() => {
    const events = new EventSource("/api/events");
    const refresh = () => {
      void (async () => {
        if (saving.current) await saving.current;
        const latest = await getResume(resume.id);
        if (!latest) {
          setMessage("简历已被删除");
          setStatus("error");
          return;
        }
        if (latest.revision <= committed.current.revision) return;
        if (selectedVersion.current) {
          committed.current = latest;
          return;
        }
        if (dirty) {
          conflicting.current = latest;
          setRemote(latest);
          setStatus("conflict");
          return;
        }
        committed.current = latest;
        syncStateFromResume(latest);
        setStatus("saved");
      })().catch((cause: unknown) => {
        const msg = cause instanceof Error ? cause.message : "读取最新简历失败";
        setMessage(msg);
        setStatus("error");
        toast.error(`读取接口失败: ${msg}`);
      });
    };
    events.addEventListener("open", refresh);
    events.addEventListener("resume-changed", (raw) => {
      const event = JSON.parse(
        (raw as MessageEvent).data,
      ) as ResumeChangedEvent;
      if (event.id === resume.id) refresh();
    });
    return () => events.close();
  }, [resume.id, syncStateFromResume, dirty]);

  async function commitName() {
    const next = name.trim();
    if (!next) {
      draft.current.title = committed.current.title || DEFAULT_RESUME_NAME;
      setName(draft.current.title);
      checkDirty();
      return;
    }
    setName(next);
    draft.current.title = next;
    checkDirty();
    await save();
  }

  const { handleSelectLanguage, handleAddLanguage, handleDeleteLanguage } =
    useEditorLanguages({
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
    });

  function handleChangeThemeColor(color: string) {
    setThemeColor(color);
    draft.current.themeColor = color;
    checkDirty();
    void save();
  }
  function handleChangeMargin(newMargin: string) {
    setMargin(newMargin);
    draft.current.margin = newMargin;
    checkDirty();
    void save();
  }

  async function formatCss() {
    if (!draft.current.customCss.trim()) return;
    setIsFormattingCss(true);
    try {
      const result = await formatAndValidateCss(draft.current.customCss);
      if (result.valid) {
        setCssError(null);
        draft.current.customCss = result.formatted;
        setCustomCss(result.formatted);
        checkDirty();
        void save();
      } else {
        setCssError(result.error);
      }
    } finally {
      setIsFormattingCss(false);
    }
  }

  function useRemote() {
    if (!remote) return;
    committed.current = remote;
    conflicting.current = null;
    syncStateFromResume(remote);
    setRemote(null);
    setStatus("saved");
  }

  async function overwriteRemote() {
    if (!remote) return;
    committed.current = remote;
    conflicting.current = null;
    setRemote(null);
    await save();
  }

  const updateTitle = (val: string) => {
    draft.current.title = val;
    setName(val);
    checkDirty();
  };
  const updateMarkdown = (val: string) => {
    draft.current.markdown = val;
    setContent(val);
    checkDirty();
  };
  const updateCustomCss = (val: string) => {
    draft.current.customCss = val;
    setCustomCss(val);
    checkDirty();
  };

  return {
    name,
    content,
    customCss,
    cssError,
    isFormattingCss,
    formatCss,
    updateTitle,
    updateMarkdown,
    updateCustomCss,
    currentLang,
    languages,
    themeColor,
    margin,
    status,
    saveNotice,
    isDirty: () => dirty,
    isSaving: status === "saving",
    isPublishing: publishing,
    message,
    ...exporter,
    history,
    remote,
    save,
    saveVersion,
    commitName,
    handleSelectLanguage,
    handleAddLanguage,
    handleDeleteLanguage,
    handleChangeThemeColor,
    handleChangeMargin,
    useRemote,
    overwriteRemote,
  };
}
