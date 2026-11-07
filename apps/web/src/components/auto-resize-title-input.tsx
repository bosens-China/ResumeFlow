import { cn } from "@/lib/utils";

/**
 * 宽度随内容实时自适应的内联输入框
 * 原理：通过同单元格的隐形镜像 span 撑开 grid 容器，让真实 input 的宽度 100% 像素级贴合文字长度
 */
export function AutoResizeTitleInput({
  value,
  placeholder,
  onChange,
  onBlur,
  onKeyDown,
  className,
}: {
  value: string;
  placeholder?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
}) {
  return (
    <div className="inline-grid grid-cols-[minmax(0,1fr)] items-center max-w-[560px] min-w-[80px]">
      {/* 隐形镜像文本：严格保持与 input 一致的字号字重、内边距与边框，附加安全缓冲防止汉字末尾笔画被裁剪 */}
      <span
        aria-hidden="true"
        className="invisible col-start-1 row-start-1 whitespace-pre pl-2 pr-4 py-1 text-sm font-semibold border border-transparent select-none pointer-events-none"
      >
        {value ? `${value} ` : placeholder || " "}
      </span>

      {/* 真实输入框：绝对铺满镜像撑开的实际宽度 */}
      <input
        type="text"
        size={1}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label="简历名称"
        className={cn(
          "col-start-1 row-start-1 w-full rounded-md border border-transparent bg-transparent pl-2 pr-4 py-1 text-sm font-semibold shadow-none transition-colors",
          "hover:bg-muted/50 focus-visible:border-input focus-visible:bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          className,
        )}
      />
    </div>
  );
}
