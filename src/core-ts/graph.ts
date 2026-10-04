import { copy, type Graph, type Node as NodeData, type Edge as EdgeData, type ObjectValue, type Value } from './model';
import { contextFor, resolvePorts, configureNode, editNode, type Configuration, type NodeContext, type Registry } from './node_module';
import { NodePorts, compatible, type PortSpec } from './ports';
import { plan, type Intent, type Ports } from './wire_planning';
import { changesBetween, equal, type GraphChanges } from './changes';
export { changesBetween } from './changes';
export { contextFor } from './node_module';
import { Subgraph } from './subgraphs';
import { createSubgraph, groupSubgraph, instantiateSubgraph, collectSubgraphs, type SubgraphOptions, type GroupOptions } from './subgraph_operations';
export { ScopeReferences } from './scope_references';

type NetworkData=Graph['stages'][string];
export interface ConnectionPolicy {components:Readonly<Record<string,number>>;conversions:readonly {from:string;to:string}[]}
export type PortResolver=(node:NodeData,networkId:string)=>readonly PortSpec[];
function clone<T>(value:T,immutable=false):T {
  if(!value||typeof value!=='object')return value;
  const result=Array.isArray(value)?[]:{};
  for(const key of Object.keys(value)){
    const entry=clone((value as Record<string,unknown>)[key],immutable);
    if(key==='__proto__')Object.defineProperty(result,key,{value:entry,enumerable:true,writable:true,configurable:true});
    else (result as Record<string,unknown>)[key]=entry;
  }
  return (immutable?Object.freeze(result):result) as T;
}
/** A network-local object identity is independent of its label or canvas order.
 * Node/Port/Edge handles query the same graph-owned document. Missing endpoints
 * remain addressable; no validation path deletes or silently rewires them. */
