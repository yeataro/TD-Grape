import type { SubgraphData } from './model';
import { CORE_CONFIG } from './config';
import type { NodeContext, NodePresentation } from './node_module';
import type { PortSpec } from './ports';
import { literal, type, types, opaque } from './values';
import { validPort } from './subgraph_operations';

/** Whether every port carries a built-in type the host can pass (basic design §3.4, amendment A1): the numeric types and the
 * opaque ones, on both sides — under expansion an opaque port is only an alias. User structs never (§3.4); host built-in
 * structs when the type table has them. 接口型別是否都是內建型別：數值與 opaque，輸入輸出都可；自訂 struct 不上。 */
export function validInterface(f:SubgraphData|undefined):boolean {
  return !!f && ['inputs','outputs'].every(key =>
    Array.isArray(f[key as 'inputs'|'outputs']) &&
    f[key as 'inputs'|'outputs'].every(p => types.includes(p.type) || opaque.includes(p.type)));
}

export function requireSubgraph(context:NodeContext,id?:string):SubgraphData {
  const f = id === undefined ? context.owner : context.subgraph?.(id);
  if (!f) throw Error('Missing Subgraph definition');
  for (const ports of [f.inputs,f.outputs]) {
    if (ports.length > CORE_CONFIG.subgraphPortsPerSide) throw Error('Subgraph supports at most '+CORE_CONFIG.subgraphPortsPerSide+' ports per direction');
    const seen = new Set<string>();
    for (const p of ports) {
      if (!validPort(p) || seen.has(p.id)) throw Error('Invalid or duplicate Subgraph port');
      seen.add(p.id);
      if (!opaque.includes(p.type)) literal(p.default,type(p.type));
    }
  }
  return f;
}

export function subgraphPorts(f:SubgraphData,kind:'call'|'input'|'output'):PortSpec[] {
  const ports:PortSpec[] = [];
  if (kind === 'call' || kind === 'input')
    for (const p of f.inputs)
      ports.push({key:p.id,direction:kind === 'input' ? 'output' : 'input',type:p.type,...(p.default === undefined ? {} : {default:p.default})});
  if (kind === 'call' || kind === 'output')
    for (const p of f.outputs)
      ports.push({key:p.id,direction:kind === 'output' ? 'input' : 'output',type:p.type,...(p.default === undefined ? {} : {default:p.default})});
  return ports;
}

export function subgraphPresentation(f:SubgraphData,kind:'call'|'input'|'output'):NodePresentation {
  // A port shows its label; with none, nothing but the type (§3.3: the id is never shown). 接孔顯示標籤；沒有就只剩型別。
  const names = (ports:typeof f.inputs) => Object.fromEntries(ports.map(p => [p.id,p.label ?? '']));
  return {
    ...(kind === 'call' ? {label:f.name,descriptionKey:f.descriptionKey || 'help.function'} : {}),
    portLabels:kind === 'call' ? {inputs:names(f.inputs),outputs:names(f.outputs)} :
      kind === 'input' ? {outputs:names(f.inputs)} : {inputs:names(f.outputs)}
  };
}
