export interface PreviewSlice {
  start: number;
  end: number;
}

/** 在连续排版中找断点，不改变正文 DOM；也供只需要页数的卡片使用。 */
export function paginatePreview(
  root: HTMLElement,
  pageHeight: number,
): PreviewSlice[] {
  if (!Number.isFinite(pageHeight) || pageHeight < 1)
    throw new Error("页边距过大，纸张没有可用内容区域");
  const origin = root.getBoundingClientRect().top;
  const height = Math.max(
    root.getBoundingClientRect().height,
    root.scrollHeight,
  );
  const blocks: { element: Element; top: number; bottom: number }[] = [];
  const keep: { top: number; bottom: number }[] = [];
  const forced: number[] = [];
  const bounds = (element: Element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top - origin, bottom: rect.bottom - origin };
  };
  const isForced = (value: string) =>
    /^(page|always|left|right|recto|verso)$/.test(value);

  function visit(element: Element) {
    const box = bounds(element);
    const style = getComputedStyle(element);
    if (style.display === "none") return;
    if (isForced(style.breakBefore)) forced.push(box.top);
    if (isForced(style.breakAfter)) forced.push(box.bottom);
    if (box.bottom <= box.top) return;
    const atomic =
      element.matches("p,li,pre,img,tr,hr,h1,h2,h3,h4,h5,h6,.rf-row") ||
      style.breakInside.startsWith("avoid") ||
      !element.children.length;
    if (atomic) {
      blocks.push({ element, ...box });
      if (box.bottom - box.top <= pageHeight) keep.push(box);
    } else {
      for (const child of element.children) visit(child);
    }
    if (element.matches("h1,h2,h3,h4,h5,h6") && element.nextElementSibling) {
      const next = element.nextElementSibling;
      const nextBox = bounds(next);
      const nextStyle = getComputedStyle(next);
      const line =
        Number.parseFloat(nextStyle.lineHeight) ||
        Number.parseFloat(nextStyle.fontSize) * 1.5;
      const bottom = Math.min(nextBox.bottom, nextBox.top + line * 2);
      if (bottom - box.top <= pageHeight) keep.push({ top: box.top, bottom });
    }
  }
  for (const child of root.children) visit(child);
  forced.sort((a, b) => a - b);

  const lines = new Map<Element, { top: number; bottom: number }[]>();
  function getLines(element: Element) {
    const cached = lines.get(element);
    if (cached) return cached;
    const result: { top: number; bottom: number }[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent?.trim()) continue;
      range.selectNodeContents(walker.currentNode);
      for (const rect of range.getClientRects()) {
        if (rect.height > 0 && rect.width > 0)
          result.push({ top: rect.top - origin, bottom: rect.bottom - origin });
      }
    }
    for (const image of element.querySelectorAll("img"))
      result.push(bounds(image));
    lines.set(element, result);
    return result;
  }

  function retreat(cut: number, spans: { top: number; bottom: number }[]) {
    let previous: number;
    do {
      previous = cut;
      for (const span of spans)
        if (span.top < cut - 0.01 && span.bottom > cut + 0.01)
          cut = Math.min(cut, span.top);
    } while (cut < previous);
    return cut;
  }

  const pages: PreviewSlice[] = [];
  let start = 0;
  while (start < height - 0.5) {
    const limit = Math.min(start + pageHeight, height);
    const explicit = forced.find(
      (point) => point > start + 0.5 && point <= limit,
    );
    let end = explicit ?? limit;
    if (end < height && explicit === undefined) {
      end = retreat(end, keep);
      if (end <= start + 0.5) end = limit;
      // 文字矩形可能超出行框，也检查恰好接触断点的块。
      const crossing = blocks.filter(
        (block) => block.top <= end && block.bottom >= end,
      );
      const ink = crossing.flatMap((block) => getLines(block.element));
      const safe = retreat(end, ink);
      if (safe > start + 0.5) end = safe;
      // shortcut: 高于整页的单张图片或无共同断点的复杂定位按页裁切，需此类模板时再扩展。
    }
    pages.push({ start, end });
    start = end;
  }
  return pages.length ? pages : [{ start: 0, end: 0 }];
}
