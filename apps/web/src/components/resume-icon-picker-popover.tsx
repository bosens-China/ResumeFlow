import { useMemo, useRef, useState } from "react";
import {
  RESUME_ICON_CATEGORIES,
  RESUME_ICONS,
  renderResumeIconHtml,
  type ResumeIconCategoryId,
  type ResumeIconDefinition,
} from "@resumeflow/shared/resume-icons";
import { Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ResumeIconPickerPopoverProps {
  onSelectIcon: (iconName: string) => void;
  side?: "left" | "bottom" | "top" | "right";
  align?: "start" | "center" | "end";
}

export function ResumeIconPickerPopover({
  onSelectIcon,
  side = "left",
  align = "start",
}: ResumeIconPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [activeCategory, setActiveCategory] =
    useState<ResumeIconCategoryId>("all");
  const restoreEditorFocus = useRef(false);

  const filteredIcons = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return RESUME_ICONS.filter((icon) => {
      const matchCategory =
        activeCategory === "all" || icon.category === activeCategory;
      if (!matchCategory) return false;
      if (!query) return true;
      return (
        icon.name.toLowerCase().includes(query) ||
        icon.label.toLowerCase().includes(query) ||
        icon.keywords.some((k) => k.toLowerCase().includes(query))
      );
    });
  }, [keyword, activeCategory]);

  const handleSelect = (icon: ResumeIconDefinition) => {
    restoreEditorFocus.current = true;
    onSelectIcon(icon.name);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 data-[state=open]:bg-muted data-[state=open]:text-foreground transition-colors cursor-pointer"
          aria-label="选择并插入简历图标"
        >
          <Sparkles className="size-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side={side}
        align={align}
        sideOffset={8}
        onCloseAutoFocus={(event) => {
          if (!restoreEditorFocus.current) return;
          event.preventDefault();
          restoreEditorFocus.current = false;
        }}
        className="w-80 p-3 flex flex-col gap-2.5 bg-background border border-border shadow-lg rounded-xl z-50"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">
              简历图标库
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            共 {RESUME_ICONS.length} 款精选
          </span>
        </div>

        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="搜索图标，如 电话、微信、github..."
            className="h-8 pl-8 pr-7 text-xs bg-muted/40 focus-visible:bg-background"
          />
          {keyword && (
            <button
              type="button"
              onClick={() => setKeyword("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded cursor-pointer"
              aria-label="清空搜索"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        {/* 分类切换 */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          {RESUME_ICON_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 图标展示网格 */}
        <TooltipProvider delayDuration={150}>
          <div className="h-56 overflow-y-auto pr-1">
            {filteredIcons.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-xs text-muted-foreground gap-1">
                <span>未找到与 "{keyword}" 相关的图标</span>
                <span className="text-[11px] text-muted-foreground/80">
                  支持搜索拼音、英文名或中文关键词
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-6 gap-1.5">
                {filteredIcons.map((icon) => {
                  const svgHtml = renderResumeIconHtml(icon.name);
                  return (
                    <Tooltip key={icon.name}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => handleSelect(icon)}
                          aria-label={`插入 ${icon.label} 图标 (:icon[${icon.name}])`}
                          className="flex flex-col items-center justify-center p-2 rounded-lg border border-transparent hover:border-border hover:bg-muted/60 transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                        >
                          <span
                            className="size-4.5 flex items-center justify-center text-foreground group-hover:scale-110 transition-transform"
                            dangerouslySetInnerHTML={{
                              __html: svgHtml ?? "",
                            }}
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="text-center py-1 px-2"
                      >
                        <div className="font-medium text-xs">{icon.label}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          :icon[{icon.name}]
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            )}
          </div>
        </TooltipProvider>

        {/* 底部语法提示 */}
        <div className="border-t pt-2 text-[11px] text-muted-foreground/90 flex items-center justify-between">
          <span>点击直接插入光标位置</span>
          <span className="font-mono text-[10px] text-muted-foreground bg-muted/60 px-1 py-0.5 rounded">
            :icon[名称]
          </span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
