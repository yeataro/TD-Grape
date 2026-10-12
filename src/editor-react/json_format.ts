// The graph JSON laid out for reading (Refactor.102, human 2026-10-12): the saved document is one compact line, so the Graph JSON View
// lays it out only for showing — what is stored never changes. Short objects and arrays stay on one line, longer ones open one item
// a line, two spaces deeper. Walked level by level, so each line knows where in the graph it comes from (Refactor.102.1): which node
// it belongs to, whether it is a node's id or name, and its place, to tell what changed.
// 圖的 JSON 排成好讀的樣子（R.102，人類 10-12）：存的文件是緊湊的一行，Graph JSON View 只在顯示時排版，存的內容不變。短的物件與陣列
// 留在同一行，長的一項一行、往內縮兩格。一層一層走，所以每一行知道自己來自圖的哪裡（R.102.1）：屬於哪個節點、是不是節點的 id 或名字、
// 它的位置（用來看出改了什麼）。

/** One line holds at most this many characters, indent included, before it opens. 一行最多這麼多字（含縮排），超過才展開。 */
const WIDTH = 60;
const INDENT = '  ';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
/** What a value on a line leads to: a node, or a wire (Refactor.103). 一行裡的某個值帶到哪裡：一個節點，或一條接線（R.103）。 */
export type JsonTarget = { node: string } | { edge: string };
/** A laid-out line. `place`: where it is in the graph, the same for the same thing after an edit (an item with an id is placed by its
 * id, not its index, so removing one does not move the rest); `node`: the node whose object holds it; `links`: for each text value on
 * the line, in order, what it leads to (a node's id and name lead to the node; a wire's id to the wire, its `from` and `to` to their
 * nodes), or null. 排好的一行。place：在圖裡的位置，改過之後同一個東西還是同一個位置（有 id 的項目用 id 不用索引，刪掉一個不會讓後面的
 * 換位置）；node：包住它的節點物件；links：這一行每個文字值依序帶到哪裡（節點的 id 與名字帶到節點；接線的 id 帶到接線，from、to 帶到
 * 兩端的節點），或 null。 */
export type JsonLine = { text: string; place: string; node?: string; links?: (JsonTarget | null)[];
  /** The wire or declaration whose object holds it (Refactor.103). 包住它的接線或宣告物件（R.103）。 */
  edge?: string; declaration?: string };
type Owner = { node?: string; edge?: string; declaration?: string };

const isOpenable = (value: Json): value is Json[] | { [key: string]: Json } => typeof value === 'object' && value !== null;
const entriesOf = (value: Json[] | { [key: string]: Json }): [string | null, Json][] =>
  Array.isArray(value) ? value.map(item => [null, item]) : Object.entries(value);
const keyOf = (key: string | null) => key === null ? '' : JSON.stringify(key) + ': ';
const idOf = (value: Json) => isOpenable(value) && !Array.isArray(value) && typeof value.id === 'string' ? value.id : null;

/** The targets of the text values inside a value, in the order they are written. 一個值裡面的文字值，依寫出的順序各自帶到哪裡。 */
function targets(value: Json, path: readonly string[], out: (JsonTarget | null)[] = []): (JsonTarget | null)[] {
  if (typeof value === 'string') {
    const [stages, , list, item, key, end] = path, own = item?.startsWith('@') ? item.slice(1) : undefined;
    const target: JsonTarget | null = stages !== 'stages' || own === undefined ? null
      : list === 'nodes' && path.length === 5 && (key === 'id' || key === 'name') ? { node: own }
      : list === 'edges' && path.length === 5 && key === 'id' ? { edge: own }
      : list === 'edges' && path.length === 6 && (key === 'from' || key === 'to') && end === '#0' ? { node: value }
      : null;
    out.push(target);
  } else if (isOpenable(value)) entriesOf(value).forEach(([key, item], index) => targets(item, [...path, key ?? (idOf(item) !== null ? '@' + idOf(item) : '#' + index)], out));
  return out;
}

function oneLine(value: Json): string {
  if (!isOpenable(value)) return JSON.stringify(value);
  const items = entriesOf(value).map(([key, item]) => keyOf(key) + oneLine(item));
  if (Array.isArray(value)) return '[' + items.join(', ') + ']';
  return items.length ? '{ ' + items.join(', ') + ' }' : '{}';
}

/** `path`: the keys down to here; a canvas node is an item of `stages.<stage>.nodes`, a wire of `stages.<stage>.edges`, a declaration
 * of `declarations`. path：走到這裡的鍵；畫布上的節點是 stages.<stage>.nodes 的項目，接線是 stages.<stage>.edges 的，宣告是 declarations 的。 */
