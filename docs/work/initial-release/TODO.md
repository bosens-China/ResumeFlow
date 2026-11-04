# 首版实施任务

- [x] 建立 monorepo、Hono 健康检查和前端 API 客户端骨架。
- [x] 实现 SQLite 数据存储、校验与版本冲突保护。
- [x] 实现与 MCP 共用逻辑的简历 REST 接口和 SSE 更新通知。
- [x] 实现 Markdown 指令渲染及服务端 PDF 预览与导出。
- [x] 实现 MCP 工具，与网页能力保持一致。
- [x] 完成本机 Docker 镜像和数据卷交付。
- [x] 实现前端创建页、详情页、自动保存、HTML 分页预览与 PDF 导出。
- [x] 验证网页与 MCP 状态同步、PDF 一致性和容器重建后的持久化。
- [x] 开发模式直接运行 Web/Server dev，生产模式由 Hono 托管前端 dist。
- [x] 增加 GitHub Actions 检查、容器冒烟测试和 Docker Hub 发布配置，并在本机验证 YAML 与容器行为。
- [x] 验证 SSE 连接存在时容器可及时停止，并补充必要的环境配置示例。
- [x] 确认远端 CI 与 Docker Hub 发布成功。
- [x] 修复 SSE 重连时漏同步和副本名称超长，补充 MCP 与网页回归测试。
- [ ] 验证固定 Node 版本的 linux/amd64 Docker 镜像及完整首版浏览器验收。
- [ ] 推送后验证 linux/amd64 镜像发布流程。
