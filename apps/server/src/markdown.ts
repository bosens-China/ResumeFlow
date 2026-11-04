// Markdown 解析与校验规则放在 shared，网页预览与 PDF 导出共用同一份实现
export {
  InvalidMarkdownError,
  renderMarkdown,
} from "@resumeflow/shared/markdown";
