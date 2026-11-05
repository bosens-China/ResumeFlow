import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";
import { cn } from "cn";

export function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  step = 1,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      step={step}
      className={cn(
        "relative flex w-full touch-none select-none items-center cursor-pointer",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted cursor-pointer"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute h-full bg-primary"
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        data-slot="slider-thumb"
        className="block size-4 rounded-full border border-primary/50 bg-background shadow-xs transition-colors hover:ring-4 hover:ring-ring/20 focus-visible:outline-hidden focus-visible:ring-4 focus-visible:ring-ring/20 cursor-grab active:cursor-grabbing disabled:pointer-events-none disabled:opacity-50"
      />
    </SliderPrimitive.Root>
  );
}
