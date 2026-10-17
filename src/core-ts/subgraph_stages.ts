import type { Graph } from './model';
import { contextFor, nodeStages, type Registry } from './node_module';

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

/** The same answer for many definitions at once (technical review TECH-3, R113-1): the definitions are grouped into the sets that
 * reach each other (strongly connected components; a definition containing an instance of itself is one), and each set is worked out once, after the
 * sets it instantiates. A definition's answer is every node it reaches, so the members of one cycle share an answer, and a graph opened
 * with a cycle costs the same as one without. 一次回答多份定義：定義先分成「彼此走得到」的組（強連通分量；包含自己的實例也算一組），
 * 每組在它用到的組之後算一次。定義的答案是它走得到的每個節點，所以同一個循環的成員答案相同；開著循環的圖和沒有循環的一樣花費。 */
export function subgraphStageTable(graph: Graph, registry: Registry): (id: string) => string[] {
  const { stagesOf } = subgraphGroups(graph, registry);
  return id => [...stagesOf(id)];
}

/** The strongly connected components of the definitions' instances (Tarjan), with each one's stages, and which definitions lie on a
 * cycle (they cannot be expanded; amendment A8 shows them in the Subgraphs panel). 定義之間的實例關係的強連通分量（Tarjan）與各自的 Stage，
 * 以及哪些定義在循環上（展不開；A8 在子圖面板顯示）。 */
export function subgraphGroups(graph: Graph, registry: Registry): { stagesOf: (id: string) => readonly string[]; cyclic: ReadonlySet<string> } {
  const byId = new Map((graph.subgraphs ?? []).map(item => [item.id, item]));
  const own = new Map<string, string[]>(), instances = new Map<string, string[]>();
  for (const [id, subgraph] of byId) {
    let stages = [...SUBGRAPH_STAGES];
    const children: string[] = [], context = contextFor(graph, subgraph);
    for (const node of subgraph.graph?.nodes ?? []) {
      const module = registry.get(node.nodeType);
      if (!module) continue;
      // What a usable node holds can narrow its type's stages (a TD built-in value's entry; Refactor.122); one this target cannot use
      // is a ghost and keeps its type's, as before. 能用的節點，內容可能讓 Stage 更窄；這個 target 用不了的是 Ghost，照類型的、同以前。
      const limit = module.stages && module.supports(node, context) ? nodeStages(module, node) : module.catalog.definition.stages;
      if (limit) stages = stages.filter(stage => limit.includes(stage));
      const child = module.referencedGraph?.(node);
      if (child !== undefined && byId.has(child)) children.push(child);
    }
    own.set(id, stages); instances.set(id, children);
  }
  const index = new Map<string, number>(), low = new Map<string, number>(), stack: string[] = [], onStack = new Set<string>();
  const groupOf = new Map<string, number>(), groupStages: string[][] = [], cyclic = new Set<string>();
  let counter = 0;
  const connect = (id: string) => {
    index.set(id, counter); low.set(id, counter); counter++; stack.push(id); onStack.add(id);
    for (const child of instances.get(id)!) {
      if (!index.has(child)) { connect(child); low.set(id, Math.min(low.get(id)!, low.get(child)!)); }
      else if (onStack.has(child)) low.set(id, Math.min(low.get(id)!, index.get(child)!));
    }
    if (low.get(id) !== index.get(id)) return;
    const members: string[] = [];
    let member: string;
    do { member = stack.pop()!; onStack.delete(member); members.push(member); } while (member !== id);
    // Components finish children first, so every set this one instantiates already has its answer. 子分量先完成，這組用到的組都已有答案。
    const group = groupStages.length, inside = new Set(members);
    let stages = [...SUBGRAPH_STAGES];
    for (const m of members) {
      stages = stages.filter(stage => own.get(m)!.includes(stage));
      for (const child of instances.get(m)!) if (!inside.has(child)) stages = stages.filter(stage => groupStages[groupOf.get(child)!]!.includes(stage));
      groupOf.set(m, group);
    }
    groupStages.push(stages);
    if (members.length > 1 || instances.get(id)!.includes(id)) for (const m of members) cyclic.add(m);
  };
  for (const id of byId.keys()) if (!index.has(id)) connect(id);
  return { stagesOf: id => byId.has(id) ? groupStages[groupOf.get(id)!]! : SUBGRAPH_STAGES, cyclic };
}
