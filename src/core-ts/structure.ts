import type { Graph, NetworkData } from './model';
import type { NodeModule, Registry } from './node_module';

/** Structural rules of the graph (design-interview Q42, human 2026-10-08; subgraph boundaries: basic design §3.3, amendment
 * A8 §5 item 7, Refactor.109).
 * A stage output (Color Output; role 'output') has a fixed identity: exactly one at the top level of each stage, never inside
 * a subgraph, never deleted, never offered in the add menu. A subgraph boundary (Subgraph Input / Subgraph Output; roles
 * 'subgraph-input' / 'subgraph-output') likewise: exactly one of each inside every subgraph, never in a stage, never
 * deleted, never offered, never pasted as a second one.
 * GraphDocument checks this at the same gate as capacity: an edit that breaks a rule, or breaks it further, is refused as a
 * whole. Opening never refuses: a graph already off a rule stays editable (and can be repaired), it is only reported.
 * 圖的結構規則：stage 出口（Color Output）身分固定——每個 stage 最外層剛好一個、子圖內不准有、不能刪、不在新增選單。子圖邊界節點
 * （Input／Output）同樣：每個子圖裡各剛好一個、stage 裡不准有、不能刪、不在新增選單、不能貼進第二個。與上限同一關卡：讓圖違規或
 * 更違規的修改整筆拒絕；開圖不擋，只回報。
 */
export type StructureKey = 'stageOutputs'|'subgraphInputs'|'subgraphOutputs';
export type StructureProblem = { key:StructureKey; network:string; value:number; expected:number };

const stageOutput = (module:NodeModule|undefined) => module?.role === 'output';
const boundary = (module:NodeModule|undefined) => module?.role === 'subgraph-input' || module?.role === 'subgraph-output';
/** Nodes with a fixed identity: never offered, never deleted. 身分固定的節點：不在新增選單、不能刪。 */
const fixed = (module:NodeModule|undefined) => stageOutput(module) || boundary(module);

/** Whether a module may be offered for adding a new node. 新增選單只提供這些。 */
export const offered = (module:NodeModule) => !fixed(module);
/** Whether the user may delete this node. 能不能刪。 */
export const removable = (module:NodeModule|undefined) => !fixed(module);

const rules:readonly {key:StructureKey; role:NodeModule['role']; stage:number; subgraph:number}[] = [
  {key:'stageOutputs',role:'output',stage:1,subgraph:0},
  {key:'subgraphInputs',role:'subgraph-input',stage:0,subgraph:1},
  {key:'subgraphOutputs',role:'subgraph-output',stage:0,subgraph:1},
];
function counts(g:Graph,registry:Registry):StructureProblem[] {
  const count = (data:NetworkData,role:NodeModule['role']) => data.nodes.filter(n => registry.get(n.nodeType)?.role === role).length;
  return rules.flatMap(rule => [
    ...Object.entries(g.stages||{}).map(([id,data]) => ({key:rule.key,network:id,value:count(data as NetworkData,rule.role),expected:rule.stage})),
    ...(g.subgraphs||[]).map(f => ({key:rule.key,network:'subgraph:'+f.id,value:count(f.graph,rule.role),expected:rule.subgraph})),
  ]);
}
const distance = (p:StructureProblem) => Math.abs(p.value-p.expected);
const slot = (p:StructureProblem) => p.key+' '+p.network;

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

/** Refuses edits that move a network further from a rule; repairs are always allowed. */
export function requireStructure(before:Graph,after:Graph,registry:Registry):void {
  const previous = new Map(counts(before,registry).map(p => [slot(p),distance(p)]));
  const worse = counts(after,registry).filter(p => distance(p) > (previous.get(slot(p)) ?? 0));
  if(worse.length) throw new StructureError(worse);
}
