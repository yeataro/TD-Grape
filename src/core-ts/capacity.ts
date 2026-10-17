import type { Graph, NetworkData } from './model';
import type { Registry } from './node_module';
import { CORE_CONFIG, type CoreConfig } from './config';

/** Graph size against the core configuration (design-interview, 2026-10-08).
 * GraphDocument checks this once, at the end of every change: an edit that makes the graph
 * exceed a limit, or exceed it further, is refused as a whole. Opening never refuses: a graph
 * already over a limit stays visible and editable, and only growth is blocked (the user's work
 * is kept, it just cannot generate code). The document's byte size is checked here too, on the text that is sent, before anything is
 * published, recorded or sent (amendment 3 C9, Codex A3-3: the host refused it only after the edit was in).
 * 圖的大小對照核心設定。GraphDocument 只在每次修改結束時檢查一次：讓圖超過上限、或超得更多的修改整筆拒絕。
 * 開圖不擋：已超過的圖照樣能看能改，只擋「變大」；作品保留、只是暫時無法產碼。文件位元組也在這裡、以送出的文字檢查，在發布、記錄、
 * 送出之前（原本要到宿主才擋，修改已經進去了）。
 */
export type CapacityKey = 'nodesPerNetwork' | 'edgesPerNetwork' | 'expandedNodes' | 'documentBytes';

/** Room kept for `savedBy`, which the editor writes when it sends the graph (host_sync.ts); the core measures without it.
 * 留給 savedBy 的位置（編輯器送出時才寫上）；核心量的時候不含它。 */
const SAVED_BY_ROOM = 128;
/** UTF-8 bytes of a text, counted without encoding it. 文字的 UTF-8 位元組數，不必真的編碼。 */
export function utf8Bytes(text:string):number {
  let n=0;
  for(let i=0;i<text.length;i++){const u=text.charCodeAt(i);n+=u<0x80?1:u<0x800?2:u>=0xd800&&u<0xdc00?(i++,4):3;}
  return n;
}
/** The bytes the host will receive for this graph (its text as sent, `savedBy` included). 宿主會收到的位元組數（送出的文字，含 savedBy）。 */
export function documentBytes(g:Graph):number {
  const {savedBy:_,...rest}=g;
  return utf8Bytes(JSON.stringify(rest))+SAVED_BY_ROOM;
}
export type Measure = { key:CapacityKey; network?:string; value:number; limit:number };

function networks(g:Graph):[string,NetworkData][] {
  return [...Object.entries(g.stages||{}).map(([id,data])=>[id,data] as [string,NetworkData]),
    ...(g.subgraphs||[]).map(f=>['subgraph:'+f.id,f.graph] as [string,NetworkData])];
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
      total+=inner?size(inner,'subgraph:'+ref):1;
    }
    visiting.delete(key);expanded.set(key,total);return total;
  };
  const result:Measure[]=[{key:'documentBytes',value:documentBytes(g),limit:config.documentBytes}];
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
  // The graph before is measured only when the one after is over a limit, so an ordinary edit serializes once. 只有修改後超過上限
  // 才量修改前的圖，一般的修改只序列化一次。
  const over=measure(after,registry,config).filter(m=>m.value>m.limit);
  if(!over.length)return;
  const previous=new Map(measure(before,registry,config).map(m=>[id(m),m.value]));
  const grown=over.filter(m=>m.value>(previous.get(id(m))??0));
  if(grown.length)throw new CapacityError(grown);
}
