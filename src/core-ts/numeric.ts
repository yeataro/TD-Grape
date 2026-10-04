import type {Value} from './model';
export type Type='float'|'vec2'|'vec3'|'vec4';
export const types:readonly string[]=['float','vec2','vec3','vec4'];
export function type(value:unknown):Type {if(!types.includes(String(value)))throw Error('Unsupported numeric type');return value as Type;}
export function count(t:Type):number {return t==='float'?1:Number(t.slice(-1));}
export function number(value:Value|undefined):string {
  if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>1e20)throw Error('Expected a finite number in supported range');
  // GLSL literals are rounded to the existing compiler's nine significant
  // decimal digits. Exponent padding is textual only, not a numeric change.
  if(Object.is(value,-0))return '-0.0';
  if(value===0)return '0.0';
  const parts=Math.abs(value).toExponential(8).split('e'),exponent=Number(parts[1]);
  let significand=Number(parts[0]!.replace('.',''));
  // JS rounds exact decimal halfway cases away from zero; Python's .9g uses
  // ties-to-even. Correct only an exactly representable halfway value. A
  // rounded binary approximation of a decimal midpoint must not count as one.
  const power=exponent-8,midpoint=2*significand-1;
  const exact=power<0?midpoint%Math.pow(5,-power)===0:midpoint*Math.pow(5,power)<=Number.MAX_SAFE_INTEGER;
  if(significand%2&&exact&&Math.abs(value)===(significand-.5)*Math.pow(10,power))significand--;
  const digits=String(significand).replace(/0+$/,'');
  let s:string;
  if(exponent<-4||exponent>=9)s=digits[0]+(digits.length>1?'.'+digits.slice(1):'')+'e'+(exponent<0?'-':'+')+String(Math.abs(exponent)).padStart(2,'0');
  else if(exponent<0)s='0.'+'0'.repeat(-exponent-1)+digits;
  else s=digits.length<=exponent+1?digits+'0'.repeat(exponent+1-digits.length)+'.0':digits.slice(0,exponent+1)+'.'+digits.slice(exponent+1);
  return (value<0?'-':'')+s;
}
export function literal(value:Value|undefined,t:Type):string {
  if(t==='float')return number(value);
  if(!Array.isArray(value)||value.length!==count(t))throw Error('Expected '+count(t)+' components');
  return t+'('+value.map(number).join(', ')+')';
}
export function fill(value:number,t:Type):Value {return t==='float'?value:Array.from({length:count(t)},()=>value);}
