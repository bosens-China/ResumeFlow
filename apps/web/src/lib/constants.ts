export const APP_NAME = "简流";
export const APP_FULL_NAME = "ResumeFlow 简流";

export function getDocumentTitle(title?: string | null): string {
  const trimmed = title?.trim();
  return trimmed ? `${trimmed} - ${APP_NAME}` : APP_FULL_NAME;
}
