import type { Graph } from './model';
import type { Registry } from './node_module';

/** The stages a subgraph can be used in, worked out from what is inside it (design-interview Q46): the stages every
 * node inside allows, nested subgraphs followed. Nothing is stored in the graph; a saved definition (library, export,
 * clipboard) writes the result and is recomputed on load. Nodes this build does not know add no limit: they are ghosts
 * and left out of code generation anyway. A cycle is not followed again (cycles are refused where subgraphs change).
 * The target needs no such rule: every node inside is checked against the graph's own target.
 * 子圖能用在哪些 Stage，由內容推算（Q46）：裡面每個節點都允許的 Stage，巢狀子圖一路跟進。圖裡不存；存成定義（個人庫、
 * 匯出、剪貼簿）時才寫出結果、載入時重算。不認得的節點不加限制（它是 Ghost、本來就不產碼）。循環不重複走。
 * target 不需要這條：裡面每個節點本來就照圖的 target 檢查。 */
export const SUBGRAPH_STAGES: readonly string[] = ['vertex', 'pixel'];

export function subgraphStages(graph: Graph, id: string, registry: Registry, active = new Set<string>()): string[] {
  let stages = [...SUBGRAPH_STAGES];
  const subgraph = graph.subgraphs?.find(item => item.id === id);
  if (!subgraph || active.has(id)) return stages;
  active.add(id);
  for (const node of subgraph.graph.nodes) {
    const module = registry.get(node.nodeType);
    if (!module) continue;
    const own = module.catalog.definition.stages;
    if (own) stages = stages.filter(stage => own.includes(stage));
    const child = module.referencedGraph?.(node);
    if (child !== undefined) {
      const inner = subgraphStages(graph, child, registry, active);
      stages = stages.filter(stage => inner.includes(stage));
    }
  }
  active.delete(id);
  return stages;
}
