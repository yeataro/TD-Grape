// TD's compile log, read for its line numbers (Refactor.63). TD writes one error a line as
// "ERROR: <the pixel shader DAT>:<line>: <message>" (measured 2026-10-10, TD 2025.33230); the line counts in the GLSL
// we sent, from 1, the same as the core's source map. A line without a number stays as text.
// TD 的編譯紀錄，讀出行號。TD 每個錯誤一行「ERROR: <pixel shader DAT>:<行>: <訊息>」（實測）；行號從 1 開始、算的是我們送的
// GLSL，同核心的 sourceMap。沒有行號的照原文留著。
export type GlslError = { line: number; text: string };

const ERROR_LINE = /^ERROR:\s*\S*?:(\d+):\s*(.*)$/;

export function glslErrors(log: string): GlslError[] {
  return log.split(/\r?\n/).flatMap(raw => {
    const match = ERROR_LINE.exec(raw.trim());
    return match ? [{ line: Number(match[1]), text: match[2]!.trim() }] : [];
  });
}

/** The nodes that wrote a line TD reported (Refactor.63.6, a trial): only when `glsl` is the GLSL that failed, and only
 * lines the source map names exactly (legacy native_compile_diagnostics: never a guessed node). None gives null.
 * TD 回報的錯誤行是哪些節點寫的（試驗）：只在 glsl 就是失敗的那份時，只認 sourceMap 確定的行（舊產品：不猜節點）。沒有就是 null。 */
export function errorNodes(failure: { log: string; pixel: string } | undefined, glsl: string,
  lines: readonly { line: number; node: string }[]): ReadonlySet<string> | null {
  if (!failure || failure.pixel !== glsl) return null;
  const nodeOf = new Map(lines.map(row => [row.line, row.node]));
  const nodes = new Set(glslErrors(failure.log).flatMap(error => nodeOf.get(error.line) ?? []));
  return nodes.size ? nodes : null;
}
