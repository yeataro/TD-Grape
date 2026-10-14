import { copy, formatProblem, GRAPH_FORMAT, GRAPH_VERSION, type Graph, type Node as NodeData, type Edge as EdgeData, type Value, type SubgraphData } from './model';
import type { GraphDocument } from './graph';
import { freeName, namesIn, takesName } from './node_names';
import { removable } from './structure';
import { addCopiedGroups, completeGroups, groupsOf } from './groups';
import { validateSubgraphData, withoutStoredUse } from './subgraph_operations';
import { fitInstanceValues } from './subgraphs';

/** Copy and paste of nodes (Refactor.96; design-interview Q37 1-4, human: the save format plus its version; the copied nodes,
 * the wires between them and the declarations they use; pasting passes the same checks as opening, what is unknown becomes a
 * ghost, every ID is new; a wire with one end outside is dropped; a group comes along only when all its members do, G-2). Duplicate is
 * a paste of a fresh copy next to the original (legacy graph_ui.js:2424). One Grape OP only for now (human 2026-10-12: pasting into
 * another Grape OP waits for a rule on declarations of the same name); `source` says which Grape OP it was copied from.
 * 節點的複製貼上（R.96；Q37 1-4，人類：與存檔同一種格式加版本號；選取的節點、其間的線、用到的宣告；貼上走開圖的同一套檢查，不認得的變
 * Ghost，ID 全換新；一端在外面的線丟掉；群組只在成員全被複製時跟著，G-2）。複製副本＝在原處旁邊貼上一份新的複製（照舊產品）。目前只在同一個
 * Grape OP 裡（人類 10-12：貼到別的 Grape OP 等同名宣告的規則）；source 記下從哪個 Grape OP 複製。 */
export type Clip = Graph & { source: string };

/** The copy of some nodes of one network (`networkId`: a stage, or 'subgraph:'+id; the top-level pixel network by default), or
 * null when none of them can be copied (a node with a fixed identity cannot: the Color Output, a subgraph boundary; structure.ts).
 * The copy is always written as a pixel network, whichever network it came from. 一張網路（networkId：stage 或 subgraph:+id；預設頂層
 * pixel）裡一些節點的複製；一個都不能複製時是 null（身分固定的節點不能：Color Output、子圖邊界節點）。不管從哪張網路複製，都寫成 pixel 網路。 */
export function copyNodes(graph: GraphDocument, ids: Iterable<string>, source: string, networkId = 'pixel'): Clip | null {
  const data = graph.document, network = graph.networks.get(networkId)?.data, chosen = new Set(ids);
  if (!network) return null;
  const nodes = network.nodes.filter(node => chosen.has(node.id) && removable(graph.registry.get(node.nodeType)));
  if (!nodes.length) return null;
  const kept = new Set(nodes.map(node => node.id));
  const edges = network.edges.filter(edge => kept.has(edge.from[0]) && kept.has(edge.to[0]));
  const used = new Set(nodes.flatMap(node => { const id = graph.registry.get(node.nodeType)?.referencedDeclaration?.(node); return id ? [id] : []; }));
  const groups = completeGroups(groupsOf(network), kept);
  // A copy always carries the definitions its calls use, with their whole dependency closure (basic design §3.13, amendment B4: the
  // paste may land where the Library is not, so the content must travel). 複製永遠帶著呼叫用到的定義，連同完整的依賴閉包（§3.13、B4：
  // 貼上的地方可能沒有 Library，內容必須跟著走）。
  const byId = new Map((data.subgraphs ?? []).map(f => [f.id, f])), needed = new Map<string, SubgraphData>();
  const visit = (id: string) => { const f = byId.get(id); if (!f || needed.has(id)) return; needed.set(id, f);
    for (const n of f.graph.nodes) { const ref = graph.registry.get(n.nodeType)?.referencedGraph?.(n); if (ref) visit(ref); } };
  for (const node of nodes) { const ref = graph.registry.get(node.nodeType)?.referencedGraph?.(node); if (ref) visit(ref); }
  return copy({ format: GRAPH_FORMAT, version: GRAPH_VERSION, target: data.target, declarations: data.declarations.filter(d => used.has(d.id)),
    ...(needed.size ? { subgraphs: [...needed.values()] } : {}),
    stages: { pixel: { nodes, edges, ...(groups.length ? { ui: { groups: groups as unknown as Value } } : {}) } }, source });
}

