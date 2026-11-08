import type {
  ResumeBackupData,
  ResumeBackupItem,
  ResumeSummary,
} from "@resumeflow/shared";
import type { ResumeStore } from "./store.ts";
import { strToU8, strFromU8, unzipSync, zipSync } from "fflate";
import { z } from "zod/v4";
import { ResumeOperationError } from "./resume-operations.ts";
import type { Resume } from "@resumeflow/shared";
import { getBackupConflictToken } from "./backup-token.ts";
import { RESUME_FONT_IDS } from "@resumeflow/shared/resume-fonts";
import { createHash } from "node:crypto";

function safeName(value: string): string {
  return Array.from(value, (char) => {
    const code = char.codePointAt(0)!;
    return code < 32 ||
      (code >= 0xd800 && code <= 0xdfff) ||
      '\\/:*?"<>|'.includes(char)
      ? "_"
      : char;
  }).join("");
}

function markdownFiles(resume: Resume): Record<string, Uint8Array> {
  const languages = Object.entries(resume.languages ?? {});
  const files: Record<string, Uint8Array> = {};
  const names = new Set<string>();
  for (const [code, item] of languages) {
    let name = safeName(code) || "language";
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name))
      name = `language-${name}`;
    let filename = `${name}.md`;
    let suffix = 2;
    while (names.has(filename.toLowerCase()))
      filename = `${name}-${suffix++}.md`;
    names.add(filename.toLowerCase());
    files[filename] = strToU8(item.markdown);
  }
  return files;
}

export function exportMarkdownArchive(resume: Resume): Uint8Array {
  if (Object.keys(resume.languages ?? {}).length < 2)
    throw new ResumeOperationError(400, "简历只有一种语言，无法导出语言合集");
  const files = markdownFiles(resume);
  return zipSync(files);
}

export function exportBackup(
  store: ResumeStore,
  id?: string,
): ResumeBackupData {
  if (id) {
    const resume = store.get(id);
    if (!resume) {
      throw new Error("简历不存在");
    }
    const versions = store.getAllVersions(id);
    return {
      version: 1,
      generator: "ResumeFlow",
      exportedAt: new Date().toISOString(),
      resumes: [{ resume, versions }],
    };
  }

  const list = store.list();
  const resumes: ResumeBackupItem[] = list.map((item) => {
    const resume = store.get(item.id) ?? item;
    const versions = store.getAllVersions(item.id);
    return { resume, versions };
  });

  return {
    version: 1,
    generator: "ResumeFlow",
    exportedAt: new Date().toISOString(),
    resumes,
  };
}

