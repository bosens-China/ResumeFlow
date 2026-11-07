import { useMemo, type RefObject } from "react";
import CodeMirror, {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  type ViewUpdate,
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

// 仅为 ResumeFlow 特殊排版指令（::::row, :::cell, columns, align, :icon[...]）赋予专属高亮
const rfDirectiveMatcher = new MatchDecorator({
  regexp:
    /(::::?row|:::cell|::::?)|(:icon\[[a-zA-Z0-9_-]+\])|(\b(?:columns|align)\b)|(?<=\b(?:columns|align)\s*=\s*)("[^"]*"|'[^']*')/g,
  decoration: (match) => {
    if (match[1]) return Decoration.mark({ class: "cm-rf-directive" });
    if (match[2]) return Decoration.mark({ class: "cm-rf-icon" });
    if (match[3]) return Decoration.mark({ class: "cm-rf-attr-name" });
    return Decoration.mark({ class: "cm-rf-attr-val" });
  },
});

const rfDirectivePlugin = ViewPlugin.fromClass(
  class {
    decorations;
    constructor(view: EditorView) {
      this.decorations = rfDirectiveMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = rfDirectiveMatcher.updateDeco(
          update,
          this.decorations,
        );
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

const markdownTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13.5px",
    backgroundColor: "transparent",
    outline: "none !important",
  },
  "&.cm-focused": {
    outline: "none !important",
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
  // 特殊排版指令专属高亮：::::row, :::cell, ::::
  ".cm-rf-directive": {
    color: "#7c3aed !important",
    fontWeight: "600",
    backgroundColor: "rgba(124, 58, 237, 0.08)",
    padding: "1px 4px",
    borderRadius: "3px",
  },
  // 属性名（columns, align）
  ".cm-rf-attr-name": {
    color: "#0d9488 !important",
    fontWeight: "600",
  },
  // 属性值（"1fr auto", "left" 等）
  ".cm-rf-attr-val": {
    color: "#b45309 !important",
    fontWeight: "500",
  },
  // 图标标签（:icon[...]）
  ".cm-rf-icon": {
    color: "#2563eb !important",
    fontWeight: "600",
    backgroundColor: "rgba(37, 99, 235, 0.09)",
    padding: "1px 5px",
    borderRadius: "4px",
    border: "1px solid rgba(37, 99, 235, 0.18)",
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
      rfDirectivePlugin,
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
