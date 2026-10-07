import { copy, type Node, type SubgraphData, type InterfacePort, type ObjectValue, type Value, type NetworkData } from './model';
import type { GraphDocument, Network } from './graph';
import { CORE_CONFIG } from './config';
import type { NodeModule } from './node_module';
import type { PortSpec } from './ports';
import { ScopeReferences } from './scope_references';
import {types as valueTypes,fill} from './values';

export interface SubgraphOptions {id:string;name:string;stage:string}
export interface GroupOptions extends SubgraphOptions {
  callId:string;
  /** Transitional descriptions only for types/nodes without a migrated module. */
  port?:(node:Node,direction:'input'|'output',key:string)=>PortSpec;
  defaultValue?:(type:string)=>Value;
  inputName?:(source:Node,port:string,fallback:string)=>string;
  ui?:ObjectValue;
}

const validId = (id:string) => /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(id);
function structural(graph:GraphDocument,role:'call'|'input'|'output'):NodeModule {
  const matches = graph.registry.modules.filter(m => m.structural &&
    (role === 'call' ? !!m.reference : m.role === 'subgraph-' + role));
  if (matches.length !== 1) throw Error('Subgraph structural module is unavailable or ambiguous');
  return matches[0]!;
}
function authored(module:NodeModule,id:string,ui:ObjectValue,params:ObjectValue={}):Node {
  const d = module.catalog.definition;
  return {id,definitionUuid:d.definitionUuid!,params:{...copy(d.defaults),...params},ui};
}
export function ensureSubgraphCapacity(graph:GraphDocument,additional=0):void {
  if (!Number.isInteger(additional) || additional < 0) throw Error('Invalid definition count');
  if ((graph.document.functions?.length || 0) + additional > CORE_CONFIG.subgraphDefinitions)
    throw Object.assign(Error('At most '+CORE_CONFIG.subgraphDefinitions+' Subgraph definitions are supported'),{code:'function.limit'});
}
export function validateSubgraphData(f:SubgraphData):void {
  if (!validId(f.id)) throw Error('Invalid Subgraph identity');
  if (!f.name.trim() || f.name.length > 80 || /[\x00-\x1f\x7f]/.test(f.name))
    throw Error('Invalid Subgraph name');
  if (!['local','library','personal'].includes(f.scope) || !f.stages.length || f.stages.some(s => !['vertex','pixel'].includes(s)))
    throw Error('Invalid Subgraph scope or stage');
  for (const ports of [f.inputs,f.outputs]) {
    if (ports.length > 16 || new Set(ports.map(p => p.id)).size !== ports.length ||
        ports.some(p => !validId(p.id) || typeof p.type !== 'string' || !p.type || p.default === undefined))
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
  if (f.scope !== 'local' || graph.document.functions?.some(d => d.id === f.id))
    throw Error('Invalid or duplicate local Subgraph identity');
  validateSubgraphData(f);
}

export function insertSubgraph(graph:GraphDocument,f:SubgraphData):SubgraphData {
  validate(graph,f);
  const owned = copy(f);
  (graph.document.functions ||= []).push(owned);
  return owned;
}

export function createSubgraph(graph:GraphDocument,options:SubgraphOptions):SubgraphData {
  const input = structural(graph,'input'),output = structural(graph,'output');
  return insertSubgraph(graph,{
    id:options.id,name:options.name,scope:'local',stages:[options.stage],
    inputs:[{id:'value',name:'Value',type:'vec4',default:[1,1,1,1]}],
    outputs:[{id:'value',name:'Value',type:'vec4',default:[0,0,0,1]}],
    graph:{nodes:[{...authored(input,'input',{x:48,y:144}),name:'Input'},{...authored(output,'output',{x:624,y:144}),name:'Output'}],
      edges:[{from:['input','value'],to:['output','value']}]}
  });
}

export function instantiateSubgraph(network:Network,definitionId:string,id:string,ui:ObjectValue={}):Node {
  network.assertEditable();
  const graph = network.graph,f = graph.document.functions?.find(f => f.id === definitionId);
  if (!f) throw Error('Subgraph definition no longer exists');
  const module = structural(graph,'call');
  const n = authored(module,id,copy(ui),module.reference!(definitionId));
  // Structural graph editing also preserves interfaces whose compiler has not
  // migrated yet. Their descriptions remain the explicit editor adapter's job.
  return network.insertFragment({nodes:[n],edges:[]},{unavailable:'preserve'})[0]!.data!;
}

function defaultValue(type:string,options:GroupOptions):Value {
  if (options.defaultValue) return options.defaultValue(type);
  if (valueTypes.includes(type)) return fill(0,type);
  throw Error('A default value description is required for ' + type);
}

/** Extract selected graph content. UI supplies selection and view metadata;
 * the model owns interface deduplication, rewiring and reference relocation. */
export function groupSubgraph(network:Network,selection:ReadonlySet<string>,options:GroupOptions):Node {
  network.assertEditable();
  const graph = network.graph,data = network.data;
  const chosen = data.nodes.filter(n => selection.has(n.id)),ids = new Set(chosen.map(n => n.id));
  if (!chosen.length || chosen.length !== selection.size) throw Error('Invalid Subgraph selection');
  if (!validId(options.callId) || data.nodes.some(n => n.id === options.callId))
    throw Error('Invalid or duplicate instance identity');
  if (chosen.some(n => {
    const role = graph.registry.get(n.definitionUuid)?.role;
    return role && role !== 'value';
  })) throw Error('Stage outputs and Subgraph boundaries cannot be grouped');
  const unique = (base:string) => {let id=base,i=0;while(ids.has(id))id=base+'_'+ ++i;ids.add(id);return id;};
  const inputId = unique('input'),outputId = unique('output');
  // Boundary IDs are not members of the original selection.
  const selected = new Set(chosen.map(n => n.id));
  const inputs:InterfacePort[]=[],outputs:InterfacePort[]=[],edges:NetworkData['edges']=[],outside:NetworkData['edges']=[];
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
        const id = 'in'+(inputs.length+1);incoming.set(key,id);
        const value = n.inputValues?.[e.to[1]] ?? spec.default ?? defaultValue(spec.type,options);
        inputs.push({id,name:options.inputName?.(byId.get(e.from[0])!,e.from[1],e.to[1]) || e.to[1],type:spec.type,default:copy(value)});
        outside.push({...e,to:[options.callId,id]});
      }
      edges.push({...e,from:[inputId,incoming.get(key)!]});
    } else {
      const n = byId.get(e.from[0])!,spec = port(n,'output',e.from[1]),key = JSON.stringify(e.from);
      if (!outgoing.has(key)) {
        const id = 'out'+(outputs.length+1);outgoing.set(key,id);
        outputs.push({id,name:e.from[1],type:spec.type,default:defaultValue(spec.type,options)});
        edges.push({...e,to:[outputId,id]});
      }
      outside.push({...e,from:[options.callId,outgoing.get(key)!]});
    }
  }
  const coordinate = (n:Node,key:'x'|'y') => Number(n.ui?.[key] ?? 0);
  const x = Math.min(...chosen.map(n => coordinate(n,'x'))),y = Math.min(...chosen.map(n => coordinate(n,'y')));
  const nodes:Node[] = chosen.map(n => ({...copy(n),ui:{...copy(n.ui || {}),x:coordinate(n,'x')-x+288,y:coordinate(n,'y')-y+144}}));
  const boundary = (role:'input'|'output',id:string,ui:ObjectValue) => {
    const n = authored(structural(graph,role),id,ui),base = role === 'input' ? 'Input' : 'Output';
    n.name=base;let suffix=0;while(nodes.some(v => v.name === n.name))n.name=base+'_'+ ++suffix;
    nodes.push(n);
  };
  boundary('input',inputId,{x:24,y:144});
  boundary('output',outputId,{x:Math.max(...nodes.map(n => Number(n.ui!.x)))+288,y:144});
  const f:SubgraphData = {id:options.id,name:options.name,scope:'local',stages:[options.stage],inputs,outputs,
    graph:{nodes,edges,...(options.ui ? {ui:copy(options.ui)} : {})}};
  validate(graph,f);
  const callModule = structural(graph,'call');
  const call = authored(callModule,options.callId,{x,y},callModule.reference!(f.id));
  const owner = graph.document.functions?.find(f => f.graph === data),oldScope = owner ? 'fn_'+owner.id : network.id;
  insertSubgraph(graph,f);
  // A move must not collect definitions used by the nodes it is moving.
  data.nodes = data.nodes.filter(n => !selected.has(n.id));data.nodes.push(call);data.edges = outside;
  ScopeReferences.walk(graph.document,(ref,old) => ref.scope === oldScope && selected.has(ref.source[0]) ?
    ScopeReferences.token('fn_'+f.id,ref.source) : old);
  return call;
}

/** Collect only the dependency closure of removed instances. Other reusable
 * definitions and the active scope remain independent graph documents. */
export function collectSubgraphs(graph:GraphDocument,roots:readonly string[],active:NetworkData):void {
  if (!roots.length) return;
  const definitions = new Map((graph.document.functions || []).map(f => [f.id,f]));
  const references = (value:unknown):Set<string> => {
    const result = new Set<string>();
    function scan(item:unknown):void {
      if (Array.isArray(item)) {item.forEach(scan);return;}
      if (!item || typeof item !== 'object') return;
      const n = item as Node;
      if (n.definitionUuid && n.params) {
        const ref = graph.registry.get(n.definitionUuid)?.referencedGraph?.(n);
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
  const candidates = closure(roots),retained = references({...graph.document,functions:[],catalogSnapshot:undefined});
  for (const [id,f] of definitions) if (!candidates.has(id) || f.graph === active) retained.add(id);
  const keep = closure(retained);
  graph.document.functions = (graph.document.functions || []).filter(f => !candidates.has(f.id) || keep.has(f.id));
}
