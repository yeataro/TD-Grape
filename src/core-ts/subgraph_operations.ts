import { freeName } from './node_names';
import { copy, type Node, type SubgraphData, type InterfacePort, type ObjectValue, type Value, type NetworkData } from './model';
import type { GraphDocument, Network } from './graph';
import { CORE_CONFIG } from './config';
import type { NodeModule } from './node_module';
import type { PortSpec } from './ports';
import { ScopeReferences } from './scope_references';
import {types as valueTypes,fill,opaque} from './values';
import { completeGroups, groupsOf } from './groups';
import type { Registry } from './node_module';
import type { Graph } from './model';

export interface SubgraphOptions {id:string;name:string}
export interface SelectionSubgraphOptions extends SubgraphOptions {
  callId:string;
  /** Transitional descriptions only for types/nodes without a migrated module. */
  port?:(node:Node,direction:'input'|'output',key:string)=>PortSpec;
  defaultValue?:(type:string)=>Value;
  inputName?:(source:Node,port:string,fallback:string)=>string;
  ui?:ObjectValue;
}

const validId = (id:string) => /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(id);
/** A new port identity: random and unique like node and edge IDs (Q44); the number after `in`/`out` is not an identity
 * (basic design §4 row 6). 新接口的身分：和節點、接線一樣隨機、不重複；序號不是身分。 */
export function newPortId(taken:ReadonlySet<string>):string {
  for(;;){
    let id='p';for(let i=0;i<3;i++)id+=Math.floor(Math.random()*0x100000000).toString(16).padStart(8,'0');
    if(!taken.has(id))return id;
  }
}
const validLabel = (label:unknown) => label === undefined || (typeof label === 'string' && label.length <= 80 && !/[\x00-\x1f\x7f]/.test(label));
/** Whether one port's data is well formed: an opaque port has no default, a numeric one must have one (§3.4, amendment B5).
 * 一筆接口的資料是否完整：opaque 沒有 default、數值一定有。 */
export function validPort(p:InterfacePort):boolean {
  return validId(p.id) && typeof p.type === 'string' && !!p.type && validLabel(p.label) &&
    (opaque.includes(p.type) ? p.default === undefined : p.default !== undefined);
}
/** Only fields the format defines, so an absent default is absent, not `undefined`. 只留格式有的欄位。 */
export function portEntry(id:string,type:string,label?:string,value?:Value):InterfacePort {
  return {id,...(label === undefined ? {} : {label}),type,...(value === undefined ? {} : {default:value})};
}
function structural(graph:GraphDocument,role:'call'|'input'|'output'):NodeModule {
  const matches = graph.registry.modules.filter(m => m.structural &&
    (role === 'call' ? !!m.reference : m.role === 'subgraph-' + role));
  if (matches.length !== 1) throw Error('Subgraph structural module is unavailable or ambiguous');
  return matches[0]!;
}
function authored(module:NodeModule,id:string,ui:ObjectValue,params:ObjectValue={}):Node {
  const d = module.catalog.definition;
  return {id,nodeType:d.definitionUuid!,params:{...copy(d.defaults),...params},ui};
}
export function ensureSubgraphCapacity(graph:GraphDocument,additional=0):void {
  if (!Number.isInteger(additional) || additional < 0) throw Error('Invalid definition count');
  if ((graph.document.subgraphs?.length || 0) + additional > CORE_CONFIG.subgraphDefinitions)
    throw Object.assign(Error('At most '+CORE_CONFIG.subgraphDefinitions+' Subgraph definitions are supported'),{code:'function.limit'});
}
export function validateSubgraphData(f:SubgraphData):void {
  if (!validId(f.id)) throw Error('Invalid Subgraph identity');
  if (!f.name.trim() || f.name.length > 80 || /[\x00-\x1f\x7f]/.test(f.name))
    throw Error('Invalid Subgraph name');
  // Stored stages and targets are not read: the graph works them out from the content and drops them (Q46).
  // 存著的 stages／targets 不讀：圖由內容推算，並把它們拿掉。
  // `libraryId` is defined by the Library round; until then a definition carrying it is refused as a whole, at every entry
  // (open, paste, append), so no half-protected Library copy can enter a document (amendment 2 B7). libraryId 到 Library
  // 那一輪才定義；之前帶著它的定義整份拒絕，開檔、貼上、加入都一樣，免得出現沒受保護的 Library 副本。
  if ('libraryId' in f) throw Object.assign(Error('Subgraph definitions from a Library are not supported in this version'),{code:'subgraph.library'});
  if (f.color !== undefined && (typeof f.color !== 'string' || f.color.length > 32)) throw Error('Invalid Subgraph color');
  for (const ports of [f.inputs,f.outputs]) {
    if (!Array.isArray(ports) || ports.length > CORE_CONFIG.subgraphPortsPerSide || new Set(ports.map(p => p.id)).size !== ports.length || !ports.every(validPort))
      throw Error('Invalid Subgraph interface');
  }
  const ids = new Set(f.graph.nodes.map(n => n.id));
  if (ids.size !== f.graph.nodes.length || f.graph.nodes.length > CORE_CONFIG.nodesPerNetwork || f.graph.edges.length > CORE_CONFIG.edgesPerNetwork ||
      [...ids].some(id => !validId(id))) throw Error('Invalid Subgraph network');
  for (const e of f.graph.edges) if (!ids.has(e.from[0]) || !ids.has(e.to[0]))
    throw Error('Invalid Subgraph edge endpoint');
}
function validate(graph:GraphDocument,f:SubgraphData):void {
  graph.assertEditable();ensureSubgraphCapacity(graph,1);
  if (graph.document.subgraphs?.some(d => d.id === f.id))
    throw Error('Invalid or duplicate Subgraph identity');
  validateSubgraphData(f);
}

