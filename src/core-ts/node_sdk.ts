/** Small developer entry point. Builtins and developer modules share this API. */
import { object, copy, type Node, type Value } from './model';
import { types, type, literal, number, fill, count, type Type } from './numeric';
import type { CatalogRow, NodeModule, NodeContext, Configuration } from './node_module';
import { declarationKinds } from './declarations';
import { tdValues, type TdValue } from './td_values';
import { types as valueTypes } from './values';
import type { PortSpec } from './ports';
export type { CatalogRow, NodeModule, NodeContext, EmitContext, Emission, Configuration, Signature, NodeControl } from './node_module';
export type { Node, Value, ObjectValue } from './model';
export type { PortSpec } from './ports';
export { literal, type, fill } from './numeric';
export { types as numericTypes } from './numeric';
export { subgraphPorts, subgraphPresentation, numericInterface, requireSubgraph } from './subgraph_interface';
export { selectedType, reshapeDefaults };

const numeric=(n:Node)=>n.params.type===undefined||types.includes(String(n.params.type));
const out=(t:string)=>({key:'out',direction:'output' as const,type:t});
export function fixedPorts(specs:PortSpec[]):readonly PortSpec[]{
  const freeze=(v:unknown):void=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}};freeze(specs);return specs;
}
const outputPorts=Object.fromEntries(types.map(t=>[t,fixedPorts([out(t)])]));
const selectedType=(node:Node,selection:Configuration)=>{
  const selected=type('type' in selection?selection.type:selection.signature.type);
  if(node.params.fixedType&&node.params.fixedType!==selected)throw Error('Fixed node type');return selected;
};
function shape(value:Value,t:Type):Value {
  const values=Array.isArray(value)?value:[value];
  if(t==='float')return values[0]??0;
  return Array.from({length:count(t)},(_,i)=>values[i]??values[0]??0);
}
/** Numeric-family policy, shared by modules, never a node-name dispatch. */
function reshapeDefaults(node:Node,before:readonly PortSpec[],after:readonly PortSpec[]):Node {
  const old=new Map(before.filter(p=>p.direction==='input').map(p=>[p.key,p.type]));
  for(const p of after)if(p.direction==='input'&&node.inputValues?.[p.key]!==undefined&&old.has(p.key)&&old.get(p.key)!==p.type){
    node.ui||={};const cache=object(node.ui.inputValuesByType)||{};node.ui.inputValuesByType=cache;
    const values=object(cache[p.key])||{};cache[p.key]=values;values[old.get(p.key)!]=copy(node.inputValues[p.key]!);
    node.inputValues[p.key]=values[p.type]===undefined?shape(node.inputValues[p.key]!,type(p.type)):copy(values[p.type]!);
  }
  return node;
}
function editValue(current:Value,t:Type,command:string,payload:Value|undefined):Value {
  const data=object(payload);if(!data)throw Error('Missing value command');
  if(command==='value'){literal(data.value,t);return copy(data.value!);}
  if(command!=='component'||typeof data.index!=='number'||!Number.isInteger(data.index)||data.index<0||data.index>=count(t))throw Error('Invalid value component');
  number(data.value);if(t==='float')return data.value!;
  const next=Array.isArray(current)?copy(current):Array(count(t)).fill(0);next[data.index]=data.value!;return next;
}
export function literalNode(catalog:CatalogRow,fixed?:Type,constant=false,appearance:{color?:boolean}={}):NodeModule {
  const selected=(n:Node)=>fixed||type(n.params.type||'float');
  return {catalog,role:'value',supports:n=>numeric(n)&&(!!fixed||n.params.type===undefined||n.params.type==='float'),
    configure:(n,s)=>{const t=selectedType(n,s);if(fixed&&fixed!==t)throw Error('Fixed literal type');n.params.type=t;n.params.value=shape(n.params.value??0,t);return n;},
    edit:(n,command,value)=>{n.params.value=editValue(n.params.value!,selected(n),command,value);return n;},
    presentation:n=>({value:{value:n.params.value!,type:selected(n),componentCommand:'component',valueCommand:'value',names:appearance.color?'RGBA':'XYZW',color:!!appearance.color,expandable:selected(n)!=='float'}}),
    ports:n=>outputPorts[selected(n)]!,validate:n=>{literal(n.params.value,selected(n));},
    emit:n=>({outputs:{out:literal(n.params.value,selected(n))},constant})};
}
export function vectorNode(catalog:CatalogRow):NodeModule {
  return {catalog,role:'value',supports:n=>['vec2','vec3','vec4'].includes(String(n.params.type)),
    configure:(n,s)=>{n.params.type=selectedType(n,s);return n;},
    edit:(n,command,value)=>{
      const t=type(n.params.type),components=n.params.components as Value[];
      const next=editValue(components.slice(0,count(t)),t,command,value) as Value[];
      n.params.components=[...next,...components.slice(next.length)];return n;
    },
    presentation:n=>({value:{value:(n.params.components as Value[]).slice(0,count(type(n.params.type))),type:String(n.params.type),componentCommand:'component',valueCommand:'value',names:String(n.ui?.componentNames||'XYZW').toUpperCase(),expandable:true}}),
    ports:n=>outputPorts[type(n.params.type)]!,validate:n=>{
      if(!Array.isArray(n.params.components)||n.params.components.length!==4)throw Error('Vector needs four stored components');
      n.params.components.forEach(number);
    },emit:n=>({outputs:{out:literal((n.params.components as Value[]).slice(0,count(type(n.params.type))),type(n.params.type))},constant:true})};
}
export function binaryNode(catalog:CatalogRow,operator:'+'|'-'|'*'|'/'):NodeModule {
  const variants=types.flatMap(t=>(t==='float'?[{a:t,b:t}]:[{a:t,b:t},{a:t,b:'float'},{a:'float',b:t}]).map(inputs=>({type:t,inputs,outputs:{out:t},operands:inputs})));
  const signatures=()=>variants;
  const layouts=new Map(variants.map(v=>[v.type+':'+v.inputs.a+':'+v.inputs.b,fixedPorts([{key:'a',direction:'input',type:v.inputs.a,default:fill(0,type(v.inputs.a))},{key:'b',direction:'input',type:v.inputs.b,default:fill(operator==='/'?1:0,type(v.inputs.b))},out(v.type)])]));
  const ports=(n:Node)=>{const t=type(n.params.type||'float'),operand=object(n.params.operandTypes);
    if(n.params.operandTypes!==undefined&&(!operand||Object.keys(operand).sort().join()!=='a,b'))throw Error('Invalid arithmetic operands');
    const a=type(operand?.a??t),b=type(operand?.b??t),layout=layouts.get(t+':'+a+':'+b);if(!layout)throw Error('Invalid arithmetic signature');return layout;};
  return {catalog,role:'value',supports:n=>numeric(n)&&Object.values(object(n.params.operandTypes)||{}).every(t=>types.includes(String(t))),
    signatures,
    ports,configure:(n,s)=>{const before=ports(n);n.params.type=selectedType(n,s);
      if('signature' in s)n.params.operandTypes={...s.signature.inputs};else delete n.params.operandTypes;
      return reshapeDefaults(n,before,ports(n));},
    validate:()=>{},emit:(_n,c)=>({outputs:{out:'('+c.input('a')+' '+operator+' '+c.input('b')+')'}})};
}
export function unaryNode(spec:{key:string;label:string;descriptionKey:string;operator:string;port:string;browser:Record<string,Value>}):NodeModule {
  const identifier=(v:unknown)=>typeof v==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(v);
  if(![spec.key,spec.operator,spec.port].every(identifier))throw Error('Invalid unary node definition');
  const catalog:CatalogRow={definition:{key:spec.key,label:spec.label,inputs:{[spec.port]:'T'},outputs:{out:'T'},stages:['vertex','pixel'],defaults:{type:'float'},descriptionKey:spec.descriptionKey,definitionUuid:'sgrape.builtin.'+spec.key},emitter:{id:spec.key,version:1,primitive:{operator:spec.operator,port:spec.port}},browser:spec.browser};
  const layouts=Object.fromEntries(types.map(t=>[t,fixedPorts([{key:spec.port,direction:'input',type:t,default:fill(0,type(t))},out(t)])]));
  return {catalog,role:'value',supports:numeric,
    configure:(n,s)=>{const before=layouts[type(n.params.type||'float')]!;n.params.type=selectedType(n,s);return reshapeDefaults(n,before,layouts[type(n.params.type)]!);},
    ports:n=>layouts[type(n.params.type||'float')]!,
    validate:()=>{},emit:(_n,c)=>({outputs:{out:spec.operator+'('+c.input(spec.port)+')'}})};
}
/** Static floating-point calls with optional, explicitly declared native input
 * alternatives. Saved input tuples never determine an existing output type. */
