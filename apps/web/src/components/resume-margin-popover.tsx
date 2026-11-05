import { useState } from "react";
import {
  Check,
  ChevronDown,
  Link2,
  Minus,
  Plus,
  Sliders,
  Unlink2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MARGIN_PRESETS = [
  { name: "10mm", value: "10mm", badge: "极窄", desc: "容纳海量内容" },
  { name: "12mm", value: "12mm", badge: "紧凑", desc: "多项目推荐" },
  { name: "14mm", value: "14mm", badge: "推荐", desc: "标准黄金留白" },
  { name: "16mm", value: "16mm", badge: "舒适", desc: "呼吸感强" },
  { name: "18mm", value: "18mm", badge: "舒展", desc: "适合单页简历" },
  { name: "20mm", value: "20mm", badge: "宽松", desc: "极简大留白" },
];

function parseMarginValues(raw?: string): {
  vertical: number;
  horizontal: number;
} {
  const parts = (raw || "").trim().split(/\s+/).filter(Boolean);
  const nums = parts.map((p) => {
    const m = p.match(/^(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : 14;
  });
  if (nums.length === 0) return { vertical: 14, horizontal: 14 };
  if (nums.length === 1) return { vertical: nums[0], horizontal: nums[0] };
  return { vertical: nums[0], horizontal: nums[1] };
}

function formatMarginValues(vertical: number, horizontal: number): string {
  if (vertical === horizontal) {
    return `${vertical}mm`;
  }
  return `${vertical}mm ${horizontal}mm`;
}

export function ResumeMarginPopover({
  margin,
  onChangeMargin,
}: {
  margin?: string;
  onChangeMargin: (margin: string) => void;
}) {
  const currentMargin = margin?.trim() || "14mm";
  const { vertical, horizontal } = parseMarginValues(currentMargin);

  const [isLinkedOverride, setIsLinkedOverride] = useState<boolean | null>(
    null,
  );
  const isLinked =
    isLinkedOverride !== null ? isLinkedOverride : vertical === horizontal;

  function handleSelectPreset(presetValue: string) {
    setIsLinkedOverride(true);
    onChangeMargin(presetValue);
  }

  function updateVertical(newVal: number) {
    if (Number.isNaN(newVal)) return;
    const clamped = Math.max(6, Math.min(35, Math.round(newVal)));
    const newHoriz = isLinked ? clamped : horizontal;
    onChangeMargin(formatMarginValues(clamped, newHoriz));
  }

  function updateHorizontal(newVal: number) {
    if (Number.isNaN(newVal)) return;
    const clamped = Math.max(6, Math.min(35, Math.round(newVal)));
    const newVert = isLinked ? clamped : vertical;
    onChangeMargin(formatMarginValues(newVert, clamped));
  }

  const matchedPreset = MARGIN_PRESETS.find(
    (p) =>
      p.value === currentMargin ||
      (vertical === horizontal && p.value === `${vertical}mm`),
  );

  let triggerLabel = `边距: ${vertical}mm`;
  if (matchedPreset) {
    triggerLabel = `边距: ${matchedPreset.name} (${matchedPreset.badge})`;
  } else if (vertical !== horizontal) {
    triggerLabel = `边距: 上下${vertical} 左右${horizontal}mm`;
  } else {
    triggerLabel = `边距: ${vertical}mm`;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs font-medium cursor-pointer"
          aria-label="选择简历页边距"
        >
          <Sliders className="size-3.5 text-muted-foreground" />
          <span className="hidden sm:inline">{triggerLabel}</span>
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-72 p-2 shadow-lg"
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1 flex items-center justify-between">
          <span>页边距预设 (10-20mm)</span>
          <span className="text-[10px] text-muted-foreground/70">A4 留白</span>
        </DropdownMenuLabel>

        <div className="space-y-0.5">
          {MARGIN_PRESETS.map((preset) => {
            const isSelected =
              vertical === horizontal && `${vertical}mm` === preset.value;
            return (
              <DropdownMenuItem
                key={preset.value}
                onSelect={() => handleSelectPreset(preset.value)}
                className="flex items-center justify-between cursor-pointer px-2.5 py-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-xs w-11">
                    {preset.name}
                  </span>
                  <span className="text-[10px] bg-muted px-1.5 py-0.2 rounded text-muted-foreground">
                    {preset.badge}
                  </span>
                  <span className="text-[11px] text-muted-foreground/70">
                    {preset.desc}
                  </span>
                </div>
                {isSelected && (
                  <Check className="size-3.5 text-primary ml-auto" />
                )}
              </DropdownMenuItem>
            );
          })}
        </div>

        <DropdownMenuSeparator className="my-1.5" />

        {/* 上下 (垂直) 与 左右 (水平) 独立/联动调节区 */}
        <div className="p-1 space-y-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-medium text-muted-foreground">
              自定义调节 (上下 / 左右)
            </span>
            <button
              type="button"
              onClick={() => setIsLinkedOverride(!isLinked)}
              className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/60 cursor-pointer"
              title={
                isLinked
                  ? "当前等比联动，点击可解除独立调节"
                  : "当前独立调节，点击开启等比联动"
              }
            >
              {isLinked ? (
                <>
                  <Link2 className="size-3 text-primary" />
                  <span className="text-primary font-medium">联动中</span>
                </>
              ) : (
                <>
                  <Unlink2 className="size-3" />
                  <span>分开调整</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* 上下（垂直留白） */}
            <div className="rounded-md border border-border/70 bg-muted/30 p-2 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>上下 (垂直)</span>
                <span className="font-mono text-[10px] text-foreground font-medium">
                  {vertical}mm
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={vertical <= 6}
                  onClick={() => updateVertical(vertical - 1)}
                  className="size-6 shrink-0 cursor-pointer"
                  aria-label="减少上下边距"
                >
                  <Minus className="size-3" />
                </Button>
                <input
                  type="number"
                  min={6}
                  max={35}
                  value={vertical}
                  onChange={(e) => updateVertical(Number(e.target.value))}
                  className="h-6 w-full text-center font-mono text-xs rounded border border-input bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={vertical >= 35}
                  onClick={() => updateVertical(vertical + 1)}
                  className="size-6 shrink-0 cursor-pointer"
                  aria-label="增加上下边距"
                >
                  <Plus className="size-3" />
                </Button>
              </div>
            </div>

            {/* 左右（水平留白） */}
            <div className="rounded-md border border-border/70 bg-muted/30 p-2 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>左右 (水平)</span>
                <span className="font-mono text-[10px] text-foreground font-medium">
                  {horizontal}mm
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={horizontal <= 6}
                  onClick={() => updateHorizontal(horizontal - 1)}
                  className="size-6 shrink-0 cursor-pointer"
                  aria-label="减少左右边距"
                >
                  <Minus className="size-3" />
                </Button>
                <input
                  type="number"
                  min={6}
                  max={35}
                  value={horizontal}
                  onChange={(e) => updateHorizontal(Number(e.target.value))}
                  className="h-6 w-full text-center font-mono text-xs rounded border border-input bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={horizontal >= 35}
                  onClick={() => updateHorizontal(horizontal + 1)}
                  className="size-6 shrink-0 cursor-pointer"
                  aria-label="增加左右边距"
                >
                  <Plus className="size-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
