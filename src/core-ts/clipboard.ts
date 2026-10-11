import { copy, formatProblem, GRAPH_FORMAT, GRAPH_VERSION, type Graph, type Node as NodeData, type Edge as EdgeData } from './model';
import type { GraphDocument } from './graph';
import { freeName, namesIn, takesName } from './node_names';
import { removable } from './structure';

/** Copy and paste of nodes (Refactor.96; design-interview Q37 1-4, human: the save format plus its version; the copied nodes,
 * the wires between them and the declarations they use; pasting passes the same checks as opening, what is unknown becomes a
 * ghost, every ID is new; a wire with one end outside is dropped). Duplicate is a paste of a fresh copy next to the original
 * (legacy graph_ui.js:2424). One Grape OP only for now (human 2026-10-12: pasting into another Grape OP waits for a rule on
 * declarations of the same name); `source` says which Grape OP it was copied from. Groups do not exist yet.
 * 節點的複製貼上（R.96；Q37 1-4，人類：與存檔同一種格式加版本號；選取的節點、其間的線、用到的宣告；貼上走開圖的同一套檢查，不認得的變
 * Ghost，ID 全換新；一端在外面的線丟掉）。複製副本＝在原處旁邊貼上一份新的複製（照舊產品）。目前只在同一個 Grape OP 裡（人類 10-12：
 * 貼到別的 Grape OP 等同名宣告的規則）；source 記下從哪個 Grape OP 複製。群組還不存在。 */
export type Clip = Graph & { source: string };

/** The copy of some nodes of the top-level pixel network, or null when none of them can be copied (the Color Output cannot:
 * there is one per stage, legacy canDeleteNode). 頂層 pixel 網路裡一些節點的複製；一個都不能複製時是 null（Color Output 不能：每個
 * Stage 只有一個，照舊產品）。 */
export function copyNodes(graph: GraphDocument, ids: Iterable<string>, source: string): Clip | null {
  const data = graph.document, network = data.stages.pixel, chosen = new Set(ids);
  if (!network) return null;
  const nodes = network.nodes.filter(node => chosen.has(node.id) && removable(graph.registry.get(node.nodeType)));
  if (!nodes.length) return null;
  const kept = new Set(nodes.map(node => node.id));
  const edges = network.edges.filter(edge => kept.has(edge.from[0]) && kept.has(edge.to[0]));
  const used = new Set(nodes.flatMap(node => { const id = graph.registry.get(node.nodeType)?.referencedDeclaration?.(node); return id ? [id] : []; }));
  return copy({ format: GRAPH_FORMAT, version: GRAPH_VERSION, target: data.target, declarations: data.declarations.filter(d => used.has(d.id)),
    stages: { pixel: { nodes, edges } }, source });
}

/** Read what the clipboard holds: a copy, or null when it is not one of ours (any other text). 讀剪貼簿：是我們的複製就回傳，不是就 null。 */
export function readClip(text: string): Clip | null {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return null; }
  const clip = value as Partial<Clip> | null;
  if (formatProblem(value) || typeof clip?.source !== 'string') return null;
  const pixel = clip.stages?.pixel;
  return pixel && Array.isArray(pixel.nodes) && Array.isArray(pixel.edges) ? clip as Clip : null;
}

/** Paste a copy into the top-level pixel network of an editable candidate (inside GraphDocument.change), its top-left node corner
 * at `at`; returns the new nodes' IDs in their copied order. A declaration that is gone since it was copied comes back when its
 * ID and name are still free; otherwise its nodes become ghosts, as on opening. Named nodes take the next free name.
 * 把複製貼進可編輯候選文件（在 GraphDocument.change 裡）的頂層 pixel 網路，左上角的節點角落放在 at；回傳新節點的 ID（照複製的順序）。
 * 複製之後被刪掉的宣告，ID 與名字都還沒人用時就加回來；否則它的節點變 Ghost，同開圖。有名字的節點取下一個沒人用的名字。 */
export function pasteClip(candidate: GraphDocument, clip: Clip, at: { x: number; y: number }, newId: () => string): string[] {
  const network = candidate.networks.get('pixel');
  if (!network) throw Error('No pixel network to paste into');
  for (const declaration of clip.declarations) {
    if (candidate.document.declarations.some(d => d.id === declaration.id)) continue;
    try { candidate.addDeclaration(copy(declaration)); } catch { /* its nodes stay ghosts 它的節點維持 Ghost */ }
  }
  const nodes = clip.stages.pixel!.nodes, x = Math.min(...nodes.map(node => Number(node.ui?.x ?? 0))), y = Math.min(...nodes.map(node => Number(node.ui?.y ?? 0)));
  const ids = new Map(nodes.map(node => [node.id, newId()])), taken = namesIn(network.data);
  const pasted: NodeData[] = nodes.map(node => {
    const fresh: NodeData = { ...copy(node), id: ids.get(node.id)!, ui: { ...copy(node.ui ?? {}), x: Number(node.ui?.x ?? 0) - x + at.x, y: Number(node.ui?.y ?? 0) - y + at.y } };
    if (node.name !== undefined && takesName(candidate.registry, node.nodeType)) { fresh.name = freeName(node.name, taken); taken.add(fresh.name); }
    return fresh;
  });
  const edges: EdgeData[] = clip.stages.pixel!.edges.filter(edge => ids.has(edge.from[0]) && ids.has(edge.to[0]))
    .map(edge => ({ ...copy(edge), id: '', from: [ids.get(edge.from[0])!, edge.from[1]], to: [ids.get(edge.to[0])!, edge.to[1]] }));
  network.insertFragment({ nodes: pasted, edges }, { unavailable: 'preserve' });
  return pasted.map(node => node.id);
}

/** Where the copied nodes start: their top-left corner, for Duplicate's offset. 複製的節點從哪裡開始：左上角，給複製副本位移用。 */
export function clipCorner(clip: Clip): { x: number; y: number } {
  const nodes = clip.stages.pixel!.nodes;
  return { x: Math.min(...nodes.map(node => Number(node.ui?.x ?? 0))), y: Math.min(...nodes.map(node => Number(node.ui?.y ?? 0))) };
}
