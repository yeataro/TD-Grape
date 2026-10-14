/** Node names (Refactor.76, human 2026-10-11; design-interview Q47 supplement 6). A node's name is also its GLSL name
 * (`sg_n_<name>`), so it is an identifier: letters, digits and underscores, a letter first. People see underscores as spaces
 * and type spaces for them. Every naming — a new node, a copy, a paste, a rename that meets a taken name — goes through one
 * rule, as TD does: the number after the last underscore goes up to the next free one; with none, `_1` is added, and a new
 * node starts at `_1` (Split_1, Split_2; a type ending in a digit: Vector_2_1). Nodes that stand for a shared source take no
 * name of their own (they show the source's). Only the legacy editor's logic is followed, not its code.
 * 節點名稱（R.76，人類；Q47 補充 6）：名稱也是 GLSL 名（sg_n_<名稱>），所以是識別字：英數底線、字母開頭。給人看時底線顯示成空白，
 * 輸入的空白存成底線。新增、複製、貼上、改名撞名都走同一套（照 TD）：最後一個底線後的數字往上加到沒人用的；沒有就加 _1；
 * 新節點從 _1 開始（Split_1、Split_2；類型名結尾是數字的：Vector_2_1）。代表共用來源的節點不取自己的名字（顯示來源的名字）。
 * 只照舊產品的邏輯，不用它的程式。 */
import { identifierRules } from './identifier_rules';
import { tr, type Message } from './text';
import type { Graph, NetworkData } from './model';
import type { Registry } from './node_module';

/** The longest name. 名稱最長幾個字。 */
export const NAME_LIMIT = 48;
const RESERVED_START = /^(gl_|TD|sTD|uTD|sg_|[iu]?sampler|[iu]?image|d?mat[234])/;

/** Whether a name can stand in GLSL and is not GLSL's or TD's own. 能不能當 GLSL 名、又不是 GLSL 或 TD 自己的。 */
export function validNodeName(name: string, reserved: readonly string[] = identifierRules.reservedNames): boolean {
  return /^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(name) && !name.includes('__') && !RESERVED_START.test(name) && !reserved.includes(name);
}
/** What a name field keeps while typing: letters, digits, spaces and underscores; nothing else gets in (legacy).
 * 輸入時留下的字：英數、空白、底線，其他打不進去（照舊產品）。 */
export const typedName = (text: string) => text.replace(/[^A-Za-z0-9 _]/g, '').slice(0, NAME_LIMIT);
/** The name to store for what was typed: spaces become underscores. 輸入的要存成什麼：空白變底線。 */
export const storedName = (text: string) => typedName(text).trim().replace(/[ _]*( +)[ _]*/g, '_').slice(0, NAME_LIMIT);
/** How a name is shown to people: underscores as spaces. 給人看的樣子：底線顯示成空白。 */
export const shownName = (name: string) => name.replace(/_/g, ' ');

/** The candidate itself when it is free; otherwise the number after its last underscore goes up to the next free one
 * (`_1` added when there is none). 沒人用就用它；否則最後一個底線後的數字往上加到沒人用的（沒有就加 _1）。 */
export function freeName(candidate: string, taken: ReadonlySet<string>, limit = NAME_LIMIT): string {
  if (!taken.has(candidate)) return candidate;
  const numbered = /^(.*)_(\d+)$/.exec(candidate);
  const base = (numbered ? numbered[1]! : candidate).replace(/_+$/, '') || 'Node';
  for (let n = numbered ? Number(numbered[2]) + 1 : 1; ; n++) {
    const suffix = '_' + n, name = base.slice(0, limit - suffix.length).replace(/_+$/, '') + suffix;
    if (!taken.has(name)) return name;
  }
}
/** A new node's name, from its type's label: Split_1, then Split_2… A label that cannot make a valid name gives Node_1.
 * 新節點的名稱，由類型名而來：Split_1、Split_2…；類型名做不出合法名稱時用 Node_1。 */