export function numericCall(catalog:CatalogRow,options:{alternatives?:Readonly<Record<string,readonly string[]>>;tuples?:readonly Readonly<Record<string,string>>[]}={}):NodeModule {
  const alternatives=options.alternatives||{};
  const call=catalog.emitter.call;
  if(!call||!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(call.operator)||call.ports.join()!==Object.keys(catalog.definition.inputs).join())throw Error('Invalid numeric call');
  if(options.tuples&&Object.keys(alternatives).length)throw Error('Declare complete tuples or independent alternatives');
  const keys=Object.keys(catalog.definition.inputs).sort().join();
  if(options.tuples&&(!options.tuples.length||options.tuples.some(row=>Object.keys(row).sort().join()!==keys)))throw Error('Incomplete numeric input tuple');
  if(Object.keys(alternatives).some(key=>!Object.prototype.hasOwnProperty.call(catalog.definition.inputs,key)))throw Error('Unknown input alternative');
  const selected=(n:Node)=>type(n.params.type??catalog.definition.defaults.type);
  const layouts=new Map<string,readonly PortSpec[]>();
  const variants=types.flatMap(t=>{
    let inputs:Record<string,string>[]=[{}];
    if(options.tuples){
      inputs=options.tuples.map(row=>Object.fromEntries(call.ports.map(key=>[key,row[key]==='T'?t:row[key]!])));
      inputs=[...new Map(inputs.map(row=>[JSON.stringify(row),row])).values()];
    }else for(const [key,declared] of Object.entries(catalog.definition.inputs))inputs=inputs.flatMap(row=>[...new Set((alternatives[key]||[declared]).map(v=>v==='T'?t:v))].map(value=>({...row,[key]:value})));
    const outputs=Object.fromEntries(Object.entries(catalog.definition.outputs).map(([key,v])=>[key,v==='T'?t:v]));
    return inputs.map(input=>{
      const defaults={...object(catalog.definition.inputDefaults),...call.defaults};
      const specs:PortSpec[]=[...Object.entries(input).map(([key,value])=>({key,direction:'input' as const,type:value,default:fill(Number(defaults[key]??0),type(value))})),...Object.entries(outputs).map(([key,value])=>({key,direction:'output' as const,type:value}))];
      layouts.set(t+':'+JSON.stringify(input),fixedPorts(specs));return {type:t,inputs:input,outputs};
    });
  });
  const signatures=()=>variants;
  const ports=(n:Node)=>{
    const t=selected(n),stored=object(n.params.inputTypes);
    if(n.params.inputTypes!==undefined&&!stored)throw Error('Invalid saved input signature');
    const chosen=variants.find(v=>v.type===t&&(!stored||Object.keys(stored).length===Object.keys(v.inputs).length&&Object.entries(v.inputs).every(([k,value])=>stored[k]===value)));
    if(!chosen)throw Error('Invalid saved input signature');return layouts.get(t+':'+JSON.stringify(chosen.inputs))!;
  };
  return {catalog,role:'value',supports:n=>types.includes(String(n.params.type??catalog.definition.defaults.type)),
    ...(options.tuples||Object.keys(alternatives).length?{signatures}:{}),ports,validate:()=>{},
    configure:(n,s)=>{
      const before=ports(n);n.params.type=selectedType(n,s);
      if('signature' in s)n.params.inputTypes={...s.signature.inputs};else delete n.params.inputTypes;
      return reshapeDefaults(n,before,ports(n));
    },
    presentation:()=>({selectorLabel:Object.values(catalog.definition.outputs).includes('T')?'vector.outputType':'vector.inputType'}),
    emit:(_n,c)=>({outputs:{out:call.operator+'('+call.ports.map(key=>c.input(key)).join(', ')+')'}})};
}
/** The one node that refers to a declaration (design-interview Q45; human 2026-10-09): what it
 * gives and whether that is a constant comes from the declaration's kind module. Missing target:
 * a ghost (ghosts.ts). Only at the top level of a stage (Q41): never inside a subgraph.
 * 引用宣告的唯一節點：給什麼、是不是常數由那筆宣告的 kind 決定；指向不存在＝Ghost；只在 stage 最外層。 */
