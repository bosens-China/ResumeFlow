import { useRef, type RefObject } from "react";
import { ChevronDown } from "lucide-react";
import { getLayoutInsertionOffset } from "@resumeflow/shared/markdown";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const layouts = [
  {
    label: "左右同行",
    columns: "1fr auto",
    cells: [
      ["left", "左侧内容"],
      ["right", "右侧内容"],
    ],
    renderDiagram: () => (
      <svg
        aria-hidden="true"
        viewBox="0 0 44 22"
        className="h-5 w-10 shrink-0 text-muted-foreground group-hover:text-primary transition-colors"
      >
        <rect
          width="44"
          height="22"
          rx="3.5"
          fill="currentColor"
          fillOpacity="0.06"
          stroke="currentColor"
          strokeOpacity="0.25"
        />
        <rect
          x="4"
          y="6.5"
          width="22"
          height="9"
          rx="2"
          fill="#2563eb"
          fillOpacity="0.85"
        />
        <rect
          x="30"
          y="6.5"
          width="10"
          height="9"
          rx="2"
          fill="#64748b"
          fillOpacity="0.75"
        />
      </svg>
    ),
  },
  {
    label: "左中右同行",
    columns: "1fr auto 1fr",
    cells: [
      ["left", "左侧内容"],
      ["center", "居中内容"],
      ["right", "右侧内容"],
    ],
    renderDiagram: () => (
      <svg
        aria-hidden="true"
        viewBox="0 0 44 22"
        className="h-5 w-10 shrink-0 text-muted-foreground group-hover:text-primary transition-colors"
      >
        <rect
          width="44"
          height="22"
          rx="3.5"
          fill="currentColor"
          fillOpacity="0.06"
          stroke="currentColor"
          strokeOpacity="0.25"
        />
        <rect
          x="4"
          y="6.5"
          width="10"
          height="9"
          rx="2"
          fill="#2563eb"
          fillOpacity="0.85"
        />
        <rect
          x="17"
          y="6.5"
          width="10"
          height="9"
          rx="2"
          fill="#6366f1"
          fillOpacity="0.85"
        />
        <rect
          x="30"
          y="6.5"
          width="10"
          height="9"
          rx="2"
          fill="#64748b"
          fillOpacity="0.75"
        />
      </svg>
    ),
  },
  {
    label: "等宽分栏",
    columns: "",
    cells: [
      ["left", "第一列内容"],
      ["right", "第二列内容"],
    ],
    renderDiagram: () => (
      <svg
        aria-hidden="true"
        viewBox="0 0 44 22"
        className="h-5 w-10 shrink-0 text-muted-foreground group-hover:text-primary transition-colors"
      >
        <rect
          width="44"
          height="22"
          rx="3.5"
          fill="currentColor"
          fillOpacity="0.06"
          stroke="currentColor"
          strokeOpacity="0.25"
        />
        <rect
          x="4"
          y="5"
          width="16"
          height="12"
          rx="2"
          fill="#2563eb"
          fillOpacity="0.8"
        />
        <rect
          x="24"
          y="5"
          width="16"
          height="12"
          rx="2"
          fill="#2563eb"
          fillOpacity="0.8"
        />
      </svg>
    ),
  },
];

export function ResumeLayoutMenu({
  editorRef,
}: {
  editorRef: RefObject<ReactCodeMirrorRef | null>;
}) {
  const restoreFocus = useRef(false);

  function insert({ columns, cells }: (typeof layouts)[number]) {
    const view = editorRef.current?.view;
    if (!view) return;
    const value = view.state.doc.toString();
    const selectionStart = view.state.selection.main.from;
    const offset = getLayoutInsertionOffset(value, selectionStart);
    const before = value.slice(0, offset);
    const after = value.slice(offset);
    const prefix = before && !before.endsWith("\n\n") ? "\n\n" : "";
    const suffix = after && !after.startsWith("\n\n") ? "\n\n" : "";
    const content = cells[0][1];
    const snippet = `::::row${columns ? `{columns="${columns}"}` : ""}\n${cells.map(([align, text]) => `:::cell{align="${align}"}\n${text}\n:::`).join("\n\n")}\n::::`;
    const start = before.length + prefix.length + snippet.indexOf(content);
    view.dispatch({
      changes: { from: offset, insert: prefix + snippet + suffix },
      selection: { anchor: start, head: start + content.length },
      scrollIntoView: true,
    });
    restoreFocus.current = true;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto h-7 shrink-0 gap-1 px-2 text-xs"
        >
          插入语法
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-44 p-1.5"
        onCloseAutoFocus={(event) => {
          if (!restoreFocus.current) return;
          event.preventDefault();
          editorRef.current?.view?.focus();
          restoreFocus.current = false;
        }}
      >
        {layouts.map((layout) => (
          <DropdownMenuItem
            key={layout.label}
            onSelect={() => insert(layout)}
            className="group flex items-center gap-2.5 px-2.5 py-1.5 cursor-pointer rounded-md"
          >
            {layout.renderDiagram()}
            <span className="font-medium text-xs">{layout.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
