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
