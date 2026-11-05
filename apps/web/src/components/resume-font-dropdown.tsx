import { ChevronDown, Type } from "lucide-react";
import {
  RESUME_FONTS,
  type ResumeFontId,
} from "@resumeflow/shared/resume-fonts";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export interface ResumeFontDropdownProps {
  value: ResumeFontId;
  onChange: (font: ResumeFontId) => void;
  iconOnly?: boolean;
  side?: "left" | "bottom" | "top" | "right";
  align?: "start" | "center" | "end";
}

export function ResumeFontDropdown({
  value,
  onChange,
  iconOnly = false,
  side = "left",
  align = "start",
}: ResumeFontDropdownProps) {
  const selected = RESUME_FONTS.find((font) => font.id === value)!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {iconOnly ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 data-[state=open]:bg-muted data-[state=open]:text-foreground transition-colors cursor-pointer"
            aria-label={`选择简历字体 (当前: ${selected.name})`}
          >
            <Type className="size-4" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs"
            aria-label="选择简历字体"
          >
            <Type className="size-3.5" />
            <span>{selected.name}</span>
            <ChevronDown className="size-3" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={side}
        align={align}
        sideOffset={8}
        className="w-64"
      >
        <DropdownMenuLabel>当前语言的字体</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(id) => onChange(id as ResumeFontId)}
        >
          {RESUME_FONTS.map((font) => (
            <DropdownMenuRadioItem
              key={font.id}
              value={font.id}
              className="py-2"
            >
              <div>
                <div>{font.name}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {font.description}
                </div>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/fonts/README.md" target="_blank" rel="noreferrer">
            字体来源与许可
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
