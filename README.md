# ResumeFlow

求职时总很难找到称心的简历工具——市面上的平台要么收费，要么功能繁重冗余，往往不符合开发者 **Markdown 优先、现代、简约** 的书写习惯。ResumeFlow 应运而生，致力于让简历撰写与维护变得纯粹高效。

**ResumeFlow 面向 AI Agent 设计**：创建、编辑、排版、多语言管理、样式定制与 PDF 导出均可通过 MCP 或 HTTP API 完成，无需打开浏览器。

## AI 接入

Skill 指引 AI 遵循简历排版和操作规则。**MCP 为可选接入方式**：已连接时优先使用；没有 MCP 或缺少所需工具时，Skill 会读取实例的 OpenAPI 文档，通过 HTTP API 操作。

### 1. 安装 Agent Skills（技能工作流）

适用于支持 Agent Skills 规范的工具（如 Claude Code、Cursor、Windsurf、Antigravity 等）：

```bash
npx skills add bosens-China/ResumeFlow
```

### 2. 提供服务地址

按下方说明启动服务后，将实例地址交给具备 HTTP 请求能力的 AI Agent，例如：

```text
使用 ResumeFlow 管理我的简历，服务地址为 http://127.0.0.1:8080。
未连接 MCP 时，请先读取 http://127.0.0.1:8080/api/openapi.json，再按文档调用 HTTP API。
```

[Swagger UI](http://127.0.0.1:8080/api/docs) 供人查看接口，[OpenAPI JSON](http://127.0.0.1:8080/api/openapi.json) 供 Agent 读取。以上为 Docker 示例端口，请替换为实际实例地址；源码开发时后端默认端口为 `10127`。Agent 须能访问该实例。

### 3. 配置 MCP（可选）

希望通过 MCP 工具调用时，将实例的 `/mcp` 地址接入对应客户端。以下使用 Docker 示例地址：

#### Cursor

在项目根目录创建 `.cursor/mcp.json`（或放入 `~/.cursor/mcp.json` 全局生效）：

```json
{
  "mcpServers": {
    "resumeflow": {
      "url": "http://127.0.0.1:8080/mcp"
    }
  }
}
```

> 也可以在 Cursor `Settings > Features > MCP` 中点击“Add New MCP Server”，类型选择 SSE/HTTP，URL 填写 `http://127.0.0.1:8080/mcp`。

#### Claude Code

- **Claude Code 命令行一键配置**：
  ```bash
  claude mcp add --transport http resumeflow http://127.0.0.1:8080/mcp
  ```
- **项目级 `.mcp.json`**：
  ```json
  {
    "mcpServers": {
      "resumeflow": {
        "type": "http",
        "url": "http://127.0.0.1:8080/mcp"
      }
    }
  }
  ```

#### Codex

- **CLI 命令一键添加**：
  ```bash
  codex mcp add resumeflow --url http://127.0.0.1:8080/mcp
  ```
- **TOML 配置文件 (`~/.codex/config.toml`)**：
  ```toml
  [mcp_servers.resumeflow]
  url = "http://127.0.0.1:8080/mcp"
  enabled = true
  ```

## Docker 启动

### 使用预构建镜像

```sh
docker run -d --name resumeflow \
  -p 127.0.0.1:8080:3000 \
  -v resumeflow-data:/data \
  boses/resumeflow:latest
```

容器启动后：

- **Web 界面**：访问 <http://127.0.0.1:8080>
- **接口文档**：`http://127.0.0.1:8080/api/docs`，OpenAPI JSON 位于 `/api/openapi.json`
- **MCP 服务端点（可选）**：`http://127.0.0.1:8080/mcp`

> 数据保存在 `resumeflow-data` 数据卷中；容器内部端口为 `3000`，宿主机端口 `8080` 可按需替换。

### 从源码构建运行

```sh
docker build -t resumeflow .
docker run -d --name resumeflow \
  -p 127.0.0.1:8080:3000 \
  -v resumeflow-data:/data \
  resumeflow
```

## 简历字体

详情页顶部可为每种语言独立选择思源黑体、阿里普惠体、MiSans、HarmonyOS Sans、Inter 或苹方。中文默认思源黑体，其他语言默认 Inter；选择会随简历、复制和历史版本保存。

字体随应用打包，Web 与 MCP 共用服务端 PDF 导出，无需访问字体 CDN 或安装本机字体。自定义 CSS 仍可覆盖默认字体。字体使用各自许可，来源、版本和校验值见 [字体资源说明](apps/web/public/fonts/README.md)。

REST/MCP 可用 `font` 设置目标语言字体，例如更新参数：`{ "revision": 1, "language": "en", "font": "inter" }`。完整语言集合使用 `languages.en.font`；可用 ID 和默认规则以实例的 OpenAPI/MCP schema 为准。

## 版本与发布

采用 Google Release Please 维护统一版本 PR，审批合并后发布 GitHub Release 和 Docker 镜像。只维护根包版本，子包自动跟随；必要的仓库设置见[发布说明](docs/releasing.md)。

## 开源协议

本项目采用 [MIT](LICENSE) 许可证开源。

Copyright (c) 2026 yliu
