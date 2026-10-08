import type { Value } from './model';

/** Keys survive labels, ordering, type changes, save/load and Undo. Scope is
 * supplied by the owning network; these read-only projections are not state. */
/** `fallback`: a GLSL expression an unconnected input uses instead of an editable value, e.g.
 * vUV.st for texture coordinates (Refactor.43). 沒接線時用的 GLSL 式子（取代可編輯的值）。 */
export interface PortSpec {readonly key:string;readonly direction:'input'|'output';readonly type:string;readonly default?:Value;readonly fallback?:string}
export interface PortTypes {inputs:Record<string,string>;outputs:Record<string,string>}
export class NodePorts {
  readonly inputs:Readonly<Record<string,PortSpec>>;
  readonly outputs:Readonly<Record<string,PortSpec>>;
  private readonly projected:PortTypes;
  constructor(specs:readonly PortSpec[]){
    const inputs:Record<string,PortSpec>=Object.create(null),outputs:Record<string,PortSpec>=Object.create(null);
    const inputTypes:Record<string,string>={},outputTypes:Record<string,string>={};
    for(const spec of specs){
      if(!spec.key||!spec.type||!['input','output'].includes(spec.direction))throw Error('Invalid port definition');
      const target=spec.direction==='input'?inputs:outputs;
      if(target[spec.key])throw Error('Duplicate port key: '+spec.key);
      const value=spec.default&&typeof spec.default==='object'?JSON.parse(JSON.stringify(spec.default)) as Value:spec.default;
      const freeze=(v:Value):Value=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
      target[spec.key]=Object.freeze({key:spec.key,direction:spec.direction,type:spec.type,default:value===undefined?undefined:freeze(value),
        ...(spec.fallback===undefined?{}:{fallback:spec.fallback})});
      (spec.direction==='input'?inputTypes:outputTypes)[spec.key]=spec.type;
    }
    this.inputs=Object.freeze(inputs);this.outputs=Object.freeze(outputs);
    this.projected=Object.freeze({inputs:Object.freeze(inputTypes),outputs:Object.freeze(outputTypes)});Object.freeze(this);
  }
  types():PortTypes {
    return this.projected;
  }
}

/** Connection policy belongs to the graph, not individual modules or widgets. */
export function compatible(source:string|undefined,target:string|undefined,types:Readonly<Record<string,number>>,conversions:readonly {from:string;to:string}[]):boolean {
  return !!source&&!!target&&(source===target&&types[source]!==undefined||conversions.some(v=>v.from===source&&v.to===target));
}
