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
/** A laid-out line. `place`: where it is in the graph, the same for the same thing after an edit (an item with an id is placed by its
 * id, not its index, so removing one does not move the rest); `node`: the node whose object holds it; `link`: the node its value
 * names, on a node's own id or name line. 排好的一行。place：在圖裡的位置，改過之後同一個東西還是同一個位置（有 id 的項目用 id 不用
 * 索引，刪掉一個不會讓後面的換位置）；node：包住它的節點物件；link：節點自己的 id 或名字那一行，值指向的節點。 */
export type JsonLine = { text: string; place: string; node?: string; link?: string };

const isOpenable = (value: Json): value is Json[] | { [key: string]: Json } => typeof value === 'object' && value !== null;
const entriesOf = (value: Json[] | { [key: string]: Json }): [string | null, Json][] =>
  Array.isArray(value) ? value.map(item => [null, item]) : Object.entries(value);
const keyOf = (key: string | null) => key === null ? '' : JSON.stringify(key) + ': ';
const idOf = (value: Json) => isOpenable(value) && !Array.isArray(value) && typeof value.id === 'string' ? value.id : null;

function oneLine(value: Json): string {
  if (!isOpenable(value)) return JSON.stringify(value);
  const items = entriesOf(value).map(([key, item]) => keyOf(key) + oneLine(item));
  if (Array.isArray(value)) return '[' + items.join(', ') + ']';
  return items.length ? '{ ' + items.join(', ') + ' }' : '{}';
}

/** `path`: the keys down to here; a canvas node is an item of `stages.<stage>.nodes`. path：走到這裡的鍵；畫布上的節點是
 * stages.<stage>.nodes 的項目。 */
function lay(value: Json, indent: string, key: string | null, comma: string, path: readonly string[], node: string | undefined, lines: JsonLine[]) {
  const place = path.join('\u0000');
  const flat = indent + keyOf(key) + oneLine(value) + comma;
  if (!isOpenable(value) || flat.length <= WIDTH || !entriesOf(value).length) {
    const link = node !== undefined && path.length === 5 && (key === 'id' || key === 'name') && typeof value === 'string' ? node : undefined;
    lines.push({ text: flat, place, ...(node !== undefined ? { node } : {}), ...(link !== undefined ? { link } : {}) });
    return;
  }
  const items = entriesOf(value), [open, close] = Array.isArray(value) ? ['[', ']'] : ['{', '}'];
  const at = (line: Omit<JsonLine, 'node'>) => lines.push(node !== undefined ? { ...line, node } : line);
  at({ text: indent + keyOf(key) + open, place: place + '\u0000{' });
  const canvas = path.length === 3 && path[0] === 'stages' && path[2] === 'nodes';
  items.forEach(([childKey, item], index) => {
    const step = childKey ?? '#' + (idOf(item) ?? index);
    lay(item, indent + INDENT, childKey, index < items.length - 1 ? ',' : '', [...path, step], canvas ? idOf(item) ?? undefined : node, lines);
  });
  at({ text: indent + close + comma, place: place + '\u0000}' });
}

/** The value laid out for reading, line by line. 排成好讀的樣子，一行一行。 */
export function layJson(value: unknown): JsonLine[] {
  // Through JSON first, so what is shown is what is saved (undefined fields left out, as JSON.stringify does).
  // 先過一次 JSON，顯示的就是存下來的樣子（undefined 的欄位拿掉，同 JSON.stringify）。
  const text = JSON.stringify(value);
  if (text === undefined) return [];
  const lines: JsonLine[] = [];
  lay(JSON.parse(text) as Json, '', null, '', [], undefined, lines);
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
