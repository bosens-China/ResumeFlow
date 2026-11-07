import type { ResumeTemplate } from "./templates.js";

const portrait =
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80";

export const INTERNET_RESUME_TEMPLATES: ResumeTemplate[] = [
  {
    id: "backend-sidebar",
    name: "后端工程师 · 青绿侧栏",
    category: "技术研发",
    targetRole: "Java 后端工程师",
    description: "主体经历与右侧个人信息并列，青绿色侧栏适合展示联系信息。",
    tags: ["双栏", "侧栏", "含头像"],
    themeColor: "#147b80",
    margin: "0mm",
    customCss: `
.rf-root > .rf-row:first-child { align-items: stretch; gap: 0; min-height: 297mm; margin: 0; }
.rf-root > .rf-row:first-child > .rf-cell:first-child { text-align: left; padding: 12mm 10mm 12mm 12mm; }
.rf-root > .rf-row:first-child > .rf-cell:last-child { text-align: left; background: var(--rf-theme-color, #147b80); color: white; padding: 12mm 5mm; }
.rf-root > .rf-row:first-child > .rf-cell:last-child img { display: block; width: 25mm; height: 25mm; border: 3px solid white; border-radius: 50%; object-fit: cover; margin: 0 auto 5mm; }
.rf-root > .rf-row:first-child > .rf-cell:last-child h1 { color: white; font-size: 15pt; margin-bottom: 2mm; }
.rf-root > .rf-row:first-child > .rf-cell:last-child h2 { color: white; border-color: #ffffff80; margin-top: 5mm; font-size: 11pt; }
.rf-root > .rf-row:first-child > .rf-cell:last-child p { overflow-wrap: anywhere; font-size: 8.5pt; line-height: 1.6; }
/* 左侧精致胶囊标签标题（自动联动主题色） */
.rf-root > .rf-row:first-child > .rf-cell:first-child h2 { display: inline-flex; align-items: center; background: color-mix(in srgb, var(--rf-theme-color, #147b80) 12%, white); color: var(--rf-theme-color, #147b80); border: none; border-radius: 4px; padding: 1.2mm 3.2mm; margin: 5mm 0 2.2mm; font-size: 10.5pt; font-weight: 600; letter-spacing: 0.02em; }
.rf-root > .rf-row:first-child > .rf-cell:first-child h2:first-of-type { margin-top: 0; }
/* 左侧经历标题与时间角色层次 */
.rf-root > .rf-row:first-child > .rf-cell:first-child h3 { font-size: 10.5pt; font-weight: 600; color: #0f172a; margin: 3mm 0 0.8mm; }
.rf-root > .rf-row:first-child > .rf-cell:first-child h3 + p { font-size: 9pt; color: #64748b; margin-top: 0; margin-bottom: 1.8mm; }
/* 左侧列表项细节（自动联动主题色） */
.rf-root > .rf-row:first-child > .rf-cell:first-child li::marker { color: var(--rf-theme-color, #147b80); }
.rf-root > .rf-row:first-child > .rf-cell:first-child li { margin: 0.6mm 0; line-height: 1.5; }
`,
    markdown: `:::::row{columns="3fr 1fr"}
::::cell{align="left"}
## :icon[code] 专业技能

- 熟悉 Java、Spring Boot 与常见设计模式，能够独立设计和交付业务服务。
- 熟悉 MySQL、Redis 和消息队列，具备接口性能优化与故障排查经验。
- 了解 Docker、Linux 和 CI/CD，重视代码质量、监控及自动化测试。

## :icon[folder-git] 项目经历

### 订单履约服务平台
2023.03 - 2024.12 · 核心开发

- 负责订单创建、库存预占和状态流转接口，梳理异常补偿及幂等处理。
- 引入缓存和异步消息处理高峰流量，核心接口响应时间下降约 35%。
- 完善日志、告警和自动化测试，协助团队缩短故障定位时间。

### 商户数据分析平台
2022.05 - 2023.02 · 后端开发

- 构建数据采集与查询服务，支持商户查看订单、退款和经营趋势。
- 优化慢查询和批量任务，使日报生成时间从 40 分钟缩短至 15 分钟。

## :icon[briefcase] 工作经历

### 云帆科技 · 高级后端工程师
2022.04 - 至今 · 杭州

- 参与交易系统设计与迭代，协同产品、前端及测试团队按期交付。
- 推进接口规范、代码评审和线上问题复盘，提升服务稳定性。

### 远航软件 · 后端工程师
2020.07 - 2022.03 · 杭州

- 参与商户管理和结算服务开发，维护业务接口及日常数据任务。
- 配合测试排查线上问题，完善接口文档和关键业务的单元测试。

## :icon[graduation-cap] 教育经历

### 江城大学 · 计算机科学与技术
2016.09 - 2020.06 · 本科
::::

::::cell{align="left"}
![个人照片](${portrait})

# 林悦

后端开发工程师 · 5 年经验

:icon[phone] 138-0000-1234

:icon[mail] linyue@example.com

:icon[map-pin] 杭州

求职意向：Java 后端开发
::::
:::::
`,
  },
  {
    id: "qa-classic",
    name: "测试工程师 · 简洁经典",
    category: "技术研发",
    targetRole: "软件测试 / 测试开发工程师",
    description: "左侧头像与个人信息开篇，居中标题和细分隔线组成经典单栏。",
    tags: ["单栏", "居中标题", "含头像"],
    themeColor: "#303641",
    margin: "13mm",
    customCss: `
.rf-root > .rf-row:first-child { align-items: center; margin-bottom: 5mm; }
.rf-root > .rf-row:first-child > .rf-cell:last-child { text-align: left; }
.rf-root > .rf-row:first-child img { width: 23mm; height: 29mm; object-fit: cover; border-radius: 2px; margin: 0; }
.rf-root > .rf-row:first-child h1 { font-size: 19pt; }
.rf-root > h2 { text-align: center; color: var(--rf-theme-color, #303641); border-bottom: 1px solid color-mix(in srgb, var(--rf-theme-color, #303641) 35%, transparent); padding-bottom: 1mm; margin: 4mm 0 2mm; }
.rf-root li::marker { color: var(--rf-theme-color, #303641); }
`,
    markdown: `::::row{columns="25mm 1fr"}
:::cell{align="left"}
![个人照片](${portrait})
:::

:::cell{align="left"}
# 周宁

软件测试工程师 · 4 年经验  
:icon[phone] 139-0000-5678　:icon[mail] zhouning@example.com　:icon[map-pin] 上海

求职意向：测试开发工程师 · 可两周内到岗
:::
::::

## :icon[check-circle] 专业技能

- 熟悉 Web 与移动端测试流程，能够独立完成测试计划、用例设计和缺陷分析。
- 熟练使用 Python、Pytest 和接口测试工具，具备接口自动化与持续集成经验。
- 熟悉 MySQL、Linux 和性能测试方法，善于通过日志与监控定位问题。

## :icon[folder-git] 项目经历

### 企业协同平台质量保障
2023.06 - 2024.12 · 测试负责人

- 负责权限、审批和消息模块的功能测试，设计覆盖主流程与异常场景的测试用例。
- 建设接口自动化回归集并接入持续集成，核心接口回归耗时降低约 50%。
- 与研发共同分析线上缺陷，完善发布检查清单和风险分级机制。

### 移动端会员服务项目
2022.03 - 2023.05 · 测试工程师

- 覆盖注册登录、权益领取和订单查询等流程，跟进多机型兼容与版本回归。
- 组织需求评审与缺陷复盘，推动高频问题进入自动化回归。

## :icon[briefcase] 工作经历

### 星桥网络 · 测试工程师
2021.07 - 至今 · 上海

- 负责产品迭代测试与上线质量保障，协调产品、研发团队解决交付风险。
- 维护测试环境和测试数据，持续改进团队回归效率。

## :icon[graduation-cap] 教育经历

### 海州理工大学 · 软件工程
2017.09 - 2021.06 · 本科
`,
  },
  {
    id: "ui-blue-header",
    name: "UI 设计师 · 蓝色封面",
    category: "设计创意",
    targetRole: "UI / 视觉设计师",
    description: "蓝色顶部色块搭配居中头像和信息，正文采用清晰的单栏结构。",
    tags: ["顶部色块", "居中排版", "含头像"],
    themeColor: "#3979e7",
    margin: "0mm",
    customCss: `
.rf-root > :not(:first-child) { margin-left: 12mm; margin-right: 12mm; }
.rf-root > .rf-row:first-child { display: block; text-align: center; margin: 0 0 7mm; padding: 4mm 5mm 5mm; background: linear-gradient(to bottom, var(--rf-theme-color, #3979e7) 0 45%, color-mix(in srgb, var(--rf-theme-color, #3979e7) 12%, white) 45% 100%); border-radius: 0 0 12mm 12mm; }
.rf-root > .rf-row:first-child > .rf-cell { text-align: center; }
.rf-root > .rf-row:first-child img { display: block; width: 23mm; height: 23mm; object-fit: cover; border: 3px solid white; border-radius: 50%; margin: 0 auto 2mm; }
.rf-root > .rf-row:first-child h1 { font-size: 18pt; }
.rf-root > h2 { text-align: center; color: var(--rf-theme-color, #3979e7); border-bottom: 1px solid color-mix(in srgb, var(--rf-theme-color, #3979e7) 35%, transparent); padding-bottom: 1mm; }
.rf-root li::marker { color: var(--rf-theme-color, #3979e7); }
`,
    markdown: `::::row
:::cell{align="center"}
![个人照片](${portrait})

# 沈知夏

UI / 视觉设计师 · 4 年经验  
:icon[phone] 137-0000-2468　:icon[mail] shen.design@example.com　:icon[globe] example.com/portfolio  
期望城市：深圳 · 擅长移动端与设计系统
:::
::::

## :icon[palette] 专业技能

- 熟悉用户界面、视觉规范和交互设计流程，能够独立完成从概念到交付的设计。
- 熟练使用 Figma、Photoshop 和 Illustrator，具备组件库与设计系统建设经验。
- 理解前端实现与无障碍基础，善于跨团队沟通、设计走查与细节打磨。

## :icon[sparkles] 项目经历

### 生活服务 App 改版
2023.08 - 2024.12 · UI 设计负责人

- 梳理首页、搜索和订单流程，建立统一的色彩、字体和组件规范。
- 基于用户访谈与可用性测试优化关键页面，任务完成率提升约 18%。
- 与产品及研发协作完成设计交付，跟进多端适配与上线验收。

### 企业工作台设计系统
2022.04 - 2023.07 · 视觉设计师

- 整理常用组件和页面模板，建立设计资源库及使用说明。
- 与前端协作统一组件状态和交互规则，减少重复设计与开发工作。

## :icon[briefcase] 工作经历

### 见山数字 · 高级 UI 设计师
2021.07 - 至今 · 深圳

- 负责移动端与管理后台的界面设计，参与需求评审和体验优化。
- 推进设计规范落地，定期组织设计走查与团队分享。

## :icon[graduation-cap] 教育经历

### 岭南艺术学院 · 视觉传达设计
2017.09 - 2021.06 · 本科
`,
  },
];
