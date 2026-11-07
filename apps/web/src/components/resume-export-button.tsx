import { ChevronDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLanguageLabel } from "@/lib/format";

interface ResumeExportButtonProps {
  currentLanguage: string;
  languages: Record<string, { title?: string; markdown: string }>;
  disabled?: boolean;
  exporting?: boolean;
  onExport: (lang?: string) => void;
}

export function ResumeExportButton({
  currentLanguage,
  languages,
  disabled,
  exporting,
  onExport,
}: ResumeExportButtonProps) {
  const allCodes = Array.from(
    new Set([...Object.keys(languages), currentLanguage]),
  );
  const hasMultiple = allCodes.length > 1;

  if (!hasMultiple) {
    return (
      <Button
        size="sm"
        onClick={() => onExport(currentLanguage)}
        disabled={disabled || exporting}
        className="h-8 gap-1.5 px-3 text-xs font-medium shadow-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/20 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
      >
        <Download className="size-3.5" />
        {exporting ? "导出中…" : "导出 PDF"}
      </Button>
    );
  }

  return (
    <div className="relative group inline-flex items-center">
      <Button
        size="sm"
        onClick={() => onExport(currentLanguage)}
        disabled={disabled || exporting}
        className="h-8 gap-1.5 px-2.5 text-xs font-medium shadow-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/20 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
        aria-label="导出当前语言 PDF，悬停可选择其他语言"
      >
        <Download className="size-3.5" />
        <span>{exporting ? "导出中…" : "导出 PDF"}</span>
        <span className="text-[10px] bg-white/20 px-1 py-0.5 rounded font-mono">
          {currentLanguage}
        </span>
        <ChevronDown className="size-3 opacity-70 group-hover:rotate-180 transition-transform" />
      </Button>

      <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-150 absolute right-0 top-full pt-1.5 z-50 pointer-events-none group-hover:pointer-events-auto">
        <div className="w-56 rounded-md border border-border bg-popover p-1.5 text-popover-foreground shadow-lg">
          <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground border-b mb-1">
            导出语言版本
          </div>

          <div className="space-y-0.5">
            {allCodes.map((code) => {
              const isCurrent = code === currentLanguage;
              return (
                <button
                  key={code}
                  type="button"
                  disabled={disabled || exporting}
                  onClick={(e) => {
                    e.stopPropagation();
                    onExport(code);
                  }}
                  className="w-full flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-accent cursor-pointer transition-colors text-left disabled:opacity-50"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{getLanguageLabel(code)}</span>
                    {isCurrent && (
                      <span className="text-[10px] text-primary font-medium">
                        (当前)
                      </span>
                    )}
                  </div>
                  <Download className="size-3.5 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
