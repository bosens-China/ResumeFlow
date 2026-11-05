import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

function highlightJson(code: string): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  const regex =
    /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*")(\s*:)?|(\b(?:true|false|null)\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],])/g;

  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = regex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      parts.push(code.slice(lastIndex, match.index));
    }
    const [, str, isKeyColon, boolNull, num, punct] = match;

    if (str) {
      if (isKeyColon) {
        parts.push(
          <span key={idx++} className="text-sky-600 dark:text-sky-400">
            {str}
          </span>,
        );
        parts.push(
          <span key={idx++} className="text-muted-foreground">
            {isKeyColon}
          </span>,
        );
      } else {
        parts.push(
          <span key={idx++} className="text-emerald-600 dark:text-emerald-400">
            {str}
          </span>,
        );
      }
    } else if (boolNull) {
      parts.push(
        <span key={idx++} className="text-amber-600 dark:text-amber-400">
          {boolNull}
        </span>,
      );
    } else if (num) {
      parts.push(
        <span key={idx++} className="text-indigo-600 dark:text-indigo-400">
          {num}
        </span>,
      );
    } else if (punct) {
      parts.push(
        <span key={idx++} className="text-muted-foreground">
          {punct}
        </span>,
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < code.length) {
    parts.push(code.slice(lastIndex));
  }

  return parts;
}

function highlightToml(code: string): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  const regex =
    /(\[[^\]]+\])|([a-zA-Z0-9_.-]+)(\s*=)|("[^"]*")|(\b(?:true|false)\b)/g;

  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = regex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      parts.push(code.slice(lastIndex, match.index));
    }
    const [, section, key, eq, str, boolVal] = match;

    if (section) {
      parts.push(
        <span key={idx++} className="text-sky-600 dark:text-sky-400">
          {section}
        </span>,
      );
    } else if (key) {
      parts.push(
        <span key={idx++} className="text-sky-600 dark:text-sky-400">
          {key}
        </span>,
      );
      parts.push(
        <span key={idx++} className="text-muted-foreground">
          {eq}
        </span>,
      );
    } else if (str) {
      parts.push(
        <span key={idx++} className="text-emerald-600 dark:text-emerald-400">
          {str}
        </span>,
      );
    } else if (boolVal) {
      parts.push(
        <span key={idx++} className="text-amber-600 dark:text-amber-400">
          {boolVal}
        </span>,
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < code.length) {
    parts.push(code.slice(lastIndex));
  }

  return parts;
}

export function CopyBlock({
  code,
  label,
  language,
}: {
  code: string;
  label?: string;
  language?: "json" | "toml" | "bash";
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      toast.success("已复制到剪贴板");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const content =
    language === "json"
      ? highlightJson(code)
      : language === "toml"
        ? highlightToml(code)
        : code;

  return (
    <div className="relative rounded-md border border-border/70 bg-muted/40 font-mono text-xs">
      {label && (
        <div className="flex items-center justify-between border-b border-border/50 px-3 py-1 bg-muted/20">
          <span className="text-[11px] font-sans text-muted-foreground">
            {label}
          </span>
          {language && (
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-mono">
              {language}
            </span>
          )}
        </div>
      )}
      <div className="flex items-start justify-between gap-2 p-2.5 overflow-x-auto">
        <pre className="text-foreground/90 whitespace-pre leading-relaxed select-all">
          {content}
        </pre>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="size-7 shrink-0 cursor-pointer text-muted-foreground hover:bg-background hover:text-foreground"
          aria-label="复制代码"
        >
          {copied ? (
            <Check className="size-3.5 text-primary stroke-[2.5]" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}
