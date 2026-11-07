import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "vitest";
import { renderMarkdown } from "@resumeflow/shared";
import { getResumePageCss } from "@resumeflow/shared/resume-css";

const require = createRequire(
  new URL("../../server/package.json", import.meta.url),
);
const { chromium } = require("playwright") as typeof import("playwright");

test("头像栏只占图片宽度，普通两栏仍然平分", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const html = renderMarkdown(`::::row{columns="1fr auto"}
:::cell
# 候选人

联系方式
:::
:::cell
![头像](https://example.com/avatar.png)
:::
::::

## 工作经历

::::row
:::cell
公司
:::
:::cell
日期
:::
::::

::::row{columns="1fr auto 1fr"}
:::cell
很长的公司名称
:::
:::cell{align="center"}
职位
:::
:::cell{align="right"}
日期
:::
::::`);
    await page.setContent(
      `<style>${getResumePageCss()} body { width: 180mm; }</style>${html}`,
    );
    const widths = await page
      .locator(".rf-row")
      .evaluateAll((rows) =>
        rows.map((row) =>
          [...row.children].map((cell) => cell.getBoundingClientRect().width),
        ),
      );
    assert.ok(widths[0]![0]! > widths[0]![1]! * 4);
    assert.ok(Math.abs(widths[0]![1]! - (24 * 96) / 25.4) < 3);
    assert.ok(Math.abs(widths[1]![0]! - widths[1]![1]!) < 1);
    assert.ok(Math.abs(widths[2]![0]! - widths[2]![2]!) < 1);
  } finally {
    await browser.close();
  }
});
