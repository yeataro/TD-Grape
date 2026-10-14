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

export function subgraphStages(graph: Graph, id: string, registry: Registry): string[] {
  return subgraphStageTable(graph, registry)(id);
}

/** The same answer for many definitions at once (technical review TECH-3): each definition is worked out once and remembered, so a
 * definition shared along many call paths is not walked again per path. A result cut short by a cycle is not remembered as complete.
 * 一次回答多份定義：每份只算一次並記住，被許多呼叫路徑共用的定義不會沿每條路徑重走；被循環截斷的結果不當成完成的記住。 */
export function subgraphStageTable(graph: Graph, registry: Registry): (id: string) => string[] {
  const done = new Map<string, string[]>(), active = new Set<string>();
  const byId = new Map((graph.subgraphs ?? []).map(item => [item.id, item]));
  const visit = (id: string): { stages: string[]; complete: boolean } => {
    const known = done.get(id);
    if (known) return { stages: known, complete: true };
    const subgraph = byId.get(id);
    if (!subgraph) return { stages: [...SUBGRAPH_STAGES], complete: true };
    if (active.has(id)) return { stages: [...SUBGRAPH_STAGES], complete: false };
    active.add(id);
    let stages = [...SUBGRAPH_STAGES], complete = true;
    for (const node of subgraph.graph.nodes) {
      const module = registry.get(node.nodeType);
      if (!module) continue;
      const own = module.catalog.definition.stages;
      if (own) stages = stages.filter(stage => own.includes(stage));
      const child = module.referencedGraph?.(node);
      if (child !== undefined) {
        const inner = visit(child);
        stages = stages.filter(stage => inner.stages.includes(stage));
        complete &&= inner.complete;
      }
    }
    active.delete(id);
    if (complete) done.set(id, stages);
    return { stages, complete };
  };
  return id => [...visit(id).stages];
}
