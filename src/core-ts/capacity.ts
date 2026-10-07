import type { Graph, NetworkData } from './model';
import type { Registry } from './node_module';
import { CORE_CONFIG, type CoreConfig } from './config';

/** Graph size against the core configuration (design-interview, 2026-10-08).
 * GraphDocument checks this once, at the end of every change: an edit that makes the graph
 * exceed a limit, or exceed it further, is refused as a whole. Opening never refuses: a graph
 * already over a limit stays visible and editable, and only growth is blocked (the user's work
 * is kept, it just cannot generate code). The document's byte size is the host's limit and is
 * checked where the document is serialized for delivery.
 * 圖的大小對照核心設定。GraphDocument 只在每次修改結束時檢查一次：讓圖超過上限、或超得更多的修改整筆拒絕。
 * 開圖不擋：已超過的圖照樣能看能改，只擋「變大」；作品保留、只是暫時無法產碼。文件位元組屬宿主，於送出序列化時檢查。
 */
export type CapacityKey = 'nodesPerNetwork' | 'edgesPerNetwork' | 'expandedNodes' | 'subgraphDefinitions';
export type Measure = { key:CapacityKey; network?:string; value:number; limit:number };

function networks(g:Graph):[string,NetworkData][] {
  return [...Object.entries(g.stages||{}).map(([id,data])=>[id,data] as [string,NetworkData]),
    ...(g.subgraphs||[]).map(f=>['function:'+f.id,f.graph] as [string,NetworkData])];
}

/** Every measure of the graph, with its limit. Expanded size counts a subgraph instance as the
 * expanded size of its definition (an estimate of what the subgraph compiler builds). */
export function measure(g:Graph,registry:Registry,config:CoreConfig=CORE_CONFIG):Measure[] {
  const definitions=new Map((g.subgraphs||[]).map(f=>[f.id,f.graph] as [string,NetworkData]));
  const expanded=new Map<string,number>(),visiting=new Set<string>();
  const size=(data:NetworkData,key:string):number=>{
    if(expanded.has(key))return expanded.get(key)!;
    if(visiting.has(key))return 0; // cycles are refused elsewhere; do not loop here
    visiting.add(key);
    let total=0;
    for(const n of data.nodes){
      const ref=registry.get(n.nodeType)?.referencedGraph?.(n),inner=ref?definitions.get(ref):undefined;
      total+=inner?size(inner,'function:'+ref):1;
    }
    visiting.delete(key);expanded.set(key,total);return total;
  };
  const result:Measure[]=[{key:'subgraphDefinitions',value:definitions.size,limit:config.subgraphDefinitions}];
  for(const [id,data] of networks(g)){
    result.push({key:'nodesPerNetwork',network:id,value:data.nodes.length,limit:config.nodesPerNetwork});
    result.push({key:'edgesPerNetwork',network:id,value:data.edges.length,limit:config.edgesPerNetwork});
  }
  for(const [id,data] of Object.entries(g.stages||{}))
    result.push({key:'expandedNodes',network:id,value:size(data as NetworkData,id),limit:config.expandedNodes});
  return result;
}

/** Measures over their limit; used to report an over-limit graph when it is opened. */
export function overLimit(g:Graph,registry:Registry,config:CoreConfig=CORE_CONFIG):Measure[] {
  return measure(g,registry,config).filter(m=>m.value>m.limit);
}

export class CapacityError extends Error {
  constructor(readonly measures:readonly Measure[]){
    super('Graph limit reached: '+measures.map(m=>`${m.key}${m.network?' ('+m.network+')':''} ${m.value}/${m.limit}`).join(', '));
    this.name='CapacityError';
  }
}

/** Refuses growth beyond a limit; shrinking an over-limit graph is always allowed. */
export function requireCapacity(before:Graph,after:Graph,registry:Registry,config:CoreConfig=CORE_CONFIG):void {
  const id=(m:Measure)=>m.key+'|'+(m.network??'');
  const previous=new Map(measure(before,registry,config).map(m=>[id(m),m.value]));
  const grown=measure(after,registry,config).filter(m=>m.value>m.limit&&m.value>(previous.get(id(m))??0));
  if(grown.length)throw new CapacityError(grown);
}
