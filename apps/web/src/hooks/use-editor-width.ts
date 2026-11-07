import { useRef, useState, type PointerEvent } from "react";
import { useLocalStorageState } from "ahooks";

export function useEditorWidth() {
  const [editorWidth = 520, setEditorWidth] = useLocalStorageState<number>(
    "resumeflow_editor_width",
    {
      defaultValue: () =>
        typeof window !== "undefined"
          ? Math.max(380, Math.min(window.innerWidth * 0.45, 600))
          : 520,
    },
  );
  const [isDragging, setIsDragging] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const handlePointerDown = (e: PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging || !mainRef.current) return;
    const rect = mainRef.current.getBoundingClientRect();
    const maxWidth = Math.max(320, rect.width - 876);
    setEditorWidth(Math.min(maxWidth, Math.max(320, e.clientX - rect.left)));
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  return {
    editorWidth,
    isDragging,
    mainRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
