/** Serializable graph data. Definitions never own editable node/port state. */
export type Value = null|boolean|number|string|Value[]|{[key:string]:Value};
export type ObjectValue = {[key:string]:Value};
export interface Node {id:string;definitionUuid:string;params:ObjectValue;name?:string;inputValues?:ObjectValue;ui?:ObjectValue}
export interface Declaration {id:string;kind:string;name:string;type:string;value:Value;[key:string]:Value}
export interface Edge {id?:string;from:readonly [string,string];to:readonly [string,string]}
export interface NetworkData {nodes:Node[];edges:Edge[];ui?:ObjectValue;edgeSequence?:number}
export interface InterfacePort {id:string;name?:string;type:string;default:Value}
export interface SubgraphData {id:string;name:string;scope:string;descriptionKey?:string;stages:string[];targets?:string[];inputs:InterfacePort[];outputs:InterfacePort[];graph:NetworkData}
export interface Graph {schemaVersion:number;target:string;declarations:Declaration[];functions?:SubgraphData[];topInputs?:unknown[];typeDefinitions?:unknown[];stages:Record<string,NetworkData>}
export function object(v:Value|undefined):ObjectValue|undefined {return v!==null&&typeof v==='object'&&!Array.isArray(v)?v:undefined;}
/** Own JSON values at mutation boundaries; callers never retain editable state. */
export function copy<T>(value:T):T {return JSON.parse(JSON.stringify(value)) as T;}