export function declarationNode(catalog:CatalogRow):NodeModule {
  const target=(n:Node,c:NodeContext)=>c.declaration(String(n.params.declarationId));
  const kindOf=(n:Node,c:NodeContext)=>{const d=target(n,c);return d&&declarationKinds.get(d.kind);};
  return {catalog,role:'value',referencedDeclaration:n=>String(n.params.declarationId),
    supports:(n,c)=>!c.owner&&(!target(n,c)||!!kindOf(n,c)?.types.includes(target(n,c)!.type)),
    // What a reference gives comes from the kind (a TOP texture input gives three outputs).
    // 引用時給哪些輸出由 kind 決定（TOP 貼圖輸入給三個）。
    ports:(n,c)=>{const d=target(n,c);if(!d)throw Error('The declaration no longer exists');return kindOf(n,c)?.outputs??outputPorts[type(d.type)]!;},
    validate:()=>{},
    // It switches only among declarations of the same kind: another kind gives other outputs.
    // 只在同一種宣告之間切換：別的種類給的輸出不同。
    presentation:(n,c)=>{const d=target(n,c),choices=(c.declarations?.()||[]).filter(x=>declarationKinds.has(x.kind)&&(!d||x.kind===d.kind));
      return {label:d?.name,inlineControls:[{kind:'select',key:'declaration',label:'declaration',literal:true,command:'declaration',value:String(n.params.declarationId),
        options:choices.map(x=>({value:x.id,label:x.name,literal:true}))}]};},
    edit:(n,command,value,c)=>{
      if(command!=='declaration')throw Error('Unknown command');
      const id=String(object(value)?.value??value),next=c.declaration(id),current=target(n,c);if(!next)throw Error('The declaration no longer exists');
      if(current&&current.kind!==next.kind)throw Error('A reference switches only among declarations of the same kind');
      n.params.declarationId=id;return n;},
    emit:(n,c)=>({outputs:c.referenceDeclaration(String(n.params.declarationId)),constant:!!kindOf(n,c)?.constant})};
}
/** TD built-in values (Q45 01, discuss-4.14 §10): one node type picks one entry of the table
 * beside it (td_values.ts) by `entry`; no declaration, so it may be used inside subgraphs (Q46).
 * This round carries entries of plain value types without parameters; samplers, structs, arrays,
 * matrices and entries with an index ({layer}…) come with their rounds — until then a graph that
 * uses one shows a ghost. An unknown entry is a ghost too.
 * TD 內建值：一個節點類型依 entry 從旁邊的表選一筆；不需要宣告、子圖裡也能用。
 * 本輪只接一般數值型別、不帶參數的；其他等各自那一輪，之前是 Ghost。 */
