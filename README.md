# ResumeFlow

本机单用户简历编辑器。开发时 Vite 和 Hono 分别热重载；生产镜像由 Hono 提供前端静态文件、网页 API、MCP、变更通知和 PDF，数据保存在 SQLite。

## Docker 运行

```sh
docker run -d --name resumeflow \
  -p 127.0.0.1:8080:3000 \
  -v resumeflow-data:/data \
  boses/resumeflow:latest
```

打开 <http://127.0.0.1:8080>，MCP 地址为 `http://127.0.0.1:8080/mcp`。把 `8080` 换成任意可用的宿主机端口即可；容器端口保持 `3000`，无需设置 `PORT`。MCP PDF 下载地址会沿用请求的宿主机地址和端口。重新创建容器时沿用 `resumeflow-data` 数据卷。

需要从源码构建时，运行 `docker build --platform linux/amd64 -t resumeflow .`，再将上述镜像名替换为 `resumeflow`。正式镜像目前面向 `linux/amd64`。

CI 在 `main` 推送和 `v*` 标签推送时，先检查代码并启动容器验证，再发布 `linux/amd64`（x86-64）镜像到 `boses/resumeflow`。先在 Docker Hub 建立该仓库；在 GitHub 仓库创建名为 `production` 的 Environment，并在其中设置 `DOCKERHUB_TOKEN` Secret。PR 只验证，不发布。

## 本地开发

需要 Node.js 24 和 pnpm 11；Docker 与 CI 固定使用 Node.js 24.22.2。服务端以 ES2025 为 TypeScript 目标，浏览器和共享代码仍使用现有兼容基线；TypeScript 类型声明不提供运行时 polyfill。运行 `pnpm install`、`pnpm dev`，同时启动 Vite 网页和 Hono 服务；也可分别运行 `pnpm dev:web`、`pnpm dev:server`。网页在 <http://localhost:10128>，API 和 MCP 在 <http://localhost:10127>。本机还需运行 `pnpm --filter @resumeflow/server exec playwright install chromium` 才能生成 PDF。开发模式不读取前端 dist，前端请求经 Vite 代理到 Hono。

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
| MCP      | Streamable HTTP `http://127.0.0.1:10127/mcp`（开发）或 `http://127.0.0.1:8080/mcp`（上述 Docker 示例）      |

简历对象包含 `id`、`title`、`markdown`、`revision`、`createdAt`、`updatedAt`，以及语言版本 `languages`、当前语言 `currentLanguage`、主题色 `themeColor`、页边距 `margin` 和自定义样式 `customCss`。顶层标题与正文对应当前语言。修改或删除时必须提交最近读取的 `revision`；冲突返回 HTTP 409 和 `current`。MCP 提供 `list_resumes`、`create_resume`、`get_resume`、`update_resume`、`duplicate_resume`、`delete_resume`、`export_resume_pdf`；最后一个工具返回当前版本的 PDF 下载地址。网页和 MCP 共用同一数据源；MCP 修改名称或正文后会发出 SSE 通知，网页自动更新编辑器与预览。

创建和修改接口也接受上述语言与样式字段。修改时可通过 `language` 指定要更新的语言版本，通过 `currentLanguage` 切换当前语言，通过 `languages` 提交完整语言集合。PDF 接口接受 `lang`，MCP 导出工具接受 `language`。导出使用已保存的最新版本；zh 文件名为“标题.pdf”，其他语言为“标题_语言代码.pdf”。

### Agent 操作说明

REST 与 MCP 共用 store、输入校验、版本冲突处理及 PDF 来源选择；HTTP 状态码与 MCP `isError` 分别适配各自协议。MCP 的工具发现结果包含字段说明，不要求 Agent 额外阅读本 README 才能了解参数。

| 参数                                | 语义                                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `revision`                          | 最近读取的当前草稿修订号。修改、删除、创建快照和恢复快照均须提供；冲突后读取并核对最新内容，再决定是否修改。它与历史快照 `versionId` 不同。 |
| `title`、`markdown`                 | 替换目标语言的完整名称、正文；其他未提供的字段保留。                                                                                        |
| `language`                          | 仅指定名称、正文的写入语言，不切换当前语言；可新增该语言正文，不会自动翻译。                                                                |
| `currentLanguage`                   | 切换当前显示语言，应指向语言集合中已有的代码；同次提交的名称、正文默认写入切换后的语言，除非另有 `language`。                               |
| `languages`                         | **完整替换语言集合，遗漏语言会被删除。** 先读取当前数据，保留其他语言再提交；集合中应包含当前语言。                                         |
| `themeColor`、`margin`、`customCss` | 全部语言共用；CSS 整体替换，空字符串清除设置或恢复默认。                                                                                    |

