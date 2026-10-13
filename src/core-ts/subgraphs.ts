import { copy, type InterfacePort, type Value, type Node, type SubgraphData } from './model';
import { type, literal, reshape, fill, opaque } from './values';
import { validPort } from './subgraph_operations';
import type { GraphDocument } from './graph';
import { CORE_CONFIG } from './config';

type Direction = 'inputs'|'outputs';
export type InterfaceEdit =
  | {kind:'add';port:InterfacePort}
  | {kind:'remove';id:string}
  | {kind:'move';id:string;delta:number}
  | {kind:'update';id:string;patch:Partial<Pick<InterfacePort,'label'|'type'|'default'>>};

/** One graph-owned definition and all its instances. Every definition in a graph is editable until the Library round adds
 * read-only copies (Refactor.109). 圖裡的定義與它的所有引用；Library 那一輪之前每份定義都可改。 */
export class Subgraph {
  constructor(readonly graph:GraphDocument,readonly id:string) {}

  get data():SubgraphData|undefined {
    return this.graph.document.subgraphs?.find(f => f.id === this.id);
  }

  rename(name:string):void {
    this.graph.assertEditable();const f=this.data;
    if(!f)throw Error('Subgraph definition no longer exists');
    if(!name.trim() || name.length>80 || /[\x00-\x1f\x7f]/.test(name))throw Error('Invalid Subgraph name');
    f.name=name.trim();
  }

  editInterface(direction:Direction,edit:InterfaceEdit):void {
    this.graph.assertEditable();
    const f = this.data;
    if (!f) throw Error('Subgraph definition no longer exists');
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
      if (Object.keys(edit.patch).some(k => !['label','type','default'].includes(k)))
        throw Error('Interface edit cannot change port identity');
      const p = next[index]!;
      const previous = p.type;
      Object.assign(p,copy(edit.patch));
      if (edit.patch.label === '') delete p.label;
      // A type change keeps the default in shape; an opaque port has none (§3.4). 換型別時預設值跟著換形狀；opaque 沒有預設值。
      if (opaque.includes(p.type)) {if (edit.patch.default !== undefined) throw Error('An opaque Subgraph port has no default');delete p.default;}
      else if (p.type !== previous && edit.patch.default === undefined) p.default = opaque.includes(previous) ? fill(0,p.type) : reshape(p.default!,p.type);
    }
    if (next.length > CORE_CONFIG.subgraphPortsPerSide) throw Error('Subgraph supports at most '+CORE_CONFIG.subgraphPortsPerSide+' ports per direction');
    const seen = new Set<string>();
    for (const p of next) {
      if (!validPort(p) || seen.has(p.id)) throw Error('Invalid or duplicate Subgraph port');
      seen.add(p.id);
      if (!opaque.includes(p.type)) literal(p.default,type(p.type));
    }

    // Prepare every patch before mutation, including instance defaults.
    const patches:{node:Node;values:Record<string,Value>}[] = [];
    const removed = edit.kind === 'remove' ? edit.id : null;
    const changed = edit.kind === 'update' && next[index]!.type !== list[index]!.type ? next[index]! : null;
    const networks = [
      ...Object.values(this.graph.document.stages),
      ...(this.graph.document.subgraphs || []).map(d => d.graph)
    ];
    const affected = (node:Node,data:typeof f.graph) => {
      const module = this.graph.registry.get(node.nodeType);
      if (module?.referencedGraph?.(node) === f.id) return direction === 'inputs' ? 'input' : 'output';
      if (data === f.graph && module?.role === (direction === 'inputs' ? 'subgraph-input' : 'subgraph-output'))
        return direction === 'inputs' ? 'output' : 'input';
      return null;
    };
    for (const data of networks) for (const n of data.nodes) {
      if (affected(n,data) !== 'input' || !n.inputValues) continue;
      const values = copy(n.inputValues);
      if (removed) delete values[removed];
      if (changed && Object.prototype.hasOwnProperty.call(values,changed.id)) {
        // An instance value follows the new shape; an opaque port keeps none. 實例值跟著新形狀；opaque 接口沒有實例值。
        if (opaque.includes(changed.type)) delete values[changed.id];
        else values[changed.id] = reshape(values[changed.id]!,changed.type);
      }
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
