export interface HealthResponse {
  status: "ok";
  time: string;
}

export function getResumePdfFilename(title: string, language = "zh") {
  return `${title}${language === "zh" ? "" : `_${language}`}.pdf`;
}

export interface ResumeLanguageItem {
  title?: string;
  markdown: string;
}

export interface Resume {
  id: string;
  title: string;
  markdown: string;
  currentLanguage?: string;
  languages?: Record<string, ResumeLanguageItem>;
  themeColor?: string;
  margin?: string;
  customCss?: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export type ResumeSummary = Resume;

export interface ResumeVersionSummary {
  id: string;
  title: string;
  createdAt: string;
}

export interface ResumeVersion extends ResumeVersionSummary {
  resume: Resume;
}

export interface ResumeChangedEvent {
  id: string;
  revision: number;
  deleted?: true;
  versionsChanged?: boolean;
}

export * from "./css-tools.js";
export * from "./markdown.js";
export * from "./resume-css.js";
