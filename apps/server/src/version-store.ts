import { randomUUID } from "node:crypto";
import type { DatabaseSync, StatementSync } from "node:sqlite";
import type {
  Resume,
  ResumeVersion,
  ResumeVersionSummary,
} from "@resumeflow/shared";

export function createVersionStore(
  db: DatabaseSync,
  get: (id: string) => Resume | undefined,
  update: StatementSync,
  notify: (resume: Resume, versionsChanged?: boolean) => void,
) {
  db.exec(`CREATE TABLE IF NOT EXISTS resume_versions (
    id TEXT PRIMARY KEY,
    resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    snapshot TEXT NOT NULL
  ); CREATE INDEX IF NOT EXISTS resume_versions_by_resume ON resume_versions(resume_id, created_at DESC)`);
  const list = db.prepare(
    "SELECT id, title, created_at AS createdAt FROM resume_versions WHERE resume_id = ? ORDER BY created_at DESC, rowid DESC",
  );
  const select = db.prepare(
    "SELECT id, title, created_at AS createdAt, snapshot FROM resume_versions WHERE resume_id = ? AND id = ?",
  );
  const insert = db.prepare(
    "INSERT INTO resume_versions VALUES (?, ?, ?, ?, ?)",
  );

  function getVersion(
    resumeId: string,
    versionId: string,
  ): ResumeVersion | undefined {
    const row = select.get(resumeId, versionId);
    if (!row) return undefined;
    return {
      id: String(row.id),
      title: String(row.title),
      createdAt: String(row.createdAt),
      resume: JSON.parse(String(row.snapshot)) as Resume,
    };
  }

  function snapshot(resume: Resume, title: string): ResumeVersion {
    const version = {
      id: randomUUID(),
      title,
      createdAt: new Date().toISOString(),
      resume,
    };
    insert.run(
      version.id,
      resume.id,
      title,
      version.createdAt,
      JSON.stringify(resume),
    );
    return version;
  }

  function transaction<T>(work: () => T): T {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  return {
    getVersion,
    listVersions(id: string): ResumeVersionSummary[] {
      return list.all(id) as unknown as ResumeVersionSummary[];
    },
    createVersion(id: string, revision: number, title: string) {
      const result = transaction(() => {
        const current = get(id);
        if (!current) return { status: "not_found" as const };
        if (current.revision !== revision)
          return { status: "conflict" as const, current };
        return { status: "ok" as const, version: snapshot(current, title) };
      });
      if (result.status === "ok") notify(result.version.resume, true);
      return result;
    },
    restoreVersion(id: string, versionId: string, revision: number) {
      const result = transaction(() => {
        const current = get(id);
        const version = getVersion(id, versionId);
        if (!current || !version) return { status: "not_found" as const };
        if (current.revision !== revision)
          return { status: "conflict" as const, current };
        snapshot(current, "恢复前的草稿");
        const source = version.resume;
        update.run(
          source.title,
          source.markdown,
          JSON.stringify(source.languages ?? {}),
          source.currentLanguage || "zh",
          source.themeColor || "",
          source.margin || "",
          source.customCss || "",
          new Date().toISOString(),
          id,
          revision,
        );
        return { status: "ok" as const, resume: get(id)! };
      });
      if (result.status === "ok") notify(result.resume, true);
      return result;
    },
  };
}
