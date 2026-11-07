import { useMemo, type RefObject } from "react";
import CodeMirror, {
  EditorView,
  type ReactCodeMirrorRef,
} from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";

export interface MarkdownEditorProps {
  editorRef: RefObject<ReactCodeMirrorRef | null>;
  value: string;
  onChange: (value: string) => void;
  onSelectionChange: (start: number, end: number) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}

const markdownTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13.5px",
    backgroundColor: "transparent",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    lineHeight: "1.65",
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
    padding: "16px 0",
  },
  // 精致现代插入光标：3px 主题蓝，定位清晰
  ".cm-cursor, .cm-dropCursor": {
    borderLeftWidth: "3px !important",
    borderLeftColor: "#2563eb !important",
    marginLeft: "-1px",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftWidth: "3px !important",
    borderLeftColor: "#2563eb !important",
  },
  // 鼠标悬停单行底色：告别整个编辑框 hover 闪烁
  ".cm-line:hover": {
    backgroundColor:
      "color-mix(in srgb, var(--primary, #2563eb) 4%, transparent)",
  },
  // 当前光标激活行微高亮
  ".cm-activeLine": {
    backgroundColor:
      "color-mix(in srgb, var(--primary, #2563eb) 8%, transparent) !important",
  },
  // 激活行的行号
  ".cm-activeLineGutter": {
    backgroundColor:
      "color-mix(in srgb, var(--primary, #2563eb) 14%, transparent) !important",
    color: "var(--primary, #2563eb) !important",
    fontWeight: "600 !important",
  },
  // 选中文本高亮
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor:
      "color-mix(in srgb, var(--primary, #2563eb) 20%, transparent) !important",
  },
  // 行号区域
  ".cm-gutters": {
    backgroundColor:
      "color-mix(in srgb, var(--muted, #f1f5f9) 35%, transparent)",
    borderRight: "1px solid var(--border, #e2e8f0)",
    color: "var(--muted-foreground, #64748b)",
    cursor: "default",
  },
  ".cm-gutterElement": {
    padding: "0 8px 0 12px",
  },
});

export function MarkdownEditor({
  editorRef,
  value,
  onChange,
  onSelectionChange,
  placeholder,
  className,
  ariaLabel = "Markdown 编辑器",
}: MarkdownEditorProps) {
  const extensions = useMemo(
    () => [
      markdown(),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
      markdownTheme,
    ],
    [ariaLabel],
  );

  return (
    <div
      className={`relative h-full flex-1 min-h-0 flex flex-col bg-background ${
        className ?? ""
      }`}
    >
      <CodeMirror
        ref={editorRef}
        value={value}
        height="100%"
        extensions={extensions}
        onChange={onChange}
        onUpdate={(update) => {
          if (update.selectionSet) {
            const main = update.state.selection.main;
            onSelectionChange(main.from, main.to);
          }
        }}
        placeholder={placeholder}
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
  );
}
