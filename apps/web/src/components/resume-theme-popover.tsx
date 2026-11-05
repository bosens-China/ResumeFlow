import { useState } from "react";
import { Check, ChevronDown, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const THEME_COLOR_PRESETS = [
  { name: "默认黑", value: "#000000" },
  { name: "商务蓝", value: "#2563eb" },
  { name: "靛青紫", value: "#4f46e5" },
  { name: "翡翠绿", value: "#059669" },
  { name: "青碧色", value: "#0d9488" },
  { name: "琥珀棕", value: "#d97706" },
  { name: "玫瑰红", value: "#e11d48" },
  { name: "石板灰", value: "#475569" },
];

export function ResumeThemePopover({
  themeColor,
  onChangeThemeColor,
}: {
  themeColor?: string;
  onChangeThemeColor: (color: string) => void;
}) {
  const activeColor = themeColor || "#000000";
  const [customHex, setCustomHex] = useState(activeColor);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs font-medium cursor-pointer"
          aria-label="设置简历主题色"
        >
          <span
            className="size-3 rounded-full border border-black/10 shrink-0 shadow-xs"
            style={{ backgroundColor: activeColor }}
          />
          <Palette className="size-3.5 text-muted-foreground" />
          <span className="hidden sm:inline">主题色</span>
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56 p-2">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          快捷预设颜色
        </DropdownMenuLabel>

        <div className="grid grid-cols-4 gap-2 py-2">
          {THEME_COLOR_PRESETS.map((preset) => {
            const isSelected =
              activeColor.toLowerCase() === preset.value.toLowerCase();
            return (
              <button
                key={preset.value}
                type="button"
                title={preset.name}
                onClick={() => {
                  setCustomHex(preset.value);
                  onChangeThemeColor(preset.value);
                }}
                className="group relative flex size-9 items-center justify-center rounded-md border border-border transition-transform hover:scale-105 cursor-pointer"
                style={{ backgroundColor: preset.value }}
              >
                {isSelected && (
                  <Check className="size-4 text-white stroke-[3] drop-shadow-sm" />
                )}
              </button>
            );
          })}
        </div>

        <DropdownMenuSeparator />

        <div className="py-2">
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">
            自定义颜色
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={customHex}
              onChange={(e) => {
                setCustomHex(e.target.value);
                onChangeThemeColor(e.target.value);
              }}
              className="size-8 cursor-pointer rounded border border-input p-0.5"
            />
            <input
              type="text"
              value={customHex}
              onChange={(e) => {
                setCustomHex(e.target.value);
                if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                  onChangeThemeColor(e.target.value);
                }
              }}
              placeholder="#000000"
              maxLength={7}
              className="h-8 flex-1 rounded-md border border-input bg-background px-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
