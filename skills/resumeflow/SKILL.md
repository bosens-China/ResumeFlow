---
name: resumeflow
description: 使用 ResumeFlow 管理、编辑和导出简历，优先调用已连接的 MCP 工具，无对应工具时依据实例的 Swagger / OpenAPI 文档调用 HTTP 接口。适用于创建、查询、修改、复制、删除简历，以及多语言、样式、历史快照和 PDF 导出；缺少服务地址或目标不明确时可向用户询问。不用于开发 ResumeFlow 项目本身或与其无关的简历写作。
---

# ResumeFlow

通过用户的 ResumeFlow 实例完成简历操作。以当前实例暴露的 MCP 工具定义或 OpenAPI schema 为准，不凭记忆构造参数或假定所有部署版本的能力相同。

## 选择连接方式

1. 发现当前环境中已连接的 ResumeFlow MCP 工具；工具可能带有客户端添加的命名空间。目标实例明确、且存在所需工具时优先调用 MCP，无需额外索要 HTTP 地址。
2. 没有已连接的 MCP，或 MCP 缺少本次所需能力时，使用该实例的 HTTP API。复用用户已提供或本次会话已确认的服务地址和访问方式；不要把 README 的示例端口当成用户地址，也不要自行扫描本机端口。
3. 仅在缺少地址、存在多个候选实例，或工具与用户给出的链接是否属于同一实例无法确定时询问。例如：「请提供要操作的 ResumeFlow 地址，或 Swagger / OpenAPI 文档链接。」已有足够信息则继续执行，不重复确认。

标准入口相对于实例根地址如下；用户提供了反向代理前缀或自定义文档地址时保留它，以实际响应为准：

| 入口         | 路径                | 用途                               |
| ------------ | ------------------- | ---------------------------------- |
| MCP          | `/mcp`              | 供支持 MCP 的客户端连接并发现工具  |
| Swagger UI   | `/api/docs`         | 供人查看 HTTP API 文档             |
| OpenAPI JSON | `/api/openapi.json` | 读取实际路径、方法、参数及响应结构 |
| 健康检查     | `/api/health`       | 必要时验证 HTTP 服务是否可达       |

有 MCP 链接不等于当前环境已经连接 MCP；无法调用时可按上述规则走 HTTP。不要用普通 REST 请求体调用 `/mcp`。不要为使用本 skill 强制安装 MCP 客户端或 SDK。

## MCP 操作

先读取工具说明和输入 schema，再调用对应工具。以下为当前项目的工具名称，实际是否可用以发现结果为准：

| 操作                | MCP 工具                                           |
| ------------------- | -------------------------------------------------- |
| 列出 / 读取简历     | `list_resumes` / `get_resume`                      |
| 创建 / 修改简历     | `create_resume` / `update_resume`                  |
| 复制 / 删除简历     | `duplicate_resume` / `delete_resume`               |
| 查看预设模板        | `list_resume_templates`                            |
| 列出 / 读取历史快照 | `list_resume_versions` / `get_resume_version`      |
| 创建 / 恢复历史快照 | `create_resume_version` / `restore_resume_version` |
| 获取 PDF 下载链接   | `export_resume_pdf`                                |

工具返回 `isError` 或错误文本时按失败处理，不能仅因协议调用成功就报告操作成功。

## HTTP 兜底

先获取目标实例的 OpenAPI JSON；若用户只提供 Swagger 页面，从页面配置取得 schema 地址。读取本次操作对应的 requestBody、parameters、responses 及其引用的 schema，再用当前环境可用的 HTTP 工具发请求。JSON 请求设置 `Content-Type: application/json`，路径和查询参数按各自位置编码。

下面的映射便于定位文档，不代替实例的实时 schema：

| 操作            | HTTP 方法与路径                                       |
| --------------- | ----------------------------------------------------- |
| 列出 / 创建简历 | `GET` / `POST /api/resumes`                           |
| 读取 / 修改简历 | `GET` / `PATCH /api/resumes/{id}`                     |
| 复制简历        | `POST /api/resumes/{id}/duplicate`                    |
| 删除简历        | `DELETE /api/resumes/{id}?revision={revision}`        |
| 列出 / 创建快照 | `GET` / `POST /api/resumes/{id}/versions`             |
| 读取快照        | `GET /api/resumes/{id}/versions/{versionId}`          |
| 恢复快照        | `POST /api/resumes/{id}/versions/{versionId}/restore` |
| 导出 PDF        | `GET /api/resumes/{id}/pdf`                           |

当前创建和修改的字段包括 `title`、`markdown`、`font`、`languages`、`currentLanguage`、`themeColor`、`margin`、`lineHeight`、`customCss`。修改另需 `revision`，可用 `language` 指定标题、正文和字体写入语言；创建快照的 JSON 包含 `revision`、`title`，恢复快照的 JSON 包含当前草稿 `revision`。删除的 `revision` 位于查询参数中。

当前预设模板只有 MCP 工具，不能假定存在 `/api/templates` 等 HTTP 接口。实例未提供对应接口时说明能力限制；用户也可提供模板正文供创建简历。

## 编辑与版本规则

