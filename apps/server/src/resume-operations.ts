import type { Resume } from "@resumeflow/shared";
import type { ResumeStore } from "./store.ts";

export class ResumeOperationError extends Error {
  readonly status: 400 | 404 | 409;
  readonly current?: Resume;

  constructor(status: 400 | 404 | 409, message: string, current?: Resume) {
    super(message);
    this.status = status;
    this.current = current;
  }
}

type OperationResult =
  | { status: "ok" }
  | { status: "not_found" }
  | { status: "conflict"; current: Resume };

export function unwrapResult<T extends OperationResult>(
  result: T,
  notFound = "简历不存在",
): Extract<T, { status: "ok" }> {
  if (result.status === "not_found")
    throw new ResumeOperationError(404, notFound);
  if (result.status === "conflict")
    throw new ResumeOperationError(409, "版本冲突", result.current);
  return result as Extract<T, { status: "ok" }>;
}

export function getPdfSource(
  store: ResumeStore,
  id: string,
  options: { versionId?: string; language?: string; revision?: string } = {},
) {
  const resume = options.versionId
    ? store.getVersion(id, options.versionId)?.resume
    : store.get(id);
  if (!resume) throw new ResumeOperationError(404, "简历不存在");
  if (
    !options.versionId &&
    options.revision &&
    options.revision !== String(resume.revision)
  )
    throw new ResumeOperationError(409, "版本冲突", resume);
  const language = options.language || resume.currentLanguage || "zh";
  const item =
    resume.languages && Object.hasOwn(resume.languages, language)
      ? resume.languages[language]
      : undefined;
  if (!item && language !== (resume.currentLanguage || "zh"))
    throw new ResumeOperationError(400, `语言版本不存在：${language}`);
  return { resume, language, title: item?.title || resume.title };
}
