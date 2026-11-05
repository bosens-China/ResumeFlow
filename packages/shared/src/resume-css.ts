/** 网页分页预览和服务端 PDF 共用的纸张样式。 */
export const resumeContentCss = `
h1 { margin: 0 0 3.5mm; font-size: 18pt; font-weight: 700; line-height: 1.2; }
h2 { margin: 4.5mm 0 1.8mm; padding-bottom: 0.8mm; border-bottom: 1px solid #333; font-size: 12.5pt; font-weight: 600; line-height: 1.25; }
h2:first-of-type, .rf-h2:first-of-type { margin-top: 2.5mm; }
h3 { margin: 2mm 0 0.8mm; font-size: 10.5pt; font-weight: 600; line-height: 1.3; }
p { margin: 0.6mm 0; line-height: 1.45; }
ul, ol { margin: 0.6mm 0 1.5mm; padding-left: 1.25em; }
ul { list-style: disc; }
ol { list-style: decimal; }
li { margin: 0.3mm 0; line-height: 1.45; padding-left: 0.1em; }
a { color: inherit; text-decoration: none; }
h1, h2, h3, .rf-row { break-inside: avoid; }
.rf-left { text-align: left; }
.rf-center { text-align: center; }
.rf-right { text-align: right; }
.rf-row { display: grid; align-items: baseline; gap: 3mm; margin: 0.5mm 0; }
.rf-row-2 { grid-template-columns: minmax(0, 1fr) auto; }
.rf-row-3 { grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); }
.rf-row-2 .rf-cell:last-child, .rf-row-3 .rf-cell:last-child { text-align: right; }
.rf-row-3 .rf-cell:nth-child(2) { text-align: center; }
.rf-cell > :first-child { margin-top: 0; }
table { width: 100%; margin: 2mm 0; border-collapse: collapse; }
th, td { padding: 1mm 2mm; border: 1px solid #999; }
th:not([align]), td:not([align]) { text-align: inherit; }
blockquote { margin: 2mm 0; padding-left: 3mm; border-left: 2px solid #999; }
hr { margin: 2.5mm 0; border: 0; border-top: 1px solid #999; }
code { font-size: 0.9em; }
`;

/** 简历页面的默认纸张页边距（A4 黄金留白） */
export const RESUME_PAGE_MARGIN = "14mm";
export const DEFAULT_THEME_COLOR = "#000000";
export const resumeBodyFont =
  '10pt/1.45 "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif';

export interface ResumeStyleOptions {
  themeColor?: string;
  margin?: string;
  customCss?: string;
}

export function escapeCustomCss(css: string): string {
  return css.replace(/<\/style/gi, "<\\/style");
}

export function getResumePageCss(options?: ResumeStyleOptions): string {
  const margin = options?.margin?.trim() || RESUME_PAGE_MARGIN;
  const themeColor = options?.themeColor?.trim() || DEFAULT_THEME_COLOR;
  const customCss = options?.customCss?.trim();
  const rootVars = `:root { --rf-theme-color: ${themeColor}; }`;
  const themeCss = `
h2, .rf-h2 { color: var(--rf-theme-color); border-bottom-color: var(--rf-theme-color); }
blockquote, .rf-blockquote { border-left-color: var(--rf-theme-color); }
`;
  const userCss = customCss ? `\n/* 自定义样式 */\n${customCss}\n` : "";

  return escapeCustomCss(`
@page { size: A4; margin: ${margin}; }
html { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
body { margin: 0; color: #1a1a1a; font: ${resumeBodyFont}; overflow-wrap: anywhere; }
${rootVars}
${resumeContentCss}
${themeCss}
${userCss}
`);
}

export const resumePageCss = getResumePageCss();