function lay(value: Json, indent: string, key: string | null, comma: string, path: readonly string[], owner: Owner, lines: JsonLine[]) {
  // The path written as JSON, so no key can run into another; an opening and a closing line get their own last step.
  // 路徑寫成 JSON，任何鍵都不會撞在一起；開頭與結尾的行各自多一步。
  const place = JSON.stringify(path), edge = (mark: string) => JSON.stringify([...path, mark]);
  const flat = indent + keyOf(key) + oneLine(value) + comma;
  if (!isOpenable(value) || flat.length <= WIDTH || !entriesOf(value).length) {
    const links = targets(value, path);
    lines.push({ text: flat, place, ...owner, ...(links.some(Boolean) ? { links } : {}) });
    return;
  }
  const items = entriesOf(value), [open, close] = Array.isArray(value) ? ['[', ']'] : ['{', '}'];
  const at = (line: { text: string; place: string }) => lines.push({ ...line, ...owner });
  at({ text: indent + keyOf(key) + open, place: edge('\u0001{') });
  const stageList = path.length === 3 && path[0] === 'stages' ? path[2] : path.length === 1 && path[0] === 'declarations' ? 'declarations' : null;
  const ownerOf = (item: Json): Owner => {
    const id = idOf(item) ?? undefined;
    return stageList === 'nodes' ? { node: id } : stageList === 'edges' ? { edge: id } : stageList === 'declarations' ? { declaration: id } : owner;
  };
  items.forEach(([childKey, item], index) => {
    // An item with an id is placed by it (@), others by their index (#): an id "3" is not the fourth item. 有 id 的項目用 id（@）、其他用
    // 索引（#）：id 是「3」不等於第四項。
    const step = childKey ?? (idOf(item) !== null ? '@' + idOf(item) : '#' + index);
    lay(item, indent + INDENT, childKey, index < items.length - 1 ? ',' : '', [...path, step], ownerOf(item), lines);
  });
  at({ text: indent + close + comma, place: edge('\u0001}') });
}

/** The value laid out for reading, line by line. 排成好讀的樣子，一行一行。 */
export function layJson(value: unknown): JsonLine[] {
  // Through JSON first, so what is shown is what is saved (undefined fields left out, as JSON.stringify does).
  // 先過一次 JSON，顯示的就是存下來的樣子（undefined 的欄位拿掉，同 JSON.stringify）。
  const text = JSON.stringify(value);
  if (text === undefined) return [];
  const lines: JsonLine[] = [];
  lay(JSON.parse(text) as Json, '', null, '', [], {}, lines);
  return lines;
}
/** The same as text; read as JSON it is the same value. 同上的文字；當 JSON 讀回來是同一個值。 */
export const formatJson = (value: unknown) => layJson(value).map(line => line.text).join('\n');

/** The lines that differ from before, by place: a place that is new, or whose text changed (a comma added or taken away does not
 * count — appending an item changes the line before it only by that). 和之前不同的行，照位置比：新的位置，或文字變了（只多或少一個逗號
 * 不算——在最後加一項時，前一行只差這個）。 */
export function changedLines(before: readonly JsonLine[], after: readonly JsonLine[]): Set<number> {
  const bare = (text: string) => text.endsWith(',') ? text.slice(0, -1) : text;
  const was = new Map(before.map(line => [line.place, bare(line.text)]));
  const changed = new Set<number>();
  after.forEach((line, index) => { if (was.get(line.place) !== bare(line.text)) changed.add(index); });
  return changed;
}

/** The lines that are gone, each with where it stood: before the line now at `at` (or at the end). Shown red for a moment and then
 * taken away (Refactor.103.2, human 2026-10-12: "turn red, then vanish" — a trial, to be taken back if it is not worth it).
 * 不見了的行，各自原本在哪：現在第 at 行之前（或最後）。先畫成紅色一下再拿掉（R.103.2，人類：「變紅後消失」——試做，不值得就退回）。 */
export function removedLines(before: readonly JsonLine[], after: readonly JsonLine[]): { at: number; line: JsonLine }[] {
  const now = new Map(after.map((line, index) => [line.place, index]));
  const gone: { at: number; line: JsonLine }[] = [];
  let at = 0;
  for (const line of before) {
    const index = now.get(line.place);
    if (index !== undefined) at = index + 1; else gone.push({ at, line });
  }
  return gone;
}