/** A definition as the graph keeps it: what it can be used in is worked out from its content, not stored (Q46).
 * 圖裡保存的定義：能用在哪裡由內容推算，不存。 */
export function withoutStoredUse(f:SubgraphData):SubgraphData {delete f.stages;delete f.targets;return f;}
export function insertSubgraph(graph:GraphDocument,f:SubgraphData):SubgraphData {
  const owned = withoutStoredUse(copy(f));
  validate(graph,owned);
  (graph.document.subgraphs ||= []).push(owned);
  return owned;
}

export function createSubgraph(graph:GraphDocument,options:SubgraphOptions):SubgraphData {
  const input = structural(graph,'input'),output = structural(graph,'output');
  const taken = new Set<string>(),inId = newPortId(taken);taken.add(inId);const outId = newPortId(taken);
  return insertSubgraph(graph,{
    id:options.id,name:options.name,
    inputs:[portEntry(inId,'vec4','in1',[1,1,1,1])],
    outputs:[portEntry(outId,'vec4','out1',[0,0,0,1])],
    graph:{nodes:[{...authored(input,'input',{x:48,y:144}),name:'Input'},{...authored(output,'output',{x:624,y:144}),name:'Output'}],
      edges:[{id:graph.nextEdgeId({nodes:[],edges:[]}),from:['input',inId],to:['output',outId]}]}
  });
}

export function instantiateSubgraph(network:Network,definitionId:string,id:string,ui:ObjectValue={}):Node {
  network.assertEditable();
  const graph = network.graph,f = graph.document.subgraphs?.find(f => f.id === definitionId);
  if (!f) throw Error('Subgraph definition no longer exists');
  const module = structural(graph,'call');
  const n = authored(module,id,copy(ui),module.reference!(definitionId));
  // Structural graph editing also preserves interfaces whose compiler has not
  // migrated yet. Their descriptions remain the explicit editor adapter's job.
  return network.insertFragment({nodes:[n],edges:[]},{unavailable:'preserve'})[0]!.data!;
}

