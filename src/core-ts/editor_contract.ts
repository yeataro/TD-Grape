/** Compatibility data for the existing editor, projected from real modules.
 * The host serves this build asset; it does not infer node ports or types.
 */
import {copy,type Node} from './model';
import {resolvePorts,type Registry,type NodeModule,type NodeContext,type Signature} from './node_module';
import * as values from './values';
import {identifierRules} from './identifier_rules';

type Variant={type:string|null;inputs:Record<string,string>;outputs:Record<string,string>};

function variants(module:NodeModule,target:string){
  const definition=module.catalog.definition;
  const base:Node={id:'projection',nodeType:definition.definitionUuid!,params:copy(definition.defaults)};
  const tokens=[...Object.values(definition.inputs),...Object.values(definition.outputs)];
  const selector=tokens.includes('D')?'declaration':
    tokens.includes('T')||typeof definition.defaults.type==='string'?'parameter':'fixed';
  const result:Variant[]=[];
  const types=selector==='fixed'?[null]:values.types;
  for(const selected of types){
    const context:NodeContext={target,declaration:()=>selector==='declaration'&&selected?
      {id:'source',kind:'uniform',name:'uSource',type:selected,value:values.fill(0,selected)}:undefined};
    let node=copy(base);
    if(selector==='parameter'&&selected){
      const requested={...node,params:{...node.params,type:selected}};
      if(!module.supports(requested,context))continue;
      if(!module.configure)throw Error('Missing configuration operation for '+definition.key);
      try{node=module.configure(node,{type:selected},context);}
      catch(error){throw Object.assign(Error('Editor projection failed for '+definition.key+' / '+selected+': '+String(error)),{cause:error});}
      if(!module.supports(node,context))throw Error('Configuration changed advertised capability: '+definition.key+' / '+selected);
    }
    if(selector==='declaration')node.params.declarationId='source';
    if(!module.supports(node,context))continue;
    module.validate(node,context);
    const ports=resolvePorts(module,node,context).types();
    const signatures:readonly Signature[]=module.signatures?.(node,context)||[];
    const matching=signatures.filter(row=>row.type===selected);
    result.push(...(matching.length?matching.map(row=>({type:selected,inputs:{...row.inputs},outputs:{...row.outputs}})):
      [{type:selected,inputs:{...ports.inputs},outputs:{...ports.outputs}}]));
  }
  if(!result.length)throw Error('No editor interface for module '+definition.key);
  if(selector==='parameter'&&typeof definition.defaults.type==='string'&&
      !result.some(row=>row.type===definition.defaults.type))throw Error('Unsupported default type for module '+definition.key);
  return {selector,variants:result};
}

// UI compatibility projection for component grouping. Module callbacks remain
// authoritative when an actual node changes or accepts a wire.
function vectorLayouts(type:string){
  const width=values.count(type),family=values.family(type),result:{inputs:Record<string,string>;groups:Record<string,string>}[]=[];
  const visit=(start:number,inputs:Record<string,string>,groups:Record<string,string>)=>{
    if(start===width){result.push({inputs,groups});return;}
    for(let size=1;size<=width-start;size++){
      const key='xyzw'[start]!,part=values.shaped(family,size);
      visit(start+size,{...inputs,[key]:part},size===1?groups:{...groups,[key]:part});
    }
  };
  visit(0,{},{});return result;
}

export function createEditorContract(registry:Registry,target='top'){
  const modules=registry.modules.filter(m=>!m.structural&&m.catalog.definition.stages.includes('pixel'));
  return {
    version:1,glslCode:identifierRules,valueTypes:[...values.types],numericTypes:values.types.filter(t=>values.family(t)!=='bool'),
    resourceTypes:[...values.opaque],specConstantTypes:[],
    types:Object.fromEntries(values.types.map(t=>[t,{family:values.family(t),components:values.count(t)}])),
    conversions:values.policy.conversions.map(row=>({...row,kind:values.count(row.from)===1&&values.count(row.to)>1?'splat':'cast'})),
    definitions:Object.fromEntries(modules.map(m=>[m.catalog.definition.definitionUuid,variants(m,target)])),
    convert:{types:[...values.types],fromParameter:'fromType',toParameter:'toType',
      pairs:Object.fromEntries(values.types.map(from=>[from,values.types.filter(to=>values.explicit(from,to))]))},
    vectors:{version:1,types:[...values.vectors],components:'xyzw',
      scalarTypes:Object.fromEntries(values.vectors.map(t=>[t,values.family(t)])),
      layouts:Object.fromEntries(values.vectors.map(t=>[t,vectorLayouts(t)]))}
  };
}