/** Read what the clipboard holds: a copy, or null when it is not one of ours (any other text). 讀剪貼簿：是我們的複製就回傳，不是就 null。 */
export function readClip(text: string): Clip | null {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return null; }
  const clip = value as Partial<Clip> | null;
  if (formatProblem(value) || typeof clip?.source !== 'string') return null;
  const pixel = clip.stages?.pixel;
  if (clip.subgraphs !== undefined && !Array.isArray(clip.subgraphs)) return null;
  return pixel && Array.isArray(pixel.nodes) && Array.isArray(pixel.edges) ? clip as Clip : null;
}

/** A copied node's place; a value that is not a number counts as 0 (only hand-made text has one). 複製的節點位置；不是數字的值當 0
 * （只有手寫的文字會有）。 */
const placeOf = (node: NodeData) => {
  const x = Number(node.ui?.x), y = Number(node.ui?.y);
  return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 };
};

/** Paste a copy into the top-level pixel network of an editable candidate (inside GraphDocument.change), its top-left node corner
 * at `at`; returns the new nodes' IDs in their copied order. `newId` names nodes, `newGroupId` groups (the editor's, the same as
 * for a new group). A declaration that is gone since it was copied comes back when its
 * ID and name are still free; otherwise its nodes become ghosts, as on opening. Named nodes take the next free name.
 * 把複製貼進可編輯候選文件（在 GraphDocument.change 裡）的頂層 pixel 網路，左上角的節點角落放在 at；回傳新節點的 ID（照複製的順序）。
 * 複製之後被刪掉的宣告，ID 與名字都還沒人用時就加回來；否則它的節點變 Ghost，同開圖。有名字的節點取下一個沒人用的名字。newId 給節點、newGroupId 給群組（編輯器的，
 * 同新建群組）。 */
/** `sameSource`: the copy came from this very graph (the editor compares the Grape OP); `newSubgraphId` names definitions brought in.
 * Definitions (basic design §3.13, amendment A5 rules 1–2, amendment 2 B3): from the same graph, a pasted call whose definition is
 * still in the document uses it as it is now, its explicit values fitted to the current interface; a definition the pasted calls need
 * that is gone comes back under a new identity together with everything it depends on in the copy (its dependencies are never
 * resolved to the current ones); from another graph the whole copied closure comes in under new identities. One batch keeps its
 * shared relations; locals are never merged by content. Every definition in the copy is validated first; one carrying a Library ID
 * refuses the paste (amendment 2 B7-5). sameSource：複製來自這張圖本身（編輯器比 Grape OP）；newSubgraphId 給帶進來的定義命名。定義
 * （§3.13、A5 第 1–2 條、附錄二 B3）：同圖時，貼上的呼叫所指的定義還在就用現在這份，實例值對齊目前接口；呼叫需要、但已刪的定義以新身分
 * 回來，連同它在複製裡的所有依賴（依賴不改指現有的）；別張圖時整個閉包以新身分進來。同批保留共用關係；本地永不按內容合併。複製裡每份定義
 * 先驗證；帶 Library ID 的整筆拒絕（B7-5）。 */
