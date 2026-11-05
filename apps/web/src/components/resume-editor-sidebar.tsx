import type { ResumeVersionSummary } from "@resumeflow/shared";
import type { ResumeFontId } from "@resumeflow/shared/resume-fonts";
import { cn } from "cn";
import { ResumeFontDropdown } from "./resume-font-dropdown";
import { ResumeLanguageDropdown } from "./resume-language-dropdown";
import {
  ResumeSpacingPopover,
  ResumeThemePopover,
} from "./resume-style-popovers";
import { ResumeVersionDropdown } from "./resume-version-dropdown";

export interface ResumeEditorSidebarProps {
  open: boolean;
  onClose?: () => void;
  // 字体
  font: ResumeFontId;
  onChangeFont: (font: ResumeFontId) => void;
  // 主题色
  themeColor?: string;
  onChangeThemeColor: (color: string) => void;
  // 间距
  margin?: string;
  onChangeMargin: (margin: string) => void;
  lineHeight?: number;
  onChangeLineHeight: (lineHeight: number) => void;
  // 多语言
  currentLanguage: string;
  languages: Record<string, { title?: string; markdown: string }>;
  onSelectLanguage: (lang: string) => void;
  onAddLanguage: (lang: string, copyFromCurrent: boolean) => void;
  onDeleteLanguage?: (lang: string) => void;
  // 版本历史
  versions: ResumeVersionSummary[];
  busyVersions: boolean;
  isDirty: boolean;
  onSelectVersion: (versionId: string) => Promise<boolean>;
  onSaveCurrent: () => Promise<boolean>;
}

export function ResumeEditorSidebar({
  open,
  font,
  onChangeFont,
  themeColor,
  onChangeThemeColor,
  margin,
  onChangeMargin,
  lineHeight,
  onChangeLineHeight,
  currentLanguage,
  languages,
  onSelectLanguage,
  onAddLanguage,
  onDeleteLanguage,
  versions,
  busyVersions,
  isDirty,
  onSelectVersion,
  onSaveCurrent,
}: ResumeEditorSidebarProps) {
  return (
    <aside
      className={cn(
        "h-full shrink-0 border-l bg-background flex flex-col z-20 shadow-xs overflow-hidden transition-[width,border-color,opacity] duration-300 ease-in-out",
        open
          ? "w-68 border-l-border opacity-100"
          : "w-0 border-l-transparent opacity-0 pointer-events-none",
      )}
      aria-hidden={!open}
      aria-label="排版与文档工具栏"
    >
      <div className="w-68 h-full flex flex-col shrink-0">
        {/* 头部标题 */}
        <div className="flex h-10 items-center border-b px-4 shrink-0 bg-muted/10">
          <span className="text-xs font-semibold text-foreground tracking-tight">
            排版与配置
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* 排版样式区 */}
          <div className="space-y-3">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              排版样式
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground shrink-0">
                  字体
                </span>
                <ResumeFontDropdown value={font} onChange={onChangeFont} />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground shrink-0">
                  主题色
                </span>
                <ResumeThemePopover
                  themeColor={themeColor}
                  onChangeThemeColor={onChangeThemeColor}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground shrink-0">
                  间距
                </span>
                <ResumeSpacingPopover
                  margin={margin}
                  onChangeMargin={onChangeMargin}
                  lineHeight={lineHeight}
                  onChangeLineHeight={onChangeLineHeight}
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-border/60" />

          {/* 语言与版本区 */}
          <div className="space-y-3">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              文档与版本
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground shrink-0">
                  多语言
                </span>
                <ResumeLanguageDropdown
                  currentLanguage={currentLanguage}
                  languages={languages}
                  onSelectLanguage={onSelectLanguage}
                  onAddLanguage={onAddLanguage}
                  onDeleteLanguage={onDeleteLanguage}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground shrink-0">
                  版本历史
                </span>
                <ResumeVersionDropdown
                  versions={versions}
                  busy={busyVersions}
                  isDirty={isDirty}
                  onSelectVersion={onSelectVersion}
                  onSaveCurrent={onSaveCurrent}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
