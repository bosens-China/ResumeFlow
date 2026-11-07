import { Link } from "@tanstack/react-router";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={`flex items-center gap-3 select-none shrink-0 cursor-pointer ${className ?? ""}`}
      title="返回首页"
      aria-label="ResumeFlow 简流 - 返回首页"
    >
      <img
        src="/favicon.svg"
        alt=""
        className="size-8 rounded-lg shadow-xs shadow-blue-500/25"
      />
      <div className="flex items-center gap-2">
        <span className="font-bold tracking-tight text-base">ResumeFlow</span>
        <span className="rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40 px-1.5 py-0.5 text-[11px] font-medium">
          简流
        </span>
      </div>
    </Link>
  );
}
