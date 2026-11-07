import { useRef, type RefObject } from "react";
import { ChevronDown } from "lucide-react";
import { getLayoutInsertionOffset } from "@resumeflow/shared/markdown";
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
  },
  {
    label: "左中右同行",
    columns: "1fr auto 1fr",
    cells: [
      ["left", "左侧内容"],
      ["center", "居中内容"],
      ["right", "右侧内容"],
    ],
  },
  {
    label: "等宽分栏",
    columns: "",
    cells: [
      ["left", "第一列内容"],
      ["right", "第二列内容"],
    ],
  },
];

export function ResumeLayoutMenu({
  editorRef,
  onChange,
}: {
  editorRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
}) {
  const selection = useRef<{ start: number; length: number } | null>(null);

  function insert({ columns, cells }: (typeof layouts)[number]) {
    const textarea = editorRef.current;
    if (!textarea) return;
    const { value, selectionStart } = textarea;
    const offset = getLayoutInsertionOffset(value, selectionStart);
    const before = value.slice(0, offset);
    const after = value.slice(offset);
    const prefix = before && !before.endsWith("\n\n") ? "\n\n" : "";
    const suffix = after && !after.startsWith("\n\n") ? "\n\n" : "";
    const content = cells[0][1];
    const snippet = `::::row${columns ? `{columns="${columns}"}` : ""}\n${cells.map(([align, text]) => `:::cell{align="${align}"}\n${text}\n:::`).join("\n\n")}\n::::`;
    selection.current = {
      start: before.length + prefix.length + snippet.indexOf(content),
      length: content.length,
    };
    onChange(before + prefix + snippet + suffix + after);
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
        onCloseAutoFocus={(event) => {
          if (selection.current === null) return;
          event.preventDefault();
          const textarea = editorRef.current;
          textarea?.focus();
          textarea?.setSelectionRange(
            selection.current.start,
            selection.current.start + selection.current.length,
          );
          selection.current = null;
        }}
      >
        {layouts.map((layout) => (
          <DropdownMenuItem key={layout.label} onSelect={() => insert(layout)}>
            {layout.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
