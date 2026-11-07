import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { css } from "@codemirror/lang-css";
import {
  AlertCircle,
  Check,
  Copy,
  HelpCircle,
  Palette,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
    outline: "none !important",
  },
  "&.cm-focused": {
    outline: "none !important",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    scrollbarWidth: "thin",
    scrollbarColor: "transparent transparent",
    transition: "scrollbar-color 0.2s ease-in-out",
  },
  "&:hover .cm-scroller": {
    scrollbarColor:
      "color-mix(in srgb, var(--foreground, #000) 25%, transparent) transparent",
  },
  ".cm-scroller::-webkit-scrollbar": {
    width: "6px",
    height: "6px",
  },
  ".cm-scroller::-webkit-scrollbar-track": {
    backgroundColor: "transparent",
  },
  ".cm-scroller::-webkit-scrollbar-thumb": {
    backgroundColor: "transparent",
    borderRadius: "9999px",
    transition: "background-color 0.2s ease-in-out",
  },
  "&:hover .cm-scroller::-webkit-scrollbar-thumb": {
    backgroundColor:
      "color-mix(in srgb, var(--foreground, #000) 25%, transparent)",
  },
  "& .cm-scroller::-webkit-scrollbar-thumb:hover": {
    backgroundColor:
      "color-mix(in srgb, var(--foreground, #000) 50%, transparent)",
  },
  ".cm-content": {
    padding: "8px 0",
  },
  // 点击后的插入光标比默认竖线更容易定位
  ".cm-cursor, .cm-dropCursor": {
    borderLeftWidth: "3px !important",
    borderLeftColor: "#2563eb !important",
    marginLeft: "-1px",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftWidth: "3px !important",
    borderLeftColor: "#2563eb !important",
  },
  // 鼠标悬停（Hover）到任意代码行时显示柔和底色，让鼠标所在行位置清晰可见
  ".cm-line:hover": {
    backgroundColor:
      "color-mix(in srgb, var(--primary, #2563eb) 5%, transparent)",
  },
  // 当前点击激活行：清晰高亮背景，点击落点一目了然
  ".cm-activeLine": {
    backgroundColor:
      "color-mix(in srgb, var(--primary, #2563eb) 9%, transparent) !important",
  },
  // 当前激活行的行号：主色高亮与加粗
  ".cm-activeLineGutter": {
    backgroundColor:
      "color-mix(in srgb, var(--primary, #2563eb) 15%, transparent) !important",
    color: "var(--primary, #2563eb) !important",
    fontWeight: "700 !important",
  },
  // 选中文本高亮
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor:
      "color-mix(in srgb, var(--primary, #2563eb) 22%, transparent) !important",
  },
  // 行号区域
  ".cm-gutters": {
    backgroundColor:
      "color-mix(in srgb, var(--muted, #f1f5f9) 30%, transparent)",
    borderRight: "1px solid var(--border, #e2e8f0)",
    color: "var(--muted-foreground, #64748b)",
    cursor: "default",
  },
  ".cm-gutterElement": {
    padding: "0 8px 0 12px",
  },
});

const VARIABLE_TIPS = [
  { name: "var(--rf-theme-color)", desc: "当前主题色（与工具栏联动）" },
  {
    name: "color-mix(in srgb, var(--rf-theme-color) 12%, white)",
    desc: "主题色浅底",
  },
];

const CLASS_TIPS = [
  { name: ".rf-root", desc: "简历根容器" },
  { name: ".rf-h1 ~ .rf-h6", desc: "各级标题" },
  { name: ".rf-p", desc: "正文段落" },
  { name: ".rf-ul / .rf-ol / .rf-li", desc: "列表与列表项" },
  { name: ".rf-link", desc: "超链接" },
  { name: ".rf-blockquote", desc: "引用块" },
  { name: ".rf-row / .rf-cell", desc: "多栏行与单元格" },
  { name: ".rf-table / .rf-th / .rf-td", desc: "表格与表头/单元格" },
];