function defaultValue(type:string,options:SelectionSubgraphOptions):Value {
  if (options.defaultValue) return options.defaultValue(type);
  if (valueTypes.includes(type)) return fill(0,type);
  throw Error('A default value description is required for ' + type);
}

/** Extract selected graph content. UI supplies selection and view metadata;
 * the model owns interface deduplication, rewiring and reference relocation. */
export function subgraphFromSelection(network:Network,selection:ReadonlySet<string>,options:SelectionSubgraphOptions):Node {
  network.assertEditable();
  const graph = network.graph,data = network.data;
  const chosen = data.nodes.filter(n => selection.has(n.id)),ids = new Set(chosen.map(n => n.id));
  if (!chosen.length || chosen.length !== selection.size) throw Error('Invalid Subgraph selection');
  if (!validId(options.callId) || data.nodes.some(n => n.id === options.callId))
    throw Error('Invalid or duplicate instance identity');
  if (chosen.some(n => {
    const role = graph.registry.get(n.nodeType)?.role;
    return role && role !== 'value';
  })) throw Error('Stage outputs and Subgraph boundaries cannot be made into a subgraph');
  const unique = (base:string) => {let id=base,i=0;while(ids.has(id))id=base+'_'+ ++i;ids.add(id);return id;};
  const inputId = unique('input'),outputId = unique('output');
  // Boundary IDs are not members of the original selection.
  const selected = new Set(chosen.map(n => n.id));
  const inputs:InterfacePort[]=[],outputs:InterfacePort[]=[],edges:NetworkData['edges']=[],outside:NetworkData['edges']=[];
  // Port identities are generated; labels come from the peer port and get a number when one side repeats a label (§3.3).
  // 接口身分產生式；標籤取對端接孔名，同一邊重複時加編號。
  const portIds = new Set<string>(),labels = {inputs:new Set<string>(),outputs:new Set<string>()};
  const newPort = (side:'inputs'|'outputs',type:string,label:string,value:Value|undefined) => {
    const id = newPortId(portIds);portIds.add(id);
    const text = freeName(label,labels[side],80);labels[side].add(text);
    return portEntry(id,type,text,opaque.includes(type) ? undefined : value);
  };
  const incoming = new Map<string,string>(),outgoing = new Map<string,string>();
  const byId = new Map(data.nodes.map(n => [n.id,n]));
  const port = (n:Node,direction:'input'|'output',key:string):PortSpec => {
    const projected = network.node(n.id).interface;
    const spec = (direction === 'input' ? projected.inputs : projected.outputs)[key] || options.port?.(n,direction,key);
    if (!spec) throw Error('Missing Subgraph endpoint description');
    return spec;
  };
  for (const edge of data.edges) {
    const e = copy(edge),a = selected.has(e.from[0]),b = selected.has(e.to[0]);
    if (a && b) {edges.push(e);continue;}
    if (!a && !b) {outside.push(e);continue;}
    if (b) {
      const n = byId.get(e.to[0])!,spec = port(n,'input',e.to[1]);
      const key = JSON.stringify([e.from,spec.type]);
      if (!incoming.has(key)) {
        const value = opaque.includes(spec.type) ? undefined : copy(n.inputValues?.[e.to[1]] ?? spec.default ?? defaultValue(spec.type,options));
        const p = newPort('inputs',spec.type,options.inputName?.(byId.get(e.from[0])!,e.from[1],e.to[1]) || e.to[1],value);
        inputs.push(p);incoming.set(key,p.id);
        outside.push({...e,to:[options.callId,p.id]});
      }
      edges.push({...e,from:[inputId,incoming.get(key)!]});
    } else {
      const n = byId.get(e.from[0])!,spec = port(n,'output',e.from[1]),key = JSON.stringify(e.from);
      if (!outgoing.has(key)) {
        const p = newPort('outputs',spec.type,e.from[1],opaque.includes(spec.type) ? undefined : defaultValue(spec.type,options));
        outputs.push(p);outgoing.set(key,p.id);
        edges.push({...e,to:[outputId,p.id]});
      }
      outside.push({...e,from:[options.callId,outgoing.get(key)!]});
    }
  }
  const coordinate = (n:Node,key:'x'|'y') => Number(n.ui?.[key] ?? 0);
  const x = Math.min(...chosen.map(n => coordinate(n,'x'))),y = Math.min(...chosen.map(n => coordinate(n,'y')));
  const nodes:Node[] = chosen.map(n => ({...copy(n),ui:{...copy(n.ui || {}),x:coordinate(n,'x')-x+288,y:coordinate(n,'y')-y+144}}));
  const boundary = (role:'input'|'output',id:string,ui:ObjectValue) => {
    // Named by the one naming rule, from _1 (Refactor.76). 照同一套命名規則，從 _1 開始（R.76）。
    const n = authored(structural(graph,role),id,ui);
    n.name=freeName((role === 'input' ? 'Input' : 'Output')+'_1',new Set(nodes.flatMap(v => v.name === undefined ? [] : [v.name])));
    nodes.push(n);
  };
  boundary('input',inputId,{x:24,y:144});
  boundary('output',outputId,{x:Math.max(...nodes.map(n => Number(n.ui!.x)))+288,y:144});
  // A group whose members all move goes with them, as it is (amendment A8: complete groups and their text come along; a partial
  // group stays outside with what is left of it — the tidy at the end of the change drops the moved members). 成員全被選的群組原樣跟著
  // 進去（A8：完整群組與內文一起進；部分群組留在外面、剩下的成員還在——修改結束時的整理會拿掉搬走的成員）。
  const groups = completeGroups(groupsOf(data),selected);
  const f:SubgraphData = {id:options.id,name:options.name,inputs,outputs,
    graph:{nodes,edges,...(options.ui || groups.length ? {ui:{...copy(options.ui || {}),...(groups.length ? {groups:copy(groups) as unknown as Value} : {})}} : {})}};
  validate(graph,f);
  const callModule = structural(graph,'call');
  const call = authored(callModule,options.callId,{x,y},callModule.reference!(f.id));
  const owner = graph.document.subgraphs?.find(f => f.graph === data),oldScope = owner ? 'fn_'+owner.id : network.id;
  insertSubgraph(graph,f);
  // A move must not collect definitions used by the nodes it is moving.
  data.nodes = data.nodes.filter(n => !selected.has(n.id));data.nodes.push(call);data.edges = outside;
  ScopeReferences.walk(graph.document,(ref,old) => ref.scope === oldScope && selected.has(ref.source[0]) ?
    ScopeReferences.token('fn_'+f.id,ref.source) : old);
  return call;
}

