import {
  getResumeFont,
  getResumeFontCss,
  getResumeFontFamily,
  type ResumeFontId,
} from "./resume-fonts.js";

/** 网页分页预览和服务端 PDF 共用的纸张样式。 */
export const resumeContentCss = `
/* 标题层次体系 */
h1, .rf-h1 { margin: 0 0 calc(2.5mm * var(--rf-spacing-ratio, 1)); font-size: 20pt; font-weight: 700; line-height: calc(1.2 * var(--rf-line-height-ratio, 1)); letter-spacing: -0.01em; }
h2, .rf-h2 { margin: calc(4.5mm * var(--rf-spacing-ratio, 1)) 0 calc(1.6mm * var(--rf-spacing-ratio, 1)); padding-bottom: 0.8mm; border-bottom: 1px solid color-mix(in srgb, var(--rf-theme-color, #1f2937) 22%, transparent); font-size: 11.5pt; font-weight: 600; line-height: calc(1.3 * var(--rf-line-height-ratio, 1)); }
h2:first-of-type, .rf-h2:first-of-type { margin-top: calc(3.2mm * var(--rf-spacing-ratio, 1)); }
h3, .rf-h3 { margin: calc(2.2mm * var(--rf-spacing-ratio, 1)) 0 calc(0.8mm * var(--rf-spacing-ratio, 1)); font-size: 10.5pt; font-weight: 600; line-height: calc(1.3 * var(--rf-line-height-ratio, 1)); }
h4, .rf-h4 { margin: calc(1.8mm * var(--rf-spacing-ratio, 1)) 0 calc(0.6mm * var(--rf-spacing-ratio, 1)); font-size: 10pt; font-weight: 600; line-height: calc(1.35 * var(--rf-line-height-ratio, 1)); color: #374151; }
h5, .rf-h5 { margin: calc(1.4mm * var(--rf-spacing-ratio, 1)) 0 calc(0.5mm * var(--rf-spacing-ratio, 1)); font-size: 9.5pt; font-weight: 600; line-height: calc(1.35 * var(--rf-line-height-ratio, 1)); color: #4b5563; }
h6, .rf-h6 { margin: calc(1.2mm * var(--rf-spacing-ratio, 1)) 0 calc(0.4mm * var(--rf-spacing-ratio, 1)); font-size: 9pt; font-weight: 600; line-height: calc(1.35 * var(--rf-line-height-ratio, 1)); color: #6b7280; }

/* 文本与段落 */
p, .rf-p { margin: calc(1mm * var(--rf-spacing-ratio, 1)) 0; line-height: calc(1.5 * var(--rf-line-height-ratio, 1)); }
a, .rf-link { color: inherit; text-decoration: none; }
strong, b { font-weight: 600; }

/* 列表系统 */
ul, ol, .rf-ul, .rf-ol { margin: calc(0.6mm * var(--rf-spacing-ratio, 1)) 0 calc(1.8mm * var(--rf-spacing-ratio, 1)); padding-left: 1.25em; }
ul, .rf-ul { list-style-type: disc; }
ol, .rf-ol { list-style-type: decimal; }
li, .rf-li { margin: calc(0.4mm * var(--rf-spacing-ratio, 1)) 0; line-height: calc(1.5 * var(--rf-line-height-ratio, 1)); padding-left: 0.1em; }
li > p, .rf-li > .rf-p { margin: 0; }
li > ul, li > ol, .rf-li > .rf-ul, .rf-li > .rf-ol { margin: calc(0.3mm * var(--rf-spacing-ratio, 1)) 0 calc(0.6mm * var(--rf-spacing-ratio, 1)); padding-left: 1.2em; }
li::marker { color: #4b5563; }

/* 网格分栏系统 */
.rf-left { text-align: left; }
.rf-center { text-align: center; }
.rf-right { text-align: right; }
.rf-row { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); align-items: baseline; gap: 3mm; margin: calc(0.6mm * var(--rf-spacing-ratio, 1)) 0; }
.rf-row > .rf-cell { min-width: 0; text-align: center; }
.rf-row > .rf-cell:first-child { text-align: left; }
.rf-row > .rf-cell:last-child:not(:first-child) { text-align: right; }
.rf-cell > :first-child { margin-top: 0; }
.rf-cell > :last-child { margin-bottom: 0; }

/* 图片与头像规范 */
img, .rf-img { max-width: 100%; height: auto; vertical-align: middle; }
.rf-row:has(img.rf-avatar) { align-items: flex-start; }
img.rf-avatar,
.rf-img.rf-avatar {
  width: 24mm;
  height: 32mm;
  object-fit: cover;
  object-position: center top;
  border-radius: 3px;
  border: 1px solid #cbd5e1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  display: block;
  margin-left: auto;
}

/* 引用、代码、表格、分割线 */
blockquote, .rf-blockquote { margin: calc(2mm * var(--rf-spacing-ratio, 1)) 0; padding: 1mm 0 1mm 3mm; border-left: 2.5px solid var(--rf-theme-color, #94a3b8); color: #4b5563; background: #f8fafc; border-radius: 0 2px 2px 0; }
hr, .rf-hr { margin: calc(2.5mm * var(--rf-spacing-ratio, 1)) 0; border: 0; border-top: 1px solid #e2e8f0; }
code, .rf-code { font-size: 0.88em; padding: 0.1em 0.3em; background: #f1f5f9; border-radius: 3px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
pre, .rf-pre { margin: calc(2mm * var(--rf-spacing-ratio, 1)) 0; padding: 2.5mm 3mm; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; overflow-x: auto; font-size: 9pt; line-height: calc(1.4 * var(--rf-line-height-ratio, 1)); }
table, .rf-table { width: 100%; margin: calc(2mm * var(--rf-spacing-ratio, 1)) 0; border-collapse: collapse; font-size: 9.5pt; }
th, td { padding: 1.2mm 2mm; border: 1px solid #e2e8f0; }
th { background-color: #f8fafc; font-weight: 600; }
th:not([align]), td:not([align]) { text-align: inherit; }

/* 分页控制 */
h1, h2, h3, h4, h5, h6, .rf-h1, .rf-h2, .rf-h3, .rf-h4, .rf-h5, .rf-h6, .rf-row { break-inside: avoid; }
`;

