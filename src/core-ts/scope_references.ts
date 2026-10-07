/** Portable references to a node output used in an array-length expression.
 * They name graph data, not evaluated values or a Library/importer object. */
export interface ScopeReference {scope:string;source:readonly [string,string]}
const identifier = /^[A-Za-z][A-Za-z0-9_]{0,70}$/;
const opaque = new Set(['code','ui','source','origin','catalogSnapshot','comment','description','extensions']);
const fields = new Set(['type','elementType','fromType','toType','fixedType','length']);

function token(scope:string,source:readonly string[]):string {
  const parts = [scope,...source];
  if (parts.length !== 3 || !parts.every(p => identifier.test(p)))
    throw Error('Invalid scoped output reference');
  return 'sg_extent_' + [...parts.join('\0')]
    .map(c => c.charCodeAt(0).toString(16).padStart(2,'0')).join('');
}

function reference(value:unknown):ScopeReference|null {
  if (typeof value !== 'string' || !/^sg_extent_(?:[0-9a-f]{2})+$/.test(value)) return null;
  const parts = value.slice(10).match(/../g)!
    .map(v => String.fromCharCode(parseInt(v,16))).join('').split('\0');
  return parts.length === 3 && parts.every(p => identifier.test(p)) ?
    {scope:parts[0]!,source:[parts[1]!,parts[2]!]} : null;
}

function walk(value:unknown,replace:(ref:ScopeReference,token:string)=>string,mutate=true):void {
  if (Array.isArray(value)) {value.forEach(v => walk(v,replace,mutate));return;}
  if (!value || typeof value !== 'object') return;
  const object = value as Record<string,unknown>;
  for (const [key,item] of Object.entries(object)) {
    if (fields.has(key) && typeof item === 'string') {
      const next = item.replace(/\bsg_extent_(?:[0-9a-f]{2})+\b/g,old => {
        const ref = reference(old);
        return ref ? replace(ref,old) : old;
      });
      if (mutate) object[key] = next;
    } else if (!opaque.has(key)) walk(item,replace,mutate);
  }
}

export const ScopeReferences = {token,reference,walk};
