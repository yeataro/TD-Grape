import { copy, type Node, type Declaration, type ObjectValue, type Value, type Graph, type SubgraphData } from './model';
import { NodePorts, type PortSpec } from './ports';

export interface CatalogDefinition {
  key:string;label:string;inputs:Record<string,string>;outputs:Record<string,string>;
  stages:string[];defaults:ObjectValue;descriptionKey:string;
  definitionUuid?:string;revisionHash?:string;[key:string]:Value|undefined;
}
export interface CatalogRow {definition:CatalogDefinition;emitter:{id:string;version:number;primitive?:{operator:string;port:string};call?:{operator:string;ports:readonly string[];defaults?:Readonly<Record<string,number>>}};browser:Record<string,Value>}
export interface NodeContext {
  readonly target?:string;
  readonly owner?:SubgraphData;
  declaration(id:string):Declaration|undefined;
  subgraph?(id:string):SubgraphData|undefined;
}
export function contextFor(graph:Graph,owner?:SubgraphData):NodeContext {
  return {target:graph.target,owner,declaration:id=>graph.declarations.find(d=>d.id===id),subgraph:id=>graph.functions?.find(f=>f.id===id)};
}
export interface EmitContext extends NodeContext {
  readonly ports:NodePorts;
  input(key:string):string;
  useUniform(id:string):string;
}
export interface Emission {outputs:Record<string,string>;constant?:boolean;statements?:readonly string[]}
export interface Signature {type:string;inputs:Readonly<Record<string,string>>;outputs:Readonly<Record<string,string>>;operands?:Readonly<Record<string,string>>}
export type Configuration={type:string}|{signature:Signature};
export interface NodeControl {
  kind:'select'|'button'|'row'|'hint';key:string;label:string;literal?:boolean;
  command?:string;value?:string;numeric?:boolean;args?:ObjectValue;
  options?:readonly {value:string;label:string;literal?:boolean}[];
  children?:readonly NodeControl[];prefix?:string;disabled?:boolean;
}
export interface NodePresentation {
  label?:string;descriptionKey?:string;
  selectorLabel?:string;
  value?:{value:Value;type:string;componentCommand:string;valueCommand:string;names:string;color?:boolean;expandable?:boolean};
  controls?:readonly NodeControl[];
  portLabels?:{inputs?:Record<string,string>;outputs?:Record<string,string>};
  note?:{key:string;text:string};
  spare?:{direction:'input'|'output';key:string;type:string;command:string;count:number;limit:number;label:string;limitLabel:string};
}
/** Trusted developer module. Callbacks read graph-owned data and return values;
 * no DOM, host, graph mutation, persistence or History access. */
export interface NodeModule {
  readonly catalog:CatalogRow;
  readonly role:'value'|'output'|'subgraph-input'|'subgraph-output';
  /** Structural modules are instantiated from a graph definition, not the palette. */
  readonly structural?:boolean;
  referencedGraph?(node:Node):string;
  supports(node:Node,context:NodeContext):boolean;
  ports(node:Node,context:NodeContext):readonly PortSpec[];
  /** Complete native input tuples for the already-selected output interface. */
  signatures?(node:Node,context:NodeContext):readonly Signature[];
  /** Module owns how a manual selection/native tuple becomes persisted state. */
  configure?(node:Node,selection:Configuration,context:NodeContext):Node;
  /** Explicit user commands, including dynamic interface edits, stay local. */
  edit?(node:Node,command:string,value:Value|undefined,context:NodeContext):Node;
  presentation?(node:Node,context:NodeContext):NodePresentation;
  validate(node:Node,context:NodeContext):void;
  emit?(node:Node,context:EmitContext):Emission;
}
export function createRegistry(modules:readonly NodeModule[]){
  const table=new Map<string,NodeModule>();
  for(const module of modules){
    const d=module.catalog.definition,id=d.definitionUuid||'sgrape.builtin.'+d.key;
    if(!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(d.key)||table.has(id))throw Error('Invalid or duplicate node definition: '+id);
    if(module.signatures&&!module.configure)throw Error('Signature module needs a configuration operation: '+id);
    const freeze=(value:unknown):void=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}};
    const catalog=JSON.parse(JSON.stringify(module.catalog)) as CatalogRow;freeze(catalog);
    table.set(id,Object.freeze({...module,catalog}));
  }
  // Do not expose a mutable registration table to a compilation in progress.
  return Object.freeze({modules:Object.freeze([...table.values()]),get:(id:string)=>table.get(id)});
}
export type Registry=ReturnType<typeof createRegistry>;
const sameTypes=(a:Readonly<Record<string,string>>,b:Readonly<Record<string,string>>)=>Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([key,value])=>b[key]===value);
/** Pure configuration. Module callbacks cannot partly edit a working node. */
export function configureNode(module:NodeModule,node:Node,selection:Configuration,context:NodeContext):Node {
  if(!module.configure)throw Error('Node does not support configuration');
  const before=resolvePorts(module,node,context).types();
  if('signature' in selection){
    const wanted=selection.signature;
    const declared=module.signatures?.(node,context).find(s=>s.type===wanted.type&&sameTypes(s.inputs,wanted.inputs)&&sameTypes(s.outputs,wanted.outputs));
    if(!sameTypes(before.outputs,wanted.outputs)||!declared)throw Error('Invalid native signature');
    selection={signature:declared};
  }
  const candidate=module.configure(copy(node),copy(selection),context);
  if(candidate.id!==node.id||candidate.definitionUuid!==node.definitionUuid)throw Error('Configuration cannot change node identity');
  if(!module.supports(candidate,context))throw Error('Unsupported node configuration');
  module.validate(candidate,context);
  const after=resolvePorts(module,candidate,context).types();
  if('signature' in selection&&(!sameTypes(after.outputs,before.outputs)||!sameTypes(after.inputs,selection.signature.inputs)))throw Error('Module configuration disagrees with its signature');
  return copy(candidate);
}
export function editNode(module:NodeModule,node:Node,command:string,value:Value|undefined,context:NodeContext):Node {
  if(!module.edit)throw Error('Node command is unavailable');
  const candidate=module.edit(copy(node),command,value===undefined?undefined:copy(value),context);
  if(candidate.id!==node.id||candidate.definitionUuid!==node.definitionUuid)throw Error('Command cannot change node identity');
  if(!module.supports(candidate,context))throw Error('Unsupported node configuration');
  module.validate(candidate,context);resolvePorts(module,candidate,context);return copy(candidate);
}
const portTemplates=new WeakMap<readonly PortSpec[],NodePorts>();
export function resolvePorts(module:NodeModule,node:Node,context:NodeContext):NodePorts {
  const specs=module.ports(node,context);
  // A frozen declaration is reusable; graph Port handles still own their
  // network/node/key identity. Dynamic declarations get a fresh projection.
  if(Object.isFrozen(specs)){
    let resolved=portTemplates.get(specs);if(!resolved){resolved=new NodePorts(specs);portTemplates.set(specs,resolved);}return resolved;
  }
  return new NodePorts(specs);
}
