import { copy, type Node, type SubgraphData, type ObjectValue } from './model';
import type { GraphDocument, Network } from './graph';
import { ensureSubgraphCapacity, validateSubgraphData, withoutStoredUse } from './subgraph_operations';
import { freeName } from './node_names';
import { ScopeReferences } from './scope_references';
import { tidyGroups } from './groups';
import { readOnly, requireCurrent, localize, now } from './library';
import type { Graph } from './model';

export type AllocateSubgraphId = () => string;
const validId = (id:string) => /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(id);
const reference = (graph:GraphDocument,n:Node) => graph.registry.get(n.nodeType)?.referencedGraph?.(n);

function parameters(graph:GraphDocument,n:Node,id:string):ObjectValue {
  const module = graph.registry.get(n.nodeType);
  if (!module?.reference) throw Error('Subgraph module cannot redirect its reference');
  const params = {...copy(n.params),...copy(module.reference(id))};
  if (module.referencedGraph?.({...n,params}) !== id) throw Error('Subgraph reference operation disagrees with its module');
  return params;
}

function remapScopes(value:unknown,ids:ReadonlyMap<string,string>):void {
  ScopeReferences.walk(value,(ref,old) => {
    const id = ref.scope.startsWith('fn_') && ids.get(ref.scope.slice(3));
    return id ? ScopeReferences.token('fn_'+id,ref.source) : old;
  });
}

function allocate(used:Set<string>,next:AllocateSubgraphId):string {
  const id = next();
  if (!validId(id) || used.has(id)) throw Error('Invalid or duplicate Subgraph identity');
  used.add(id);return id;
}

/** A Library copy in the form the end of an edit would leave it (edge IDs given, groups tidy), so the ledger records what stays.
 * Library 副本整理成修改結束時的樣子（線有 ID、群組整理好），帳本記的就是會留下的內容。 */
export function settle(graph:GraphDocument,f:SubgraphData):void {
  for (const e of f.graph.edges) if (!e.id) e.id = graph.nextEdgeId(f.graph);
  tidyGroups({stages:{},subgraphs:[f]} as unknown as Graph);
}

/** Receive authored definitions, not Library files. The adapter decides which
 * versions to reuse and supplies any ID mapping. All mutation stays here. */
export function appendSubgraphs(graph:GraphDocument,definitions:readonly SubgraphData[],ids:ReadonlyMap<string,string>=new Map()):SubgraphData[] {
  graph.assertEditable();ensureSubgraphCapacity(graph,definitions.length);
  const pending = definitions.map(f => withoutStoredUse(copy(f))),used = new Set((graph.document.subgraphs || []).map(f => f.id));
  const originalIds = new Set<string>();
  for (const f of pending) {
    if (originalIds.has(f.id)) throw Error('Duplicate Subgraph identity');
    originalIds.add(f.id);f.id=ids.get(f.id) || f.id;
    if (used.has(f.id)) throw Error('Duplicate Subgraph identity');used.add(f.id);
    for (const n of f.graph.nodes) {
      const old = reference(graph,n),mapped = old && ids.get(old);
      if (mapped) n.params=parameters(graph,n,mapped);
    }
    remapScopes(f,ids);validateSubgraphData(f);
  }
  const all = new Map([...(graph.document.subgraphs || []),...pending].map(f => [f.id,f]));
  const active = new Set<string>(),done = new Set<string>();
  const visit = (id:string):void => {
    if (active.has(id)) throw Error('Subgraph reference cycle');
    if (done.has(id)) return;
    const f=all.get(id);if(!f)throw Error('Missing nested Subgraph');
    active.add(id);
    for (const n of f.graph.nodes) {const child=reference(graph,n);if(child)visit(child);}
    active.delete(id);done.add(id);
  };
  pending.forEach(f=>visit(f.id));
  // A Library copy coming in is the legal "add a copy" (amendment 2 B1): an identity the ledger has never held, entered in its tidy
  // final form so the end of the edit leaves it as recorded. 帶進來的 Library 副本＝合法的「加入副本」：帳本沒見過的身分，以整理好的最後樣子入帳，
  // 修改結束時的整理不會再動它。
  for (const f of pending) {
    if (f.libraryId === undefined) continue;
    if (graph.library.state(f.id,f.libraryId) !== undefined) throw readOnly('this identity was already used in this edit');
    settle(graph,f);
    graph.library.set(f.id,f.libraryId,{kind:'content',data:f});
  }
  if (pending.length) (graph.document.subgraphs ||= []).push(...pending);
  return pending;
}

/** Make Single User (basic design §3.10): copy only this instance's definition for this one instance. Nested children remain
 * shared; the graph already owns their complete content. The copy is named by the one naming rule (node_names.ts), not
 * "… Copy". 設為唯一：只為這個實例複製一份定義；巢狀仍共用；名稱走同一套撞名規則，不加「Copy」。 */
export function independentSubgraph(network:Network,nodeId:string,next:AllocateSubgraphId,at=now()):SubgraphData|null {
  network.assertEditable();
  const graph=network.graph,n=network.nodeData(nodeId);
  if(!n)throw Error('Subgraph instance no longer exists');
  const id=reference(graph,n),source=graph.document.subgraphs?.find(f=>f.id===id);
  if(!source)return null;
  // The copy of a Library copy is local (§3.10) and records where it came from (C6): read the copy as it stands, then drop the Library
  // ID. Library 副本的複本是本地的，記下出處。
  requireCurrent(graph.library,source);
  ensureSubgraphCapacity(graph,1);
  const newId=allocate(new Set(graph.document.subgraphs!.map(f=>f.id)),next);
  const f=copy(source);f.id=newId;localize(f,at);f.title=freeName(source.title,new Set(graph.document.subgraphs!.map(d=>d.title)),80);
  remapScopes(f,new Map([[source.id,newId]]));
  const params=parameters(graph,n,newId);
  const owned=appendSubgraphs(graph,[f])[0]!;
  n.params=params;return owned;
}