export function newNodeName(label: string, taken: ReadonlySet<string>): string {
  const base = label.replace(/[^A-Za-z0-9 _]/g, '').trim().replace(/[ _]+/g, '_').replace(/_+$/, '').slice(0, NAME_LIMIT - 3);
  return freeName(validNodeName(base + '_1') ? base + '_1' : 'Node_1', taken);
}
/** A subgraph's title (visual notes 27, human 2026-10-14): the node-name rule, shown with its spaces — letters, digits, spaces and
 * underscores, a letter first, and as a stored name (spaces as underscores) a valid node name. 子圖的 Title（外觀意見 27，人類）：
 * 照節點名稱規則，顯示時保留空白——英數、空白、底線，字母開頭，存成名稱（空白換底線）後是合法的節點名。 */
export function validSubgraphTitle(title: string): boolean {
  return title.length > 0 && title === typedName(title).trim() && !/ {2}/.test(title) && validNodeName(storedName(title));
}
/** The base of a subgraph call's default name: its definition's title as a stored name, or Subgraph when the title cannot make one
 * (an old graph). 子圖呼叫預設名的底：定義的 Title 存成名稱；做不出來（舊圖）就用 Subgraph。 */
export function callNameBase(title: string): string {
  const base = storedName(title);
  return base && validNodeName(base + '_1') ? base : 'Subgraph';
}
/** A new call's name: the base, then _1, _2… — the title's own trailing number is never counted up, so the calls of Subgraph_1 are
 * Subgraph_1_1, Subgraph_1_2 and never look like another definition (human 2026-10-14). 新呼叫的名稱：底加 _1、_2…——Title 結尾的數字
 * 不往上加，Subgraph_1 的呼叫是 Subgraph_1_1、Subgraph_1_2，不會看起來像另一份定義（人類）。 */
export function newCallName(title: string, taken: ReadonlySet<string>, from = 1): string {
  const base = callNameBase(title);
  for (let n = from; ; n++) {
    const suffix = '_' + n, name = base.slice(0, NAME_LIMIT - suffix.length).replace(/_+$/, '') + suffix;
    if (!taken.has(name) && validNodeName(name)) return name;
  }
}
/** The number of a call still named by default for this title (base_N), else null. 仍是這個 Title 預設名的呼叫編號；不是就 null。 */
export function defaultCallNumber(name: string, title: string): number | null {
  const base = callNameBase(title), match = name.startsWith(base + '_') ? /^(\d+)$/.exec(name.slice(base.length + 1)) : null;
  return match ? Number(match[1]) : null;
}
/** The names already used in one network. 一張網路裡已用的名稱。 */
export const namesIn = (network: NetworkData) => new Set(network.nodes.flatMap(node => node.name === undefined ? [] : [node.name]));
/** Whether a node of this type takes a name (not one standing for a shared source; unknown types are left as stored).
 * 這種節點要不要名字（代表共用來源的不要；不認得的類型照原樣）。 */
export const takesName = (registry: Registry, nodeType: string) => { const module = registry.get(nodeType); return !!module && !module.unnamed; };

export interface NamedNode { readonly network: string; readonly node: string; readonly name: string; readonly note: Message }
/** Name every node that should have a name and has none, in place (opening a graph made before names were given,
 * Refactor.76). 把該有名字卻沒有的節點補上名字（在傳入的圖上改；給名字之前做的圖，R.76）。 */
export function nameMissing(graph: Graph, registry: Registry): NamedNode[] {
  const named: NamedNode[] = [];
  const networks: [string, NetworkData][] = [...Object.entries(graph.stages), ...(graph.subgraphs ?? []).map(s => [s.id, s.graph] as [string, NetworkData])];
  for (const [network, data] of networks) {
    const taken = namesIn(data);
    for (const node of data.nodes) {
      if (node.name !== undefined || !takesName(registry, node.nodeType)) continue;
      // A subgraph call is named after its definition's title (visual notes 27). 子圖呼叫照定義的 Title 命名。
      const ref = registry.get(node.nodeType)!.referencedGraph?.(node), title = ref === undefined ? undefined : graph.subgraphs?.find(f => f.id === ref)?.name;
      const name = title !== undefined ? newCallName(title, taken) : newNodeName(String(registry.get(node.nodeType)!.catalog.definition.label), taken);
      node.name = name; taken.add(name);
      named.push({ network, node: node.id, name, note: tr('upgrade.named', 'Given the name {name}', { name: shownName(name) }) });
    }
  }
  return named;
}
