import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { css } from "@codemirror/lang-css";
import { AlertCircle, Check, Info, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const editorFont = EditorView.theme({
  ".cm-scroller": { fontFamily: "var(--font-mono)" },
});

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
              <span>语法检查通过 · 保存时将自动格式化</span>
            </div>
          )}
        </div>

        {onFormat && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void onFormat()}
            disabled={isFormatting || !value.trim()}
            className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Sparkles className="size-3 text-primary" />
            <span>{isFormatting ? "格式化中…" : "格式化代码"}</span>
          </Button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <CodeMirror
          value={value}
          height="100%"
          extensions={[css(), editorFont]}
          onChange={onChange}
          placeholder={`/* 在此处输入自定义 CSS，示例：\n.rf-root {\n  font-family: serif;\n}\n.rf-h2 {\n  border-bottom: 2px dashed var(--rf-theme-color, #000000);\n  text-transform: uppercase;\n}\n.rf-p {\n  line-height: 1.6;\n}\n*/`}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            dropCursor: false,
            allowMultipleSelections: false,
            indentOnInput: true,
            tabSize: 2,
          }}
          className="h-full text-xs font-mono"
        />
      </div>

      <div className="border-t bg-muted/20 px-4 py-2 text-xs text-muted-foreground shrink-0">
        <div className="flex items-center gap-1.5 font-medium text-foreground mb-1">
          <Info className="size-3.5 text-primary" />
          <span>常用选择器类名参考</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
          {CLASS_TIPS.map((tip) => (
            <div key={tip.name} className="flex items-center justify-between">
              <code className="text-primary font-mono">{tip.name}</code>
              <span className="text-muted-foreground">{tip.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
