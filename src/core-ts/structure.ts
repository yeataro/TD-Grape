import type { Graph, NetworkData } from './model';
import type { NodeModule, Registry } from './node_module';

/** Structural rules of the graph (design-interview Q42, human 2026-10-08).
 * A stage output (Color Output; role 'output') has a fixed identity: exactly one at the top level
 * of each stage, never inside a subgraph, never deleted, never offered in the add menu.
 * GraphDocument checks this at the same gate as capacity: an edit that breaks the rule, or breaks
 * it further, is refused as a whole. Opening never refuses: a graph already off the rule stays
 * editable (and can be repaired), it is only reported.
 * 圖的結構規則：stage 出口（Color Output）身分固定——每個 stage 最外層剛好一個、子圖內不准有、
 * 不能刪、不在新增選單。與上限同一關卡：讓圖違規或更違規的修改整筆拒絕；開圖不擋，只回報。
 */
export type StructureProblem = { key:'stageOutputs'; network:string; value:number; expected:number };

const stageOutput = (module:NodeModule|undefined) => module?.role === 'output';

/** Whether a module may be offered for adding a new node. 新增選單只提供這些。 */
export const offered = (module:NodeModule) => !stageOutput(module);
/** Whether the user may delete this node. 能不能刪。 */
export const removable = (module:NodeModule|undefined) => !stageOutput(module);

function counts(g:Graph,registry:Registry):StructureProblem[] {
  const count = (data:NetworkData) => data.nodes.filter(n => stageOutput(registry.get(n.nodeType))).length;
  return [
    ...Object.entries(g.stages||{}).map(([id,data]) => ({key:'stageOutputs' as const,network:id,value:count(data as NetworkData),expected:1})),
    ...(g.subgraphs||[]).map(f => ({key:'stageOutputs' as const,network:'subgraph:'+f.id,value:count(f.graph),expected:0})),
  ];
}
const distance = (p:StructureProblem) => Math.abs(p.value-p.expected);

/** Rules the graph currently breaks; used to report a graph when it is opened. */
export function structureProblems(g:Graph,registry:Registry):StructureProblem[] {
  return counts(g,registry).filter(p => distance(p) > 0);
}

export class StructureError extends Error {
  constructor(readonly problems:readonly StructureProblem[]){
    super('Graph structure rule: '+problems.map(p=>`${p.key} (${p.network}) ${p.value}, expected ${p.expected}`).join(', '));
    this.name='StructureError';
  }
}

/** Refuses edits that move a network further from the rule; repairs are always allowed. */
export function requireStructure(before:Graph,after:Graph,registry:Registry):void {
  const previous = new Map(counts(before,registry).map(p => [p.network,distance(p)]));
  const worse = counts(after,registry).filter(p => distance(p) > (previous.get(p.network) ?? 0));
  if(worse.length) throw new StructureError(worse);
}
