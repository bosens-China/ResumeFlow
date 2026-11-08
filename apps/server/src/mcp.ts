import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod/v4";
import {
  RESUME_TEMPLATES,
  getResumeMarkdownFilename,
} from "@resumeflow/shared";
import { APP_VERSION } from "./app-version.ts";
import { duplicateResume, type ResumeStore } from "./store.ts";
import {
  backupRequest,
  backupRestoreInput,
  exportMarkdownArchive,
  importBackup,
  inspectBackup,
  readBackup,
} from "./backup.ts";
import {
  getPdfSource,
  ResumeOperationError,
  unwrapResult,
} from "./resume-operations.ts";
import {
  createInput,
  updateInput,
  idInput,
  versionIdInput,
  deleteInput,
  pdfInput,
  versionCreateInput,
  versionRestoreInput,
} from "./schemas.ts";

export function mcpHandler(store: ResumeStore) {
  return createMcpHandler(({ requestInfo }) => {
    const server = new McpServer({ name: "resumeflow", version: APP_VERSION });
    const text = (value: unknown) => ({
      content: [{ type: "text" as const, text: JSON.stringify(value) }],
    });
    const error = (message: string) => ({
      isError: true,
      content: [{ type: "text" as const, text: message }],
    });
    const run = (operation: () => unknown) => {
      try {
        return text(operation());
      } catch (cause) {
        if (!(cause instanceof ResumeOperationError)) throw cause;
        return error(
          cause.current
            ? `${cause.message}，当前内容：${JSON.stringify(cause.current)}`
            : cause.message,
        );
      }
    };

    server.registerTool(
      "list_resume_versions",
      {
        description: "列出简历的历史快照，返回标题和创建时间",
        inputSchema: idInput,
      },
      async ({ id }) =>
        store.get(id) ? text(store.listVersions(id)) : error("简历不存在"),
    );
    server.registerTool(
      "get_resume_version",
      {
        description: "读取不可变的简历历史快照",
        inputSchema: versionIdInput,
      },
      async ({ id, versionId }) => {
        const version = store.getVersion(id, versionId);
        return version ? text(version) : error("版本不存在");
      },
    );
    server.registerTool(
      "create_resume_version",
      {
        description: "以当前已保存草稿创建命名历史快照，需提供当前 revision",
        inputSchema: versionCreateInput.extend(idInput.shape),
      },
      async ({ id, revision, title }) =>
        run(
          () => unwrapResult(store.createVersion(id, revision, title)).version,
        ),
    );
    server.registerTool(
      "restore_resume_version",
      {
        description:
          "先归档当前草稿，再从历史快照开始新草稿；原快照不变，需当前 revision",
        inputSchema: versionRestoreInput.extend(versionIdInput.shape),
      },
      async ({ id, versionId, revision }) =>
        run(
          () =>
            unwrapResult(
              store.restoreVersion(id, versionId, revision),
              "版本不存在",
            ).resume,
        ),
    );

    server.registerTool(
      "list_resumes",
      { description: "列出简历", inputSchema: z.object({}) },
      async () => text(store.list()),
    );
    server.registerTool(
      "list_resume_templates",
      {
        description:
          "列出预设的简历模板（如 AI 应用开发极简模板、产品经理左对齐带头像模板），可用于创建新简历",
        inputSchema: z.object({}),
      },
      async () => text(RESUME_TEMPLATES),
    );
    server.registerTool(
      "create_resume",
      {
        description:
          "创建简历，可同时设置多语言及样式；未提供正文时创建空白简历",
        inputSchema: createInput,
      },
      async ({ title, markdown, ...options }) =>
        text(store.create(title, markdown, options)),
    );
    server.registerTool(
      "get_resume",
      { description: "读取简历", inputSchema: idInput },
      async ({ id }) => {
        const resume = store.get(id);
        return resume ? text(resume) : error("简历不存在");
      },
    );
    server.registerTool(
      "update_resume",
      {
        description:
          "修改名称、Markdown、语言版本、字体、主题色、内边距、行距与间距或自定义 CSS，需当前 revision。font 按目标语言保存；普通字段局部更新。languages 整体替换，遗漏语言会被删除。language 指定标题、正文和字体的写入目标，currentLanguage 切换显示语言；新增当前语言须同时提供该语言的正文（可以为空）。不会自动翻译",
        inputSchema: updateInput.safeExtend(idInput.shape),
      },
      async ({ id, revision, ...patch }) =>
        run(() => unwrapResult(store.update(id, revision, patch)).resume),
    );
    server.registerTool(
      "duplicate_resume",
      { description: "创建指定简历的副本", inputSchema: idInput },
      async ({ id }) => {
        const copy = duplicateResume(store, id);
        return copy ? text(copy) : error("简历不存在");
      },
    );
    server.registerTool(
      "delete_resume",
      {
        description: "永久删除简历及其全部语言和历史快照，需提供当前 revision",
        inputSchema: deleteInput.extend(idInput.shape),
      },
      async ({ id, revision }) =>
        run(() => {
          unwrapResult(store.delete(id, revision));
          return { deleted: true, id };
        }),
    );
    server.registerTool(
      "export_resume_pdf",
      {
        description:
          "获取已保存简历的 PDF 下载地址，需要再下载该 URL 才会生成文件；可指定已有语言和历史快照 versionId。当前稿链接遇到后续修改会失效，请重新获取；快照链接不受草稿修改影响",
        inputSchema: pdfInput,
      },
      async ({ id, language, versionId }) =>
        run(() => {
          const { resume } = getPdfSource(store, id, { language, versionId });
          const base =
            process.env.RESUMEFLOW_PUBLIC_URL ??
            new URL(requestInfo!.url).origin;
          const url = new URL(
            `${base.replace(/\/$/, "")}/api/resumes/${id}/pdf`,
          );
          url.searchParams.set("revision", String(resume.revision));
          url.searchParams.set("download", "1");
          if (language) url.searchParams.set("lang", language);
          if (versionId) url.searchParams.set("versionId", versionId);
          return {
            url: url.href,
            revision: resume.revision,
          };
        }),
    );
    server.registerTool(
      "export_resume_markdown",
      {
        description:
          "获取已保存简历或快照的 Markdown 正文与推荐文件名，可指定已有语言和历史快照 versionId",
        inputSchema: pdfInput,
      },
      async ({ id, language, versionId }) =>
        run(() => {
          const {
            resume,
            language: lang,
            title,
          } = getPdfSource(store, id, { language, versionId });
          const item = resume.languages?.[lang];
          const markdown = item?.markdown ?? resume.markdown ?? "";
          return {
            title,
            language: lang,
            filename: getResumeMarkdownFilename(title, lang),
            markdown,
            revision: resume.revision,
          };
        }),
    );
    server.registerTool(
      "export_resume_markdown_all",
      {
        description:
          "获取简历所有语言 Markdown 的 ZIP 下载地址；只有一种语言时不可导出合集，可指定历史快照",
        inputSchema: pdfInput,
      },
      async ({ id, versionId }) =>
        run(() => {
          const { resume } = getPdfSource(store, id, { versionId });
          exportMarkdownArchive(resume);
          const base =
            process.env.RESUMEFLOW_PUBLIC_URL ??
            new URL(requestInfo!.url).origin;
          const url = new URL(
            `${base.replace(/\/$/, "")}/api/resumes/${id}/markdown-all`,
          );
          url.searchParams.set("revision", String(resume.revision));
          if (versionId) url.searchParams.set("versionId", versionId);
          return { url: url.href };
        }),
    );
    server.registerTool(
      "export_backup",
      {
        description:
          "获取 ZIP 备份下载地址。省略 id 备份全部，指定 id 备份单份简历；包含所有语言、样式和历史快照",
        inputSchema: z.object({
          id: z
            .string()
            .uuid()
            .optional()
            .describe("可选，要备份的单份简历 UUID"),
        }),
      },
      async ({ id }) =>
        run(() => {
          if (id && !store.get(id))
            throw new ResumeOperationError(404, "简历不存在");
          const base =
            process.env.RESUMEFLOW_PUBLIC_URL ??
            new URL(requestInfo!.url).origin;
          const url = new URL(`${base.replace(/\/$/, "")}/api/backup`);
          if (id) url.searchParams.set("id", id);
          return { url: url.href };
        }),
    );
    server.registerTool(
      "inspect_backup",
      {
        description:
          "预检 ZIP 备份并列出逐份冲突及确认令牌；发生冲突时必须逐份询问用户，再调用 import_backup",
        inputSchema: backupRequest,
      },
      async ({ archive }) =>
        run(() => inspectBackup(store, readBackup(archive))),
    );
    server.registerTool(
      "import_backup",
      {
        description:
          "恢复 ZIP 备份。必须先调用 inspect_backup，逐份询问用户选择覆盖或副本，提交每项选择和 token；冲突变化须重新询问。不得自行覆盖",
        inputSchema: backupRestoreInput,
      },
      async ({ archive, decisions }) =>
        run(() => importBackup(store, readBackup(archive), decisions)),
    );
    return server;
  });
}
