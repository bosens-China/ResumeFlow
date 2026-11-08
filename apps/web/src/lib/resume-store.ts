import type { Resume, ResumeTemplate } from "@resumeflow/shared";
import { api } from "./api";

const LEGACY_KEY = "resumeflow:resumes";
const IMPORTED_KEY = "resumeflow:imported-legacy-ids";

export class ApiError extends Error {
  readonly status: number;
  readonly current?: Resume;

  constructor(status: number, message: string, current?: Resume) {
    super(message);
    this.status = status;
    this.current = current;
  }
}

export async function throwApiError(response: {
  status: number;
  json: () => Promise<unknown>;
}): Promise<never> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    current?: Resume;
  };
  throw new ApiError(
    response.status,
    body.error ?? `请求失败 (${response.status})`,
    body.current,
  );
}

export const DEFAULT_RESUME_NAME = "未命名简历";
export const DEFAULT_MARKDOWN = `# 姓名\n\n::::row\n:::cell{align="center"}\n职位 · 城市 · 电话 · 邮箱\n:::\n::::\n\n## 工作经历\n\n::::row{columns="1fr auto"}\n:::cell{align="left"}\n### 公司名称 · 职位\n:::\n\n:::cell{align="right"}\n2022 - 至今\n:::\n::::\n\n- 工作内容描述\n`;

export async function listResumes() {
  const response = await api.api.resumes.$get();
  if (!response.ok) return throwApiError(response);
  return response.json();
}

export async function getResume(id: string): Promise<Resume | undefined> {
  const response = await api.api.resumes[":id"].$get({ param: { id } });
  if (response.status === 404) return undefined;
  if (!response.ok) return throwApiError(response);
  return response.json();
}

export async function createResume(
  input: {
    title?: string;
    markdown?: string;
    themeColor?: string;
    margin?: string;
    lineHeight?: number;
    customCss?: string;
  } = {},
) {
  const response = await api.api.resumes.$post({
    json: { title: DEFAULT_RESUME_NAME, markdown: DEFAULT_MARKDOWN, ...input },
  });
  if (!response.ok) return throwApiError(response);
  return response.json();
}

export async function createResumeFromTemplate(template: ResumeTemplate) {
  return createResume({
    title: template.name.replace(/（.*）/, "").trim(),
    markdown: template.markdown,
    themeColor: template.themeColor,
    margin: template.margin,
    customCss: template.customCss,
  });
}

export async function updateResume(
  id: string,
  revision: number,
  patch: {
    title?: string;
    markdown?: string;
    themeColor?: string;
    margin?: string;
    lineHeight?: number;
    customCss?: string;
    currentLanguage?: string;
    languages?: Record<string, { title?: string; markdown: string }>;
    language?: string;
  },
) {
  const response = await api.api.resumes[":id"].$patch({
    param: { id },
    json: { revision, ...patch },
  });
  if (!response.ok) return throwApiError(response);
  return response.json();
}

export async function duplicateResume(id: string) {
  const response = await api.api.resumes[":id"].duplicate.$post({
    param: { id },
  });
  if (!response.ok) return throwApiError(response);
  return response.json();
}

export async function deleteResume(id: string, revision: number) {
  const response = await api.api.resumes[":id"].$delete({
    param: { id },
    query: { revision: String(revision) },
  });
  if (!response.ok) return throwApiError(response);
}

export async function importMarkdownFile(file: File) {
  const content = await file.text();
  const title = file.name.replace(/\.md$/i, "").trim() || DEFAULT_RESUME_NAME;
  return createResume({ title, markdown: content });
}

export async function exportBackup(id?: string) {
  const url = id ? `/api/backup?id=${encodeURIComponent(id)}` : "/api/backup";
  const response = await fetch(url);
  if (!response.ok) return throwApiError(response);
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition");
  let filename = "resumeflow_backup.zip";
  if (disposition) {
    const match =
      /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition) ??
      /filename="?([^";]+)"?/i.exec(disposition);
    if (match?.[1]) filename = decodeURIComponent(match[1]);
  }
  const downloadUrl = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), {
    href: downloadUrl,
    download: filename,
  }).click();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
}

export type BackupConflict = {
  id: string;
  title: string;
  currentTitle: string;
  token: string;
};
export type BackupDecision = {
  id: string;
  action: "overwrite" | "copy";
  token: string;
};

export async function inspectBackupFile(file: File) {
  if (file.size > 20_000_000) throw new Error("备份文件超过大小限制");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const archive = btoa(binary);
  const response = await fetch("/api/backup/inspect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ archive }),
  });
  if (!response.ok) return throwApiError(response);
  const result = (await response.json()) as {
    count: number;
    conflicts: BackupConflict[];
  };
  return { archive, ...result };
}

export async function importBackupFile(
  archive: string,
  decisions: BackupDecision[],
) {
  const response = await fetch("/api/backup/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ archive, decisions }),
  });
  if (!response.ok) return throwApiError(response);
  return response.json() as Promise<{ count: number; resumes: Resume[] }>;
}

interface LegacyResume {
  id: string;
  name: string;
  content: string;
}

function legacyDrafts(): LegacyResume[] {
  try {
    const saved = JSON.parse(
      localStorage.getItem(LEGACY_KEY) ?? "[]",
    ) as unknown;
    const imported = new Set(
      JSON.parse(localStorage.getItem(IMPORTED_KEY) ?? "[]") as string[],
    );
    return Array.isArray(saved)
      ? saved.filter(
          (item): item is LegacyResume =>
            typeof item?.id === "string" &&
            typeof item?.name === "string" &&
            typeof item?.content === "string" &&
            !imported.has(item.id),
        )
      : [];
  } catch {
    return [];
  }
}

export function legacyDraftCount() {
  return legacyDrafts().length;
}

export async function importLegacyDrafts() {
  const imported = new Set(
    JSON.parse(localStorage.getItem(IMPORTED_KEY) ?? "[]") as string[],
  );
  for (const draft of legacyDrafts()) {
    await createResume({ title: draft.name, markdown: draft.content });
    imported.add(draft.id);
    localStorage.setItem(IMPORTED_KEY, JSON.stringify([...imported]));
  }
}
