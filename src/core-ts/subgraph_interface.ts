import type { SubgraphData } from './model';
import { CORE_CONFIG } from './config';
import type { NodeContext, NodePresentation } from './node_module';
import type { PortSpec } from './ports';
import { literal, type, types } from './values';

export function numericInterface(f:SubgraphData|undefined):boolean {
  return !!f && ['inputs','outputs'].every(key =>
    Array.isArray(f[key as 'inputs'|'outputs']) &&
    f[key as 'inputs'|'outputs'].every(p => types.includes(p.type)));
}

export function requireSubgraph(context:NodeContext,id?:string):SubgraphData {
  const f = id === undefined ? context.owner : context.subgraph?.(id);
  if (!f) throw Error('Missing Subgraph definition');
  for (const ports of [f.inputs,f.outputs]) {
    if (ports.length > CORE_CONFIG.subgraphPortsPerSide) throw Error('Subgraph supports at most '+CORE_CONFIG.subgraphPortsPerSide+' ports per direction');
    const seen = new Set<string>();
    for (const p of ports) {
      if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(p.id) || seen.has(p.id))
        throw Error('Invalid or duplicate Subgraph port');
      seen.add(p.id);
      literal(p.default,type(p.type));
    }
  }
  return f;
}

export function subgraphPorts(f:SubgraphData,kind:'call'|'input'|'output'):PortSpec[] {
  const ports:PortSpec[] = [];
  if (kind === 'call' || kind === 'input')
    for (const p of f.inputs)
      ports.push({key:p.id,direction:kind === 'input' ? 'output' : 'input',type:p.type,default:p.default});
  if (kind === 'call' || kind === 'output')
    for (const p of f.outputs)
      ports.push({key:p.id,direction:kind === 'output' ? 'input' : 'output',type:p.type,default:p.default});
  return ports;
}

export function subgraphPresentation(f:SubgraphData,kind:'call'|'input'|'output'):NodePresentation {
  const names = (ports:typeof f.inputs) => Object.fromEntries(ports.map(p => [p.id,p.name || p.id]));
  return {
    ...(kind === 'call' ? {
      label:f.name,
      descriptionKey:f.scope === 'local' ? 'help.function' : f.descriptionKey || 'help.function'
    } : {}),
    portLabels:kind === 'call' ? {inputs:names(f.inputs),outputs:names(f.outputs)} :
      kind === 'input' ? {outputs:names(f.inputs)} : {inputs:names(f.outputs)}
  };
}
