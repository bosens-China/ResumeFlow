import { useRef } from "react";
import { useSize } from "ahooks";
import { AlertCircle } from "lucide-react";
import {
  useResumePreview,
  type ResumePreviewOptions,
} from "@/hooks/use-resume-preview";
import { PREVIEW_WIDTH } from "@/lib/preview-document";
import { ScrollArea } from "@/components/ui/scroll-area";

export type { PreviewStatus } from "@/hooks/use-resume-preview";

export function ResumePreview(options: ResumePreviewOptions) {
  const container = useRef<HTMLDivElement>(null);
  const iframe = useRef<HTMLIFrameElement>(null);
  const size = useSize(container);
  const preview = useResumePreview(options, iframe);
  const scale = Math.min(
    1,
    Math.max(1, (size?.width ?? PREVIEW_WIDTH) - 24) / PREVIEW_WIDTH,
  );

  return (
    <ScrollArea
      ref={container}
      className="relative h-full bg-muted/50"
      viewportClassName="py-6"
      aria-busy={!preview.ready && !preview.error}
    >
      {preview.error && (
        <div
          role="alert"
          className="sticky top-2 z-10 mx-auto mb-4 flex max-w-lg items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 shadow-sm"
        >
          <AlertCircle className="size-4 shrink-0" />
          {preview.error}
          <button
            type="button"
            className="ml-auto underline"
            onClick={preview.retryPreview}
          >
            重试预览
          </button>
        </div>
      )}
      <div
        className="relative mx-auto"
        style={{ width: PREVIEW_WIDTH * scale, height: preview.height * scale }}
      >
        <iframe
          key={preview.retry}
          ref={iframe}
          title="简历分页预览"
          srcDoc={preview.doc}
          sandbox="allow-scripts"
          aria-hidden="false"
          className="absolute left-0 top-0 border-0 origin-top-left"
          style={{
            width: PREVIEW_WIDTH,
            height: preview.height,
            transform: `scale(${scale})`,
          }}
        />
      </div>
    </ScrollArea>
  );
}
