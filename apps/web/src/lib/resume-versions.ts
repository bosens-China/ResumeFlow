import { api } from "./api";
import { throwApiError } from "./resume-store";

export async function listResumeVersions(id: string) {
  const response = await api.api.resumes[":id"].versions.$get({
    param: { id },
  });
  if (!response.ok) return throwApiError(response);
  return response.json();
}

export async function getResumeVersion(id: string, versionId: string) {
  const response = await api.api.resumes[":id"].versions[":versionId"].$get({
    param: { id, versionId },
  });
  if (!response.ok) return throwApiError(response);
  return response.json();
}

export async function createResumeVersion(
  id: string,
  revision: number,
  title: string,
) {
  const response = await api.api.resumes[":id"].versions.$post({
    param: { id },
    json: { revision, title },
  });
  if (!response.ok) return throwApiError(response);
  return response.json();
}

export async function restoreResumeVersion(
  id: string,
  versionId: string,
  revision: number,
) {
  const response = await api.api.resumes[":id"].versions[
    ":versionId"
  ].restore.$post({ param: { id, versionId }, json: { revision } });
  if (!response.ok) return throwApiError(response);
  return response.json();
}
