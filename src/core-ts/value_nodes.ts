import {object,copy,type Node,type Value} from './model';
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
    edit:spec.edit,emit:spec.emit,
    presentation:n=>({selectorLabel:'vector.outputType',...spec.presentation?.(n)})
  };
}
export const input=(key:string,t:string,value:number|boolean=0):PortSpec=>({key,direction:'input',type:t,default:values.fill(value,t)});
export const output=(key:string,t:string):PortSpec=>({key,direction:'output',type:t});
export function payload(value:Value|undefined):Value {const data=object(value);if(!data||data.value===undefined)throw Error('Missing command value');return data.value;}
