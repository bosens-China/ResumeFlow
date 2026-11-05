const formatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatDateTime(iso: string) {
  return formatter.format(new Date(iso));
}

export interface PresetLanguage {
  code: string;
  label: string;
  nativeLabel?: string;
}

export const PRESET_LANGUAGES: PresetLanguage[] = [
  { code: "zh", label: "简体中文" },
  { code: "en", label: "英语", nativeLabel: "English" },
  { code: "zh-TW", label: "繁体中文" },
  { code: "ja", label: "日语", nativeLabel: "日本語" },
  { code: "de", label: "德语", nativeLabel: "Deutsch" },
  { code: "fr", label: "法语", nativeLabel: "Français" },
  { code: "es", label: "西班牙语", nativeLabel: "Español" },
  { code: "ko", label: "韩语", nativeLabel: "한국어" },
];

let intlDisplayNames: Intl.DisplayNames | null = null;
try {
  intlDisplayNames = new Intl.DisplayNames(["zh-CN"], { type: "language" });
} catch {
  // fallback for environments without DisplayNames support
}

/**
 * 解析语言的友好中文名称
 * 优先匹配预设表，其次使用 Intl.DisplayNames 智能解析，最后回退至代码本身
 */
export function getLanguageName(code: string): string {
  if (!code) return "";
  const normalized = code.trim();
  const match = PRESET_LANGUAGES.find(
    (item) => item.code.toLowerCase() === normalized.toLowerCase(),
  );
  if (match) return match.label;

  if (intlDisplayNames) {
    try {
      const resolved = intlDisplayNames.of(normalized);
      if (resolved && resolved.toLowerCase() !== normalized.toLowerCase()) {
        return resolved;
      }
    } catch {
      // 忽略非标准 BCP 47 代码异常
    }
  }
  return normalized;
}

/**
 * 语言的显示标签，如 "简体中文 (zh)"、"俄语 (ru)"
 */
export function getLanguageLabel(code: string): string {
  if (!code) return "";
  const name = getLanguageName(code);
  return name.toLowerCase() === code.toLowerCase() ? code : `${name} (${code})`;
}
