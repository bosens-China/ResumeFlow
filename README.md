# ResumeFlow

求职时总很难找到称心的简历工具——市面上的平台要么收费，要么功能繁重冗余，往往不符合开发者 **Markdown 优先、现代、简约** 的书写习惯。ResumeFlow 应运而生，致力于让简历撰写与维护变得纯粹高效。

更重要的是，**ResumeFlow 完全是 AI 优先（AI-Native）**：Web 界面具备的所有能力（创建、编辑、排版、多语言管理、样式定制与 PDF 导出），AI 均可通过 MCP 协议完全调用。你甚至无需打开浏览器，直接让 AI Agent 就能为你生成、润色并导出一份高质量的简历。

## AI 接入 (Skills + MCP)

ResumeFlow 采用 **Skills + MCP 双引擎** 协同设计：**Skills** 指引 AI 遵循简历排版规则与专业心智，**MCP** 提供增删改查与 PDF 导出的底层工具。

### 1. 安装 Agent Skills（技能工作流）

适用于支持 Agent Skills 规范的工具（如 Claude Code、Cursor、Windsurf、Antigravity 等）：

```bash
npx skills add bosens-China/ResumeFlow
```

### 2. 配置 MCP 服务

服务启动后（Docker 默认端口为 `8080`，MCP 地址为 `http://127.0.0.1:8080/mcp`），在主流 AI 工具中接入即可：

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

#### Claude

- **Claude Code 命令行一键配置**：
  ```bash
  claude mcp add resumeflow --type http http://127.0.0.1:8080/mcp
  ```
- **Claude Desktop / 项目级 `.mcp.json`**：
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
- **MCP 服务端点**：`http://127.0.0.1:8080/mcp`

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
