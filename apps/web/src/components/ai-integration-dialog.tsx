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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="max-h-[85vh] overflow-y-auto sm:max-w-xl [scrollbar-gutter:stable]"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-medium">
            <Bot className="size-5 text-muted-foreground" />
            <span>接入 AI</span>
          </DialogTitle>
          <DialogDescription className="text-xs leading-normal">
            安装 Agent Skills，为 AI 提供简历排版和操作指引。MCP
            不是必需的；未连接时，具备 HTTP 请求能力的 AI Agent 可通过 HTTP API
            管理简历。
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4 py-2 text-xs">
          {/* 步骤 1：Skills */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <span className="flex size-4.5 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">
                1
              </span>
              <span>安装 Skills</span>
            </div>
            <p className="text-[11px] text-muted-foreground pl-6">
              适用于支持 Agent Skills 规范的工具（如 Claude
              Code、Cursor、Windsurf、Antigravity 等）：
            </p>
            <div className="pl-6">
              <CopyBlock code={SKILL_COMMAND} language="bash" />
            </div>
          </div>

          {/* MCP 配置指引 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <span className="flex size-4.5 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">
                2
              </span>
              <span>配置 MCP（可选）</span>
            </div>

            <div className="pl-6 space-y-2">
              {/* 客户端切换 Tabs */}
              <p className="text-[11px] text-muted-foreground">
                将服务的 /mcp 地址添加到支持 MCP 的客户端，即可通过 MCP
                工具管理简历。请将以下示例地址替换为 AI Agent
                能够访问的实际服务地址。
              </p>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