export class Port {
  constructor(readonly node:Node,readonly direction:'input'|'output',readonly key:string){}
  get spec(){return (this.direction==='input'?this.node.interface.inputs:this.node.interface.outputs)[this.key];}
  get exists(){return !!this.spec;}
  get type(){return this.spec?.type;}
  get default(){return this.spec?.default;}
  get edges():Edge[]{return this.node.network.edgesAt(this);}
  get endpoint():readonly [string,string]{return [this.node.id,this.key];}
  connect(to:Port,policy:ConnectionPolicy){return this.node.network.connect(this,to,policy);}
}
export class Node {
  private readonly handles=new Map<string,Port>();
  private resolved?:NodePorts;
  private stored?:NodeData;
  private module?:ReturnType<Registry['get']>;
  constructor(readonly network:Network,readonly id:string){}
  get data(){if(this.stored)return this.stored;const value=this.network.nodeData(this.id);if(!this.network.graph.editable)this.stored=value;return value;}
  get definition(){if(this.module)return this.module;const data=this.data,value=data&&this.network.graph.registry.get(data.definitionUuid);if(!this.network.graph.editable)this.module=value;return value;}
  get interface():NodePorts {
    if(this.resolved)return this.resolved;
    const n=this.data;if(!n)return new NodePorts([]);
    const module=this.definition;
    const result=module&&module.supports(n,this.network.context)?resolvePorts(module,n,this.network.context):new NodePorts(this.network.graph.fallback?.(n,this.network.id)||[]);
    if(!this.network.graph.editable)this.resolved=result;return result;
  }
  port(direction:'input'|'output',key:string):Port {
    const identity=(direction==='input'?'i':'o')+key;let p=this.handles.get(identity);
    if(!p){p=new Port(this,direction,key);this.handles.set(identity,p);}return p;
  }
  get inputs(){return Object.keys(this.interface.inputs).map(k=>this.port('input',k));}
  get outputs(){return Object.keys(this.interface.outputs).map(k=>this.port('output',k));}
  configure(selection:Configuration):void {
    this.network.assertEditable();const node=this.data,module=this.definition;
    if(!node||!module)throw Error('Node configuration is unavailable');
    const candidate=configureNode(module,node,selection,this.network.context);
    this.replace(candidate);
  }
  update(patch:{params?:ObjectValue;inputValues?:ObjectValue;ui?:ObjectValue;name?:string}):void {
    this.network.assertEditable();const node=this.data;if(!node)throw Error('Node no longer exists');
    if(Object.keys(patch).some(k=>!['params','inputValues','ui','name'].includes(k)))throw Error('Node update cannot change identity');
    const candidate={...copy(node),...copy(patch)};
    if(this.definition){
      if(!this.definition.supports(candidate,this.network.context))throw Error('Unsupported node configuration');
      this.definition.validate(candidate,this.network.context);resolvePorts(this.definition,candidate,this.network.context);
    }
    this.replace(candidate);
  }
  edit(command:string,value?:Value):void {
    this.network.assertEditable();const node=this.data,module=this.definition;
    if(!node||!module)throw Error('Node command is unavailable');
    const before=this.interface,candidate=editNode(module,node,command,value,this.network.context),after=resolvePorts(module,candidate,this.network.context);
    const removedInputs=new Set(Object.keys(before.inputs).filter(k=>!after.inputs[k])),removedOutputs=new Set(Object.keys(before.outputs).filter(k=>!after.outputs[k]));
    // Deliberately removing a port removes its incident edges in the same
    // command. Unsupported imported ports remain a separate preservation path.
    if(removedInputs.size||removedOutputs.size){
      const handles=this.network.edges,raw=this.network.data.edges;
      const removed=handles.filter((_,i)=>raw[i]!.to[0]===this.id&&removedInputs.has(raw[i]!.to[1])||raw[i]!.from[0]===this.id&&removedOutputs.has(raw[i]!.from[1]));
      if(removed.length)this.network.disconnectAll(removed);
    }
    this.replace(candidate);
  }
  private replace(candidate:NodeData):void {
    const node=this.data!;if(equal(node,candidate))return;
    for(const key of Object.keys(node))if(!Object.prototype.hasOwnProperty.call(candidate,key))delete (node as unknown as Record<string,unknown>)[key];
    Object.assign(node,candidate);
  }
}
export class Edge {
  private stored?:EdgeData;
  private source?:Port;
  private target?:Port;
  constructor(readonly network:Network,readonly id:string){}
  get data(){if(this.stored)return this.stored;const value=this.network.edgeData(this.id);if(!this.network.graph.editable)this.stored=value;return value;}
  get exists(){return !!this.data;}
  disconnect(){this.network.disconnect(this);}
  get from():Port|undefined{if(this.source)return this.source;const e=this.data,p=e&&this.network.node(e.from[0]).port('output',e.from[1]);if(!this.network.graph.editable)this.source=p;return p;}
  get to():Port|undefined{if(this.target)return this.target;const e=this.data,p=e&&this.network.node(e.to[0]).port('input',e.to[1]);if(!this.network.graph.editable)this.target=p;return p;}
  connection(policy:ConnectionPolicy):{valid:true;conversion:'identity'|'convert'}|{valid:false;reason:'missing-edge'|'missing-port'|'type'} {
    if(!this.exists)return {valid:false,reason:'missing-edge'};
    const from=this.from!,to=this.to!;
    if(!from.exists||!to.exists)return {valid:false,reason:'missing-port'};
    if(!compatible(from.type,to.type,policy.components,policy.conversions))return {valid:false,reason:'type'};
    return {valid:true,conversion:from.type===to.type?'identity':'convert'};
  }
}
export class Network {
  private readonly nodeHandles=new Map<string,Node>();
  private readonly removedNodes=new Set<string>();
  private readonly edgeHandles=new Map<string,Edge>();
  private nodeIndex=new Map<string,NodeData>();
  private edgeIndex=new Map<string,EdgeData>();
  private nodeSlots=new Map<string,number>();
  private indexedNodes?:NodeData[];
  private indexedEdges?:EdgeData[];
  private nodeCount=-1;
  private edgeCount=-1;
  private adjacency?:{input:Map<string,Map<string,string[]>>;output:Map<string,Map<string,string[]>>};
  private readonly temporaryIds=new WeakMap<EdgeData,string>();
  private temporarySequence=0;
  constructor(readonly graph:GraphDocument,readonly id:string,readonly data:NetworkData){}
  assertEditable():void {
    this.graph.assertEditable();
    if (this.graph.networks.get(this.id) !== this) throw Error('Network no longer belongs to this graph');
  }
  groupSubgraph(ids:ReadonlySet<string>,options:GroupOptions):Node {
    this.assertEditable();
    if(this.removedNodes.has(options.callId))throw Error('Retired node ID');
    const call=groupSubgraph(this,ids,options);
    ids.forEach(id=>this.removedNodes.add(id));
    return this.node(call.id);
  }
  instantiateSubgraph(definitionId:string,id:string,ui:ObjectValue={}):Node {
    return this.node(instantiateSubgraph(this,definitionId,id,ui).id);
  }
  get context():NodeContext {return contextFor(this.graph.document,this.graph.document.functions?.find(f=>f.graph===this.data));}
  node(id:string):Node {let n=this.nodeHandles.get(id);if(!n){n=new Node(this,id);this.nodeHandles.set(id,n);}return n;}
  nodeData(id:string){
    const slot=this.nodeSlots.get(id),current=slot===undefined?undefined:this.data.nodes[slot];
    // The transitional editor can replace array entries without changing their
    // count. Validate the indexed slot, never just the array's length.
    if(this.indexedNodes!==this.data.nodes||this.nodeCount!==this.data.nodes.length||this.graph.editable&&(!current||current.id!==id||this.nodeIndex.get(id)!==current)){
      const index=new Map<string,NodeData>(),slots=new Map<string,number>();
      this.data.nodes.forEach((n,i)=>{if(!n.id||index.has(n.id))throw Error('Invalid or duplicate node ID');index.set(n.id,n);slots.set(n.id,i);});
      this.nodeIndex=index;this.nodeSlots=slots;this.indexedNodes=this.data.nodes;this.nodeCount=this.data.nodes.length;
    }
    return this.nodeIndex.get(id);
  }
  get nodes(){return this.data.nodes.map(n=>this.node(n.id));}
  create(id:string,definitionUuid:string,params:ObjectValue={}):Node {
    return this.insert({id,definitionUuid,params});
  }
  /** Insert authored node data through the same validation/ownership seam. */
  insert(authored:NodeData):Node {
    const {id,definitionUuid}=authored;
    this.assertEditable();if(!id||this.nodeData(id)||this.removedNodes.has(id))throw Error('Invalid, duplicate or retired node ID');
    const module=this.graph.registry.get(definitionUuid);if(!module)throw Error('Node module is unavailable');
    const node:NodeData={...copy(authored),params:{...copy(module.catalog.definition.defaults),...copy(authored.params)}};
    if(!module.supports(node,this.context))throw Error('Unsupported node configuration');
    module.validate(node,this.context);resolvePorts(module,node,this.context);
    this.data.nodes.push(node);return this.node(id);
  }
  /** Neutral authored fragment ingestion. Adapters own format/ID remapping;
   * the model owns validation, copied state and new edge identities. Missing
   * capabilities may be retained explicitly, without making them executable. */
  insertFragment(fragment:{nodes:readonly NodeData[];edges:readonly EdgeData[]},options:{unavailable?:'preserve'}={}):Node[] {
    this.assertEditable();
    const nodes=fragment.nodes.map(n=>copy(n)),edges=fragment.edges.map(e=>copy(e));
    const ids=new Set(this.data.nodes.map(n=>n.id)),ports=new Set(this.data.edges.map(e=>JSON.stringify(e.to)));
    for(const n of nodes){
      if(!n||typeof n.id!=='string'||!n.id||ids.has(n.id)||this.removedNodes.has(n.id))throw Error('Invalid, duplicate or retired node ID');ids.add(n.id);
      if(typeof n.definitionUuid!=='string'||!n.definitionUuid||!n.params||typeof n.params!=='object'||Array.isArray(n.params))throw Error('Invalid fragment node');
      const module=this.graph.registry.get(n.definitionUuid);
      if(module?.supports(n,this.context)){module.validate(n,this.context);resolvePorts(module,n,this.context);}
      else if(options.unavailable!=='preserve')throw Error('Node module or configuration is unavailable');
    }
    let sequence=edgeSequence(this.data);
    for(const e of edges){
      for(const end of [e.from,e.to])if(!Array.isArray(end)||end.length!==2||end.some(v=>typeof v!=='string'||!v)||!ids.has(end[0]))throw Error('Invalid fragment endpoint');
      const input=JSON.stringify(e.to);if(ports.has(input))throw Error('Fragment input already connected');ports.add(input);
      if(!Number.isSafeInteger(sequence+1))throw Error('Edge sequence exhausted');e.id='edge_'+ ++sequence;
    }
    this.data.nodes.push(...nodes);this.data.edges.push(...edges);if(edges.length)this.data.edgeSequence=sequence;
    return nodes.map(n=>this.node(n.id));
  }
  remove(node:Node):void {
    this.removeAll([node]);
  }
  removeAll(nodes:readonly Node[]):void {
    this.assertEditable();if(nodes.some(n=>n.network!==this))throw Error('Node belongs to another network');
    const ids=new Set(nodes.filter(n=>this.nodeData(n.id)).map(n=>n.id));if(!ids.size)return;
    const roots=this.data.nodes.filter(n=>ids.has(n.id)).map(n=>this.graph.registry.get(n.definitionUuid)?.referencedGraph?.(n)).filter((id):id is string=>!!id);
    const sequence=edgeSequence(this.data);if(sequence)this.data.edgeSequence=sequence;
    ids.forEach(id=>this.removedNodes.add(id));
    this.data.nodes=this.data.nodes.filter(n=>!ids.has(n.id));
    this.data.edges=this.data.edges.filter(e=>!ids.has(e.from[0])&&!ids.has(e.to[0]));
    collectSubgraphs(this.graph,roots,this.data);
  }
  plan(policy:ConnectionPolicy,intent:Intent,overrides:ReadonlyMap<string,Ports>=new Map()) {
    const nodes=this.nodes.map(n=>{const module=n.definition,data=n.data!;
      return {id:n.id,definition:data.definitionUuid,stored:overrides.get(n.id)||n.interface.types(),
        ...(module?.supports(data,this.context)&&module.signatures?{variants:module.signatures(data,this.context)}:{})};});
    return plan({nodes,edges:this.data.edges},policy,intent);
  }
  private identity(e:EdgeData,_index:number){
    if(e.id)return e.id;
    let id=this.temporaryIds.get(e);if(!id){id='temporary:'+ ++this.temporarySequence;this.temporaryIds.set(e,id);}return id;
  }
  private indexEdges(){
    // Editable views permit legacy in-place mutation. Immutable compiler views
    // build this index once; they never pay the rescan on each getter.
    if(this.graph.editable||this.indexedEdges!==this.data.edges||this.edgeCount!==this.data.edges.length){
      const index=new Map<string,EdgeData>();
      this.data.edges.forEach((e,i)=>{const id=this.identity(e,i);if(index.has(id))throw Error('Duplicate edge ID');index.set(id,e);});
      this.edgeIndex=index;this.indexedEdges=this.data.edges;this.edgeCount=this.data.edges.length;
      this.adjacency=undefined;
    }
  }
  edgeData(id:string){this.indexEdges();return this.edgeIndex.get(id);}
  private edge(id:string):Edge {let edge=this.edgeHandles.get(id);if(!edge){edge=new Edge(this,id);this.edgeHandles.set(id,edge);}return edge;}
  get edges(){this.indexEdges();return [...this.edgeIndex.keys()].map(id=>this.edge(id));}
  /** Query raw endpoints from one validated index, never through E getters that
   * would each reindex an externally editable network. Snapshot views retain
   * the adjacency index; transitional editable views refresh it for raw edits. */
  edgesAt(port:Port):Edge[] {
    if(port.node.network!==this)throw Error('Port belongs to another network');
    this.indexEdges();
    if(!this.adjacency){
      const input=new Map<string,Map<string,string[]>>(),output=new Map<string,Map<string,string[]>>();
      const add=(index:Map<string,Map<string,string[]>>,endpoint:readonly [string,string],id:string)=>{
        let ports=index.get(endpoint[0]);if(!ports){ports=new Map();index.set(endpoint[0],ports);}
        let edges=ports.get(endpoint[1]);if(!edges){edges=[];ports.set(endpoint[1],edges);}edges.push(id);
      };
      for(const [id,e] of this.edgeIndex){add(input,e.to,id);add(output,e.from,id);}
      this.adjacency={input,output};
    }
    return (this.adjacency[port.direction].get(port.node.id)?.get(port.key)||[]).map(id=>this.edge(id));
  }
  /** Returns a dependency order and rejects cycles, including disconnected ones. */
  order(sink?:string):Node[] {
    const active=new Set<string>(),done=new Set<string>(),ordered:Node[]=[];
    this.indexEdges();
    const incoming=new Map<string,EdgeData[]>();
    for(const edge of this.edgeIndex.values()){const id=edge.to[0],list=incoming.get(id)||[];list.push(edge);incoming.set(id,list);}
    for(const list of incoming.values())list.sort((a,b)=>a.to[1]<b.to[1]?-1:a.to[1]>b.to[1]?1:0);
    const visit=(root:string)=>{
      const stack:{id:string;exit?:boolean}[]=[{id:root}];
      while(stack.length){const {id,exit}=stack.pop()!;
        if(exit){active.delete(id);done.add(id);ordered.push(this.node(id));continue;}
        if(done.has(id))continue;
        if(active.has(id))throw new GraphError('Cycle detected',id);
        if(!this.nodeData(id))throw new GraphError('Connection endpoint no longer exists',id);
        active.add(id);stack.push({id,exit:true});const links=incoming.get(id)||[];
        for(let i=links.length-1;i>=0;i--)stack.push({id:links[i]!.from[0]});
      }
    };
    for(const n of this.nodes)visit(n.id);
    if(sink!==undefined){ordered.length=0;done.clear();visit(sink);}return ordered;
  }
  connect(from:Port,to:Port,policy:ConnectionPolicy):Edge {
    this.assertEditable();
    if(from.node.network!==this||to.node.network!==this||from.direction!=='output'||to.direction!=='input')throw Error('Connection endpoints must belong to this network');
    const result=this.plan(policy,{kind:'wire',from:{node:from.node.id,port:from.key},to:{node:to.node.id,port:to.key}});
    if(!result.ok)throw new GraphError(result.diagnostic.code==='cycle'?'Cycle detected':'Incompatible connection: '+result.diagnostic.code,to.node.id);
    const retained=this.edges.find(e=>equal(e.data?.from,from.endpoint)&&equal(e.data?.to,to.endpoint));
    const signature=result.inference.signatures.get(to.node.id),target=to.node.data!,original=copy(target);
    if(signature)to.node.configure({signature});
    if(retained&&result.displaced.length===1)return retained;
    const before=this.data.edges,sequence=this.data.edgeSequence;
    try{
      const id=this.graph.nextEdgeId(this.data);
      this.data.edges=before.filter(e=>e.to[0]!==to.node.id||e.to[1]!==to.key);
      this.data.edges.push({id,from:from.endpoint,to:to.endpoint});return this.edges.find(e=>e.id===id)!;
    }catch(e){
      this.data.edges=before;for(const key of Object.keys(target))delete (target as unknown as Record<string,unknown>)[key];Object.assign(target,original);
      if(sequence===undefined)delete this.data.edgeSequence;else this.data.edgeSequence=sequence;throw e;
    }
  }
  disconnect(edge:Edge):void {
    this.disconnectAll([edge]);
  }
  disconnectAll(edges:readonly Edge[]):void {
    this.assertEditable();if(edges.some(e=>e.network!==this))throw Error('Edge belongs to another network');
    this.indexEdges();const targets=new Set(edges.map(e=>this.edgeIndex.get(e.id)).filter(e=>!!e));
    if(!targets.size)return;const sequence=edgeSequence(this.data);if(sequence)this.data.edgeSequence=sequence;
    this.data.edges=this.data.edges.filter(e=>!targets.has(e));
  }
}
function edgeSequence(data:NetworkData):number {
  let sequence=data.edgeSequence||0;
  if(!Number.isSafeInteger(sequence)||sequence<0)throw Error('Invalid edge sequence');
  for(const e of data.edges){const match=e.id?.match(/^edge_(\d+)$/);if(match)sequence=Math.max(sequence,Number(match[1]));}
  return sequence;
}
export class GraphError extends Error {constructor(message:string,readonly node?:string){super(message);}}
export class GraphDocument {
  readonly document:Graph;
  private readonly networkHandles=new Map<string,Network>();
  readonly context:NodeContext;
  private active=true;
  constructor(document:Graph,readonly registry:Registry,readonly fallback?:PortResolver,readonly editable=false){
    this.document=editable?document:clone(document,true);
    this.context=contextFor(this.document);
  }
  get networks():ReadonlyMap<string,Network> {
    const current=new Map(networkEntries(this.document));
    for(const [id,data]of current)if(this.networkHandles.get(id)?.data!==data)this.networkHandles.set(id,new Network(this,id,data));
    for(const id of this.networkHandles.keys())if(!current.has(id))this.networkHandles.delete(id);
    return this.networkHandles;
  }
  createSubgraph(options:SubgraphOptions):Subgraph {return this.subgraph(createSubgraph(this,options).id);}
  subgraph(id:string):Subgraph {return new Subgraph(this,id);}
  assertEditable(){if(!this.editable||!this.active)throw Error('Graph changes require an active transaction');}
  close(){this.active=false;}
  nextEdgeId(data:NetworkData){
    this.assertEditable();const index=edgeSequence(data);
    if(!Number.isSafeInteger(index+1))throw Error('Edge sequence exhausted');
    data.edgeSequence=index+1;return 'edge_'+data.edgeSequence;
  }
  snapshot():Graph{return clone(this.document);}
  /** One candidate, one publication. History stores this before/after pair;
   * host receipts and UI selections remain the application's responsibility. */
  change(edit:(candidate:GraphDocument)=>void):{before:Graph;after:Graph;changes:GraphChanges} {
    const before=this.snapshot(),candidate=new GraphDocument(clone(before),this.registry,this.fallback,true);
    try{
      edit(candidate);if(!equal(before,candidate.document))complete(candidate.document,before);
      const after=candidate.snapshot();return {before,after,changes:changesBetween(before,after,this.registry)};
    }finally{candidate.close();}
  }
}
function networkEntries(document:Graph):[string,NetworkData][] {
  return [...Object.entries(document.stages),...(document.functions||[]).map(raw=>{const f=raw as {id:string;graph:NetworkData};return ['function:'+f.id,f.graph] as [string,NetworkData];})];
}
function complete(document:Graph,previous?:Graph):void {
  const prior=new Map(previous?networkEntries(previous):[]);
  for(const [id,data] of networkEntries(document)){
    const old=prior.get(id);let sequence=Math.max(edgeSequence(data),old?edgeSequence(old):0);
    const nodes=new Set<string>(),edges=new Set<string>();
    for(const n of data.nodes){if(!n.id||nodes.has(n.id))throw Error('Invalid or duplicate node ID');nodes.add(n.id);}
    for(const e of data.edges){
      if(!e.id){if(!Number.isSafeInteger(sequence+1))throw Error('Edge sequence exhausted');e.id='edge_'+ ++sequence;}
      if(edges.has(e.id))throw Error('Duplicate edge ID');edges.add(e.id);
    }
    if(sequence)data.edgeSequence=sequence;
  }
}
/** Transitional editor transaction: existing widgets mutate the one active
 * candidate (including their captured node references). The core publishes and
 * identifies its edges; the application restores `before` on a failed callback.
 * This adapter can disappear as widgets adopt Network operations directly. */
export function transact(document:Graph,registry:Registry,edit:(before:Graph,model:GraphDocument)=>Graph):{before:Graph;after:Graph;changes:GraphChanges} {
  const before=clone(document);
  const model=new GraphDocument(document,registry,undefined,true);
  try{
    const after=edit(before,model);
    if(!equal(before,after))complete(after,before);
    return {before,after,changes:changesBetween(before,after,registry)};
  }catch(error){
    for(const key of Object.keys(document))delete (document as unknown as Record<string,unknown>)[key];
    Object.assign(document,clone(before));throw error;
  }finally{model.close();}
}
