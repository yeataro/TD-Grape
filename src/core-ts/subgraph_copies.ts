import { copy, type Node, type SubgraphData, type ObjectValue } from './model';
import type { GraphDocument, Network } from './graph';
import { ensureSubgraphCapacity, validateSubgraphData, withoutStoredUse } from './subgraph_operations';
import { ScopeReferences } from './scope_references';

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
  if (pending.length) (graph.document.subgraphs ||= []).push(...pending);
  return pending;
}

/** Turn a source-owned definition and its source callers into editable local
 * copies. Stored source snapshots remain byte-for-byte authored data. */
export function localizeSubgraph(graph:GraphDocument,id:string,next:AllocateSubgraphId):Map<string,string> {
  graph.assertEditable();
  const definitions=graph.document.subgraphs || [],target=definitions.find(f=>f.id===id);
  if (!target || target.scope==='local') return new Map();
  const affected=new Set([id]);let added=true;
  while (added) {
    added=false;
    for (const f of definitions) {
      if (f.scope==='local' || affected.has(f.id)) continue;
      let depends=f.graph.nodes.some(n=>affected.has(reference(graph,n) || ''));
      ScopeReferences.walk(f,(ref,old)=>{if(ref.scope.startsWith('fn_')&&affected.has(ref.scope.slice(3)))depends=true;return old;},false);
      if (depends) {affected.add(f.id);added=true;}
    }
  }
  ensureSubgraphCapacity(graph,affected.size);
  const ids=new Map<string,string>(),used=new Set(definitions.map(f=>f.id));
  for (const old of affected) ids.set(old,allocate(used,next));
  const changed=definitions.filter(f=>affected.has(f.id)),snapshots=changed.map(f=>copy(f));
  const writable=definitions.filter(f=>f.scope==='local'||affected.has(f.id));
  const networks=[...Object.values(graph.document.stages),...writable.map(f=>f.graph)];
  const patches:{node:Node;params:ObjectValue}[]=[];
  for (const data of networks) for (const n of data.nodes) {
    const old=reference(graph,n),mapped=old&&ids.get(old);
    if(mapped)patches.push({node:n,params:parameters(graph,n,mapped)});
  }
  // Prepare all IDs, snapshots and module commands before the first write.
  // Keep node/data objects alive for current editor callbacks during migration.
  for (const f of changed) {
    // `origin` already records where a snapshot came from; `scope` tells whether it is still one (Q44).
    // origin 已記錄來源；是否仍是唯讀副本由 scope 看出。
    f.id=ids.get(f.id)!;f.scope='local';
  }
  for (const p of patches) p.node.params=p.params;
  remapScopes([...Object.values(graph.document.stages),...writable,graph.document.structDefinitions || []],ids);
  definitions.push(...snapshots);
  return ids;
}

/** Copy only this instance's definition. Nested children remain shared, as
 * before; the graph already owns their complete content. */
export function independentSubgraph(network:Network,nodeId:string,next:AllocateSubgraphId):SubgraphData|null {
  network.assertEditable();
  const graph=network.graph,n=network.nodeData(nodeId);
  if(!n)throw Error('Subgraph instance no longer exists');
  const id=reference(graph,n),source=graph.document.subgraphs?.find(f=>f.id===id);
  if(!source)return null;
  ensureSubgraphCapacity(graph,1);
  const newId=allocate(new Set(graph.document.subgraphs!.map(f=>f.id)),next);
  const f=copy(source);f.id=newId;f.name=f.name.slice(0,75)+' Copy';f.scope='local';
  remapScopes(f,new Map([[source.id,newId]]));
  const params=parameters(graph,n,newId);
  const owned=appendSubgraphs(graph,[f])[0]!;
  n.params=params;return owned;
}