/** The first definition that, through its calls, reaches itself; null when none does (a cycle cannot be expanded, subgraph_compiler.ts;
 * a paste or a call placed inside a definition could make one, legacy clipboard.cycle). 第一份經由呼叫回到自己的定義；沒有就是 null
 * （循環展不開；貼上或在定義裡放呼叫可能造成，照舊產品 clipboard.cycle）。 */
export function subgraphCycle(g:Graph,registry:Registry):string|null {
  const definitions = new Map((g.subgraphs || []).map(f => [f.id,f])),active = new Set<string>(),done = new Set<string>();
  const visit = (id:string):string|null => {
    if (active.has(id)) return id;
    if (done.has(id)) return null;
    const f = definitions.get(id);if (!f) return null;
    active.add(id);
    for (const n of f.graph.nodes) {const child = registry.get(n.nodeType)?.referencedGraph?.(n);if (child) {const found = visit(child);if (found) return found;}}
    active.delete(id);done.add(id);return null;
  };
  for (const id of definitions.keys()) {const found = visit(id);if (found) return found;}
  return null;
}

/** Which definitions each definition calls: the (parent, child) edges of the document's definitions. 每份定義呼叫哪些定義：父→子的邊。 */
function callEdges(g:Graph,registry:Registry):Map<string,Set<string>> {
  const edges = new Map<string,Set<string>>();
  for (const f of g.subgraphs || []) {
    const children = new Set<string>();
    for (const n of f.graph.nodes) {const child = registry.get(n.nodeType)?.referencedGraph?.(n);if (child !== undefined) children.add(child);}
    edges.set(f.id,children);
  }
  return edges;
}
/** A cycle this edit makes (technical review TECH-8): the parent of the first new (parent, child) edge whose child reaches back to
 * it, a self-call included; null when no new edge lies on a cycle. Cycles already there do not let new ones in, and an edit that
 * removes an old cycle while adding edges passes when those edges close none. 這次修改造成的循環：第一條新的父→子邊，子能走回父（含自己
 * 呼叫自己）就回傳那個父；新邊都不在循環上就是 null。已有的循環不會放行新的；拆掉舊循環、新邊不成環的修改照樣通過。 */
