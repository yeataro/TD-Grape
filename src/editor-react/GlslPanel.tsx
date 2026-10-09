import { tr, say } from './text';

// The generated GLSL, read only (legacy GLSL tab). Syntax colours come later with the Markdown display
// (floating-panels.md 19). 產生的 GLSL，唯讀（舊產品 GLSL 分頁）。語法上色之後和 Markdown 顯示一起做。
export function GlslPanel({ glsl }: { glsl: string }) {
  return <pre className="code-view" aria-label={say(tr('glsl.label', 'Generated GLSL'))}>
    {glsl || say(tr('glsl.empty', 'The generated GLSL appears after the first apply.'))}</pre>;
}
