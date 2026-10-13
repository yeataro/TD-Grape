import type { Piece } from './code_highlight';
import type { GlslLine } from './editor';

// The GLSL panel's lines, worked out once per GLSL (Refactor.106 H): each line's coloured pieces with the names in its plain text
// made links, and the node that wrote it; plus, for each node, the lines whose look depends on whether that node is traced (its own
// lines, and the lines where one of its variables is named). A primary change then re-draws only those lines.
// GLSL 面板的行，每份 GLSL 只算一次（R.106 H）：每一行有顏色的片段、純文字裡的名字變成連結、產生它的節點；再加上每個節點「被追蹤與否
// 會改變外觀」的行（它自己的行，以及寫到它某個變數的行）。換主要選取時只重畫這些行。

/** A name in the GLSL that leads somewhere: a node's variable, or a declaration (Refactor.63.4). GLSL 裡能帶到別處的名字：節點的
 * 變數，或宣告。 */
export type GlslName = { text: string; node: string } | { text: string; declaration: string };
/** A coloured piece, or plain text cut around the names in it. 有顏色的片段，或在名字處切開的純文字。 */
export type GlslPiece = Piece | { linked: readonly (string | GlslName)[] };
export type GlslRow = { node?: string; pieces: readonly GlslPiece[] };

// The names are GLSL identifiers (word characters only), so a name is found as a whole word looked up in the two tables, the same
// as the old `\b(name|…)\b` but once per word instead of once per name. 名字都是 GLSL 識別字（只有字元），所以照整個字去兩張表查，
// 結果同以前的 `\b(名字|…)\b`，但每個字查一次，不是每個名字掃一次。
const WORD = /\w+/g;

/** `lines`: the highlighted GLSL (highlightGlsl); `map`: which node wrote each line (from 1). lines：上好色的 GLSL；map：每一行
 * 由哪個節點產生（行號從 1）。 */
export function glslRows(lines: readonly (readonly Piece[])[], map: readonly GlslLine[], variables: Readonly<Record<string, string>>,
  declarations: Readonly<Record<string, string>>): { rows: GlslRow[]; touching: Map<string, number[]> } {
  const nodeOf = new Map(map.map(row => [row.line, row.node]));
  const touching = new Map<string, number[]>();
  const touch = (node: string, index: number) => {
    const list = touching.get(node);
    if (!list) touching.set(node, [index]); else if (list[list.length - 1] !== index) list.push(index);
  };
  const linked = (piece: Piece, index: number): GlslPiece => {
    const parts: (string | GlslName)[] = [];
    let from = 0;
    for (const match of piece.text.matchAll(WORD)) {
      const word = match[0], at = match.index!;
      const name: GlslName | null = Object.hasOwn(variables, word) ? { text: word, node: variables[word]! }
        : Object.hasOwn(declarations, word) ? { text: word, declaration: declarations[word]! } : null;
      if (!name) continue;
      if (at > from) parts.push(piece.text.slice(from, at));
      parts.push(name); from = at + word.length;
      if ('node' in name) touch(name.node, index);
    }
    if (!parts.length) return piece;
    if (from < piece.text.length) parts.push(piece.text.slice(from));
    return { linked: parts };
  };
  const rows = lines.map((pieces, index): GlslRow => {
    const node = nodeOf.get(index + 1);
    if (node !== undefined) touch(node, index);
    return { node, pieces: pieces.map(piece => piece.kind ? piece : linked(piece, index)) };
  });
  return { rows, touching };
}
