import type { ResumeVersionSummary } from "@resumeflow/shared";
import { useRef, useState, type ReactNode } from "react";
import {
  RESUME_FONTS,
  type ResumeFontId,
} from "@resumeflow/shared/resume-fonts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getLanguageName } from "@/lib/format";
import { ResumeFontDropdown } from "./resume-font-dropdown";
import { ResumeIconPickerPopover } from "./resume-icon-picker-popover";
import { ResumeLanguageDropdown } from "./resume-language-dropdown";
import {
  ResumeSpacingPopover,
  ResumeThemePopover,
} from "./resume-style-popovers";
import { ResumeVersionDropdown } from "./resume-version-dropdown";

function RailTooltip({
  children,
  label,
}: {
  children: ReactNode;
  label: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLDivElement>(null);

  return (
    <Tooltip
      open={open}
      onOpenChange={(next) =>
        setOpen(next && !trigger.current?.querySelector('[data-state="open"]'))
      }
    >
      <TooltipTrigger asChild>
        <div
          ref={trigger}
          onPointerDownCapture={() => setOpen(false)}
          onKeyDownCapture={(event) => {
            if (event.key === "Enter" || event.key === " ") setOpen(false);
          }}
        >
          {children}
        </div>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export interface ResumeEditorIconRailProps {
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
  // 图标库插入
  onInsertIcon?: (iconName: string) => void;
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

export function ResumeEditorIconRail({
  font,
  onChangeFont,
  themeColor,
  onChangeThemeColor,
  margin,
  onChangeMargin,
  lineHeight = 1.0,
  onChangeLineHeight,
  onInsertIcon,
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
}: ResumeEditorIconRailProps) {
  const currentFont = RESUME_FONTS.find((f) => f.id === font)?.name ?? font;
  const currentMargin = margin?.trim() || "14mm";

  return (
    <TooltipProvider delayDuration={120} disableHoverableContent>
      <aside
        className="w-11 shrink-0 border-l bg-background flex flex-col items-center py-2.5 gap-1.5 z-20 shadow-xs select-none"
        aria-label="快速排版与文档工具轨"
      >
        {/* 字体 */}
        <RailTooltip label={`字体: ${currentFont}`}>
          <ResumeFontDropdown
            iconOnly
            side="left"
            align="start"
            value={font}
            onChange={onChangeFont}
          />
        </RailTooltip>

        {/* 主题色 */}
        <RailTooltip label={`主题色: ${themeColor || "#000000"}`}>
          <ResumeThemePopover
            iconOnly
            side="left"
            align="start"
            themeColor={themeColor}
            onChangeThemeColor={onChangeThemeColor}
          />
        </RailTooltip>

        {/* 间距 */}
        <RailTooltip
          label={`排版间距 · 边距 ${currentMargin} · 行距 ${lineHeight.toFixed(2)}x`}
        >
          <ResumeSpacingPopover
            iconOnly
            side="left"
            align="start"
            margin={margin}
            onChangeMargin={onChangeMargin}
            lineHeight={lineHeight}
            onChangeLineHeight={onChangeLineHeight}
          />
        </RailTooltip>

        {/* 图标库 */}
        {onInsertIcon && (
          <RailTooltip label="简历图标库 · 插入图标">
            <ResumeIconPickerPopover
              side="left"
              align="start"
              onSelectIcon={onInsertIcon}
            />
          </RailTooltip>
        )}

        {/* 分隔线 */}
        <div className="w-5 h-px bg-border/70 my-0.5" />

        {/* 多语言 */}
        <RailTooltip
          label={`语言版本: ${getLanguageName(currentLanguage)} (${currentLanguage})`}
        >
          <ResumeLanguageDropdown
            iconOnly
            side="left"
            align="start"
            currentLanguage={currentLanguage}
            languages={languages}
            onSelectLanguage={onSelectLanguage}
            onAddLanguage={onAddLanguage}
            onDeleteLanguage={onDeleteLanguage}
          />
        </RailTooltip>

        {/* 版本历史 */}
        <RailTooltip
          label={`版本记录: ${versions.length} 个版本${isDirty ? " (未保存)" : ""}`}
        >
          <ResumeVersionDropdown
            iconOnly
            side="left"
            align="start"
            versions={versions}
            busy={busyVersions}
            isDirty={isDirty}
            onSelectVersion={onSelectVersion}
            onSaveCurrent={onSaveCurrent}
          />
        </RailTooltip>
      </aside>
    </TooltipProvider>
  );
}
