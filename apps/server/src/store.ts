import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { createVersionStore } from "./version-store.ts";
import type {
  Resume,
  ResumeChangedEvent,
  ResumeLanguageItem,
  ResumeSummary,
} from "@resumeflow/shared";

export function createStore(
  path = process.env.RESUMEFLOW_DB_PATH ?? "data/resumeflow.sqlite",
) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });

  const db = new DatabaseSync(path, { timeout: 5000 });
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS resumes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      markdown TEXT NOT NULL,
      revision INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      languages TEXT DEFAULT '{}',
      current_language TEXT DEFAULT 'zh',
      theme_color TEXT DEFAULT '',
      margin TEXT DEFAULT '',
      custom_css TEXT DEFAULT ''
    )
  `);

  const columns = db.prepare("PRAGMA table_info(resumes)").all() as {
    name: string;
  }[];
  const colNames = new Set(columns.map((c) => c.name));
  if (!colNames.has("languages"))
    db.exec("ALTER TABLE resumes ADD COLUMN languages TEXT DEFAULT '{}'");
  if (!colNames.has("current_language"))
    db.exec(
      "ALTER TABLE resumes ADD COLUMN current_language TEXT DEFAULT 'zh'",
    );
  if (!colNames.has("theme_color"))
    db.exec("ALTER TABLE resumes ADD COLUMN theme_color TEXT DEFAULT ''");
  if (!colNames.has("margin"))
    db.exec("ALTER TABLE resumes ADD COLUMN margin TEXT DEFAULT ''");
  if (!colNames.has("custom_css"))
    db.exec("ALTER TABLE resumes ADD COLUMN custom_css TEXT DEFAULT ''");

  const listeners = new Set<(event: ResumeChangedEvent) => void>();
  const fields =
    "id, title, markdown, revision, created_at AS createdAt, updated_at AS updatedAt, languages, current_language AS currentLanguage, theme_color AS themeColor, margin, custom_css AS customCss";
  const select = db.prepare(`SELECT ${fields} FROM resumes WHERE id = ?`);
  const list = db.prepare(
    `SELECT ${fields} FROM resumes ORDER BY updated_at DESC, id DESC`,
  );
  const insert = db.prepare(
    "INSERT INTO resumes (id, title, markdown, revision, created_at, updated_at, languages, current_language, theme_color, margin, custom_css) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)",
  );
  const update = db.prepare(
    "UPDATE resumes SET title = ?, markdown = ?, languages = ?, current_language = ?, theme_color = ?, margin = ?, custom_css = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?",
  );
  const remove = db.prepare(
    "DELETE FROM resumes WHERE id = ? AND revision = ?",
  );

  function parseRow(row: Record<string, unknown>): Resume {
    let languages: Record<string, ResumeLanguageItem> = {};
    if (typeof row.languages === "string") {
      try {
        languages = JSON.parse(row.languages) as Record<
          string,
          ResumeLanguageItem
        >;
      } catch {}
    }
    const currentLanguage = (row.currentLanguage as string) || "zh";
    if (!languages[currentLanguage] && (row.markdown || row.title)) {
      languages[currentLanguage] = {
        title: row.title as string,
        markdown: (row.markdown as string) || "",
      };
    }
    return {
      id: row.id as string,
      title: row.title as string,
      markdown: (row.markdown as string) || "",
      revision: Number(row.revision),
      createdAt: row.createdAt as string,
      updatedAt: row.updatedAt as string,
      currentLanguage,
      languages,
      themeColor: (row.themeColor as string) || undefined,
      margin: (row.margin as string) || undefined,
      customCss: (row.customCss as string) || undefined,
    };
  }

  function get(id: string): Resume | undefined {
    const row = select.get(id);
    return row ? parseRow(row as Record<string, unknown>) : undefined;
  }

  function notify(resume: Resume, versionsChanged = false) {
    for (const listener of listeners)
      listener({ id: resume.id, revision: resume.revision, versionsChanged });
  }

  return {
    ...createVersionStore(db, get, update, notify),
    list(): ResumeSummary[] {
      return list.all().map((row) => parseRow(row as Record<string, unknown>));
    },
    get,
    create(
      title: string,
      markdown = "",
      options?: {
        languages?: Record<string, ResumeLanguageItem>;
        currentLanguage?: string;
        themeColor?: string;
        margin?: string;
        customCss?: string;
      },
    ): Resume {
      const id = randomUUID();
      const now = new Date().toISOString();
      const currentLanguage = options?.currentLanguage || "zh";
      const languages = structuredClone(
        options?.languages ?? {
          [currentLanguage]: { title, markdown },
        },
      );
      const activeItem = languages[currentLanguage];
      insert.run(
        id,
        activeItem?.title ?? title,
        activeItem?.markdown ?? markdown,
        now,
        now,
        JSON.stringify(languages),
        currentLanguage,
        options?.themeColor ?? "",
        options?.margin ?? "",
        options?.customCss ?? "",
      );
      const resume = get(id)!;
      notify(resume);
      return resume;
    },
    update(
      id: string,
      revision: number,
      patch: {
        title?: string;
        markdown?: string;
        languages?: Record<string, ResumeLanguageItem>;
        currentLanguage?: string;
        themeColor?: string;
        margin?: string;
        customCss?: string;
        language?: string;
      },
    ) {
      const current = get(id);
      if (!current) return { status: "not_found" as const };
      if (current.revision !== revision)
        return { status: "conflict" as const, current };

      const nextLanguages = patch.languages
        ? structuredClone(patch.languages)
        : structuredClone(current.languages ?? {});

      const nextCurrentLanguage =
        patch.currentLanguage ?? current.currentLanguage ?? "zh";

      if (patch.markdown !== undefined || patch.title !== undefined) {
        const targetLang = patch.language || nextCurrentLanguage;
        const existingLang = nextLanguages[targetLang] ?? {
          title: current.title,
          markdown:
            targetLang === current.currentLanguage ? current.markdown : "",
        };
        nextLanguages[targetLang] = {
          title: patch.title ?? existingLang.title ?? current.title,
          markdown: patch.markdown ?? existingLang.markdown,
        };
      }

      const activeItem = nextLanguages[nextCurrentLanguage];
      const nextTitle = activeItem?.title ?? current.title;
      const nextMarkdown = activeItem?.markdown ?? current.markdown;
      const nextThemeColor =
        patch.themeColor !== undefined
          ? patch.themeColor
          : (current.themeColor ?? "");
      const nextMargin =
        patch.margin !== undefined ? patch.margin : (current.margin ?? "");
      const nextCustomCss =
        patch.customCss !== undefined
          ? patch.customCss
          : (current.customCss ?? "");

      const now = new Date().toISOString();
      const result = update.run(
        nextTitle,
        nextMarkdown,
        JSON.stringify(nextLanguages),
        nextCurrentLanguage,
        nextThemeColor,
        nextMargin,
        nextCustomCss,
        now,
        id,
        revision,
      );
      if (result.changes === 0)
        return { status: "conflict" as const, current: get(id)! };
      const resume = get(id)!;
      notify(resume);
      return { status: "ok" as const, resume };
    },
    delete(id: string, revision: number) {
      const current = get(id);
      if (!current) return { status: "not_found" as const };
      if (current.revision !== revision)
        return { status: "conflict" as const, current };
      if (remove.run(id, revision).changes === 0)
        return { status: "conflict" as const, current: get(id)! };
      for (const listener of listeners)
        listener({ id, revision: revision + 1, deleted: true });
      return { status: "ok" as const };
    },
    subscribe(listener: (event: ResumeChangedEvent) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      db.close();
    },
  };
}

export type ResumeStore = ReturnType<typeof createStore>;

export function duplicateResume(store: ResumeStore, id: string) {
  const original = store.get(id);
  if (!original) return undefined;
  const suffix = " (副本)";
  const title = `${original.title
    .slice(0, 120 - suffix.length)
    .replace(/[\uD800-\uDBFF]$/, "")
    .trimEnd()}${suffix}`;
  const languages = structuredClone(original.languages ?? {});
  const language = original.currentLanguage || "zh";
  languages[language] = { title, markdown: original.markdown };
  return store.create(title, original.markdown, {
    languages,
    currentLanguage: original.currentLanguage,
    themeColor: original.themeColor,
    margin: original.margin,
    customCss: original.customCss,
  });
}