const languageSchema = z.strictObject({
  title: z.string().max(120).optional(),
  markdown: z.string().max(1_000_000),
  font: z.enum(RESUME_FONT_IDS).optional(),
});
const resumeSchema = z
  .strictObject({
    id: z.uuid(),
    title: z.string().min(1).max(120),
    markdown: z.string().max(1_000_000),
    revision: z.number().int().positive(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    currentLanguage: z.string().min(1).max(20),
    languages: z.record(z.string().min(1).max(20), languageSchema),
    themeColor: z.string().max(50).optional(),
    margin: z.string().max(50).optional(),
    customCss: z.string().max(100_000).optional(),
    lineHeight: z.number().min(0.5).max(2).optional(),
  })
  .refine(
    (r) => Object.hasOwn(r.languages, r.currentLanguage),
    "当前语言不存在",
  );
const backupSchema = z
  .strictObject({
    version: z.literal(1),
    generator: z.literal("ResumeFlow"),
    exportedAt: z.iso.datetime(),
    resumes: z.array(
      z.strictObject({
        resume: resumeSchema,
        versions: z.array(
          z.strictObject({
            id: z.uuid(),
            title: z.string().min(1),
            createdAt: z.iso.datetime(),
            resume: resumeSchema,
          }),
        ),
      }),
    ),
  })
  .refine(
    (data) =>
      new Set(data.resumes.map((item) => item.resume.id)).size ===
      data.resumes.length,
    "备份包含重复简历",
  )
  .refine(
    (data) =>
      data.resumes.every((item) =>
        item.versions.every((v) => v.resume.id === item.resume.id),
      ),
    "历史版本不属于对应简历",
  );

export const backupRequest = z.object({
  archive: z
    .string()
    .min(1)
    .max(28_000_000)
    .describe("ZIP 备份文件的 Base64 内容"),
});
export const backupRestoreInput = backupRequest.extend({
  decisions: z
    .array(
      z.object({
        id: z.uuid(),
        action: z.enum(["overwrite", "copy"]),
        token: z.string(),
      }),
    )
    .default([])
    .describe("逐份冲突的用户选择；token 必须使用预检结果，AI 不得自行选择"),
});

export function backupZip(data: ResumeBackupData): Uint8Array {
  const json = strToU8(JSON.stringify(data));
  if (json.length > 50_000_000)
    throw new ResumeOperationError(400, "备份数据超过大小限制");
  const files: Record<string, Uint8Array> = {
    "backup.json": json,
    "backup.sha256": strToU8(createHash("sha256").update(json).digest("hex")),
  };
  for (const { resume } of data.resumes) {
    const title =
      Array.from(safeName(resume.title)).slice(0, 80).join("") || "resume";
    for (const [name, content] of Object.entries(markdownFiles(resume))) {
      files[`resumes/${title}-${resume.id}/${name}`] = content;
    }
  }
  const archive = zipSync(files);
  if (archive.length > 20_000_000)
    throw new ResumeOperationError(400, "备份文件超过大小限制");
  return archive;
}

export function readBackup(archive: string): ResumeBackupData {
  try {
    if (
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        archive,
      )
    )
      throw new Error();
    const bytes = Buffer.from(archive, "base64");
    if (bytes.length > 20_000_000) throw new Error();
    const found = new Set<string>();
    const files = unzipSync(bytes, {
      filter: (entry) => {
        if (entry.name !== "backup.json" && entry.name !== "backup.sha256")
          return false;
        if (
          found.has(entry.name) ||
          entry.originalSize > (entry.name === "backup.json" ? 50_000_000 : 64)
        )
          throw new Error();
        found.add(entry.name);
        return true;
      },
    });
    const json = files["backup.json"];
    const hash = files["backup.sha256"];
    if (
      !json ||
      !hash ||
      strFromU8(hash) !== createHash("sha256").update(json).digest("hex")
    )
      throw new Error();
    const result = backupSchema.safeParse(JSON.parse(strFromU8(json)));
    if (!result.success) throw new Error();
    return result.data as ResumeBackupData;
  } catch {
    throw new ResumeOperationError(400, "备份文件无效、损坏或超过大小限制");
  }
}

export function inspectBackup(store: ResumeStore, data: ResumeBackupData) {
  const conflicts = data.resumes.flatMap((item) => {
    const { resume } = item;
    const current = store.get(resume.id);
    return current
      ? [
          {
            id: resume.id,
            title: resume.title,
            currentTitle: current.title,
            token: getBackupConflictToken(
              current,
              store.listVersions(current.id).map((v) => v.id),
              item,
            ),
          },
        ]
      : [];
  });
  return { count: data.resumes.length, conflicts };
}

export function importBackup(
  store: ResumeStore,
  data: ResumeBackupData,
  decisions: z.infer<typeof backupRestoreInput>["decisions"],
): { count: number; resumes: ResumeSummary[] } {
  const conflicts = inspectBackup(store, data).conflicts;
  if (
    decisions.length !== conflicts.length ||
    new Set(decisions.map((d) => d.id)).size !== decisions.length ||
    conflicts.some(
      (c) => !decisions.some((d) => d.id === c.id && d.token === c.token),
    )
  )
    throw new ResumeOperationError(
      409,
      "请逐份确认备份冲突；如数据已变化请重新检查",
    );
  const resumes = store.restoreBackup(data.resumes, decisions);
  return { count: resumes.length, resumes };
}
