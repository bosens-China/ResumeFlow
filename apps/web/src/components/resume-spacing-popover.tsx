import { useRef, useState } from "react";
import {
  ChevronDown,
  Link2,
  Minus,
  Plus,
  RotateCcw,
  Sliders,
  Unlink2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { cn } from "cn";

const MARGIN_PRESETS = [10, 12, 14, 16, 18];
const MIN_MARGIN = 6;
const MAX_MARGIN = 32;

const LINE_HEIGHT_PRESETS = [
  { label: "0.8x", value: 0.8 },
  { label: "1.0x", value: 1.0 },
  { label: "1.2x", value: 1.2 },
  { label: "1.5x", value: 1.5 },
];
const MIN_LINE_HEIGHT = 0.6;
const MAX_LINE_HEIGHT = 1.8;
const LINE_HEIGHT_STEP = 0.02;

function parseMarginValues(raw?: string): {
  vertical: number;
  horizontal: number;
} {
  const parts = (raw ?? "").trim().split(/\s+/).filter(Boolean);
  const nums = parts.map((p) => {
    const m = p.match(/^(\d+(?:\.\d+)?)/);
    return m ? Number.parseFloat(m[1]) : 14;
  });
  if (nums.length === 0) return { vertical: 14, horizontal: 14 };
  if (nums.length === 1) return { vertical: nums[0], horizontal: nums[0] };
  return { vertical: nums[0], horizontal: nums[1] };
}

function formatMarginValues(vertical: number, horizontal: number): string {
  return vertical === horizontal
    ? `${vertical}mm`
    : `${vertical}mm ${horizontal}mm`;
}

function roundRatio(num: number): number {
  return Math.round(num * 100) / 100;
}

const clampMargin = (v: number) =>
  Math.max(MIN_MARGIN, Math.min(MAX_MARGIN, Math.round(v)));

export interface ResumeSpacingPopoverProps {
  margin?: string;
  onChangeMargin: (margin: string) => void;
  lineHeight?: number;
  onChangeLineHeight: (lineHeight: number) => void;
}

export function ResumeSpacingPopover({
  margin,
  onChangeMargin,
  lineHeight = 1.0,
  onChangeLineHeight,
}: ResumeSpacingPopoverProps) {
  const currentMargin = margin?.trim() || "14mm";
  const { vertical, horizontal } = parseMarginValues(currentMargin);

  const [isLinkedOverride, setIsLinkedOverride] = useState<boolean | null>(
    null,
  );
  const isLinked =
    isLinkedOverride !== null ? isLinkedOverride : vertical === horizontal;

  // 行距状态与防抖
  const currentRatio = roundRatio(lineHeight || 1.0);
  const [prevRatio, setPrevRatio] = useState(currentRatio);
  const [sliderVal, setSliderVal] = useState(currentRatio);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (prevRatio !== currentRatio) {
    setPrevRatio(currentRatio);
    setSliderVal(currentRatio);
  }

  function commitLineHeight(val: number) {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const clamped = Math.max(
      MIN_LINE_HEIGHT,
      Math.min(MAX_LINE_HEIGHT, roundRatio(val)),
    );
    setSliderVal(clamped);
    onChangeLineHeight(clamped);
  }

  function handleLineHeightChange([val]: number[]) {
    if (val === undefined) return;
    const clamped = roundRatio(val);
    setSliderVal(clamped);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => onChangeLineHeight(clamped), 120);
  }

  // 页边距状态处理
  function updateVertical(newVal: number) {
    if (Number.isNaN(newVal)) return;
    const clamped = clampMargin(newVal);
    onChangeMargin(
      formatMarginValues(clamped, isLinked ? clamped : horizontal),
    );
  }

  function updateHorizontal(newVal: number) {
    if (Number.isNaN(newVal)) return;
    const clamped = clampMargin(newVal);
    onChangeMargin(formatMarginValues(isLinked ? clamped : vertical, clamped));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs font-medium cursor-pointer"
          aria-label="调节简历排版间距"
        >
          <Sliders className="size-3.5 text-muted-foreground" />
          <span>间距</span>
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-68 p-3 space-y-3 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 页边距区块 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">页边距</span>
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              <span>
                {vertical === horizontal
                  ? `${vertical}mm`
                  : `${vertical}/${horizontal}mm`}
              </span>
              <button
                type="button"
                onClick={() => setIsLinkedOverride(!isLinked)}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                title={
                  isLinked
                    ? "当前上下左右联动，点击独立调节"
                    : "当前独立调节，点击开启等比联动"
                }
              >
                {isLinked ? (
                  <Link2 className="size-3 text-primary" />
                ) : (
                  <Unlink2 className="size-3" />
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1">
            {MARGIN_PRESETS.map((p) => {
              const active = isLinked && vertical === p && horizontal === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setIsLinkedOverride(true);
                    onChangeMargin(`${p}mm`);
                  }}
                  className={cn(
                    "h-6 rounded text-xs font-mono transition-colors cursor-pointer border",
                    active
                      ? "bg-primary text-primary-foreground border-primary font-medium"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground border-transparent",
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {isLinked ? (
            <div className="flex items-center gap-1.5 pt-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={vertical <= MIN_MARGIN}
                onClick={() => updateVertical(vertical - 1)}
                className="size-6 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="减少边距"
              >
                <Minus className="size-3" />
              </Button>
              <Slider
                min={MIN_MARGIN}
                max={MAX_MARGIN}
                step={1}
                value={[vertical]}
                onValueChange={([val]) =>
                  val !== undefined && updateVertical(val)
                }
                className="flex-1 cursor-pointer"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={vertical >= MAX_MARGIN}
                onClick={() => updateVertical(vertical + 1)}
                className="size-6 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="增加边距"
              >
                <Plus className="size-3" />
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              {[
                { label: "上下", val: vertical, fn: updateVertical },
                { label: "左右", val: horizontal, fn: updateHorizontal },
              ].map(({ label, val, fn }) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded border border-border/70 bg-muted/20 px-2 py-1 text-[11px]"
                >
                  <span className="text-muted-foreground">{label}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={val <= MIN_MARGIN}
                      onClick={() => fn(val - 1)}
                      className="size-4 inline-flex items-center justify-center rounded hover:bg-muted cursor-pointer disabled:opacity-40"
                    >
                      -
                    </button>
                    <span className="font-mono text-xs font-medium w-8 text-center">
                      {val}
                    </span>
                    <button
                      type="button"
                      disabled={val >= MAX_MARGIN}
                      onClick={() => fn(val + 1)}
                      className="size-4 inline-flex items-center justify-center rounded hover:bg-muted cursor-pointer disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DropdownMenuSeparator className="my-1" />

        {/* 行间距区块 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">行距与段距</span>
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span
                className={
                  sliderVal !== 1.0
                    ? "font-medium text-primary"
                    : "text-muted-foreground"
                }
              >
                {sliderVal.toFixed(2)}x
              </span>
              {sliderVal !== 1.0 && (
                <button
                  type="button"
                  onClick={() => commitLineHeight(1.0)}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  title="重置为默认 1.00x"
                >
                  <RotateCcw className="size-2.5" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {LINE_HEIGHT_PRESETS.map((p) => {
              const active = Math.abs(sliderVal - p.value) < 0.015;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => commitLineHeight(p.value)}
                  className={cn(
                    "h-6 rounded text-xs font-mono transition-colors cursor-pointer border",
                    active
                      ? "bg-primary text-primary-foreground border-primary font-medium"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground border-transparent",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 pt-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={sliderVal <= MIN_LINE_HEIGHT}
              onClick={() => commitLineHeight(sliderVal - LINE_HEIGHT_STEP)}
              className="size-6 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="缩小行距"
            >
              <Minus className="size-3" />
            </Button>
            <Slider
              min={MIN_LINE_HEIGHT}
              max={MAX_LINE_HEIGHT}
              step={LINE_HEIGHT_STEP}
              value={[sliderVal]}
              onValueChange={handleLineHeightChange}
              onValueCommit={([val]) =>
                val !== undefined && commitLineHeight(val)
              }
              className="flex-1 cursor-pointer"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={sliderVal >= MAX_LINE_HEIGHT}
              onClick={() => commitLineHeight(sliderVal + LINE_HEIGHT_STEP)}
              className="size-6 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="放大行距"
            >
              <Plus className="size-3" />
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
