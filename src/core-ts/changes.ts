import { copy, type Graph, type NetworkData, type Node, type Edge } from './model';
import { contextFor, resolvePorts, type Registry } from './node_module';

export interface NodeChange {id:string;fields:string[];params:string[];inputs:string[];ui:string[]}
export interface PortChange {node:string;direction:'input'|'output';key:string;before?:string;after?:string}
export interface EdgeChange {id?:string;before?:Edge;after?:Edge}
export interface NetworkChange {
  id:string;added:string[];removed:string[];nodes:NodeChange[];ports:PortChange[];edges:EdgeChange[];
  order:boolean;metadata:boolean;complete:boolean;
}
export interface GraphChanges {changed:boolean;global:string[];definitions:string[];networks:NetworkChange[]}
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'?value as Record<string,unknown>:{};
/** JSON equality independent of property insertion order. Array order matters. */
export function equal(a:unknown,b:unknown):boolean {
  if(a===b)return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const x=record(a),y=record(b),keys=Object.keys(x);
  return keys.length===Object.keys(y).length&&keys.every(k=>Object.prototype.hasOwnProperty.call(y,k)&&equal(x[k],y[k]));
}
const keys=(a:unknown,b:unknown)=>[...new Set([...Object.keys(record(a)),...Object.keys(record(b))])].filter(k=>!equal(record(a)[k],record(b)[k]));
function networks(g:Graph):Map<string,NetworkData> {
  return new Map([...Object.entries(g.stages),...(g.subgraphs||[]).map(raw=>{const f=raw as {id:string;graph:NetworkData};return ['function:'+f.id,f.graph] as [string,NetworkData];})]);
}
function metadata(g:Graph) {
  const {stages,subgraphs,catalogSnapshot,...rest}=g as Graph&{catalogSnapshot?:unknown};
  return {...rest,subgraphs:(subgraphs||[]).map(raw=>{const {graph,...definition}=raw as {graph:NetworkData};return definition;})};
}
const networkMetadata=(data?:NetworkData)=>{const {nodes,edges,...rest}=data||{};return rest;};
function portTypes(g:Graph,node:Node|undefined,registry:Registry,networkId:string) {
  if(!node)return {inputs:{},outputs:{}};
  const module=registry.get(node.nodeType),context=contextFor(g,g.subgraphs?.find(f=>'function:'+f.id===networkId));
  if(!module?.supports(node,context))return undefined;
  try{return resolvePorts(module,node,context).types();}catch{return undefined;}
}
/** Model publication, also used for snapshot Undo/Redo. This transitional
 * publication diff is shared by views; candidate planning may compare its own
 * inputs. Unknown/dynamic legacy contexts explicitly request fallback. */
export function changesBetween(before:Graph,after:Graph,registry:Registry):GraphChanges {
  const global=keys(metadata(before),metadata(after)).filter(k=>k!=='subgraphs'),old=networks(before),next=networks(after),changes:NetworkChange[]=[];
  const defs=(g:Graph)=>new Map((g.subgraphs||[]).map(({graph,...f})=>[f.id,f]));
  const oldDefs=defs(before),newDefs=defs(after),definitions=[...new Set([...oldDefs.keys(),...newDefs.keys()])].filter(id=>!equal(oldDefs.get(id),newDefs.get(id)));
  const affected=(n:Node|undefined,network:string)=>{if(!n)return false;const m=registry.get(n.nodeType);return definitions.includes(m?.referencedGraph?.(n)||'')||!!m?.structural&&definitions.some(id=>network==='function:'+id);};
  for(const id of new Set([...old.keys(),...next.keys()])){
    const a=old.get(id),b=next.get(id);
    if(equal(a,b)&&!global.length&&![...(a?.nodes||[]),...(b?.nodes||[])].some(n=>affected(n,id)))continue;
    const previous=new Map((a?.nodes||[]).map(n=>[n.id,n])),current=new Map((b?.nodes||[]).map(n=>[n.id,n]));
    const change:NetworkChange={id,added:[],removed:[],nodes:[],ports:[],edges:[],order:!equal([...previous.keys()],[...current.keys()]),metadata:!equal(networkMetadata(a),networkMetadata(b)),complete:!global.length&&!!a&&!!b};
    for(const nodeId of new Set([...previous.keys(),...current.keys()])){
      const x=previous.get(nodeId),y=current.get(nodeId);
      // Legacy modules may depend on other nodes/definitions; until migrated,
      // an affected mixed network keeps its conservative projection path.
      for(const [g,n] of [[before,x],[after,y]] as const)if(n&&!registry.get(n.nodeType)?.supports(n,contextFor(g,g.subgraphs?.find(f=>'function:'+f.id===id))))change.complete=false;
      if(!x)change.added.push(nodeId);if(!y)change.removed.push(nodeId);
      if(equal(x,y)&&!global.length&&!affected(x,id)&&!affected(y,id))continue;
      change.nodes.push({id:nodeId,fields:[...keys(x,y),...(affected(x,id)||affected(y,id)?['interface']:[])],params:keys(x?.params,y?.params),inputs:keys(x?.inputValues,y?.inputValues),ui:keys(x?.ui,y?.ui)});
      const from=portTypes(before,x,registry,id),to=portTypes(after,y,registry,id);
      if(!from||!to){change.complete=false;continue;}
      for(const direction of ['input','output'] as const){
        const left=direction==='input'?from.inputs:from.outputs,right=direction==='input'?to.inputs:to.outputs;
        for(const key of keys(left,right))change.ports.push({node:nodeId,direction,key,before:left[key],after:right[key]});
      }
    }
    // Edges without IDs are transitional. Their endpoints supply a stable
    // comparison identity until publication materializes persistent IDs.
    const identity=(e:Edge)=>e.id||JSON.stringify([e.from,e.to]);
    const left=new Map((a?.edges||[]).map(e=>[identity(e),e])),right=new Map((b?.edges||[]).map(e=>[identity(e),e]));
    for(const key of new Set([...left.keys(),...right.keys()])){
      const x=left.get(key),y=right.get(key);if(!equal(x,y))change.edges.push({id:y?.id||x?.id,before:x&&copy(x),after:y&&copy(y)});
    }
    changes.push(change);
  }
  // Include persisted sequence/unknown fields even when no view needs repaint.
  return {changed:!equal(before,after),global,definitions,networks:changes};
}
