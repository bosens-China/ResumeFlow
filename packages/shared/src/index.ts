export interface HealthResponse {
  status: "ok";
  time: string;
}

export interface Resume {
  id: string;
  title: string;
  markdown: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export type ResumeSummary = Omit<Resume, "markdown">;

export interface ResumeChangedEvent {
  id: string;
  revision: number;
  deleted?: true;
}
