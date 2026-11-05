import { useState, useEffect, useRef } from "react";
import { Bot, ExternalLink, MessageSquare, Sparkles, Tag } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AiIntegrationDialog } from "@/components/ai-integration-dialog";

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="size-3.5"
      aria-hidden="true"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

const STORAGE_KEY = "resumeflow_help_menu_pos";
const GITHUB_REPO_URL = "https://github.com/bosens-China/ResumeFlow";
const GITHUB_ISSUES_URL = "https://github.com/bosens-China/ResumeFlow/issues";

interface MenuPos {
  x: number;
  y: number;
}

function getInitialMenuPos(): MenuPos {
  if (typeof window === "undefined") {
    return { x: 0, y: 0 };
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as MenuPos;
      if (typeof parsed.x === "number" && typeof parsed.y === "number") {
        const maxX = Math.max(12, window.innerWidth - 48);
        const maxY = Math.max(12, window.innerHeight - 48);
        return {
          x: Math.min(maxX, Math.max(12, parsed.x)),
          y: Math.min(maxY, Math.max(12, parsed.y)),
        };
      }
    }
  } catch {
    // Ignore JSON error
  }
  return {
    x: window.innerWidth - 56,
    y: window.innerHeight - 56,
  };
}

export function GlobalHelpMenu() {
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [pos, setPos] = useState<MenuPos>(getInitialMenuPos);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const hasMovedRef = useRef(false);

  useEffect(() => {
    function handleResize() {
      setPos((prev) => {
        const maxX = Math.max(12, window.innerWidth - 48);
        const maxY = Math.max(12, window.innerHeight - 48);
        return {
          x: Math.min(maxX, Math.max(12, prev.x)),
          y: Math.min(maxY, Math.max(12, prev.y)),
        };
      });
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      originX: pos.x,
      originY: pos.y,
    };
    hasMovedRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.pointerX;
    const dy = e.clientY - dragStartRef.current.pointerY;
    if (!hasMovedRef.current && Math.hypot(dx, dy) > 4) {
      hasMovedRef.current = true;
      setIsDragging(true);
    }
    if (hasMovedRef.current) {
      const maxX = Math.max(12, window.innerWidth - 48);
      const maxY = Math.max(12, window.innerHeight - 48);
      const newX = Math.min(
        maxX,
        Math.max(12, dragStartRef.current.originX + dx),
      );
      const newY = Math.min(
        maxY,
        Math.max(12, dragStartRef.current.originY + dy),
      );
      setPos({ x: newX, y: newY });
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragStartRef.current) return;
    const moved = hasMovedRef.current;
    dragStartRef.current = null;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    if (moved) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    }
  }

  return (
    <>
      <div
        style={{ position: "fixed", left: `${pos.x}px`, top: `${pos.y}px` }}
        className="z-40 touch-none select-none"
      >
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onClick={(e) => {
                if (hasMovedRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  hasMovedRef.current = false;
                } else {
                  setMenuOpen((open) => !open);
                }
              }}
              className={cn(
                "size-9 rounded-full border border-border/80 bg-background/90 shadow-md backdrop-blur-md transition-shadow select-none",
                isDragging
                  ? "cursor-grabbing shadow-xl scale-105"
                  : "cursor-grab hover:scale-105 hover:bg-accent hover:shadow-lg",
              )}
              aria-label="帮助、反馈与 AI 接入 (可拖拽)"
              title="点击打开菜单，可自由拖拽位置"
            >
              <Sparkles className="size-4 text-foreground/80 pointer-events-none" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-56 p-2 space-y-1 shadow-lg"
          >
            <DropdownMenuItem
              onClick={() => window.open(GITHUB_REPO_URL, "_blank")}
              className="gap-3 px-2.5 py-2 text-xs cursor-pointer"
            >
              <GithubIcon className="size-3.5 text-muted-foreground" />
              <span>GitHub 仓库</span>
              <ExternalLink className="ml-auto size-3 opacity-50" />
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => window.open(GITHUB_ISSUES_URL, "_blank")}
              className="gap-3 px-2.5 py-2 text-xs cursor-pointer"
            >
              <MessageSquare className="size-3.5 text-muted-foreground" />
              <span>问题反馈 (Issues)</span>
              <ExternalLink className="ml-auto size-3 opacity-50" />
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => setAiModalOpen(true)}
              className="gap-3 px-2.5 py-2 text-xs cursor-pointer"
            >
              <Bot className="size-3.5 text-muted-foreground" />
              <span>接入 AI (Skills + MCP)</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1.5" />

            <div className="flex items-center justify-between px-2.5 py-1.5 text-[11px] text-muted-foreground select-none">
              <span className="flex items-center gap-1.5">
                <Tag className="size-3 opacity-60" />
                <span>版本号</span>
              </span>
              <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-foreground/80">
                v{__APP_VERSION__}
              </span>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AiIntegrationDialog open={aiModalOpen} onOpenChange={setAiModalOpen} />
    </>
  );
}
