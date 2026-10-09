import {object,copy,type Node,type Value,type ObjectValue} from './model';
import type {CatalogRow,NodeModule,NodePresentation} from './node_module';
import type {PortSpec} from './ports';
import * as values from './values';

export {values};
export function reshapeInputs(n:Node,before:readonly PortSpec[],after:readonly PortSpec[]):Node {
  for(const p of after)if(p.direction==='input'&&n.inputValues?.[p.key]!==undefined){
    const old=before.find(v=>v.direction==='input'&&v.key===p.key);
    if(old&&old.type!==p.type){
      n.ui||={};const cache=object(n.ui.inputValuesByType)||{};n.ui.inputValuesByType=cache;
      const stored=object(cache[p.key])||{};cache[p.key]=stored;stored[old.type]=copy(n.inputValues[p.key]!);
      n.inputValues[p.key]=stored[p.type]===undefined?values.reshape(n.inputValues[p.key]!,p.type):copy(stored[p.type]!);
    }
  }
  return n;
}
/** A typed value family owns its ports and commands; no node-name dispatch. */
export function typedNode(catalog:CatalogRow,spec:{
  types:readonly string[];
  ports:(type:string,node:Node)=>readonly PortSpec[];
  emit:NonNullable<NodeModule['emit']>;
  edit?:NonNullable<NodeModule['edit']>;
  configure?:(node:Node,type:string)=>Node;
  validate?:NonNullable<NodeModule['validate']>;
  presentation?:(node:Node)=>NodePresentation;
  creations?:NodeModule['creations'];
  /** Fixed-type entries (Q37 1-5, Refactor.50): the params a node of that type starts with. Given = the
   * menu offers the generic node plus one locked entry per type. 固定型別入口：給了就提供通用入口＋每種型別一個鎖定入口。 */
  fixed?:(type:string)=>ObjectValue;
}):NodeModule {
  const selected=(n:Node)=>String(n.params.type??catalog.definition.defaults.type);
  const ports=(n:Node)=>{const t=selected(n);if(!spec.types.includes(t))throw Error('Unsupported node type');return spec.ports(t,n);};
  return {catalog,role:'value',supports:n=>spec.types.includes(selected(n)),ports,
    configure:(n,s)=>{
      if(!('type' in s)||!spec.types.includes(s.type)||n.params.fixedType&&n.params.fixedType!==s.type)throw Error('Invalid manual type');
      const before=ports(n);n.params.type=s.type;
      n=spec.configure?spec.configure(n,s.type):n;
      return reshapeInputs(n,before,ports(n));
    },
    validate:(n,c)=>{if(n.params.fixedType&&n.params.fixedType!==selected(n))throw Error('Fixed node type');ports(n);spec.validate?.(n,c);},
    edit:spec.edit,emit:spec.emit,creations:spec.creations,
    ...(spec.fixed?{entries:()=>[{key:'',label:catalog.definition.label,params:{}},
      ...spec.types.map(t=>({key:t,label:t,literal:true,params:{type:t,fixedType:t,...spec.fixed!(t)}}))]}:{}),
    // A fixed node is titled by its type and has no type menu (Refactor.17.2). 固定型別的節點以型別為標題、沒有型別選單。
    presentation:n=>({selectorLabel:'vector.outputType',...spec.presentation?.(n),
      ...(n.params.fixedType?{label:String(n.params.fixedType),literalLabel:true,typeLocked:true}:{})})
  };
}
export const input=(key:string,t:string,value:number|boolean=0):PortSpec=>({key,direction:'input',type:t,default:values.fill(value,t)});
export const output=(key:string,t:string):PortSpec=>({key,direction:'output',type:t});
export function payload(value:Value|undefined):Value {const data=object(value);if(!data||data.value===undefined)throw Error('Missing command value');return data.value;}

export function staticNode(catalog:CatalogRow,spec:Pick<NodeModule,'ports'|'emit'>):NodeModule {
  return {catalog,role:'value',supports:()=>true,validate:()=>{},...spec};
}
