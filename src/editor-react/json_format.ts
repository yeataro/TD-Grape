// The graph JSON laid out for reading (Refactor.102, human 2026-10-12): the saved document is one compact line, so the Graph JSON View
// lays it out only for showing — what is stored never changes. Short objects and arrays stay on one line, longer ones open one item
// a line, two spaces deeper. Walked level by level, so folding can later note where each one opens and closes (not wanted now).
// 圖的 JSON 排成好讀的樣子（R.102，人類 10-12）：存的文件是緊湊的一行，Graph JSON View 只在顯示時排版，存的內容不變。短的物件與陣列
// 留在同一行，長的一項一行、往內縮兩格。一層一層走，之後要摺疊可以順便記下每一層從哪裡開始、到哪裡結束（現在不要）。

/** One line holds at most this many characters, indent included, before it opens. 一行最多這麼多字（含縮排），超過才展開。 */
const WIDTH = 60;
const INDENT = '  ';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
const isOpenable = (value: Json): value is Json[] | { [key: string]: Json } => typeof value === 'object' && value !== null;
const entriesOf = (value: Json[] | { [key: string]: Json }): [string | null, Json][] =>
  Array.isArray(value) ? value.map(item => [null, item]) : Object.entries(value);
const keyOf = (key: string | null) => key === null ? '' : JSON.stringify(key) + ': ';

function oneLine(value: Json): string {
  if (!isOpenable(value)) return JSON.stringify(value);
  const items = entriesOf(value).map(([key, item]) => keyOf(key) + oneLine(item));
  if (Array.isArray(value)) return '[' + items.join(', ') + ']';
  return items.length ? '{ ' + items.join(', ') + ' }' : '{}';
}

function lay(value: Json, indent: string, key: string | null, comma: string, lines: string[]) {
  const flat = indent + keyOf(key) + oneLine(value) + comma;
  if (!isOpenable(value) || flat.length <= WIDTH || !entriesOf(value).length) { lines.push(flat); return; }
  const items = entriesOf(value), [open, close] = Array.isArray(value) ? ['[', ']'] : ['{', '}'];
  lines.push(indent + keyOf(key) + open);
  items.forEach(([childKey, item], index) => lay(item, indent + INDENT, childKey, index < items.length - 1 ? ',' : '', lines));
  lines.push(indent + close + comma);
}

/** The value as JSON text laid out for reading; read as JSON it is the same value. 排成好讀的 JSON 文字；當 JSON 讀回來是同一個值。 */
export function formatJson(value: unknown): string {
  // Through JSON first, so what is shown is what is saved (undefined fields left out, as JSON.stringify does).
  // 先過一次 JSON，顯示的就是存下來的樣子（undefined 的欄位拿掉，同 JSON.stringify）。
  const text = JSON.stringify(value);
  if (text === undefined) return '';
  const lines: string[] = [];
  lay(JSON.parse(text) as Json, '', null, '', lines);
  return lines.join('\n');
}
