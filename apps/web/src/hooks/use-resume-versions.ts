import { useCallback, useEffect, useState, type RefObject } from "react";
import type {
  Resume,
  ResumeChangedEvent,
  ResumeVersion,
  ResumeVersionSummary,
} from "@resumeflow/shared";
import { toast } from "sonner";
import {
  createResumeVersion,
  getResumeVersion,
  listResumeVersions,
} from "@/lib/resume-versions";

export interface ResumeVersionState {
  selected: ResumeVersion | null;
  pending: string | null;
}

export function useResumeVersions(
  id: string,
  committed: RefObject<Resume>,
  load: (version: ResumeVersion) => Promise<void>,
) {
  const [versions, setVersions] = useState<ResumeVersionSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(
    async () => setVersions(await listResumeVersions(id)),
    [id],
  );

  useEffect(() => {
    const events = new EventSource("/api/events");
    const update = () => {
      void refresh().catch((cause: unknown) => {
        const msg = cause instanceof Error ? cause.message : "读取版本记录失败";
        setError(msg);
        toast.error(`读取接口失败: ${msg}`);
      });
    };
    update();
    events.addEventListener("open", update);
    events.addEventListener("resume-changed", (raw) => {
      const event = JSON.parse(
        (raw as MessageEvent).data,
      ) as ResumeChangedEvent;
      if (event.id === id && event.versionsChanged) update();
    });
    return () => events.close();
  }, [id, refresh]);

  async function run<T>(action: () => Promise<T>): Promise<T | null> {
    setBusy(true);
    setError("");
    try {
      return await action();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "版本操作失败";
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function switchToVersion(versionId: string): Promise<boolean> {
    const res = await run(async () => {
      const version = await getResumeVersion(id, versionId);
      if (!version) throw new Error("版本不存在或已被删除");
      await load(version);
      return true;
    });
    return res ?? false;
  }

  async function publishVersion(title?: string): Promise<ResumeVersion | null> {
    const version = await run(async () => {
      const versionTitle = title || `版本 ${versions.length + 1}`;
      return createResumeVersion(id, committed.current.revision, versionTitle);
    });
    if (version)
      setVersions((current) => [
        { id: version.id, title: version.title, createdAt: version.createdAt },
        ...current.filter((item) => item.id !== version.id),
      ]);
    return version;
  }

  return {
    versions,
    busy,
    error,
    refresh,
    switchToVersion,
    publishVersion,
  };
}
