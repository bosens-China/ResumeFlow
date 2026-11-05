import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { FileText, LayoutTemplate } from "lucide-react";
import { BrandLogo } from "./brand-logo";

export function HomeHeader({ action }: { action?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b bg-background/95 backdrop-blur-sm px-6">
      <div className="flex items-center gap-6">
        <BrandLogo />

        {/* 顶部 Tab 导航：在「我的简历」与「模板中心」之间无缝切换 */}
        <nav
          className="flex items-center gap-1 rounded-lg bg-muted/60 p-1 text-xs font-medium"
          aria-label="主要导航"
        >
          <Link
            to="/"
            activeOptions={{ exact: true }}
            activeProps={{
              className:
                "bg-background text-foreground shadow-xs font-semibold",
            }}
            inactiveProps={{
              className:
                "text-muted-foreground hover:text-foreground hover:bg-background/40",
            }}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all"
          >
            <FileText className="size-3.5" />
            我的简历
          </Link>
          <Link
            to="/templates"
            activeProps={{
              className:
                "bg-background text-foreground shadow-xs font-semibold",
            }}
            inactiveProps={{
              className:
                "text-muted-foreground hover:text-foreground hover:bg-background/40",
            }}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all"
          >
            <LayoutTemplate className="size-3.5" />
            模板中心
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-3">{action}</div>
    </header>
  );
}
