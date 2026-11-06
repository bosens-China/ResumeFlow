import { useState } from "react";
import { Bot } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CopyBlock } from "@/components/code-block";

const SKILL_COMMAND = "npx skills add bosens-China/ResumeFlow";
const DOCKER_COMMAND = `docker run -d --name resumeflow \\
  -p 127.0.0.1:8080:3000 \\
  -v resumeflow-data:/data \\
  boses/resumeflow:latest`;

const CURSOR_JSON = `{
  "mcpServers": {
    "resumeflow": {
      "url": "http://127.0.0.1:8080/mcp"
    }
  }
}`;

const CLAUDE_CODE_COMMAND =
  "claude mcp add --transport http resumeflow http://127.0.0.1:8080/mcp";

const CLAUDE_JSON = `{
  "mcpServers": {
    "resumeflow": {
      "type": "http",
      "url": "http://127.0.0.1:8080/mcp"
    }
  }
}`;

const CODEX_CLI_COMMAND =
  "codex mcp add resumeflow --url http://127.0.0.1:8080/mcp";

const CODEX_TOML = `[mcp_servers.resumeflow]
url = "http://127.0.0.1:8080/mcp"
enabled = true`;

export function AiIntegrationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [clientTab, setClientTab] = useState<"cursor" | "claude" | "codex">(
    "cursor",
  );
  const httpPrompt = `使用 ResumeFlow 管理我的简历。
服务地址为 ${window.location.origin}。
未连接 MCP 时，先读取以下文档，再调用 HTTP API：
${window.location.origin}/api/openapi.json`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="max-h-[85vh] overflow-y-auto sm:max-w-xl [scrollbar-gutter:stable]"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-medium">
            <Bot className="size-5 text-muted-foreground" />
            <span>接入 AI 编程助手与 Agent</span>
          </DialogTitle>
          <DialogDescription className="text-xs leading-normal">
            Skill 指引 AI 遵循简历排版与操作规则。MCP
            为可选接入方式：已连接时优先使用，没有 MCP 时可通过 HTTP API
            创建、编辑和导出简历。
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4 py-2 text-xs">
          {/* 步骤 1：Skills */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <span className="flex size-4.5 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">
                1
              </span>
              <span>安装 Agent Skills（技能工作流）</span>
            </div>
            <p className="text-[11px] text-muted-foreground pl-6">
              适用于支持 Agent Skills 规范的工具（如 Claude
              Code、Cursor、Windsurf、Antigravity 等）：
            </p>
            <div className="pl-6">
              <CopyBlock code={SKILL_COMMAND} language="bash" />
            </div>
          </div>

          {/* 步骤 2：Docker 运行 */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <span className="flex size-4.5 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">
                2
              </span>
              <span>启动 ResumeFlow 服务（已启动可跳过）</span>
            </div>
            <p className="text-[11px] text-muted-foreground pl-6">
              Web、HTTP API 和 MCP 共用同一实例，简历数据保存在 Docker
              数据卷中：
            </p>
            <div className="pl-6">
              <CopyBlock code={DOCKER_COMMAND} language="bash" />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <span className="flex size-4.5 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">
                3
              </span>
              <span>将服务地址交给 AI</span>
            </div>
            <p className="text-[11px] text-muted-foreground pl-6">
              安装 Skill 后，将以下说明交给具备 HTTP 请求能力的 AI
              Agent，即可在未连接 MCP 时按接口文档操作。Agent 须能访问该实例。
            </p>
            <div className="pl-6 space-y-2">
              <CopyBlock code={httpPrompt} label="HTTP 接入说明" />
              <div className="flex gap-3 text-muted-foreground">
                <a
                  href="/api/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  查看 Swagger UI
                </a>
                <a
                  href="/api/openapi.json"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  查看 OpenAPI JSON
                </a>
              </div>
            </div>
          </div>

          {/* MCP 配置指引 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <span className="flex size-4.5 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">
                4
              </span>
              <span>配置 MCP（可选）</span>
            </div>

            <div className="pl-6 space-y-2">
              {/* 客户端切换 Tabs */}
              <div className="flex rounded-md bg-muted/60 p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setClientTab("cursor")}
                  className={`flex-1 rounded px-2.5 py-1 text-xs cursor-pointer transition-colors ${
                    clientTab === "cursor"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Cursor
                </button>
                <button
                  type="button"
                  onClick={() => setClientTab("claude")}
                  className={`flex-1 rounded px-2.5 py-1 text-xs cursor-pointer transition-colors ${
                    clientTab === "claude"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Claude
                </button>
                <button
                  type="button"
                  onClick={() => setClientTab("codex")}
                  className={`flex-1 rounded px-2.5 py-1 text-xs cursor-pointer transition-colors ${
                    clientTab === "codex"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Codex / 通用
                </button>
              </div>

              {/* 稳定最小高度容器，防止 Tab 切换时发生高度抖动 */}
              <div className="min-h-[285px] pt-1">
                {clientTab === "cursor" && (
                  <div className="space-y-2.5">
                    <p className="text-[11px] text-muted-foreground">
                      可在项目根目录创建 <code>.cursor/mcp.json</code>（或放入{" "}
                      <code>~/.cursor/mcp.json</code> 全局生效）：
                    </p>
                    <CopyBlock
                      code={CURSOR_JSON}
                      label=".cursor/mcp.json"
                      language="json"
                    />
                    <div className="rounded border border-border/50 bg-muted/20 p-2 text-[10px] text-muted-foreground leading-relaxed">
                      💡 提示：也可在 Cursor Settings &gt; Features &gt; MCP
                      中点击“Add New MCP Server”，类型选择 SSE/HTTP，URL 填写{" "}
                      <code>http://127.0.0.1:8080/mcp</code>。
                    </div>
                  </div>
                )}

                {clientTab === "claude" && (
                  <div className="space-y-2.5">
                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground">
                        方式 A：Claude Code 命令行一键配置
                      </p>
                      <CopyBlock code={CLAUDE_CODE_COMMAND} language="bash" />
                    </div>
                    <div className="space-y-1 pt-1">
                      <p className="text-[11px] text-muted-foreground">
                        方式 B：Claude Code 项目级 <code>.mcp.json</code>
                      </p>
                      <CopyBlock
                        code={CLAUDE_JSON}
                        label=".mcp.json"
                        language="json"
                      />
                    </div>
                  </div>
                )}

                {clientTab === "codex" && (
                  <div className="space-y-2.5">
                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground">
                        方式 A：Codex CLI 一键添加
                      </p>
                      <CopyBlock code={CODEX_CLI_COMMAND} language="bash" />
                    </div>
                    <div className="space-y-1 pt-1">
                      <p className="text-[11px] text-muted-foreground">
                        方式 B：TOML 配置文件 (<code>~/.codex/config.toml</code>
                        )
                      </p>
                      <CopyBlock
                        code={CODEX_TOML}
                        label="config.toml"
                        language="toml"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border/60 bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
            💡 开发模式提示：若您使用 <code>pnpm dev</code> 本地源码运行，MCP
            服务端点端口为 <code>10127</code>（即{" "}
            <code>http://127.0.0.1:10127/mcp</code>）。
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
