# ResumeFlow

本机单用户简历编辑器。开发时 Vite 和 Hono 分别热重载；生产镜像由 Hono 提供前端静态文件、网页 API、MCP、变更通知和 PDF，数据保存在 SQLite。

## Docker 运行

```sh
docker build -t resumeflow .
docker run --rm -p 127.0.0.1:3000:3000 -v resumeflow-data:/data resumeflow
```

打开 <http://127.0.0.1:3000>。重新创建容器时沿用 `resumeflow-data` 数据卷。

CI 在 `main` 推送和 `v*` 标签推送时，先检查代码并启动容器验证，再发布 `linux/amd64` 和 `linux/arm64` 镜像到 `boses/resumeflow`。先在 Docker Hub 建立该仓库；在 GitHub 仓库创建名为 `production` 的 Environment，并在其中设置 `DOCKERHUB_TOKEN` Secret。PR 只验证，不发布。镜像发布后也可用 `boses/resumeflow:latest` 替代上面的本地镜像。

## 本地开发

需要 Node.js 24 和 pnpm 11。运行 `pnpm install`、`pnpm dev`，同时启动 Vite 网页和 Hono 服务；也可分别运行 `pnpm dev:web`、`pnpm dev:server`。网页在 <http://localhost:10128>，API 和 MCP 在 <http://localhost:10127>。本机还需运行 `pnpm --filter @resumeflow/server exec playwright install chromium` 才能生成 PDF。开发模式不读取前端 dist，前端请求经 Vite 代理到 Hono。

端口、SQLite 路径和 MCP PDF 下载地址的可选环境变量见 [.env.example](.env.example)。

## 接口

| 操作     | HTTP                                                                                                        |
| -------- | ----------------------------------------------------------------------------------------------------------- |
| 列出简历 | `GET /api/resumes`                                                                                          |
| 创建简历 | `POST /api/resumes`，JSON `{ "title"?: string, "markdown"?: string }`                                       |
| 读取简历 | `GET /api/resumes/:id`                                                                                      |
| 修改简历 | `PATCH /api/resumes/:id`，JSON `{ "revision": number, "title"?: string, "markdown"?: string }`              |
| 创建副本 | `POST /api/resumes/:id/duplicate`                                                                           |
| 删除简历 | `DELETE /api/resumes/:id?revision=N`                                                                        |
| 下载 PDF | `GET /api/resumes/:id/pdf?revision=N&download=1`                                                            |
| 更新通知 | `GET /api/events`，SSE 的 `resume-changed` 事件 `{ "id": string, "revision": number, "deleted"?: boolean }` |
| MCP      | Streamable HTTP `http://127.0.0.1:10127/mcp`（开发）或 `http://127.0.0.1:3000/mcp`（Docker）                |

简历对象包含 `id`、`title`、`markdown`、`revision`、`createdAt`、`updatedAt`。修改或删除时必须提交最近读取的 `revision`；冲突返回 HTTP 409 和 `current`。MCP 提供 `list_resumes`、`create_resume`、`get_resume`、`update_resume`、`duplicate_resume`、`delete_resume`、`export_resume_pdf`；最后一个工具返回当前版本的 PDF 下载地址。网页和 MCP 共用同一数据源；MCP 修改名称或正文后会发出 SSE 通知，网页自动更新编辑器与预览。

Markdown 支持普通语法，以及 `:::left`、`:::center`、`:::right` 和外层 `::::row` 内的两个或三个 `:::cell`。无效指令在保存时返回 HTTP 400。网页通过 Paged.js 即时生成多页 HTML 预览；服务端 Playwright 运行相同分页脚本生成 PDF。导出使用已保存的最新版本。

Markdown 图片只支持完整的 HTTP(S) URL；`./image.png`、`/image.png` 等相对路径会在预览和保存时提示错误。PDF 导出限制单张图片不超过 5 MB，并拒绝私网地址；图片无法加载时会提示导出失败。

产品需求见 [docs/work/initial-release/PRD.md](docs/work/initial-release/PRD.md)。
