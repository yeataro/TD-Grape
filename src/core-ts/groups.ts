import { copy, type Graph, type NetworkData, type Value } from './model';
import type { Network } from './graph';
import { equal } from './changes';

/** Groups (Refactor.98; design-interview 1-2, G-1–G-3, GLOSSARY "群組與導覽"): a named, coloured list of member nodes, kept in its
 * network's `ui.groups`. A node is in at most one group, groups do not nest, a group stays in one network, and groups never change the
 * generated code. Where a group's box is drawn is worked out by the editor from its members and never stored (G-3). The rules live
 * here; GraphDocument only calls them (one way). Legacy kept the same list in `ui.frames` (functions_model.js:8-49); old graphs'
 * frames are ignored (1011).
 * 群組（R.98；1-2、G-1～G-3、GLOSSARY）：有名字、顏色的成員節點名單，存在所屬網路的 `ui.groups`。一個節點最多屬一個群組、不巢狀、範圍限
 * 一個網路、不影響產碼。外框畫在哪裡由編輯器依成員算、從不儲存（G-3）。規則在這裡；GraphDocument 只呼叫（單向）。舊產品存在 `ui.frames`；
 * 舊圖的 frames 忽略（1011）。 */
/** `text`: the body text shown above the members (Refactor.99, human 2026-10-12; new, legacy had none), as written; basic Markdown
 * is the editor's to show. `text`：顯示在成員上方的內文（R.99，人類 10-12；新的，舊產品沒有），存寫下的原文；基本 Markdown 由編輯器顯示。 */
export interface GraphGroup { id: string; name: string; nodes: string[]; color?: string; text?: string;
  /** How the whole body text is shown, not part of the Markdown (Refactor.101; legacy Note noteFontScale, noteTextAlign,
   * graph_ui.js:1688-1689): its size as a factor (1 is not stored) and its alignment (left is not stored). 整段內文怎麼顯示，不屬於
   * Markdown（R.101；照舊產品 Note 的 noteFontScale、noteTextAlign）：字體倍率（1 不存）與對齊（靠左不存）。 */
  textScale?: number; textAlign?: TextAlign;
  /** Where the body text sits: above the members, or below them (Refactor.105.16, human 2026-10-13: top and bottom; top is not
   * stored). 內文放在哪裡：成員上方，或成員下方（R.105.16，人類 10-13：靠上與置底；靠上不存）。 */
  textPlace?: TextPlace }
export type TextAlign = 'left' | 'center' | 'right';
export type TextPlace = 'top' | 'bottom';
/** The body text's size factor, as legacy (graph_ui.js:1688: up to 10). 內文字體倍率範圍（照舊產品：最大 10）。 */
export const TEXT_SCALE_MIN = 0.5, TEXT_SCALE_MAX = 10;
const validScale = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= TEXT_SCALE_MIN && value <= TEXT_SCALE_MAX;

/** Legacy's limits (functions_model.js:10-13). 舊產品的上限。 */
export const GROUP_LIMIT = 256, MEMBER_LIMIT = 256, GROUP_NAME_LIMIT = 80;
/** The body text's length (a few pages; Refactor.99). 內文長度上限（幾頁；R.99）。 */
export const GROUP_TEXT_LIMIT = 10000;
const ID = /^[A-Za-z][A-Za-z0-9_]{0,63}$/, COLOR = /^#[0-9a-f]{6}$/;
/** A name people can read: 1 to 80 characters, no control characters, not only spaces. 看得懂的名字：1 到 80 字、沒有控制字元、不是只有空白。 */
export const validGroupName = (name: unknown): name is string =>
  typeof name === 'string' && name.trim().length > 0 && name.length <= GROUP_NAME_LIMIT && !/[\u0000-\u001f\u007f]/.test(name);

/** The groups of a network, tidied (the automatic fix, 1-2): members that are not nodes of this network are dropped (a ghost node is
 * still a node), a node claimed by two groups stays with the first, repeats go, an empty group goes; a malformed entry is dropped.
 * `fixed` says whether anything was changed. 一張網路的群組，整理過（自動修正，1-2）：不是這張網路節點的成員拿掉（Ghost 節點仍是節點）、
 * 被兩個群組認領的節點留在第一個、重複的拿掉、空群組拿掉；格式不對的整筆拿掉。fixed：有沒有改到東西。 */
