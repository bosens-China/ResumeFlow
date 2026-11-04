import type { Resume, ResumeSummary } from "@resumeflow/shared";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
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
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}

const json = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const DEFAULT_RESUME_NAME = "未命名简历";
export const DEFAULT_MARKDOWN =
  "# 姓名\n\n:::center\n职位 · 城市 · 电话 · 邮箱\n:::\n\n## 工作经历\n\n::::row\n:::cell\n### 公司名称 · 职位\n:::\n:::cell\n2022 - 至今\n:::\n::::\n\n- 工作内容描述\n";

export function listResumes() {
  return request<ResumeSummary[]>("/api/resumes");
}

export async function getResume(id: string): Promise<Resume | undefined> {
  try {
    return await request<Resume>(`/api/resumes/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined;
    throw error;
  }
}

export function createResume(
  input: { title?: string; markdown?: string } = {},
) {
  return request<Resume>("/api/resumes", {
    method: "POST",
    ...json({
      title: DEFAULT_RESUME_NAME,
      markdown: DEFAULT_MARKDOWN,
      ...input,
    }),
  });
}

export function updateResume(
  id: string,
  revision: number,
  patch: { title?: string; markdown?: string },
) {
  return request<Resume>(`/api/resumes/${id}`, {
    method: "PATCH",
    ...json({ revision, ...patch }),
  });
}

export function duplicateResume(id: string) {
  return request<Resume>(`/api/resumes/${id}/duplicate`, { method: "POST" });
}

export function deleteResume(id: string, revision: number) {
  return request<void>(`/api/resumes/${id}?revision=${revision}`, {
    method: "DELETE",
  });
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
