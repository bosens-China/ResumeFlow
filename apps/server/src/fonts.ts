import { readFile } from "node:fs/promises";
import { RESUME_FONTS } from "@resumeflow/shared/resume-fonts";

const fontFiles = new Set<string>(
  RESUME_FONTS.flatMap((font) => font.faces.map((face) => face.file)),
);
const fontRoot = new URL(
  `../../web/${process.env.NODE_ENV === "production" ? "dist" : "public"}/fonts/`,
  import.meta.url,
);

export async function readResumeFont(file: string) {
  if (!fontFiles.has(file)) return undefined;
  return {
    body: await readFile(new URL(file, fontRoot)),
    contentType: file.endsWith(".woff2") ? "font/woff2" : "font/ttf",
  };
}
