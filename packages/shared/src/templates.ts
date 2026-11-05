export interface ResumeTemplate {
  id: string;
  name: string;
  category: string;
  targetRole: string;
  description: string;
  tags: string[];
  themeColor: string;
  margin: string;
  customCss?: string;
  markdown: string;
}

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  {
    id: "ai-engineer",
    name: "AI 应用开发工程师",
    category: "技术研发",
    targetRole: "AI 算法工程师 / 大模型应用研发",
    description:
      "面向 AI / LLM 应用与 Agent 研发的通用骨架。极简风格，Header 居中，层次分明，模块精炼易改。",
    tags: ["居中极简", "无头像", "全栈研发"],
    themeColor: "#0f172a",
    margin: "13mm",
    customCss: `/* 极简 AI 研发排版微调 */
.rf-center {
  margin-bottom: 2.5mm;
}
.rf-h1 {
  letter-spacing: -0.01em;
}
`,
    markdown: `:::center
# 候选人

AI 算法工程师 / 大模型应用研发 · 5年经验  
138-0000-0000 · applicant@example.com · 个人主页 / GitHub  
期望城市：北京 / 上海 / 远程
:::

## 专业技能

- **大模型与 Agent 架构**：熟练掌握主流 LLM 框架（LangChain、LangGraph），具备复杂 Agent 规划、工具调用（Tool Calling）与上下文工程落地经验。
- **RAG 与检索增强**：熟悉向量数据库、混合检索（Hybrid Search）、Query 改写与重排序（Rerank）全流程。
- **模型推理与部署**：具备开源大模型私有化部署经验（vLLM、Ollama），熟悉高并发推理调优、量化技术与 API 服务化封装。
- **全栈开发与工程化**：熟练使用 Python / FastAPI / TypeScript，具备高并发后端与现代前端工程化开发能力。

## 项目经历

### 某某企业级智能协同对话系统

2024.03 - 至今

- **项目描述**：面向企业业务场景打造的通用智能体对话系统，支持复杂任务自动分解、工具调用与长文本问答。
- **核心职责**：设计多智能体协同流水线，通过工具注册机制打通内部数据库与外部 API；构建基于向量检索的知识库召回链路。
- **项目成果**：服务日均处理调用 50,000+ 次，复杂业务问答准确率达 92%，显著降低业务操作与查询延迟。

## 工作经历

### 某某科技股份有限公司

::::row
:::cell
高级 AI 应用研发工程师
:::
:::cell
2023.01 - 至今
:::
::::

- 负责企业级 AI 中台与大模型应用落地，主导核心架构设计、模型推理加速与智能体业务流水线搭建。

## 教育经历

### 某某重点大学

::::row
:::cell
计算机科学与技术 · 工学学士
:::
:::cell
2015.09 - 2019.06
:::
::::
`,
  },
  {
    id: "product-manager",
    name: "互联网产品经理",
    category: "产品规划",
    targetRole: "产品经理 / 高级产品经理",
    description:
      "面向互联网产品经理的标准求职版式。左对齐干练风格，右侧集成规范头像栏（自动自适应裁剪），包含精炼单段骨架。",
    tags: ["左对齐·含照", "含证件照", "业务增长"],
    themeColor: "#0284c7",
    margin: "14mm",
    customCss: `/* 产品经理模板：头像卡片微调 */
.rf-row:first-of-type {
  margin-bottom: 2mm;
}
`,
    markdown: `::::row
:::cell
# 候选人

高级产品经理 / Senior PM · 5年经验  
138-0000-0000 · applicant@example.com · 期望城市：上海 / 杭州  
个人主页 / 作品集：https://example.com/portfolio
:::
:::cell
![个人照片](https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80)
:::
::::

## 专业能力

- **产品规划与设计**：具备从 0 到 1 架构规划与业务演进能力，精通用户调研、竞品分析、PRD 撰写与交互原型设计。
- **数据分析与指标增长**：熟练运用数据分析方法与指标体系（AARRR、留存率、转化漏斗），擅长通过 A/B 测试驱动功能迭代。
- **跨职能协作与推进**：精通敏捷开发（Scrum）管理，能高效协调研发、设计、运营与商务等多方资源，确保项目高质量按期交付。

## 项目经历

### 某某数字化协同管理平台

2023.06 - 至今

- **项目描述**：面向企业客户打造的一体化工作协同与业务管理 SaaS 平台，涵盖任务流转、看板管理与数据统计功能。
- **核心职责**：主导产品从 0 到 1 需求规划与版本迭代路线制定，主导核心业务流程与原型设计，协同产研团队落地 10+ 核心模块。
- **项目成果**：上线后 6 个月内累计服务企业客户 300+ 家，月活跃用户增长 45%，核心流程流转效率提升约 30%。

## 工作经历

### 某某互联网科技有限公司

::::row
:::cell
高级产品经理
:::
:::cell
2022.05 - 至今
:::
::::

- 负责核心产品线的战略规划、需求挖掘与商业化探索，带领跨职能团队推进产品持续迭代与关键业务指标达成。

## 教育经历

### 某某重点大学

::::row
:::cell
信息管理与信息系统 · 管理学学士
:::
:::cell
2015.09 - 2019.06
:::
::::
`,
  },
];
