import type { SVGProps } from "react";

export function ResumeFlowLogo({
  className = "size-5",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-label="ResumeFlow Logo"
      {...props}
    >
      {/* 现代折角简历外框 */}
      <path d="M6 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5L14.5 3H6z" />
      <path d="M14 3v5.5H19.5" />
      {/* 简流 Flow 标志性流动双轨 */}
      <path d="M8 13c1.2-.8 2.6-.8 3.8 0 1.2.8 2.6.8 3.8 0" strokeWidth="1.8" />
      <path
        d="M8 16.5c1.2-.8 2.6-.8 3.8 0 1.2.8 2.6.8 3.8 0"
        strokeWidth="1.8"
      />
    </svg>
  );
}
