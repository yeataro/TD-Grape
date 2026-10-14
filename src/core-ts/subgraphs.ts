import { copy, type InterfacePort, type Value, type Node, type SubgraphData } from './model';
import { type, literal, reshape, fill, opaque } from './values';
import { validPort } from './subgraph_operations';
import type { GraphDocument } from './graph';
import { CORE_CONFIG } from './config';
import { validSubgraphTitle, defaultCallNumber, newCallName, namesIn } from './node_names';

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

  /** The definition's colour (basic design §3.14): a hex colour as a group's, every call shows it; null takes it away (the default
   * colour group draws it). 定義的顏色（§3.14）：和群組一樣的色碼，每個呼叫都顯示；null 拿掉（畫面用預設顏色組）。 */
  recolor(color:string|null):void {
    this.graph.assertEditable();const f=this.data;
    if(!f)throw Error('Subgraph definition no longer exists');
    if(color!==null&&!/^#[0-9a-f]{6}$/.test(color))throw Error('Invalid Subgraph color');
    if(color===null)delete f.color;else f.color=color;
  }
  /** A new title, by the node-name rule (visual notes 27, human 2026-10-14). Calls still named by default for the old title follow it,
   * keeping their number when it is free (Gain_2 → Blur_2); calls named by hand stay. Old graphs may hold a title outside the rule;
   * it is checked only when it changes. 新的 Title，照節點名稱規則（外觀意見 27，人類）。仍是舊 Title 預設名的呼叫跟著改，編號沒人用就保留
   * （Gain_2 → Blur_2）；手動取名的不動。舊圖的 Title 可能不合規則，只在改的時候檢查。 */
  rename(title:string):void {
    this.graph.assertEditable();const f=this.data;
    if(!f)throw Error('Subgraph definition no longer exists');
    if(!validSubgraphTitle(title))throw Object.assign(Error('A subgraph title uses letters, digits, spaces and underscores, and starts with a letter'),{code:'subgraph.title'});
    const old=f.name;f.name=title;
    const networks=[...Object.values(this.graph.document.stages),...(this.graph.document.subgraphs||[]).map(d=>d.graph)];
    for(const data of networks){
      const taken=namesIn(data);
      for(const n of data.nodes){
        if(n.name===undefined||this.graph.registry.get(n.nodeType)?.referencedGraph?.(n)!==this.id)continue;
        const number=defaultCallNumber(n.name,old);
        if(number===null)continue;
        taken.delete(n.name);n.name=newCallName(title,taken,number);taken.add(n.name);
      }
    }
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
      // An instance value follows the new interface (fitInstanceValues). 實例值跟著新接口。
      patches.push({node:n,values:fitInstanceValues(n.inputValues,next)});
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

/** A call's explicit values fitted to its definition's current inputs (technical review TECH-2): a value whose port is gone is
 * dropped, an opaque port keeps none, a numeric value takes its port's shape, and one that cannot falls back to the port default.
 * Values not given stay not given. One rule for an interface edit and for pasting a call copied before the interface changed.
 * 呼叫的實例值對齊定義目前的輸入：接口不在就拿掉、opaque 接口不留值、數值換成接口的形狀，換不了就退回接口預設；沒給的維持沒給。
 * 改接口與貼上舊呼叫用同一條規則。 */
export function fitInstanceValues(values:Readonly<Record<string,Value>>,ports:readonly InterfacePort[]):Record<string,Value> {
  const fitted:Record<string,Value> = {};
  for (const [key,value] of Object.entries(values)) {
    const p = ports.find(port => port.id === key);
    if (!p || opaque.includes(p.type)) continue;
    try { fitted[key] = reshape(value,p.type); } catch { /* the port default applies 用接口預設 */ }
  }
  return fitted;
}
