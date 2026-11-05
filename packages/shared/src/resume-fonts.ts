export const RESUME_FONTS = [
  {
    id: "source-han-sans",
    name: "思源黑体",
    family: "RF Source Han Sans",
    description: "中性清晰 · 默认中文字体",
    faces: [{ file: "source-han-sans-085cc88c.woff2", weight: "100 900" }],
  },
  {
    id: "alibaba-puhuiti",
    name: "阿里普惠体",
    family: "RF Alibaba PuHuiTi",
    description: "现代亲和 · 阿里巴巴",
    faces: [
      { file: "alibaba-puhuiti-regular-be33bc8d.ttf", weight: "400" },
      { file: "alibaba-puhuiti-semibold-463818f1.ttf", weight: "600" },
      { file: "alibaba-puhuiti-bold-d50f483f.ttf", weight: "700" },
    ],
  },
  {
    id: "misans",
    name: "MiSans",
    family: "RF MiSans",
    description: "简洁利落 · 小米",
    faces: [
      { file: "misans-regular-d704c1a9.woff2", weight: "400" },
      { file: "misans-semibold-78227c6e.woff2", weight: "600" },
      { file: "misans-bold-1c5a7515.woff2", weight: "700" },
    ],
  },
  {
    id: "harmonyos-sans",
    name: "HarmonyOS Sans",
    family: "RF HarmonyOS Sans",
    description: "规整舒展 · 华为",
    faces: [
      { file: "harmonyos-sans-regular-297b0884.ttf", weight: "400" },
      { file: "harmonyos-sans-medium-6ed1553e.ttf", weight: "500" },
      { file: "harmonyos-sans-bold-43a424b8.ttf", weight: "700" },
    ],
  },
  {
    id: "inter",
    name: "Inter",
    family: "RF Inter",
    description: "现代清晰 · 默认其他语言字体",
    faces: [
      { file: "inter-693b77d4.woff2", weight: "100 900" },
      {
        file: "inter-italic-e564f652.woff2",
        weight: "100 900",
        style: "italic",
      },
    ],
  },
  {
    id: "pingfang-sc",
    name: "苹方",
    family: "RF PingFang SC",
    description: "柔和清晰 · 苹方简体",
    faces: [
      { file: "pingfang-sc-regular-adb6f724.ttf", weight: "400" },
      { file: "pingfang-sc-medium-4dee5d9e.ttf", weight: "500" },
      { file: "pingfang-sc-semibold-51df2eb7.ttf", weight: "600" },
    ],
  },
] as const;

export type ResumeFontId = (typeof RESUME_FONTS)[number]["id"];
export const RESUME_FONT_IDS = RESUME_FONTS.map((font) => font.id);

export function getResumeFont(font?: ResumeFontId, language = "zh") {
  const id =
    font ?? (/^zh(?:-|$)/i.test(language) ? "source-han-sans" : "inter");
  return RESUME_FONTS.find((item) => item.id === id) ?? RESUME_FONTS[0];
}

export function getResumeFontFamily(font: ResumeFontId) {
  const selected = getResumeFont(font);
  return `"${selected.family}", "RF Source Han Sans", sans-serif`;
}

export function getResumeFontCss(font: ResumeFontId, baseUrl = "") {
  const selected = getResumeFont(font);
  const fonts =
    selected.id === "source-han-sans"
      ? [selected]
      : [selected, RESUME_FONTS[0]];
  return fonts
    .flatMap((item) =>
      item.faces.map(
        (face) => `@font-face {
  font-family: "${item.family}";
  src: url("${baseUrl}/api/fonts/${face.file}");
  font-weight: ${face.weight};
  font-style: ${"style" in face ? face.style : "normal"};
  font-display: block;
}`,
      ),
    )
    .join("\n");
}

/** 保留源节点至字体完成布局；加载失败不能悄悄使用系统字体分页。 */
export async function waitForResumeFonts() {
  await document.fonts.ready;
  if (Array.from(document.fonts).some((face) => face.status === "error"))
    throw new Error("简历字体加载失败，请重试");
}
