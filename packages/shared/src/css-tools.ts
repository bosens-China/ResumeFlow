import * as prettier from "prettier/standalone";
import * as postcssPlugin from "prettier/plugins/postcss";

export interface CssValidationResult {
  valid: boolean;
  formatted: string;
  error: string | null;
  line?: number;
  column?: number;
}

export async function formatAndValidateCss(
  cssText: string,
): Promise<CssValidationResult> {
  const trimmed = cssText.trim();
  if (!trimmed) {
    return { valid: true, formatted: "", error: null };
  }

  try {
    const formatted = await prettier.format(trimmed, {
      parser: "css",
      plugins: [postcssPlugin],
      tabWidth: 2,
    });

    return {
      valid: true,
      formatted: formatted.trimEnd(),
      error: null,
    };
  } catch (err: unknown) {
    const error = err as {
      message?: string;
      loc?: { start?: { line?: number; column?: number } };
    };
    const line = error.loc?.start?.line;
    const col = error.loc?.start?.column;
    const rawMsg = error.message?.split("\n")[0] ?? "CSS 语法格式不正确";
    const cleanMsg = rawMsg.replace(/^CssSyntaxError:\s*/, "");
    const errorText =
      line && col ? `第 ${line} 行第 ${col} 列: ${cleanMsg}` : cleanMsg;

    return {
      valid: false,
      formatted: cssText,
      error: errorText,
      line,
      column: col,
    };
  }
}
