import { useEffect } from "react";
import { getDocumentTitle } from "@/lib/constants";

export function useDocumentTitle(title?: string | null) {
  useEffect(() => {
    document.title = getDocumentTitle(title);
  }, [title]);
}