自定义 CSS 在 Web、REST 和 MCP 中共用同一套 Prettier 语法校验。创建或更新时，无效 CSS 会返回错误位置，整次请求不会写入简历、递增 revision 或发送变更通知；有效 CSS 保留提交原文，Web 编辑器仍提供自动格式化。语法校验不判断实际排版效果。

例如，新增英文正文可以调用 `update_resume`，传入 `id`、当前 `revision`、`language: "en"`、`title` 和 `markdown`；随后使用返回的新 `revision` 与 `currentLanguage: "en"` 切换显示。删除其他语言时，提交移除该语言后的完整 `languages`。需要从历史版本修改时，先调用 `restore_resume_version`，再使用返回的当前草稿 `revision` 更新；读取快照本身不会恢复草稿。

`export_resume_pdf` 返回 `{ url, revision }`，**需要再下载 URL 才会生成 PDF 文件**。不提供语言时导出所选草稿或快照的当前语言；指定不存在的语言会返回错误。当前草稿修改后，先前下载地址会返回版本冲突，需要重新调用工具；使用 `versionId` 的快照地址不受草稿修改影响。图片加载或分页生成错误会在下载时返回。

默认从 MCP 请求地址推导下载地址，支持 `docker run -p 127.0.0.1:任意端口:3000`。反向代理改变外部协议、地址或路径时，可用 `RESUMEFLOW_PUBLIC_URL` 显式指定 Agent 可访问的基础地址，例如 `https://resumes.example.com`；该配置优先于请求地址，不自动信任转发头。本产品仍面向本机单用户使用。

## 历史版本

实时保存更新“当前草稿”。修改后点击详情页 header 的“保存”或按 `Cmd/Ctrl+S`，可以保留当前草稿的完整快照，名称自动生成为“版本 N”；没有变化时不重复创建。历史列表显示标题与创建时间。

选择历史版本只查看快照，不会覆盖当前草稿。首次修改历史内容时，系统先把当前草稿保存为“恢复前的草稿”，再从旧快照开始新草稿；原历史快照保持不变。之后继续自动保存，需要保留新的时间点时再点击“保存”。查看历史时导出对应快照；开始编辑后导出当前草稿。

版本创建失败时保留未发布状态并显示错误，可以重试；发布请求期间继续输入的内容仍是未发布修改，需要再次保存版本。切换历史版本前若存在未发布修改，可选择取消、放弃修改并切换，或保存并切换；保存失败时停留在当前内容。

快照包含全部语言、简历名称、正文和样式。`revision` 仍只用于并发写入检查，与命名历史版本分开。

| 操作             | HTTP                                                                               |
| ---------------- | ---------------------------------------------------------------------------------- |
| 列出版本         | `GET /api/resumes/:id/versions`                                                    |
| 读取快照         | `GET /api/resumes/:id/versions/:versionId`                                         |
| 创建版本         | `POST /api/resumes/:id/versions`，JSON `{ "revision": number, "title": string }`   |
| 从快照开始新草稿 | `POST /api/resumes/:id/versions/:versionId/restore`，JSON `{ "revision": number }` |

MCP 对应工具为 `list_resume_versions`、`get_resume_version`、`create_resume_version`、`restore_resume_version`。REST PDF 接口和 MCP `export_resume_pdf` 均接受可选的 `versionId`，用于导出指定快照。恢复前的草稿归档与快照恢复在同一事务中完成；删除整份简历时，其历史快照一并删除。

## 排版语法

Markdown 支持普通语法，以及 `:::left`、`:::center`、`:::right` 和外层 `::::row` 内的两个或三个 `:::cell`。冒号与指令名之间不能有空格。无效或不支持的指令在保存时返回 HTTP 400；不符合指令语法的文字仍按普通 Markdown 处理。

标题与正文默认左对齐。需要居中时，把相应内容放入 `center`；标题也继承容器的对齐方式：

```markdown
:::center

# 姓名

职位 · 经验\
电话 · 邮箱
:::
```

上例行尾的反斜杠表示硬换行，也可以使用行尾两个空格。普通单换行遵循 Markdown 规则。

左右同行需要显式分栏，相邻的 `left`、`right` 块各自保持独立：

```markdown
::::row
:::cell
职位名称
:::
:::cell
2025 - 至今
:::
::::
```

网页通过 Paged.js 即时生成多页 HTML 预览；服务端 Playwright 运行相同分页脚本生成 PDF。

Markdown 图片只支持完整的 HTTP(S) URL；`./image.png`、`/image.png` 等相对路径会在预览和保存时提示错误。PDF 导出限制单张图片不超过 5 MB，并拒绝私网地址；图片无法加载时会提示导出失败。

当前产品决策见 [产品 PRD](docs/PRD.md)，交付验收进度见 [文档索引](docs/index.md)。