export function newSubgraphCycle(before:Graph,after:Graph,registry:Registry):string|null {
  const old = callEdges(before,registry),now = callEdges(after,registry);
  const reaches = (from:string,to:string):boolean => {
    const seen = new Set<string>(),stack = [from];
    while (stack.length) {
      const id = stack.pop()!;
      if (id === to) return true;
      if (seen.has(id)) continue;
      seen.add(id);stack.push(...(now.get(id) ?? []));
    }
    return false;
  };
  for (const [parent,children] of now) for (const child of children)
    if (!old.get(parent)?.has(child) && reaches(child,parent)) return parent;
  return null;
}

/** How many call nodes point at each definition, over every network of the document (the "×N" of basic design §3.6: direct
 * calls, not expanded uses). 每份定義被幾個呼叫節點指著，算遍文件的每張網路（§3.6 的「×N」：直接呼叫數，不是展開後的使用數）。 */
export function callCounts(graph:GraphDocument):ReadonlyMap<string,number> {
  const counts = new Map<string,number>();
  for (const data of [...Object.values(graph.document.stages),...(graph.document.subgraphs || []).map(f => f.graph)])
    for (const n of data.nodes) {
      const ref = graph.registry.get(n.nodeType)?.referencedGraph?.(n);
      if (ref) counts.set(ref,(counts.get(ref) ?? 0) + 1);
    }
  return counts;
}

/** Each definition's uses (visual notes 2026-10-14, ×N): `direct` = how many call nodes point at it anywhere; `expanded` = how many
 * times it is in effect once every caller is expanded (a call inside P counts P's own expanded uses). One scan of every network;
 * the gate keeps the call graph acyclic, and a cycle found anyway counts once. 每份定義的使用數：direct＝幾個呼叫節點指著它；expanded＝
 * 展開所有呼叫者後實際用到幾次（P 裡的呼叫算 P 自己的展開數）。掃每張網路一次；關卡保證無循環，萬一有就只算一次。 */
export function useCounts(graph:GraphDocument):ReadonlyMap<string,{direct:number;expanded:number}> {
  const stage = new Map<string,number>(),inside = new Map<string,Map<string,number>>();
  const bump = (m:Map<string,number>,id:string) => m.set(id,(m.get(id) ?? 0) + 1);
  for (const data of Object.values(graph.document.stages)) for (const n of data.nodes) {const ref = graph.registry.get(n.nodeType)?.referencedGraph?.(n);if (ref) bump(stage,ref);}
  for (const f of graph.document.subgraphs || []) {
    const calls = new Map<string,number>();
    for (const n of f.graph.nodes) {const ref = graph.registry.get(n.nodeType)?.referencedGraph?.(n);if (ref) bump(calls,ref);}
    if (calls.size) inside.set(f.id,calls);
  }
  const parents = new Map<string,{parent:string;count:number}[]>();
  for (const [parent,calls] of inside) for (const [child,count] of calls) (parents.get(child) ?? parents.set(child,[]).get(child)!).push({parent,count});
  const expanded = new Map<string,number>(),active = new Set<string>();
  const total = (id:string):number => {
    const known = expanded.get(id);if (known !== undefined) return known;
    if (active.has(id)) return 0;
    active.add(id);
    let n = stage.get(id) ?? 0;
    for (const {parent,count} of parents.get(id) ?? []) n += count * total(parent);
    active.delete(id);expanded.set(id,n);return n;
  };
  const result = new Map<string,{direct:number;expanded:number}>();
  for (const f of graph.document.subgraphs || []) {
    const direct = (stage.get(f.id) ?? 0) + [...inside.values()].reduce((sum,calls) => sum + (calls.get(f.id) ?? 0),0);
    result.set(f.id,{direct,expanded:total(f.id)});
  }
  return result;
}

