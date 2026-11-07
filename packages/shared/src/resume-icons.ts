import { BASIC_RESUME_ICONS } from "./resume-icon-basic.js";
import { EXTENDED_RESUME_ICONS } from "./resume-icon-extended.js";

export interface ResumeIconDefinition {
  name: string;
  label: string;
  category: "contact" | "social" | "section" | "tech" | "common";
  keywords: string[];
  viewBox?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  body: string;
}

export const RESUME_ICON_CATEGORIES = [
  { id: "all", label: "全部" },
  { id: "contact", label: "联系信息" },
  { id: "social", label: "社交与平台" },
  { id: "section", label: "经历与分类" },
  { id: "tech", label: "技术与技能" },
  { id: "common", label: "通用符号" },
] as const;

export type ResumeIconCategoryId =
  (typeof RESUME_ICON_CATEGORIES)[number]["id"];

export const RESUME_ICONS: readonly ResumeIconDefinition[] = [
  ...BASIC_RESUME_ICONS,
  ...EXTENDED_RESUME_ICONS,
];

// 常用别名映射表，提升输入体验
const ICON_ALIASES: Record<string, string> = {
  tel: "phone",
  mobile: "phone",
  email: "mail",
  location: "map-pin",
  address: "map-pin",
  city: "map-pin",
  website: "globe",
  web: "globe",
  site: "globe",
  person: "user",
  date: "calendar",
  time: "calendar",
  wx: "wechat",
  weixin: "wechat",
  work: "briefcase",
  job: "briefcase",
  company: "briefcase",
  education: "graduation-cap",
  school: "graduation-cap",
  degree: "graduation-cap",
  project: "folder-git",
  skills: "code",
  honor: "award",
  certificate: "award",
  contest: "trophy",
  book: "book-open",
  paper: "book-open",
  highlights: "sparkles",
  ai: "bot",
  robot: "bot",
  agent: "bot",
  llm: "bot",
  cli: "terminal",
  backend: "terminal",
  frontend: "layout",
  ui: "layout",
  tools: "wrench",
  tool: "wrench",
  k8s: "cloud",
  docker: "cloud",
  link: "external-link",
  team: "users",
  group: "users",
  leader: "users",
  growth: "trending-up",
  chart: "trending-up",
  metrics: "trending-up",
  lang: "languages",
  translate: "languages",
  english: "languages",
  design: "palette",
  art: "palette",
  color: "palette",
  "mobile-device": "smartphone",
  app: "smartphone",
  ios: "smartphone",
  android: "smartphone",
  money: "dollar-sign",
  cost: "dollar-sign",
  revenue: "dollar-sign",
  dollar: "dollar-sign",
};

const iconMap = new Map<string, ResumeIconDefinition>(
  RESUME_ICONS.map((icon) => [icon.name, icon]),
);

export function getResumeIcon(name: string): ResumeIconDefinition | undefined {
  const normalized = name.trim().toLowerCase();
  const targetName = ICON_ALIASES[normalized] ?? normalized;
  return iconMap.get(targetName);
}

export function renderResumeIconHtml(
  name: string,
  extraClass = "",
): string | undefined {
  const icon = getResumeIcon(name);
  if (!icon) return undefined;

  const viewBox = icon.viewBox ?? "0 0 24 24";
  const fill = icon.fill ?? "none";
  const stroke = icon.stroke ?? "currentColor";
  const strokeWidth = icon.strokeWidth ?? 2;
  const classes = ["rf-icon", `rf-icon-${icon.name}`];
  if (extraClass) classes.push(extraClass);

  return `<span class="${classes.join(" ")}" data-icon="${icon.name}" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="1em" height="1em" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${icon.body}</svg></span>`;
}