const tdValueTable=new Map(tdValues.map(entry=>[entry.id,entry]));
const tdValuePorts=new Map<string,readonly PortSpec[]>();
const tdValuePort=(t:string)=>{let p=tdValuePorts.get(t);if(!p){p=fixedPorts([out(t)]);tdValuePorts.set(t,p);}return p;};
/** Whether this build can use an entry for a target. 這個版本能不能在這個 target 用這一筆。 */
export const usableTdValue=(entry:TdValue|undefined,target:string|undefined)=>!!entry&&(!target||entry.targets.includes(target))
  &&valueTypes.includes(entry.type)&&!entry.expression.includes('{');
export function tdValueNode(catalog:CatalogRow):NodeModule {
  const entryOf=(n:Node)=>tdValueTable.get(String(n.params.entry));
  return {catalog,role:'value',colorGroup:'runtime',
    supports:(n,c)=>usableTdValue(entryOf(n),c.target),
    ports:n=>tdValuePort(entryOf(n)!.type),validate:()=>{},
    presentation:(n,c)=>({label:entryOf(n)?.name,inlineControls:[{kind:'select',key:'entry',label:'entry',literal:true,command:'entry',
      value:String(n.params.entry),options:tdValues.filter(e=>usableTdValue(e,c.target)).map(e=>({value:e.id,label:e.name,literal:true}))}]}),
    edit:(n,command,value,c)=>{
      if(command!=='entry')throw Error('Unknown command');
      const id=String(object(value)?.value??value);if(!usableTdValue(tdValueTable.get(id),c.target))throw Error('Unknown TD built-in value');
      n.params.entry=id;return n;},
    emit:n=>({outputs:{out:entryOf(n)!.expression}})};
}
export function uniformNode(catalog:CatalogRow):NodeModule {
  return {catalog,role:'value',supports:(n,c)=>numeric(n)&&(!c.declaration(String(n.params.declarationId))||types.includes(c.declaration(String(n.params.declarationId))!.type)),ports:(n,c)=>{
    const d=c.declaration(String(n.params.declarationId));if(!d)throw Error('Select a matching declaration');return outputPorts[type(d.type)]!;
  },validate:()=>{},emit:(n,c)=>({outputs:{out:c.useUniform(String(n.params.declarationId))}})};
}
/** Terminal family with a shared, immutable port layout. The owning node
 * supplies target capabilities, controls, validation and shader statements. */
export function outputNode(catalog:CatalogRow,spec:Omit<NodeModule,'catalog'|'role'|'ports'> & {ports:readonly PortSpec[]|NodeModule['ports']}):NodeModule {
  const {ports,...implementation}=spec;
  const inputsOnly=(specs:readonly PortSpec[])=>{if(specs.some(p=>p.direction!=='input'))throw Error('Terminal nodes only have input ports');return specs;};
  // Fixed layout, or one chosen per node (e.g. Color Output follows what is wired in, Q46).
  if(typeof ports==='function')return {...implementation,catalog,role:'output',ports:(n,c)=>inputsOnly(ports(n,c))};
  const layout=fixedPorts([...inputsOnly(ports)]);
  return {...implementation,catalog,role:'output',ports:()=>layout};
}

export {staticNode,typedNode,reshapeInputs,input,output,payload,values} from './value_nodes';

export {vectorAssembly} from './vector_assembly';
