import type { ResumeTemplate } from "@resumeflow/shared";
import aiEngineerMd from "./ai-engineer.md?raw";
import productManagerMd from "./product-manager.md?raw";

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
    markdown: aiEngineerMd,
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
    markdown: productManagerMd,
  },
];
