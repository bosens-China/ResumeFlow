import { Link } from "@tanstack/react-router";
import { ResumeFlowLogo } from "./resume-flow-logo";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={`flex items-center gap-3 group select-none shrink-0 cursor-pointer ${className ?? ""}`}
      title="返回首页"
      aria-label="ResumeFlow 简流 - 返回首页"
    >
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs transition-transform group-hover:scale-105">
        <ResumeFlowLogo className="size-4.5" />
      </div>
      <div className="flex items-center gap-2">
        <span className="font-bold tracking-tight text-base">ResumeFlow</span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          简流
        </span>
      </div>
    </Link>
  );
}
