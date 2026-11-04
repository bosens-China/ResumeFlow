import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type {
  Resume,
  ResumeChangedEvent,
  ResumeSummary,
} from "@resumeflow/shared";

export function createStore(
  path = process.env.RESUMEFLOW_DB_PATH ?? "data/resumeflow.sqlite",
) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });

  const db = new DatabaseSync(path, { timeout: 5000 });
  db.exec(`
    CREATE TABLE IF NOT EXISTS resumes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      markdown TEXT NOT NULL,
      revision INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  const listeners = new Set<(event: ResumeChangedEvent) => void>();
  const fields =
    "id, title, markdown, revision, created_at AS createdAt, updated_at AS updatedAt";
  const select = db.prepare(`SELECT ${fields} FROM resumes WHERE id = ?`);
  const list = db.prepare(
    "SELECT id, title, revision, created_at AS createdAt, updated_at AS updatedAt FROM resumes ORDER BY updated_at DESC, id DESC",
  );
  const insert = db.prepare(
    "INSERT INTO resumes (id, title, markdown, revision, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
  );
  const update = db.prepare(
    "UPDATE resumes SET title = ?, markdown = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?",
  );
  const remove = db.prepare(
    "DELETE FROM resumes WHERE id = ? AND revision = ?",
  );

  function get(id: string): Resume | undefined {
    const row = select.get(id);
    return row ? ({ ...row } as unknown as Resume) : undefined;
  }

  function notify(resume: Resume) {
    for (const listener of listeners)
      listener({ id: resume.id, revision: resume.revision });
  }

  return {
    list(): ResumeSummary[] {
      return list.all().map((row) => ({ ...row }) as unknown as ResumeSummary);
    },
    get,
    create(title: string, markdown = ""): Resume {
      const id = randomUUID();
      const now = new Date().toISOString();
      insert.run(id, title, markdown, now, now);
      const resume = get(id)!;
      notify(resume);
      return resume;
    },
    update(
      id: string,
      revision: number,
      patch: { title?: string; markdown?: string },
    ) {
      const current = get(id);
      if (!current) return { status: "not_found" as const };
      if (current.revision !== revision)
        return { status: "conflict" as const, current };

      const now = new Date().toISOString();
      const result = update.run(
        patch.title ?? current.title,
        patch.markdown ?? current.markdown,
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
