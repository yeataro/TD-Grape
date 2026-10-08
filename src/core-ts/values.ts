/**
 * Scalar/vector types, literals, default values and conversion policies.
 * 純量／向量共用的型別與值工具，供節點模組、接線規劃與產碼使用。
 * 包含：型別查詢、GLSL 字面值、預設值調整、手動與自動轉換的配對規則。
 * 目前不涵蓋 double、矩陣或 texture 等資源型別；宿主參數綁定另有自己的規則。
 */
import {copy, type Value} from './model';
import {number} from './numeric';

// Supported types — 四種元素型別家族，各有純量及 2／3／4 分量向量，共 16 種。
export const scalars = ['float', 'int', 'uint', 'bool'] as const;
export type Family = typeof scalars[number];
export const types: readonly string[] = scalars.flatMap(f => [f, ...[2,3,4].map(n => shaped(f,n))]);
export const vectors = types.filter(t => count(t)>1);
/**
 * Opaque types (Refactor.43): a texture is passed as it is to an input of the same type. It has no
 * value, no conversion and no literal, and GLSL cannot keep it in a local variable, so code
 * generation writes its expression where it is used. 不透明型別：貼圖原樣傳給同型別的輸入；
 * 沒有值、不能轉型、沒有字面值，GLSL 也不能放進區域變數，所以產碼時直接代入使用的地方。
 */
export const opaque: readonly string[] = ['sampler2D'];

/** Type from family + width — 用家族與分量數組出名稱，例如 shaped('int', 3) → ivec3。 */
export function shaped(f:Family,n:number):string {
  if(!Number.isInteger(n)||n<1||n>4)throw Error('Invalid component count');
  return n===1?f:({float:'vec',int:'ivec',uint:'uvec',bool:'bvec'}[f]+n);
}
/** Validate type name — 確認名稱屬於支援的 16 種型別；不支援時直接報錯。 */
export function type(t:unknown):string {if(typeof t!=='string'||!types.includes(t))throw Error('Unsupported value type');return t;}
/** Component count — 預期傳入已確認的純量／向量型別；此函式本身不驗證名稱。 */
export function count(t:string):number {return /vec[234]$/.test(t)?Number(t.slice(-1)):1;}
/** Element family — 取得元素型別，例如 ivec3 → int、vec4 → float。 */
export function family(t:string):Family {type(t);return t.startsWith('ivec')?'int':t.startsWith('uvec')?'uint':t.startsWith('bvec')?'bool':t.startsWith('vec')?'float':t as Family;}

/**
 * Validate a value and emit its GLSL literal without reshaping it.
 * 驗證資料並寫成 GLSL 字面值，例如 true、1u、vec3(1.0, 2.0, 3.0)。
 * 向量必須已有正確分量數，整數必須符合 32-bit 範圍；不在這裡自動補值或截斷。
 */
export function literal(value:Value|undefined,t:string):string {
  type(t);const n=count(t),f=family(t);
  if(n>1){if(!Array.isArray(value)||value.length!==n)throw Error('Expected '+n+' components');return t+'('+value.map(v=>literal(v,f)).join(', ')+')';}
  if(f==='float')return number(value);
  if(f==='bool'){if(typeof value!=='boolean')throw Error('Expected a boolean');return String(value);}
  const low=f==='int'?-2147483648:0,high=f==='int'?2147483647:4294967295;
  if(typeof value!=='number'||!Number.isInteger(value)||value<low||value>high)throw Error('Expected a 32-bit '+f);
  return value===-2147483648?'(-2147483647 - 1)':String(value)+(f==='uint'?'u':'');
}

/**
 * Reshape stored/default values; this does not define automatic Edge conversions.
 * 明確調整資料中的值，供切換型別、建立預設值等操作使用；不是 Edge 自動轉換。
 * 目標分量較少時取前面的值；不足時補第一個值，連第一個值都沒有才補 0。
 * 轉整數會去除小數並限制範圍；完成後再用 literal() 驗證結果。
 */
export function reshape(value:Value,t:string):Value {
  const f=family(t),a=Array.isArray(value)?value:[value];
  const scalar=(v:Value):Value=>f==='bool'?Boolean(v):f==='float'?Number(v):Math.min(f==='int'?2147483647:4294967295,Math.max(f==='int'?-2147483648:0,Math.trunc(Number(v))));
  const next=Array.from({length:count(t)},(_,i)=>scalar(a[i]??a[0]??0));
  const result=count(t)===1?next[0]!:next;literal(result,t);return result;
}
/** Fill all components — 用同一值填滿指定型別，例如 fill(1, 'vec3') → [1, 1, 1]。 */
export const fill=(v:number|boolean,t:string):Value=>reshape(v,t);

/**
 * Explicit Convert pairs: casts, scalar splats and vector truncation, but no vector expansion.
 * 手動 Convert 節點可選的配對，比 Edge 自動轉換寬鬆：
 * 允許布林與數值互轉、純量展開，以及向量取較少分量；不允許向量擴成更多分量。
 * 此處只判斷可否配對，真正的 GLSL 轉換由 Convert 節點產生。
 */
export function explicit(source:string,target:string):boolean {return types.includes(source)&&types.includes(target)&&(count(source)===1||count(source)>=count(target));}

/**
 * Automatic Edge conversion policy; source output types stay unchanged.
 * New pairs must also have valid GLSL emission, not just permission to connect.
 * Edge 自動接線的共用規則，不改變來源節點的輸出型別。
 * 同型直連由接線檢查另外接受，因此 conversions 只列出不同型別的有向配對。
 * 放行配對後，產碼端會在使用來源值的位置加入目標型別的 GLSL constructor。
 * 未來若加入需要補值等特殊處理的配對，必須同時實作產碼，不能只擴充此表。
 */
export const policy={
  // Type widths — 列出支援的型別與分量數，供同型直連及其他型別查詢使用。
  // Opaque types connect only to the same type (0 components: never a conversion).
  // 不透明型別只能接同型別（0 分量：不參與任何轉換）。
  components:Object.fromEntries([...types.map(t=>[t,count(t)]),...opaque.map(t=>[t,0])]),
  // Numeric casts/splats and bool splats only; no automatic vector resizing.
  // 數值家族 float／int／uint：同分量數可互轉，純量可展開成任意數值向量。
  // 布林只允許 bool → bvec2／3／4；不自動做布林與數值互轉。
  // 不自動做向量縮短、向量擴長或向量 → 純量；需要時由使用者明確操作。
  conversions:types.flatMap(from=>types.filter(to=>from!==to&&
    (family(from)!=='bool'&&family(to)!=='bool'&&(count(from)===count(to)||count(from)===1)||
     family(from)===family(to)&&count(from)===1)).map(to=>({from,to})))
};
// Re-export copy — 方便節點模組從同一組值工具取得資料複製函式。
export {copy};