export function pasteClip(candidate: GraphDocument, clip: Clip, at: { x: number; y: number }, newId: () => string, newGroupId: () => string,
  networkId = 'pixel', newSubgraphId: () => string = newId, sameSource = true): string[] {
  const network = candidate.networks.get(networkId);
  if (!network) throw Error('No network to paste into');
  // Every definition the copy carries is checked first, as written, also those that will not be brought in (TECH-4, amendment 2
  // B7-5); two with one ID are refused too, so none can hide behind another (R113-2). One that fails refuses the whole paste.
  // 複製帶著的每份定義照原樣先驗，包括不會帶進來的；同 ID 的兩份也拒絕，免得一份藏在另一份後面。任一份不過，整筆拒絕。
  const carried = clip.subgraphs ?? [];
  for (const f of carried) validateSubgraphData(withoutStoredUse(copy(f)));
  if (new Set(carried.map(f => f.id)).size !== carried.length) throw Error('Duplicate Subgraph identity');
  const snapshot = new Map(carried.map(f => [f.id, f]));
  const current = new Map((candidate.document.subgraphs ?? []).map(f => [f.id, f]));
  const referenceOf = (node: NodeData) => candidate.registry.get(node.nodeType)?.referencedGraph?.(node);
  const calls = clip.stages.pixel!.nodes.map(referenceOf).filter((ref): ref is string => ref !== undefined);
  // What comes in (TECH-1, amendment 2 B3): from another graph, the whole closure; from this graph, the definitions the pasted calls
  // point at that are gone now, with everything they depend on in the copy, all under one map. A pasted call whose definition is still
  // here keeps it. 帶進來的：別張圖的整個閉包；同一張圖的，是貼上的呼叫所指、現在已不在的定義，加上它們在複製裡的所有依賴，共用一張對照。
  // 定義還在的呼叫沿用它。
  const imported = new Set<string>();
  const bring = (id: string) => {
    const f = snapshot.get(id);
    if (!f || imported.has(id)) return;
    imported.add(id);
    for (const node of f.graph.nodes) { const ref = referenceOf(node); if (ref) bring(ref); }
  };
  for (const id of sameSource ? calls.filter(ref => !current.has(ref)) : snapshot.keys()) bring(id);
  const ids = new Map([...imported].map(id => [id, newSubgraphId()]));
  if (ids.size) candidate.appendSubgraphs([...imported].map(id => snapshot.get(id)!), ids);
  for (const declaration of clip.declarations) {
    if (candidate.document.declarations.some(d => d.id === declaration.id)) continue;
    try { candidate.addDeclaration(copy(declaration)); } catch { /* its nodes stay ghosts 它的節點維持 Ghost */ }
  }
  const nodes = clip.stages.pixel!.nodes, { x, y } = clipCorner(clip);
  const taken = namesIn(network.data);
  const nodeIds = new Map(nodes.map(node => [node.id, newId()]));
  const pasted: NodeData[] = nodes.map(node => {
    const place = placeOf(node);
    const fresh: NodeData = { ...copy(node), id: nodeIds.get(node.id)!, ui: { ...copy(node.ui ?? {}), x: place.x - x + at.x, y: place.y - y + at.y } };
    if (node.name !== undefined && takesName(candidate.registry, node.nodeType)) { fresh.name = freeName(node.name, taken); taken.add(fresh.name); }
    // A call keeps the definition still here, else follows its new identity. 呼叫沿用還在的定義，否則跟著新身分。
    const module = candidate.registry.get(node.nodeType), ref = module?.referencedGraph?.(node);
    const kept = ref !== undefined && sameSource && current.has(ref), mapped = ref !== undefined && !kept ? ids.get(ref) : undefined;
    if (module?.reference && mapped) fresh.params = { ...fresh.params, ...copy(module.reference(mapped)) };
    // A call copied before its definition's interface changed takes the current interface (TECH-2). 定義的接口在複製後改過：照目前的接口。
    if (kept && fresh.inputValues) fresh.inputValues = fitInstanceValues(fresh.inputValues, current.get(ref!)!.inputs);
    return fresh;
  });
  const edges: EdgeData[] = clip.stages.pixel!.edges.filter(edge => nodeIds.has(edge.from[0]) && nodeIds.has(edge.to[0]))
    .map(edge => ({ ...copy(edge), id: '', from: [nodeIds.get(edge.from[0])!, edge.from[1]], to: [nodeIds.get(edge.to[0])!, edge.to[1]] }));
  network.insertFragment({ nodes: pasted, edges }, { unavailable: 'preserve' });
  const groups = groupsOf(clip.stages.pixel!);
  if (groups.length) addCopiedGroups(network, groups, nodeIds, newGroupId);
  return pasted.map(node => node.id);
}

/** Where the copied nodes start: their top-left corner, for Duplicate's offset. 複製的節點從哪裡開始：左上角，給複製副本位移用。 */
export function clipCorner(clip: Clip): { x: number; y: number } {
  const places = clip.stages.pixel!.nodes.map(placeOf);
  return { x: Math.min(...places.map(place => place.x)), y: Math.min(...places.map(place => place.y)) };
}