export function tidy(network: NetworkData): { groups: GraphGroup[]; fixed: boolean } {
  const raw = network.ui?.groups;
  if (raw === undefined) return { groups: [], fixed: false };
  if (!Array.isArray(raw)) return { groups: [], fixed: true };
  const nodes = new Set(network.nodes.map(node => node.id)), claimed = new Set<string>(), ids = new Set<string>(), groups: GraphGroup[] = [];
  for (const entry of raw.slice(0, GROUP_LIMIT)) {
    const group = entry as Partial<GraphGroup> | null;
    if (!group || typeof group !== 'object' || typeof group.id !== 'string' || !ID.test(group.id) || ids.has(group.id) || !validGroupName(group.name)
      || !Array.isArray(group.nodes)) continue;
    const members = [...new Set(group.nodes)].filter((id): id is string => typeof id === 'string' && nodes.has(id) && !claimed.has(id)).slice(0, MEMBER_LIMIT);
    if (!members.length) continue;
    members.forEach(id => claimed.add(id)); ids.add(group.id);
    groups.push({ id: group.id, name: group.name, nodes: members, ...(typeof group.color === 'string' && COLOR.test(group.color) ? { color: group.color } : {}),
      ...(typeof group.text === 'string' && group.text && group.text.length <= GROUP_TEXT_LIMIT ? { text: group.text } : {}),
      ...(validScale(group.textScale) && group.textScale !== 1 ? { textScale: group.textScale } : {}),
      ...(group.textAlign === 'center' || group.textAlign === 'right' ? { textAlign: group.textAlign } : {}),
      ...(group.textPlace === 'bottom' ? { textPlace: group.textPlace } : {}) });
  }
  // Compared as JSON values, whatever order the fields were written in. 照 JSON 的值比，不管欄位寫的順序。
  return { groups, fixed: !equal(groups, raw) };
}
/** The groups of a network as they are now (tidied, read-only use). 一張網路現在的群組（整理過，只讀用）。 */
export const groupsOf = (network: NetworkData) => tidy(network).groups;

function write(network: NetworkData, groups: readonly GraphGroup[]): void {
  if (groups.length) { network.ui = { ...(network.ui ?? {}), groups: copy(groups) as unknown as Value }; return; }
  if (!network.ui) return;
  const { groups: _, ...rest } = network.ui;
  if (Object.keys(rest).length) network.ui = rest; else delete network.ui;
}
/** Tidy every network of a document in place; how many networks were fixed. Run at the end of every change and when a graph is
 * opened (1-2: the only two gates). Every subgraph network is tidied like a stage (Refactor.109: no read-only snapshots in
 * a graph). 就地整理整份文件的每張網路；回傳修了幾張。在每次修改結束時與開圖時執行（1-2：只有這兩個關卡）。子圖網路和 stage 一樣整理。 */
export function tidyGroups(document: Graph): number {
  let fixed = 0;
  const networks = [...Object.values(document.stages), ...(document.subgraphs ?? []).map(subgraph => subgraph.graph)];
  for (const network of networks) { const result = tidy(network); if (result.fixed) { write(network, result.groups); fixed++; } }
  return fixed;
}

const groupOf = (groups: readonly GraphGroup[], node: string) => groups.find(group => group.nodes.includes(node));
/** Whether these nodes can make a new group: two or more, none in a group yet (legacy frames_ui.js:23-27). 這些節點能不能建立新群組：兩個以上、
 * 都還沒在群組裡（照舊產品）。 */
export const canGroup = (groups: readonly GraphGroup[], ids: readonly string[]) => new Set(ids).size === ids.length
  && ids.length >= 2 && ids.length <= MEMBER_LIMIT && groups.length < GROUP_LIMIT && ids.every(id => !groupOf(groups, id));
/** The group these nodes would join: the one holding most of them, when it is the only such one, some are outside it (legacy
 * frames_ui.js:38-48), and they all fit under the member limit. 這些節點會加入哪個群組：裝著最多個的那一個，只有它一個這麼多、
 * 有些不在裡面時（照舊產品），而且全部放得進成員上限。 */
export function joinTarget(groups: readonly GraphGroup[], ids: readonly string[]): GraphGroup | null {
  const counts = groups.map(group => ({ group, count: ids.filter(id => group.nodes.includes(id)).length })).filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count);
  const best = counts[0];
  if (!best || counts[1]?.count === best.count || ids.every(id => best.group.nodes.includes(id))) return null;
  return new Set([...best.group.nodes, ...ids]).size <= MEMBER_LIMIT ? best.group : null;
}
/** Whether some of these nodes are in a group (Remove from group). 這些節點有沒有在群組裡的（移出群組）。 */
export const inAnyGroup = (groups: readonly GraphGroup[], ids: readonly string[]) => ids.some(id => !!groupOf(groups, id));