/** Remove a definition nobody calls (the subgraph panel's Delete on a zero-use card, basic design §3.9); one still called is
 * refused. 刪掉沒人呼叫的定義（子圖面板上 0 個引用的卡片的刪除，§3.9）；還有人呼叫的拒絕。 */
export function removeSubgraph(graph:GraphDocument,id:string):void {
  graph.assertEditable();
  const definitions = graph.document.subgraphs || [];
  if (!definitions.some(f => f.id === id)) throw Error('Subgraph definition no longer exists');
  if (callCounts(graph).get(id)) throw Object.assign(Error('The Subgraph definition is still in use'),{code:'subgraph.inUse'});
  graph.document.subgraphs = definitions.filter(f => f.id !== id);
}

/** Collect, among the dependency closure of removed instances, only definitions the caller names as collectible: Library
 * copies that can be brought back whole (basic design §3.9, amendments A4/B2; the caller resolves them, the core never reads a
 * Library). A local definition is never collected: deleting a call must not lose the person's work; it stays listed in the
 * subgraph panel with zero uses. Other reusable definitions and the active scope remain untouched.
 * 刪掉呼叫後只回收呼叫端指名「可回收」的定義（能整份拉回來的 Library 副本；由呼叫端解析，核心不讀 Library）。本地定義永不回收：
 * 刪錯呼叫不該把人做的子圖弄丟，它留在子圖面板、顯示 0 個引用。 */
export function collectSubgraphs(graph:GraphDocument,roots:readonly string[],active:NetworkData,collectible:ReadonlySet<string>):void {
  if (!roots.length || !collectible.size) return;
  const definitions = new Map((graph.document.subgraphs || []).map(f => [f.id,f]));
  const references = (value:unknown):Set<string> => {
    const result = new Set<string>();
    function scan(item:unknown):void {
      if (Array.isArray(item)) {item.forEach(scan);return;}
      if (!item || typeof item !== 'object') return;
      const n = item as Node;
      if (n.nodeType && n.params) {
        const ref = graph.registry.get(n.nodeType)?.referencedGraph?.(n);
        if (ref) result.add(ref);
      }
      for (const [key,child] of Object.entries(item))
        if (!['ui','source','origin','code','catalogSnapshot'].includes(key)) scan(child);
    }
    scan(value);
    ScopeReferences.walk(value,(ref,old) => {if(ref.scope.startsWith('fn_'))result.add(ref.scope.slice(3));return old;},false);
    return result;
  };
  const dependencies = new Map([...definitions].map(([id,f]) => [id,references(f)]));
  const closure = (seeds:Iterable<string>) => {
    const seen = new Set<string>(),pending=[...seeds];
    while (pending.length) {const id=pending.pop()!;if(seen.has(id))continue;seen.add(id);pending.push(...(dependencies.get(id)||[]));}
    return seen;
  };
  const candidates = closure(roots),retained = references({...graph.document,subgraphs:[],catalogSnapshot:undefined});
  for (const [id,f] of definitions) if (!candidates.has(id) || f.graph === active) retained.add(id);
  const keep = closure(retained);
  graph.document.subgraphs = (graph.document.subgraphs || []).filter(f => !candidates.has(f.id) || keep.has(f.id) || !collectible.has(f.id));
}
