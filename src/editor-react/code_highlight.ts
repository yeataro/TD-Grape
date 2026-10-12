import Prism from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-glsl';
import 'prismjs/components/prism-json';

// Code colouring, one for the editor: GLSL for the GLSL panel and the Markdown GLSL blocks (Refactor.100: moved here unchanged from
// GlslPanel.tsx), JSON for the Graph JSON View (Refactor.102). Only Prism's core and the C-like, C, GLSL and JSON grammars are loaded.
// 程式碼上色，編輯器只有一份：GLSL 給 GLSL 面板與 Markdown 的 GLSL 程式碼塊（R.100：從 GlslPanel.tsx 原樣搬來），JSON 給 Graph JSON View
// （R.102）。只載 Prism 的核心與類 C、C、GLSL、JSON 規則。
// Prism's token kinds, shown in the legacy GLSL colours (legacy style.css:480; Refactor.63, human 2026-10-10: a light
// library, not our own highlighter). Prism counts types as keywords; a keyword that is a type by the legacy list
// (legacy app.js:1624) takes the type colour again (Refactor.63.5, human: layout and vec4 looked the same).
// Prism 的 token 種類，用舊產品的 GLSL 顏色（人類：用輕量的程式庫，不自己維護上色）。Prism 把型別算進關鍵字；照舊產品的
// 型別清單是型別的關鍵字，改回型別色（63.5，人類：layout 和 vec4 同色看起來怪）。
const KINDS: Record<string, string> = { comment: 'comment', macro: 'directive', directive: 'directive', string: 'string',
  char: 'string', number: 'number', boolean: 'number', keyword: 'keyword', function: 'function', constant: 'builtin',
  'class-name': 'type' };
const TYPES = /^(?:void|bool|int|uint|float|double|atomic_uint|[biud]?vec[234]|d?mat[234](?:x[234])?|[iu]?(?:sampler|image)(?:1D|2D|3D|Cube|2DRect|Buffer)(?:MS)?(?:Array)?(?:Shadow)?)$/;
const kindOf = (token: Prism.Token, outer?: string) => token.type === 'keyword' && typeof token.content === 'string' && TYPES.test(token.content)
  ? 'type' : KINDS[token.type] ?? outer;
export type Piece = { text: string; kind?: string };

/** The GLSL split into lines of coloured pieces; a token running over lines (a block comment) is cut at each line.
 * GLSL 切成一行行有顏色的片段；跨行的 token（區塊註解）在換行處切開。 */
export const highlightGlsl = (source: string) => lines(source, Prism.languages.glsl!, kindOf);

// JSON in the same colours (Refactor.102): keys as functions, text as strings, numbers as directives, true, false and null as types;
// punctuation plain. Numbers do not take the number colour, which sits too near the string one (human 2026-10-12: text and numbers
// were not far enough apart). JSON 用同一組顏色（R.102）：鍵名用函式色、字串用字串色、數字用指令色、true／false／null 用型別色；標點
// 不上色。數字不用數字色——它和字串色太近（人類 10-12：文字和數字拉得不夠開）。
const JSON_KINDS: Record<string, string> = { property: 'function', string: 'string', number: 'directive', boolean: 'type', null: 'type' };
/** JSON text split into lines of coloured pieces. JSON 文字切成一行行有顏色的片段。 */
export const highlightJson = (source: string) => lines(source, Prism.languages.json!, (token, outer) => JSON_KINDS[token.type] ?? outer);

function lines(source: string, grammar: Prism.Grammar, kindOf: (token: Prism.Token, outer?: string) => string | undefined): Piece[][] {
  const pieces: Piece[] = [];
  const walk = (stream: Prism.TokenStream, kind?: string) => {
    if (typeof stream === 'string') pieces.push({ text: stream, kind });
    else if (Array.isArray(stream)) stream.forEach(item => walk(item, kind));
    else walk(stream.content, kindOf(stream, kind));
  };
  walk(Prism.tokenize(source, grammar));
  const lines: Piece[][] = [[]];
  for (const piece of pieces) {
    piece.text.split('\n').forEach((text, index) => {
      if (index) lines.push([]);
      if (text) lines[lines.length - 1]!.push({ text, kind: piece.kind });
    });
  }
  return lines;
}
