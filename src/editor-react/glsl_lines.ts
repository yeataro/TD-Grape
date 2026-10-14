import type { Piece } from './code_highlight';
import type { GlslLine } from './editor';
import type { Compiled } from './host_sync';

/** Which node wrote each line of the GLSL (the core's source map, lines from 1), so a line leads to its node (Refactor.63). One
 * list per compiled program, worked out when first asked — by the GLSL panel or the error-line trial — and never on a commit
 * (Refactor.107, Z1); the same program object gives the same list, so what is memoised on it keeps. GLSL 每一行由哪個節點產生（核心的
 * sourceMap，行號從 1），讓一行能找回它的節點（R.63）。每份程式一份清單，第一次被問時才算——GLSL 面板或錯誤行試驗問——commit 不算
 * （R.107，Z1）；同一個程式物件給同一份清單，靠它 memo 的東西就留著。 */
const NO_LINES: readonly GlslLine[] = [];
const lineMaps = new WeakMap<Compiled, readonly GlslLine[]>();
export function glslMapOf(compiled: Compiled | null): readonly GlslLine[] {
  if (!compiled) return NO_LINES;
  let map = lineMaps.get(compiled);
  if (!map) lineMaps.set(compiled, map = compiled.sourceMap.pixel.map(row => ({ line: row.line, node: row.node, ...(row.trail.length ? { trail: [...row.trail] } : {}) })));
  return map;
}

/** Where a node is (technical review TECH-6): its ID and the subgraph path to its network, as one key, `trail/…/node`; a node at
 * the stage is its ID alone. IDs never hold '/', so the key reads back exactly. The GLSL's links, lines and error marks use it, so
 * two nodes with the same ID in different networks stay apart. 節點在哪裡：它的 ID 與到它所在網路的子圖路徑，合成一把鍵；stage 上的
 * 節點就是 ID 本身。ID 不含「/」，所以讀得回來。GLSL 的連結、行與錯誤標記都用它，不同網路裡同 ID 的節點才分得開。 */
export const placeKey = (node: string, trail: readonly string[] = []) => trail.length ? [...trail, node].join('/') : node;
export const placeOf = (key: string): { node: string; trail: string[] } => { const parts = key.split('/'); return { node: parts.pop()!, trail: parts }; };

/** Each variable's node as a place key, once per compiled program (the panel memoises on it). 每個變數的節點位置鍵，每份程式一份。 */
const variableMaps = new WeakMap<Compiled, Readonly<Record<string, string>>>();
const NO_VARIABLES: Readonly<Record<string, string>> = {};
export function variablePlaces(compiled: Compiled | null | undefined): Readonly<Record<string, string>> {
  if (!compiled) return NO_VARIABLES;
  let places = variableMaps.get(compiled);
  if (!places) {
    const trails = 'variableTrails' in compiled.sourceMap ? compiled.sourceMap.variableTrails ?? {} : {};
    variableMaps.set(compiled, places = Object.fromEntries(Object.entries(compiled.sourceMap.variables).map(([name, node]) => [name, placeKey(node, trails[name])])));
  }
  return places;
}

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
  const nodeOf = new Map(map.map(row => [row.line, placeKey(row.node, row.trail)]));
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