export function CssEditor({
  value,
  onChange,
  error,
  onFormat,
  isFormatting,
}: {
  value: string;
  onChange: (val: string) => void;
  error?: string | null;
  onFormat?: () => Promise<void>;
  isFormatting?: boolean;
}) {
  const handleCopy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    toast.success(`已复制 ${text}`);
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-9 shrink-0 items-center justify-between border-b px-4 text-xs bg-muted/10">
        <div className="flex items-center gap-2 min-w-0">
          {error ? (
            <div className="flex items-center gap-1.5 text-destructive font-medium truncate">
              <AlertCircle className="size-3.5 shrink-0" />
              <span className="truncate">CSS 语法错误: {error}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Check className="size-3 text-emerald-600" />
              <span>语法检查通过 · 可手动格式化</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <HelpCircle className="size-3 text-primary" />
                <span>类名与变量</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="bottom"
              align="end"
              sideOffset={6}
              className="w-[450px] max-w-[calc(100vw-2rem)] p-3.5 flex flex-col gap-3.5 bg-background border border-border shadow-xl rounded-xl z-50 text-xs"
            >
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-foreground mb-2">
                  <Palette className="size-3.5 text-primary" />
                  <span>动态主题变量（点击复制）</span>
                </div>
                <div className="flex flex-col gap-2">
                  {VARIABLE_TIPS.map((tip) => (
                    <button
                      key={tip.name}
                      type="button"
                      onClick={() => handleCopy(tip.name)}
                      className="group flex flex-col gap-1 rounded-lg bg-muted/40 hover:bg-muted p-2 text-left font-mono text-[11px] transition-all cursor-pointer border border-border/50 hover:border-primary/40"
                      title={`点击复制: ${tip.name}`}
                    >
                      <div className="flex items-center justify-between gap-2 font-sans">
                        <span className="font-medium text-[11px] text-foreground">
                          {tip.desc}
                        </span>
                        <span className="flex items-center gap-1 text-[10.5px] text-muted-foreground group-hover:text-primary transition-colors">
                          <Copy className="size-3" />
                          <span>点击复制</span>
                        </span>
                      </div>
                      <code className="text-primary font-mono text-[11px] break-all select-all font-semibold bg-background/80 px-1.5 py-0.5 rounded border border-border/40">
                        {tip.name}
                      </code>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-border/60 pt-2.5">
                <div className="font-semibold text-foreground mb-2">
                  常用选择器类名
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {CLASS_TIPS.map((tip) => (
                    <button
                      key={tip.name}
                      type="button"
                      onClick={() => handleCopy(tip.name)}
                      className="group flex flex-col gap-0.5 rounded-md p-1.5 hover:bg-muted/60 transition-colors text-left cursor-pointer border border-transparent hover:border-border/60"
                      title={`点击复制: ${tip.name}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <code className="text-primary font-mono text-[11px] font-semibold truncate">
                          {tip.name}
                        </code>
                        <Copy className="size-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                      <span className="text-muted-foreground text-[10.5px] font-sans truncate">
                        {tip.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {onFormat && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void onFormat()}
              disabled={isFormatting || !value.trim()}
              className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Sparkles className="size-3 text-primary" />
              <span>{isFormatting ? "格式化中…" : "格式化代码"}</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <CodeMirror
          value={value}
          height="100%"
          extensions={[css(), editorTheme]}
          onChange={onChange}
          placeholder={`/* 在此处输入自定义 CSS，示例：\n.rf-root {\n  font-family: serif;\n}\n.rf-h2 {\n  border-bottom: 2px dashed var(--rf-theme-color, #000000);\n  text-transform: uppercase;\n}\n.rf-p {\n  line-height: 1.6;\n}\n*/`}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            dropCursor: true,
            allowMultipleSelections: false,
            indentOnInput: true,
            tabSize: 2,
          }}
          className="h-full text-xs font-mono"
        />
      </div>
    </div>
  );
}
