import type {Edge as StoredEdge} from './model';
import {compatible} from './ports';
import type {Signature} from './node_module';
export type {Signature} from './node_module';
/** Planning sees hypothetical wires that have no identity yet; stored edges always do (Q44).
 * 規劃時的假想接線還沒有 id；存進圖的接線一定有。 */
export type Edge=Omit<StoredEdge,'id'>&{id?:string};
export interface Ports {inputs:Readonly<Record<string,string>>;outputs:Readonly<Record<string,string>>}
export interface Node {id:string;definition:string;stored:Ports;variants?:readonly Signature[]}
export interface Graph {nodes:readonly Node[];edges:readonly Edge[]}
export interface Capabilities {components:Readonly<Record<string,number>>;conversions:readonly {from:string;to:string}[]}
export interface Endpoint {node:string;port:string}
export type Intent={kind:'infer';nodes?:readonly string[]}|{kind:'wire';from:Endpoint;to:Endpoint};
export interface Diagnostic {code:'cycle'|'missing-port'|'input-signature'|'downstream';node?:string;sourceType?:string;targetType?:string}
export interface Inference {
  ports:Map<string,Ports>;choices:Map<string,string>;operands:Map<string,Readonly<Record<string,string>>|null>;issues:Map<string,Diagnostic>;
  signatures:Map<string,Signature>;
}
export type Result={ok:true;inference:Inference;edges:readonly Edge[];displaced:readonly Edge[]}|{ok:false;diagnostic:Diagnostic};
const same=(a:Readonly<Record<string,string>>,b:Readonly<Record<string,string>>)=>Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([k,v])=>b[k]===v);

/** No Auto inference. Every existing output is an invariant. Only complete
 * native input tuples can change, and every retained input must still fit.
 * Creation chooses its initial output before entering this planner. */
function resolve(graph:Graph,c:Capabilities,only?:readonly string[]):Inference|Diagnostic {
  const nodes=new Map(graph.nodes.map(n=>[n.id,n])),incoming=new Map<string,Edge[]>(),outgoing=new Map<string,string[]>(),degrees=new Map<string,number>();
  const ports=new Map(graph.nodes.map(n=>[n.id,n.stored])),choices=new Map<string,string>(),operands=new Map<string,Readonly<Record<string,string>>|null>(),issues=new Map<string,Diagnostic>();
  const signatures=new Map<string,Signature>();
  for(const n of graph.nodes)degrees.set(n.id,0);
  for(const e of graph.edges){
    const list=incoming.get(e.to[0])||[];list.push(e);incoming.set(e.to[0],list);
    if(nodes.has(e.from[0])&&nodes.has(e.to[0])){degrees.set(e.to[0],degrees.get(e.to[0])!+1);const peers=outgoing.get(e.from[0])||[];peers.push(e.to[0]);outgoing.set(e.from[0],peers);}
  }
  const ready=graph.nodes.filter(n=>!degrees.get(n.id)).map(n=>n.id);
  for(let i=0;i<ready.length;i++)for(const id of outgoing.get(ready[i]!)||[]){const count=degrees.get(id)!-1;degrees.set(id,count);if(!count)ready.push(id);}
  if(ready.length!==graph.nodes.length)return {code:'cycle'};
  if(only?.some(id=>!nodes.has(id)))return {code:'missing-port'};
  for(const n of only===undefined?graph.nodes:only.map(id=>nodes.get(id)!)){
    if(!n.variants)continue;
    const links=incoming.get(n.id)||[];
    const source=(e:Edge)=>nodes.get(e.from[0])?.stored.outputs[e.from[1]];
    const candidates=n.variants.filter(v=>same(v.outputs,n.stored.outputs)&&links.every(e=>compatible(source(e),v.inputs[e.to[1]],c.components,c.conversions)));
    const conversions=(v:Signature)=>links.reduce((score,e)=>score+Number(source(e)!==v.inputs[e.to[1]]),0);
    const changes=(v:Signature)=>Object.entries(n.stored.inputs).reduce((score,[key,value])=>score+Number(v.inputs[key]!==value),0);
    candidates.sort((a,b)=>conversions(a)-conversions(b)||changes(a)-changes(b));
    const chosen=candidates[0];
    if(!chosen){issues.set(n.id,{code:'input-signature',node:n.id});continue;}
    ports.set(n.id,{inputs:chosen.inputs,outputs:n.stored.outputs});choices.set(n.id,chosen.type);operands.set(n.id,chosen.operands||null);
    signatures.set(n.id,chosen);
  }
  return {ports,choices,operands,issues,signatures};
}
export function plan(graph:Graph,c:Capabilities,intent:Intent):Result {
  let candidate=graph,displaced:readonly Edge[]=[];
  if(intent.kind==='wire'){
    const source=graph.nodes.find(n=>n.id===intent.from.node),target=graph.nodes.find(n=>n.id===intent.to.node);
    if(!source?.stored.outputs[intent.from.port]||!target?.stored.inputs[intent.to.port])return {ok:false,diagnostic:{code:'missing-port'}};
    displaced=graph.edges.filter(e=>e.to[0]===intent.to.node&&e.to[1]===intent.to.port);
    candidate={nodes:graph.nodes,edges:[...graph.edges.filter(e=>!displaced.includes(e)),{from:[intent.from.node,intent.from.port],to:[intent.to.node,intent.to.port]}]};
  }
  const inference=resolve(candidate,c,intent.kind==='wire'?[intent.to.node]:intent.nodes);
  if('code' in inference)return {ok:false,diagnostic:inference};
  if(intent.kind==='wire'){
    const issue=inference.issues.get(intent.to.node);if(issue)return {ok:false,diagnostic:issue};
    // Other nodes' interfaces never change. Validate only the target's inputs;
    // unrelated missing/incompatible draft edges remain editable.
    for(const e of candidate.edges)if(e.to[0]===intent.to.node){
      const sourceType=inference.ports.get(e.from[0])?.outputs[e.from[1]],targetType=inference.ports.get(e.to[0])?.inputs[e.to[1]];
      if(!compatible(sourceType,targetType,c.components,c.conversions))return {ok:false,diagnostic:{code:'downstream',node:intent.to.node,sourceType,targetType}};
    }
  }
  return {ok:true,inference,edges:candidate.edges,displaced};
}