/** 简历页面的默认纸张页边距（A4 黄金留白） */
export const RESUME_PAGE_MARGIN = "14mm";
export const DEFAULT_THEME_COLOR = "#000000";
export const DEFAULT_LINE_HEIGHT_RATIO = 1.0;
export const resumeBodyFont = `10pt/1.5 ${getResumeFontFamily("source-han-sans")}`;

export interface ResumeStyleOptions {
  font?: ResumeFontId;
  language?: string;
  fontBaseUrl?: string;
  themeColor?: string;
  margin?: string;
  lineHeight?: number;
  customCss?: string;
}

export function escapeCustomCss(css: string): string {
  return css.replace(/<\/style/gi, "<\\/style");
}

export function getResumePageCss(options?: ResumeStyleOptions): string {
  const font = getResumeFont(options?.font, options?.language);
  const margin = options?.margin?.trim() || RESUME_PAGE_MARGIN;
  const themeColor = options?.themeColor?.trim() || DEFAULT_THEME_COLOR;
  const ratio =
    typeof options?.lineHeight === "number" &&
    !Number.isNaN(options.lineHeight) &&
    options.lineHeight > 0
      ? options.lineHeight
      : DEFAULT_LINE_HEIGHT_RATIO;
  const customCss = options?.customCss?.trim();
  const rootVars = `:root { --rf-theme-color: ${themeColor}; --rf-line-height-ratio: ${ratio}; --rf-spacing-ratio: ${ratio}; }`;
  const themeCss = `
h2, .rf-h2 { color: var(--rf-theme-color); }
blockquote, .rf-blockquote { border-left-color: var(--rf-theme-color); }
`;
  const userCss = customCss ? `\n/* 自定义样式 */\n${customCss}\n` : "";

  return escapeCustomCss(`
${getResumeFontCss(font.id, options?.fontBaseUrl)}
@page { size: A4; margin: ${margin}; }
html { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
body { margin: 0; color: #1a1a1a; font: 10pt/${(1.5 * ratio).toFixed(3)} ${getResumeFontFamily(font.id)}; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
${rootVars}
${resumeContentCss}
${themeCss}
${userCss}
`);
}

export const resumePageCss = getResumePageCss();
