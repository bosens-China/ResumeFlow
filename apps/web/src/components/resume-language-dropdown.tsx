import { useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  FileText,
  Globe,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PRESET_LANGUAGES,
  getLanguageLabel,
  getLanguageName,
} from "@/lib/format";

interface ResumeLanguageDropdownProps {
  currentLanguage: string;
  languages: Record<string, { title?: string; markdown: string }>;
  onSelectLanguage: (lang: string) => void;
  onAddLanguage: (lang: string, copyFromCurrent: boolean) => void;
  onDeleteLanguage?: (lang: string) => void;
}

export function ResumeLanguageDropdown({
  currentLanguage,
  languages,
  onSelectLanguage,
  onAddLanguage,
  onDeleteLanguage,
}: ResumeLanguageDropdownProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const existingCodes = new Set(Object.keys(languages));
  existingCodes.add(currentLanguage);

  const availablePresets = PRESET_LANGUAGES.filter(
    (item) => !existingCodes.has(item.code),
  );

  const [inputCode, setInputCode] = useState("");
  const [copyCurrent, setCopyCurrent] = useState(true);

  const normalizedCode = inputCode.trim();
  const isValidFormat =
    !normalizedCode || /^[a-zA-Z0-9_-]+$/.test(normalizedCode);
  const isExisting = [...existingCodes].some(
    (c) => c.toLowerCase() === normalizedCode.toLowerCase(),
  );
  const isTooLong = normalizedCode.length > 20;
  const canSubmit =
    normalizedCode.length > 0 && isValidFormat && !isExisting && !isTooLong;

  const detectedName = normalizedCode ? getLanguageName(normalizedCode) : "";
  const showDetectedBadge =
    detectedName && detectedName.toLowerCase() !== normalizedCode.toLowerCase();

  function handleOpenAdd() {
    setInputCode(availablePresets[0]?.code ?? "");
    setCopyCurrent(true);
    setIsAddOpen(true);
  }

  function handleConfirmAdd() {
    if (!canSubmit) return;
    onAddLanguage(normalizedCode, copyCurrent);
    setIsAddOpen(false);
  }

  const existingList = Array.from(existingCodes);

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs font-medium"
            aria-label="切换简历语言版本"
          >
            <Globe className="size-3.5 text-muted-foreground" />
            <span>{getLanguageName(currentLanguage)}</span>
            <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1 py-0.2 rounded">
              {currentLanguage}
            </span>
            <ChevronDown className="size-3 opacity-60 ml-0.5" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-60 p-1.5">
          <DropdownMenuLabel className="flex items-center justify-between px-2 py-1 text-xs font-medium text-muted-foreground">
            <span>语言版本</span>
            <span className="text-[10px] text-muted-foreground/60">
              切换即设为主语言
            </span>
          </DropdownMenuLabel>

          <div className="space-y-0.5">
            {existingList.map((code) => {
              const isCurrent = code === currentLanguage;
              return (
                <div
                  key={code}
                  className="group flex items-center justify-between rounded-sm px-2 py-1.5 text-xs hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => {
                    onSelectLanguage(code);
                    setMenuOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-4 flex items-center justify-center shrink-0">
                      {isCurrent && (
                        <Check className="size-3.5 text-primary stroke-[2.5]" />
                      )}
                    </span>
                    <span className="truncate font-medium">
                      {getLanguageName(code)}
                    </span>
                    {isCurrent && (
                      <span className="rounded bg-primary/10 px-1 py-0.2 text-[9px] font-medium text-primary shrink-0">
                        主语言
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className="font-mono text-[10px] text-muted-foreground/80 bg-muted px-1.5 py-0.5 rounded">
                      {code}
                    </span>
                    {!isCurrent &&
                      existingList.length > 1 &&
                      onDeleteLanguage && (
                        <button
                          type="button"
                          aria-label={`删除 ${code} 语言版本`}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-opacity ml-0.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpen(false);
                            setPendingDelete(code);
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                  </div>
                </div>
              );
            })}
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={handleOpenAdd}
            className="cursor-pointer gap-2 text-xs py-1.5"
          >
            <Plus className="size-3.5" />
            <span>添加语言版本…</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>添加语言版本</DialogTitle>
            <DialogDescription>
              为简历创建多语言版本，各语言版本独立排版与导出。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            {/* 推荐预设与自由输入区 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">
                  语言代码 (Language Code)
                </label>
                {showDetectedBadge && (
                  <span className="text-[11px] text-muted-foreground font-medium">
                    识别为：
                    <strong className="text-foreground">{detectedName}</strong>
                  </span>
                )}
              </div>

              {/* 推荐预设胶囊标签：点选即可填入并允许继续微调 */}
              {availablePresets.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {availablePresets.map((preset) => {
                    const isSelected =
                      normalizedCode.toLowerCase() ===
                      preset.code.toLowerCase();
                    return (
                      <button
                        key={preset.code}
                        type="button"
                        onClick={() => setInputCode(preset.code)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors cursor-pointer border ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary font-medium"
                            : "bg-muted/50 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        <span>{preset.label}</span>
                        <span className="font-mono text-[10px] opacity-75">
                          {preset.code}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 现代化输入框：支持一键选预设后自由编辑修改 */}
              <input
                type="text"
                autoFocus
                placeholder="例如: en, en-US, zh-HK, ru, fr-CA"
                value={inputCode}
                maxLength={20}
                onChange={(e) => setInputCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canSubmit) {
                    e.preventDefault();
                    handleConfirmAdd();
                  }
                }}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
              />

              {/* 校验提示 */}
              {!isValidFormat && (
                <p role="alert" className="text-xs text-destructive">
                  语言代码格式不合法，仅支持字母、数字及中划线（如 en-US）。
                </p>
              )}
              {isExisting && (
                <p role="alert" className="text-xs text-destructive">
                  该语言版本已存在，请使用其他语言代码。
                </p>
              )}
            </div>

            {/* 正文初始底稿选择卡片 */}
            <div className="space-y-2 pt-2 border-t">
              <label className="text-xs font-medium text-foreground block">
                正文初始内容
              </label>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setCopyCurrent(true)}
                  className={`flex flex-col items-start gap-1 p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    copyCurrent
                      ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/20"
                      : "border-border bg-background text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <Copy className="size-3.5 text-primary" />
                    <span>复制当前版本</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground leading-relaxed">
                    基于当前正文创建，方便对照逐段翻译
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCopyCurrent(false)}
                  className={`flex flex-col items-start gap-1 p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    !copyCurrent
                      ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/20"
                      : "border-border bg-background text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <FileText className="size-3.5" />
                    <span>使用空白正文</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground leading-relaxed">
                    从全新的空白页面开始独立编写
                  </span>
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              取消
            </Button>
            <Button onClick={handleConfirmAdd} disabled={!canSubmit}>
              添加语言
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除该语言版本？</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除「{pendingDelete && getLanguageLabel(pendingDelete)}
              」版本的正文与配置，其他语言版本不受影响。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingDelete) onDeleteLanguage?.(pendingDelete);
              }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
