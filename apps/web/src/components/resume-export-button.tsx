import { useRef, useState } from "react";
import { ChevronDown, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getLanguageLabel } from "@/lib/format";

interface ResumeExportButtonProps {
  currentLanguage: string;
  languages: Record<string, { title?: string; markdown: string }>;
  disabled?: boolean;
  exporting?: boolean;
  onExport: (lang?: string) => void;
  onExportMarkdown?: (lang?: string) => void;
  onExportMarkdownAll?: () => void;
}

export function ResumeExportButton({
  currentLanguage,
  languages,
  disabled,
  exporting,
  onExport,
  onExportMarkdown,
  onExportMarkdownAll,
}: ResumeExportButtonProps) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allCodes = Array.from(
    new Set([...Object.keys(languages), currentLanguage]),
  );
  const blocked = disabled || exporting;

  const openMenu = () => {
    if (blocked) return;
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setOpen(true);
  };

  const scheduleClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
    }, 150);
  };

  return (
    <div
      className="inline-flex items-center rounded-[min(var(--radius-md),10px)] bg-gradient-to-r from-blue-600 to-indigo-600 shadow-xs transition-all hover:from-blue-500 hover:to-indigo-500 has-[button:disabled]:opacity-50 has-[button:disabled]:pointer-events-none"
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
    >
      <Button
        variant="ghost"
        size="sm"
        disabled={blocked}
        onClick={() => onExport(currentLanguage)}
        className="h-8 gap-1.5 rounded-r-none border-none bg-transparent pr-1.5 text-xs text-white hover:bg-white/15 hover:text-white disabled:opacity-100 cursor-pointer"
      >
        <Download className="size-3.5" />
        {exporting ? "导出中…" : "导出 PDF"}
      </Button>
      <DropdownMenu
        open={blocked ? false : open}
        onOpenChange={(next) => {
          if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
          }
          setOpen(next);
        }}
        modal={false}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={blocked}
            aria-label="更多导出选项"
            onPointerDown={(e) => {
              if (open) e.preventDefault();
            }}
            className="h-8 rounded-l-none border-none bg-transparent pl-1 pr-2 text-white hover:bg-white/15 hover:text-white aria-expanded:bg-white/15 aria-expanded:text-white disabled:opacity-100 cursor-pointer"
          >
            <ChevronDown className="size-3.5 opacity-90 transition-transform duration-200 group-aria-expanded/button:rotate-180" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-52"
          onMouseEnter={openMenu}
          onMouseLeave={scheduleClose}
        >
          {allCodes.length > 1 ? (
            <>
              <DropdownMenuLabel>导出 PDF</DropdownMenuLabel>
              {allCodes.map((code) => (
                <DropdownMenuItem
                  key={`pdf-${code}`}
                  onSelect={() => onExport(code)}
                >
                  {getLanguageLabel(code)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>导出 Markdown</DropdownMenuLabel>
              {allCodes.map((code) => (
                <DropdownMenuItem
                  key={code}
                  onSelect={() => onExportMarkdown?.(code)}
                >
                  <FileText className="size-3.5" />
                  {getLanguageLabel(code)} (.md)
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onSelect={onExportMarkdownAll}>
                <FileText className="size-3.5" />
                导出全部语言 (.zip)
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem
              onSelect={() => onExportMarkdown?.(currentLanguage)}
            >
              <FileText className="size-3.5" />
              导出 Markdown (.md)
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
