/** 网页分页预览和服务端 PDF 共用的纸张样式。 */
export const resumeContentCss = `
h1 { margin: 0 0 7mm; text-align: center; font-size: 20pt; }
h2 { margin: 7mm 0 2mm; padding-bottom: 1mm; border-bottom: 1px solid #333; font-size: 13pt; }
h3 { margin: 3mm 0 1mm; font-size: 11pt; }
p { margin: 1mm 0; }
ul, ol { margin: 1mm 0 2mm; padding-left: 1.3em; }
ul { list-style: disc; }
ol { list-style: decimal; }
li { padding-left: 0.1em; }
a { color: inherit; text-decoration: none; }
h1, h2, h3, .rf-row { break-inside: avoid; }
.rf-left { text-align: left; }
.rf-center { text-align: center; }
.rf-right { text-align: right; }
.rf-row { display: grid; align-items: start; gap: 4mm; }
.rf-row-2 { grid-template-columns: minmax(0, 1fr) auto; }
.rf-row-3 { grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); }
.rf-row-2 .rf-cell:last-child, .rf-row-3 .rf-cell:last-child { text-align: right; }
.rf-row-3 .rf-cell:nth-child(2) { text-align: center; }
.rf-cell > :first-child { margin-top: 0; }
table { width: 100%; margin: 2mm 0; border-collapse: collapse; }
th, td { padding: 1mm 2mm; border: 1px solid #999; text-align: left; }
blockquote { margin: 2mm 0; padding-left: 3mm; border-left: 2px solid #999; }
hr { margin: 3mm 0; border: 0; border-top: 1px solid #999; }
code { font-size: 0.9em; }
`;

/** 简历页面的纸张与页边距（A4） */
export const RESUME_PAGE_MARGIN = "17mm 16mm";
export const resumeBodyFont =
  '10pt/1.45 "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif';

export const resumePageCss = `
@page { size: A4; margin: ${RESUME_PAGE_MARGIN}; }
html { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
body { margin: 0; color: #202124; font: ${resumeBodyFont}; overflow-wrap: anywhere; }
${resumeContentCss}
`;