- 根据列表或创建结果取得真实 `id`，历史快照 `versionId` 另行从快照列表取得。名称匹配多个简历且无法确定目标时先询问，不猜 ID。
- 修改、删除、创建快照或恢复前读取当前草稿，使用最新 `revision`。HTTP `409` 或 MCP「版本冲突」表示内容已变化；读取最新内容并核对原意，仅在能安全合并时重试。涉及相互冲突的修改则请用户决定，不能只换一个 revision 强行覆盖。
- 普通字段按需局部提交。`markdown` 会替换目标语言的完整正文，`customCss` 会替换完整自定义样式；读取原值后保留用户未要求修改的内容。
- `language` 只决定 `title` / `markdown` / `font` 写入哪个语言，不切换当前显示语言；`currentLanguage` 切换显示语言，与正文同时提交时也影响默认写入目标。服务不会自动翻译，需要翻译时先生成译文再保存，不虚构用户经历。
- `languages` 是完整替换，遗漏的语言会被删除。仅新增或修改某一语言的标题、正文时优先使用 `language`；必须提交 `languages` 时先读取并保留其他语言，确保包含当前显示语言。主题色、边距和 CSS 为所有语言共用。
- `font` 按语言独立保存，也可写在 `languages[语言代码].font`。当前 ID 为 `source-han-sans`、`alibaba-puhuiti`、`misans`、`harmonyos-sans`、`inter`、`pingfang-sc`；以实际 schema 为准。未设置时中文默认思源黑体，其他语言默认 Inter。修改正文时保留已有字体，不提交系统字体名或外部字体地址。
- 历史快照不可变；恢复会先归档当前草稿，再从所选快照生成新草稿。`versionId` 与草稿 `revision` 用途不同，不能互换。
- 删除会永久移除简历的全部语言和历史快照。只执行用户已明确要求的删除；已有明确授权和目标时不额外要求确认。

## 排版、图标、头像与图片

编写或修改对齐、分栏、图标、头像、图片及相关 CSS 时，先读 [排版与图片规则](references/markdown-layout.md)。支持行内图标指令 `:icon[name]`（如 `:icon[phone]`、`:icon[mail]`、`:icon[github]`、`:icon[briefcase]` 等内置 40+ 款图标）。使用显式 `::::row` 包裹 `:::cell`，可用 columns 指定列宽、align 指定对齐；不要使用旧的位置指令或自动分组。所有图片须使用完整 HTTP(S) URL。仅顶部 h1 后、首个 h2–h6 前的图片自动采用头像样式。

## PDF 交付

- 导出前完成用户要求的保存操作，指定的语言必须已存在。导出历史快照时使用其 `versionId`。
- MCP `export_resume_pdf` 返回 `{ url, revision }`，取得链接不代表文件已经生成。用户要文件时继续下载返回的 URL，成功后交付文件；用户只要链接时交付该链接并说明访问时生成 PDF。
- HTTP 导出返回 PDF 二进制。可传 `lang`、`versionId`、`download=1`；导出当前稿时携带最新 `revision`，避免导出期间内容变化。快照导出忽略当前草稿 revision。
- 下载文件时使用 `download=1`，保留响应 `Content-Disposition` 提供的文件名（优先 UTF-8 `filename*`）。客户端无法读取响应文件名时，按所导出语言的已保存标题命名：`zh` 使用“标题.pdf”，其他语言使用“标题_语言代码.pdf”；历史快照使用快照中的标题。除非用户明确指定文件名或为避免重名，不自行改名。
- 用户未指定保存位置时，默认保存到用户实际的系统下载目录；优先读取系统配置，无法读取时使用用户主目录下的 `Downloads`，不存在则创建。用户指定的路径优先，无需为默认保存位置另行询问。
- 使用当前环境可用的下载工具或 HTTP 客户端，以 GET 请求下载上述 URL，校验成功后保存到目标目录。已有同名文件时保留原文件，在扩展名前依次添加 ` (1)`、` (2)` 等后缀；保存成功后报告实际完整路径。
- 仅能写入远程服务器、容器或临时沙箱时，不能把其中的 `Downloads` 当作用户电脑的下载目录。改为交付可下载文件或链接，并说明尚未保存到用户本机；不能声称已保存到本机下载目录。
- Web 与 MCP 共用服务端 PDF 导出；指定语言的字体随已保存数据或快照生效，无需浏览器本机安装字体。自定义 CSS 仍可覆盖默认字体样式。
- 下载时检查状态和内容类型，不能把错误 JSON 保存成 PDF。当前稿链接因后续修改返回 `409` 时，重新读取并取得最新链接；快照链接不受草稿修改影响。
- 下载地址不可达时不擅自替换为另一实例的地址。说明结果，必要时询问客户端可访问的实例地址；无法下载时明确区分「已获取链接」与「已生成并下载文件」。

## 失败处理与结果

- `400`：根据校验错误修正参数；`404`：核对实例及简历 / 快照 ID；`401` / `403`：说明访问限制，请用户提供适当的访问方式，不通过切换通道绕过限制。
- 超时或断连后，写操作可能已成功。先读取结果核对，再决定是否重试或切换通道，避免重复创建简历、快照或副本；不能确定写入状态时说明不确定性并暂停该次写入。业务错误不是「MCP 不可用」，不应换成 HTTP 重复写入。
- 没有可用的 MCP 或 HTTP 执行能力时，说明缺少的能力；不能声称已经保存、删除或导出。可以提供用户可自行执行的请求，但将其与已执行结果分开。
- 完成后简要交代操作对象、实际变更及导出文件或链接；未完成的步骤和原因明确说明。