// Commands, inside GraphDocument.change() on the editable candidate. 指令：在 GraphDocument.change() 的可編輯候選文件上使用。
function edit(network: Network, change: (groups: GraphGroup[]) => GraphGroup[]): void {
  network.assertEditable();
  write(network.data, change(groupsOf(network.data)));
}
/** A new group of these nodes (G-3, Ctrl+G). 用這些節點建立新群組（G-3，Ctrl＋G）。 */
export function createGroup(network: Network, ids: readonly string[], group: { id: string; name: string; color?: string }): void {
  edit(network, groups => {
    if (!ID.test(group.id) || groups.some(item => item.id === group.id) || !validGroupName(group.name)) throw Error('Invalid group');
    if (!canGroup(groups, ids) || ids.some(id => !network.data.nodes.some(node => node.id === id))) throw Error('These nodes cannot make a group');
    return [...groups, { id: group.id, name: group.name, nodes: [...ids], ...(group.color ? { color: group.color } : {}) }];
  });
}
/** Move these nodes into the group most of them are in (G-3, Alt+Shift+G). 把這些節點移入多數所在的群組（G-3，Alt＋Shift＋G）。 */
export function joinGroup(network: Network, ids: readonly string[]): void {
  edit(network, groups => {
    const target = joinTarget(groups, ids);
    if (!target) throw Error('No group to join');
    return groups.map(group => group.id === target.id ? { ...group, nodes: [...group.nodes, ...ids.filter(id => !group.nodes.includes(id))] }
      : { ...group, nodes: group.nodes.filter(id => !ids.includes(id)) });
  });
}
/** Take these nodes out of their groups (G-3, Alt+G); a group left empty goes. 把這些節點移出群組（G-3，Alt＋G）；空了的群組拿掉。 */
export function leaveGroups(network: Network, ids: readonly string[]): void {
  edit(network, groups => groups.map(group => ({ ...group, nodes: group.nodes.filter(id => !ids.includes(id)) })));
}
/** Remove a group, keeping its nodes (G-3). 拿掉群組，節點留著（G-3）。 */
export function removeGroup(network: Network, id: string): void {
  edit(network, groups => groups.filter(group => group.id !== id));
}
/** Rename, recolour or rewrite a group; an empty text takes the text away. 群組改名、改色或改內文；空的內文＝拿掉內文。 */
export function changeGroup(network: Network, id: string, patch: { name?: string; color?: string; text?: string; textScale?: number; textAlign?: TextAlign; textPlace?: TextPlace }): void {
  edit(network, groups => groups.map(group => {
    if (group.id !== id) return group;
    if (patch.name !== undefined && !validGroupName(patch.name)) throw Error('Invalid group name');
    if (patch.color !== undefined && !COLOR.test(patch.color)) throw Error('Invalid group color');
    if (patch.text !== undefined && patch.text.length > GROUP_TEXT_LIMIT) throw Error('Group text too long');
    if (patch.textScale !== undefined && !validScale(patch.textScale)) throw Error('Invalid text scale');
    if (patch.textAlign !== undefined && !['left', 'center', 'right'].includes(patch.textAlign)) throw Error('Invalid text alignment');
    if (patch.textPlace !== undefined && !['top', 'bottom'].includes(patch.textPlace)) throw Error('Invalid text place');
    // The defaults are not stored: no text, size 1, left, top. 預設值不存：沒有內文、倍率 1、靠左、靠上。
    const { text, textScale, textAlign, textPlace, ...rest } = { ...group, ...patch };
    return { ...rest, ...(text ? { text } : {}), ...(textScale !== undefined && textScale !== 1 ? { textScale } : {}),
      ...(textAlign && textAlign !== 'left' ? { textAlign } : {}), ...(textPlace === 'bottom' ? { textPlace } : {}) };
  }));
}

/** The groups that come along when these nodes are copied: only those whose members are all among them (G-2). 複製這些節點時帶著的群組：
 * 只有成員全在裡面的（G-2）。 */
export const completeGroups = (groups: readonly GraphGroup[], ids: ReadonlySet<string>) => groups.filter(group => group.nodes.every(id => ids.has(id)));
/** Add copied groups to a network under new IDs, their members renamed by `nodes` (G-2); none past the limit. 把複製的群組加進網路、換新
 * ID，成員依 nodes 換成新節點（G-2）；超過上限的不加。 */
export function addCopiedGroups(network: Network, copied: readonly GraphGroup[], nodes: ReadonlyMap<string, string>, newId: () => string): void {
  edit(network, groups => [...groups, ...copied.map(group => ({ ...copy(group), id: newId(), nodes: group.nodes.flatMap(id => nodes.has(id) ? [nodes.get(id)!] : []) }))]
    .slice(0, GROUP_LIMIT));
}
