// The Markdown engine's reading half (Refactor.100; human 2026-10-12: group text and later Notes take basic Markdown, a small engine
// of our own, kept apart). A deliberately small part of Markdown, as legacy's notes (inspector.js:963-1015, the rules followed, the
// code written anew): headings, paragraphs (a line break stays a break), bulleted and numbered lists, fenced code blocks (with a
// language, e.g. glsl), and inline code, bold, italic and links (http, https and mailto only). Never HTML: what it gives is a plain
// structure, drawn by Markdown.tsx. Pure, no DOM (its own name: on Windows it cannot differ from Markdown.tsx by case only). Markdown 引擎的「讀」那一半（R.100；人類 10-12：群組內文與之後的 Note 支援基本
// Markdown，自己做的小引擎、獨立出來）。刻意只支援一小部分，照舊產品的註記（規則照做、程式重寫）：標題、段落（換行保持換行）、項目與編號清單、
// 程式碼塊（可標語言，例如 glsl）、行內程式碼、粗體、斜體、連結（只接受 http、https、mailto）。永遠不是 HTML：給出的是單純的結構，由
// Markdown.tsx 畫。純函式，不碰畫面。

export type Inline =
  | { kind: 'text'; text: string } | { kind: 'code'; text: string } | { kind: 'strong'; text: string } | { kind: 'em'; text: string }
  | { kind: 'link'; text: string; href: string };
export type Block =
  | { kind: 'heading'; level: number; content: Inline[] }
  | { kind: 'paragraph'; lines: Inline[][] }
  | { kind: 'list'; ordered: boolean; start: number; items: Inline[][] }
  | { kind: 'code'; language: string; source: string };

const INLINE = /`([^`\n]+)`|\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g;
/** A link only to the web or mail; anything else stays as written. 只連到網頁或郵件；其他照原文。 */
function safeLink(href: string): string | null {
  if (!/^(?:https?:\/\/|mailto:)/i.test(href)) return null;
  try { const url = new URL(href); return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export function parseInline(value: string): Inline[] {
  const out: Inline[] = [];
  let at = 0;
  const text = (to: number) => { if (to > at) out.push({ kind: 'text', text: value.slice(at, to) }); };
  for (const match of value.matchAll(INLINE)) {
    text(match.index!);
    if (match[1] !== undefined) out.push({ kind: 'code', text: match[1] });
    else if (match[2] !== undefined) { const href = safeLink(match[3]!); out.push(href ? { kind: 'link', text: match[2], href } : { kind: 'text', text: match[0] }); }
    else if (match[4] !== undefined) out.push({ kind: 'strong', text: match[4] });
    else out.push({ kind: 'em', text: match[5]! });
    at = match.index! + match[0].length;
  }
  text(value.length);
  return out;
}

const fence = (line: string) => /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
const heading = (line: string) => /^ {0,3}(#{1,6})\s+(.+)$/.exec(line);
const listItem = (line: string) => /^ {0,3}(?:([-+*])|([0-9]{1,9})[.)])\s+(.+)$/.exec(line);
const startsBlock = (line: string) => !!(fence(line) || heading(line) || listItem(line));

export function parseMarkdown(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n'), blocks: Block[] = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i]!;
    if (!line.trim()) { i++; continue; }
    const opened = fence(line), title = heading(line), item = listItem(line);
    if (opened) {
      // Closed by the same mark, at least as long, with nothing after it; an unclosed block runs to the end. 用同一種、至少一樣長、
      // 後面沒有字的記號結束；沒結束就到最後。
      const source: string[] = [];
      for (i++; i < lines.length; i++) {
        const close = fence(lines[i]!);
        if (close && close[1]![0] === opened[1]![0] && close[1]!.length >= opened[1]!.length && !close[2]!.trim()) { i++; break; }
        source.push(lines[i]!);
      }
      blocks.push({ kind: 'code', language: opened[2]!.trim().toLowerCase(), source: source.join('\n') });
    } else if (title) {
      blocks.push({ kind: 'heading', level: title[1]!.length, content: parseInline(title[2]!) }); i++;
    } else if (item) {
      const ordered = item[2] !== undefined, items: Inline[][] = [];
      for (; i < lines.length; i++) { const next = listItem(lines[i]!); if (!next || (next[2] !== undefined) !== ordered) break; items.push(parseInline(next[3]!)); }
      blocks.push({ kind: 'list', ordered, start: ordered ? Number(item[2]) : 1, items });
    } else {
      const paragraph: Inline[][] = [parseInline(lines[i++]!)];
      while (i < lines.length && lines[i]!.trim() && !startsBlock(lines[i]!)) paragraph.push(parseInline(lines[i++]!));
      blocks.push({ kind: 'paragraph', lines: paragraph });
    }
  }
  return blocks;
}
