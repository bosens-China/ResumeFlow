import assert from "node:assert/strict";
import { test } from "vitest";
import { getResumePageCss } from "@resumeflow/shared/resume-css";

test("line-height relaxed range (0.6x to 1.8x) correctly generates CSS variables and body styles", () => {
  // 1. 紧凑极限值 0.60x
  const tightCss = getResumePageCss({ lineHeight: 0.6 });
  assert.ok(tightCss.includes("--rf-line-height-ratio: 0.6;"));
  assert.ok(tightCss.includes("--rf-spacing-ratio: 0.6;"));
  assert.ok(tightCss.includes("font: 10pt/0.900"));

  // 2. 默认值 1.00x
  const normalCss = getResumePageCss({ lineHeight: 1.0 });
  assert.ok(normalCss.includes("--rf-line-height-ratio: 1;"));
  assert.ok(normalCss.includes("--rf-spacing-ratio: 1;"));
  assert.ok(tightCss.includes("font: 10pt/"));

  // 3. 舒展大间距 1.80x（用于单页少内容撑满）
  const relaxedCss = getResumePageCss({ lineHeight: 1.8 });
  assert.ok(relaxedCss.includes("--rf-line-height-ratio: 1.8;"));
  assert.ok(relaxedCss.includes("--rf-spacing-ratio: 1.8;"));
  assert.ok(relaxedCss.includes("font: 10pt/2.700"));
});

test("page margin custom values and presets apply to @page correctly", () => {
  // 1. 单边距预设
  const presetCss = getResumePageCss({ margin: "14mm" });
  assert.ok(presetCss.includes("@page { size: A4; margin: 14mm; }"));

  // 2. 上下与左右独立边距
  const splitCss = getResumePageCss({ margin: "16mm 12mm" });
  assert.ok(splitCss.includes("@page { size: A4; margin: 16mm 12mm; }"));
});
