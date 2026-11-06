# 版本与发布

## 一个版本入口

根 `package.json` 的 `version` 是应用统一版本。Release Please 在一个版本 PR 中同步修改根包、三个工作区子包和 CHANGELOG；子包不独立升级或发布。`.release-please-manifest.json` 由工具自动维护，无需再手动同步一份版本号。

Web 读取根包版本，MCP 和 OpenAPI 读取随发布同步的服务端包版本。CI 会检查所有工作区版本与根版本一致，并检查子包都已列入发布配置。

## 发布流程

1. 业务 PR 运行检查和容器冒烟测试，不发布镜像。提交采用 `feat:`、`fix:` 等 Conventional Commits 格式。
2. 业务合并到 `main` 且 CI 通过后，Google Release Please 创建或更新版本 PR，展示拟发布的版本、所有包版本变更和更新说明。
3. 审批并合并版本 PR，版本变更才进入 `main`；仅提交 review approval 不触发发布。
4. CI 和容器冒烟测试通过后，创建 GitHub Release 与 `vX.Y.Z` 标签，再发布 `boses/resumeflow` 的 `latest`、版本号和 SHA 标签。

镜像发布使用同一次工作流的 Release Please 输出，并检出对应版本标签。它不依赖机器人创建的标签再次触发工作流。配置见 [CI](../.github/workflows/ci.yml) 和 [Release Please](../release-please-config.json)。

## GitHub 设置

- 仓库 Settings → Actions → General → Workflow permissions 中，开启 **Allow GitHub Actions to create and approve pull requests**。默认令牌权限可以继续保持只读，只有发布任务申请必要的写入权限。
- 工作流使用内置 `GITHUB_TOKEN`。机器人创建或更新的版本 PR 若显示 **Approve workflows to run**，由有写权限的用户批准运行检查；工作流没有自动批准或合并 PR 的步骤。
- 保留仓库级或 `production` Environment 中的 `DOCKERHUB_TOKEN`，用于现有 Docker Hub 账号的镜像发布；当前凭据已配置在仓库级。

机制参考：[Google Release Please](https://github.com/googleapis/release-please-action)、[GitHub 机器人触发工作流规则](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow)。
