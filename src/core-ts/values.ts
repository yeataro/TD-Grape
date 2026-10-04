/** Portable scalar/vector values. Resource and native binding policies are separate. */
import {copy, type Value} from './model';
import {number} from './numeric';

export const scalars = ['float', 'int', 'uint', 'bool'] as const;
export type Family = typeof scalars[number];
export const types: readonly string[] = scalars.flatMap(f => [f, ...[2,3,4].map(n => shaped(f,n))]);
export const vectors = types.filter(t => count(t)>1);
export function shaped(f:Family,n:number):string {
  if(!Number.isInteger(n)||n<1||n>4)throw Error('Invalid component count');
  return n===1?f:({float:'vec',int:'ivec',uint:'uvec',bool:'bvec'}[f]+n);
}
export function type(t:unknown):string {if(typeof t!=='string'||!types.includes(t))throw Error('Unsupported value type');return t;}
export function count(t:string):number {return /vec[234]$/.test(t)?Number(t.slice(-1)):1;}
export function family(t:string):Family {type(t);return t.startsWith('ivec')?'int':t.startsWith('uvec')?'uint':t.startsWith('bvec')?'bool':t.startsWith('vec')?'float':t as Family;}
export function literal(value:Value|undefined,t:string):string {
  type(t);const n=count(t),f=family(t);
  if(n>1){if(!Array.isArray(value)||value.length!==n)throw Error('Expected '+n+' components');return t+'('+value.map(v=>literal(v,f)).join(', ')+')';}
  if(f==='float')return number(value);
  if(f==='bool'){if(typeof value!=='boolean')throw Error('Expected a boolean');return String(value);}
  const low=f==='int'?-2147483648:0,high=f==='int'?2147483647:4294967295;
  if(typeof value!=='number'||!Number.isInteger(value)||value<low||value>high)throw Error('Expected a 32-bit '+f);
  return value===-2147483648?'(-2147483647 - 1)':String(value)+(f==='uint'?'u':'');
}
export function reshape(value:Value,t:string):Value {
  const f=family(t),a=Array.isArray(value)?value:[value];
  const scalar=(v:Value):Value=>f==='bool'?Boolean(v):f==='float'?Number(v):Math.min(f==='int'?2147483647:4294967295,Math.max(f==='int'?-2147483648:0,Math.trunc(Number(v))));
  const next=Array.from({length:count(t)},(_,i)=>scalar(a[i]??a[0]??0));
  const result=count(t)===1?next[0]!:next;literal(result,t);return result;
}
export const fill=(v:number|boolean,t:string):Value=>reshape(v,t);
export function explicit(source:string,target:string):boolean {return types.includes(source)&&types.includes(target)&&(count(source)===1||count(source)>=count(target));}
export const policy={
  components:Object.fromEntries(types.map(t=>[t,count(t)])),
  conversions:types.flatMap(from=>types.filter(to=>from!==to&&
    (family(from)!=='bool'&&family(to)!=='bool'&&(count(from)===count(to)||count(from)===1)||
     family(from)===family(to)&&count(from)===1)).map(to=>({from,to})))
};
export {copy};
