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
  { label: "左对齐", name: "left", content: "左侧内容" },
  { label: "居中", name: "center", content: "居中内容" },
  { label: "右对齐", name: "right", content: "右侧内容" },
  { label: "单元格", name: "cell", content: "单元格内容" },
];

export function ResumeLayoutMenu({
  editorRef,
  onChange,
}: {
  editorRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
}) {
  const selection = useRef<{ start: number; length: number } | null>(null);

  function insert(name: string, content: string) {
    const textarea = editorRef.current;
    if (!textarea) return;
    const { value, selectionStart } = textarea;
    const offset = getLayoutInsertionOffset(value, selectionStart);
    const before = value.slice(0, offset);
    const after = value.slice(offset);
    const prefix = before && !before.endsWith("\n\n") ? "\n\n" : "";
    const suffix = after && !after.startsWith("\n\n") ? "\n\n" : "";
    const snippet = `:::${name}\n${content}\n:::`;
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
        {layouts.map(({ label, name, content }) => (
          <DropdownMenuItem key={label} onSelect={() => insert(name, content)}>
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
