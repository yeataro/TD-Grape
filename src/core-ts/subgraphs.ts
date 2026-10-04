import { copy, type InterfacePort, type Value, type Node, type SubgraphData } from './model';
import { type, literal, count } from './numeric';
import type { GraphDocument } from './graph';

type Direction = 'inputs'|'outputs';
export type InterfaceEdit =
  | {kind:'add';port:InterfacePort}
  | {kind:'remove';id:string}
  | {kind:'move';id:string;delta:number}
  | {kind:'update';id:string;patch:Partial<Pick<InterfacePort,'name'|'type'|'default'>>};

function reshape(value:Value,to:string):Value {
  const t = type(to);
  const values = Array.isArray(value) ? value : [value];
  return t === 'float' ? values[0] ?? 0 :
    Array.from({length:count(t)},(_,i) => values[i] ?? values[0] ?? 0);
}

/** One graph-owned definition and all its instances. Library localization is
 * still an editor adapter; this operation requires its resulting local copy. */
export class Subgraph {
  constructor(readonly graph:GraphDocument,readonly id:string) {}

  get data():SubgraphData|undefined {
    return this.graph.document.functions?.find(f => f.id === this.id);
  }

  editInterface(direction:Direction,edit:InterfaceEdit):void {
    this.graph.assertEditable();
    const f = this.data;
    if (!f || f.scope !== 'local') throw Error('Edit a local Subgraph definition');
    const list = f[direction];
    if (!Array.isArray(list)) throw Error('Invalid Subgraph interface');
    const next = copy(list);
    const index = edit.kind === 'add' ? -1 : next.findIndex(p => p.id === edit.id);
    if (edit.kind !== 'add' && index < 0) throw Error('Subgraph port no longer exists');
    if (edit.kind === 'add') next.push(copy(edit.port));
    else if (edit.kind === 'remove') next.splice(index,1);
    else if (edit.kind === 'move') {
      if (!Number.isInteger(edit.delta) || index + edit.delta < 0 || index + edit.delta >= next.length)
        throw Error('Invalid Subgraph port order');
      next.splice(index + edit.delta,0,next.splice(index,1)[0]!);
    } else {
      if (Object.keys(edit.patch).some(k => !['name','type','default'].includes(k)))
        throw Error('Interface edit cannot change port identity');
      const p = next[index]!;
      const previous = p.type;
      Object.assign(p,copy(edit.patch));
      if (p.type !== previous && edit.patch.default === undefined) p.default = reshape(p.default,p.type);
    }
    if (next.length > 16) throw Error('Subgraph supports at most 16 ports per direction');
    const seen = new Set<string>();
    for (const p of next) {
      if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(p.id) || seen.has(p.id))
        throw Error('Invalid or duplicate Subgraph port');
      seen.add(p.id);
      literal(p.default,type(p.type));
    }

    // Prepare every patch before mutation, including instance defaults.
    const patches:{node:Node;values:Record<string,Value>}[] = [];
    const removed = edit.kind === 'remove' ? edit.id : null;
    const changed = edit.kind === 'update' && next[index]!.type !== list[index]!.type ? next[index]! : null;
    const networks = [
      ...Object.values(this.graph.document.stages),
      ...(this.graph.document.functions || []).map(d => d.graph)
    ];
    const affected = (node:Node,data:typeof f.graph) => {
      const module = this.graph.registry.get(node.definitionUuid);
      if (module?.referencedGraph?.(node) === f.id) return direction === 'inputs' ? 'input' : 'output';
      if (data === f.graph && module?.role === (direction === 'inputs' ? 'subgraph-input' : 'subgraph-output'))
        return direction === 'inputs' ? 'output' : 'input';
      return null;
    };
    for (const data of networks) for (const n of data.nodes) {
      if (affected(n,data) !== 'input' || !n.inputValues) continue;
      const values = copy(n.inputValues);
      if (removed) delete values[removed];
      if (changed && Object.prototype.hasOwnProperty.call(values,changed.id))
        values[changed.id] = reshape(values[changed.id]!,changed.type);
      patches.push({node:n,values});
    }
    f[direction] = next;
    for (const patch of patches) patch.node.inputValues = patch.values;
    if (removed) for (const data of networks) {
      const nodes = new Map(data.nodes.map(n => [n.id,affected(n,data)]));
      data.edges = data.edges.filter(e =>
        !(nodes.get(e.from[0]) === 'output' && e.from[1] === removed) &&
        !(nodes.get(e.to[0]) === 'input' && e.to[1] === removed));
    }
  }
}
