import { useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  FoldVertical,
  Minus,
  Plus,
  RotateCcw,
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
import { Slider } from "@/components/ui/slider";

const LINE_HEIGHT_PRESETS = [
  { name: "0.88x", value: 0.88, badge: "极紧凑", desc: "消除多余单行跨页" },
  { name: "0.94x", value: 0.94, badge: "紧凑", desc: "提高信息密度" },
  { name: "1.00x", value: 1.0, badge: "默认推荐", desc: "标准排版基准" },
  { name: "1.08x", value: 1.08, badge: "舒适", desc: "增强呼吸感" },
  { name: "1.18x", value: 1.18, badge: "舒展", desc: "少内容单页撑满" },
];

const MIN_LINE_HEIGHT = 0.8;
const MAX_LINE_HEIGHT = 1.3;
const STEP = 0.02;

function roundRatio(num: number): number {
  return Math.round(num * 100) / 100;
}

export function ResumeLineHeightPopover({
  lineHeight = 1.0,
  onChangeLineHeight,
}: {
  lineHeight?: number;
  onChangeLineHeight: (lineHeight: number) => void;
}) {
  const currentRatio = roundRatio(lineHeight || 1.0);
  const [prevRatio, setPrevRatio] = useState(currentRatio);
  const [sliderVal, setSliderVal] = useState(currentRatio);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (prevRatio !== currentRatio) {
    setPrevRatio(currentRatio);
    setSliderVal(currentRatio);
  }

  function commitValue(val: number) {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const clamped = Math.max(
      MIN_LINE_HEIGHT,
      Math.min(MAX_LINE_HEIGHT, roundRatio(val)),
    );
    setSliderVal(clamped);
    onChangeLineHeight(clamped);
  }

  function handleSliderChange([val]: number[]) {
    if (val === undefined) return;
    const clamped = roundRatio(val);
    setSliderVal(clamped);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      onChangeLineHeight(clamped);
    }, 120);
  }

  function handleSliderCommit([val]: number[]) {
    if (val === undefined) return;
    commitValue(val);
  }

  function handleStep(delta: number) {
    commitValue(sliderVal + delta);
  }

  const matchedPreset = LINE_HEIGHT_PRESETS.find(
    (p) => Math.abs(p.value - currentRatio) < 0.015,
  );

  let triggerLabel = `行距: ${currentRatio.toFixed(2)}x`;
  if (matchedPreset && matchedPreset.value !== 1.0) {
    triggerLabel = `行距: ${matchedPreset.name} (${matchedPreset.badge})`;
  } else if (currentRatio === 1.0) {
    triggerLabel = "行距: 1.00x";
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs font-medium cursor-pointer"
          aria-label="调节简历行距与垂直间距"
        >
          <FoldVertical className="size-3.5 text-muted-foreground" />
          <span className="hidden sm:inline">{triggerLabel}</span>
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-76 p-2 shadow-lg"
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1 flex items-center justify-between">
          <span>行距与间距预设</span>
          <span className="text-[10px] text-muted-foreground/70">
            基准 1.00x
          </span>
        </DropdownMenuLabel>

        <div className="space-y-0.5">
          {LINE_HEIGHT_PRESETS.map((preset) => {
            const isSelected = Math.abs(currentRatio - preset.value) < 0.015;
            return (
              <DropdownMenuItem
                key={preset.value}
                onSelect={() => commitValue(preset.value)}
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

        {/* 拖动条与步进微调区 */}
        <div className="p-2 space-y-2.5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">
              拖动调节 (0.80x - 1.30x)
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-semibold text-primary">
                {sliderVal.toFixed(2)}x
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                ({Math.round(sliderVal * 100)}%)
              </span>
              {currentRatio !== 1.0 && (
                <button
                  type="button"
                  onClick={() => commitValue(1.0)}
                  className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground ml-1 cursor-pointer transition-colors"
                  title="重置为默认基准 1.00x"
                >
                  <RotateCcw className="size-2.5" />
                  <span>重置</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={sliderVal <= MIN_LINE_HEIGHT}
              onClick={() => handleStep(-STEP)}
              className="size-7 shrink-0 cursor-pointer"
              aria-label="缩小行距"
            >
              <Minus className="size-3.5" />
            </Button>

            <div className="flex-1 px-1">
              <Slider
                min={MIN_LINE_HEIGHT}
                max={MAX_LINE_HEIGHT}
                step={STEP}
                value={[sliderVal]}
                onValueChange={handleSliderChange}
                onValueCommit={handleSliderCommit}
                className="cursor-pointer"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={sliderVal >= MAX_LINE_HEIGHT}
              onClick={() => handleStep(STEP)}
              className="size-7 shrink-0 cursor-pointer"
              aria-label="放大行距"
            >
              <Plus className="size-3.5" />
            </Button>
          </div>

          <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 px-0.5">
            <span>紧凑 0.80x</span>
            <span
              className={`cursor-pointer hover:text-foreground transition-colors ${
                Math.abs(sliderVal - 1.0) < 0.015
                  ? "font-bold text-primary"
                  : ""
              }`}
              onClick={() => commitValue(1.0)}
            >
              默认 1.00x
            </span>
            <span>宽松 1.30x</span>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
