import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react';
import { core, same, typeColor, type GraphDocument, type GraphChanges, type Node,
  type NodePresentation, type PortSpec, type Bootstrap, type GhostKind, type Declaration, type ComponentStyle } from './core';

export type FlowNode = RFNode<{
  authored: Node; label: string; colorGroup: string; view: NodePresentation; types: string[];
  /** How the node names vector components, inputs and outputs alike (Refactor.85, human 2026-10-11: we show input components,
   * legacy did not). 節點怎麼稱呼向量分量，輸入輸出都用（R.85，人類 10-11：我們看得到輸入的分量，舊產品看不到）。 */
  componentStyle?: ComponentStyle;
  /** connected: inputs with a wire; wired: outputs with at least one (port styles, Refactor.54.2). 接了線的輸入／輸出。 */
  inputs: PortSpec[]; outputs: PortSpec[]; connected: string[]; wired: string[]; ghost?: GhostKind;
  /** The declaration a reference node points to (its value is shown on the card, Refactor.55.2). 引用宣告節點指向的宣告。 */
  declaration?: Declaration;
  /** Inputs whose wire brings another type, with that type (Refactor.77.6: shown on the port, as the legacy editor did).
   * Taken from the wires every time, so a node follows when the node upstream changes type. 接進另一種型別的輸入與那個型別
   * （R.77.6：寫在接孔上，同舊產品）。每次都從線算，上游換型別時跟著變。 */
  conversions?: Record<string, string>;
}, 'grape'>;
export type FlowEdge = RFEdge;
export type Projection = { nodes: FlowNode[]; edges: FlowEdge[] };
const retainArray = <T,>(next: T[], old: T[]) =>
  next.length === old.length && next.every((item, i) => item === old[i]) ? old : next;

// A transaction prepares BOTH collections before the session publishes anything.
// GraphChanges 提供候選範圍，RF 外殼留用未變引用；不建立第二份可寫作品。
// Colour group: a display-only tag (COLOR_SYSTEM.md, design-interview Q42). Derived from behaviour where
// possible; the core never reads it. 顏色組：只給畫面的 tag；能從行為推的就推，核心永遠不讀。
// A reference node takes its colour from the kind of declaration it points to (Q42).
// 引用宣告節點的顏色來自它指向的宣告種類。
// A node in the Logic category wears the logic colour, whatever it is built from (Refactor.81.6, human 2026-10-11: all of them in
// logic; legacy coloured only Compare and If, graph_ui.js:142). 新增選單分類是「邏輯」的節點用邏輯色，不管它怎麼做出來的（R.81.6，人類：
// 通通放到邏輯類；舊產品只給 Compare、If）。
const colorGroupOf = (module: { role: string; colorGroup?: string; catalog?: { browser?: { category?: unknown } }; referencedDeclaration?: (node: Node) => string }, node: Node, document: GraphDocument) => {
  if (module.colorGroup) return module.colorGroup;
  if (module.catalog?.browser?.category === 'logic') return 'logic';
  if (module.referencedDeclaration) {
    const kind = document.document.declarations.find(d => d.id === module.referencedDeclaration!(node))?.kind;
    return (kind && core.declarationKinds.get(kind)?.colorGroup) || 'function';
  }
  return module.role === 'output' ? 'output' : 'function';
};

export function project(document: GraphDocument, previous: Projection, contract: Bootstrap['typeContract'], changes?: GraphChanges): Projection {
  const network = document.networks.get('pixel')!;
  const delta = changes?.networks.find(item => item.id === 'pixel');
  const all = !changes || !!changes.global.length || !!changes.definitions.length || delta?.complete === false;
  // A move (ui x, y) redraws nothing but the position; any other change, in ui too (component names, Refactor.85), redraws the node.
  // 移動（ui 的 x、y）只改位置；其他改變，包括 ui 裡的（分量名稱，R.85），重畫節點。
  const dirty = new Set(delta?.nodes.filter(item => item.fields.some(key => key !== 'ui') || item.ui.some(key => key !== 'x' && key !== 'y')).map(item => item.id));
  for (const edge of delta?.edges ?? []) {
    if (edge.before) { dirty.add(edge.before.to[0]); dirty.add(edge.before.from[0]); }
    if (edge.after) { dirty.add(edge.after.to[0]); dirty.add(edge.after.from[0]); }
  }
  // Two uses of the wires (Refactor.103.1): a ghost node's ports are the ones its stored wires use; whether a port is connected is
  // read from the wires in effect (connectivity.ts), so a ghost wire leaves its input showing its own value, as code generation uses it.
  // 線的兩種用途（R.103.1）：Ghost 節點的接孔是它存著的線用到的那些；接孔有沒有接，讀接通的線（connectivity.ts），所以 Ghost 線讓那個輸入
  // 顯示它自己的值，同產碼用的。
  const stored = new Map<string, string[]>(), storedOut = new Map<string, string[]>();
  const connected = new Map<string, string[]>(), outgoing = new Map<string, string[]>();
  const inEffect = core.connectedWires(network, core.values.policy);
  const add = (map: Map<string, string[]>, node: string, port: string) => { const list = map.get(node) ?? []; if (!list.includes(port)) list.push(port); map.set(node, list); };
  for (const edge of network.data.edges) {
    add(stored, edge.to[0], edge.to[1]); add(storedOut, edge.from[0], edge.from[1]);
    if (inEffect.has(edge)) { add(connected, edge.to[0], edge.to[1]); add(outgoing, edge.from[0], edge.from[1]); }
  }
  // Ghosts are judged by the core (ghosts.ts); a ghost's ports are the ones its stored wires use.
  // Ghost 由核心判斷；Ghost 節點的接孔就是它存著的線用到的那些。
  const ghosts = core.ghostsOf(network, core.values.policy);
  const conversions = new Map<string, Record<string, string>>();
  for (const edge of network.edges) {
    const from = edge.from?.type, to = edge.to?.type;
    if (!from || !to || from === to || ghosts.edges.has(edge.id)) continue;
    conversions.set(edge.data!.to[0], { ...conversions.get(edge.data!.to[0]), [edge.data!.to[1]]: from });
  }
  const sameList = (a: readonly string[] | undefined, b: readonly string[] | undefined) => (a ?? []).length === (b ?? []).length && (a ?? []).every((key, i) => key === b![i]);
  const ghostPorts = (keys: string[] | undefined, direction: 'input' | 'output'): PortSpec[] =>
    [...new Set(keys ?? [])].map(key => ({ key, direction, type: '' }));
  const priorNodes = new Map(previous.nodes.map(node => [node.id, node]));
  const nodes = network.nodes.map(node => {
    const authored = node.data!, old = priorNodes.get(node.id);
    const position = { x: Number(authored.ui?.x ?? 0), y: Number(authored.ui?.y ?? 0) };
    let data = old?.data;
    const ghost = ghosts.nodes.get(node.id);
    if (ghost) {
      // Recomputed every time: a node can turn ghost without being edited (e.g. its declaration is gone).
      const next = { authored, label: node.definition?.catalog.definition.label ?? authored.nodeType, colorGroup: 'ghost',
        view: {}, types: [], inputs: ghostPorts(stored.get(node.id), 'input'), outputs: ghostPorts(storedOut.get(node.id), 'output'),
        connected: connected.get(node.id) ?? [], wired: outgoing.get(node.id) ?? [], ghost };
      data = data && same(data, next) ? data : next;
    // A wire can come into effect or drop out without this node being edited (a type changed upstream): drawn again then too.
    // 線可能在這個節點沒被編輯時接通或斷開（上游改了型別）：那時也重畫。
    } else if (!data || all || dirty.has(node.id) || data.ghost || !sameList(data.connected, connected.get(node.id)) || !sameList(data.wired, outgoing.get(node.id))) {
      const module = node.definition!;
      const described = contract.definitions[authored.nodeType];
      const types: string[] = described?.selector === 'parameter'
        ? [...new Set<string>(described.variants.map((row: { type: string | null }) => row.type)
          .filter((type: string | null): type is string => !!type))] : [];
      const next = { authored, label: module.catalog.definition.label, colorGroup: colorGroupOf(module, authored, document),
        componentStyle: core.componentStyle(module, authored, network.context),
        view: module.presentation?.(authored, network.context) ?? {}, types,
        inputs: Object.values(node.interface.inputs), outputs: Object.values(node.interface.outputs),
        connected: connected.get(node.id) ?? [], wired: outgoing.get(node.id) ?? [],
        declaration: module.referencedDeclaration ? document.document.declarations.find(d => d.id === module.referencedDeclaration!(authored)) : undefined };
      data = data && same(data, next) ? data : next;
    }
    const converted = conversions.get(node.id);
    if (data && !same(data.conversions, converted)) data = { ...data, conversions: converted };
    if (old && old.data === data && same(old.position, position)) return old;
    // Nodes one layer up, so a group's title can sit between the wires (layer 0) and the nodes (Refactor.98; legacy style.css:968-975):
    // React Flow's own node property. 節點在第 1 層，群組標題才能在線（第 0 層）與節點之間（R.98；照舊產品）：React Flow 自己的節點屬性。
    return { ...old, id: node.id, type: 'grape' as const, position, data: data!,
      dragHandle: '.node-drag-surface', zIndex: 1 };
  });
  const priorEdges = new Map(previous.edges.map(edge => [edge.id, edge])), byId = new Map(nodes.map(node => [node.id, node]));
  const edges = network.edges.map(edge => {
    const saved = edge.data!, old = priorEdges.get(edge.id);
    // A ghost wire (Q37 1-3) is kept and drawn dashed; code generation treats it as not connected.
    // Ghost 線保留、畫成虛線；產碼時當作沒接。
    const ghost = ghosts.edges.has(edge.id);
    const sourceType = ghost ? '' : edge.from?.type ?? '', targetType = ghost ? '' : edge.to?.type ?? '';
    // The width is the theme's (--wire-width); only the colour is per wire, also as `color` for looks that follow it (the wire
    // glow). A ghost wire's look is the theme's, as a wire that does not count (style.css, Refactor.78).
    // 粗細由主題決定；每條線只決定顏色，也放在 color 給跟著它的外觀用（接線光暈）。Ghost 線的樣子由主題決定：不算數的線（R.78）。
    const style = ghost ? {} : { stroke: typeColor(sourceType), color: typeColor(sourceType) };
    const label = !ghost && sourceType !== targetType ? `${sourceType} → ${targetType}` : undefined;
    // A wire leaving a one-component output takes that component's colour under component tint (Refactor.59; legacy
    // app.js:623). 從單一分量輸出出發的線，在分量染色下用該分量色。
    const components = byId.get(saved.from[0])?.data.view.components?.outputs?.[saved.from[1]];
    const className = !ghost && components?.length === 1 ? 'component-' + components[0] : undefined;
    if (old && old.source === saved.from[0] && old.sourceHandle === saved.from[1] && old.className === className &&
        old.target === saved.to[0] && old.targetHandle === saved.to[1] && old.label === label && same(old.style, style)) return old;
    // A ghost wire is drawn by its own type, a ghost at its middle (Refactor.75.27); a wire that converts types by its own
    // too, carrying the target's type colour (Refactor.77.1, the gradient trial). Ghost 線用自己的類型畫，中點一隻幽靈；
    // 轉型的線也用自己的類型，帶著下游的型別色（R.77.1，漸層試驗）。
    return { ...old, id: edge.id, type: ghost ? 'ghost' : label ? 'convert' : undefined, source: saved.from[0], sourceHandle: saved.from[1], className,
      target: saved.to[0], targetHandle: saved.to[1], style, label,
      data: label ? { to: typeColor(targetType), fromType: sourceType, toType: targetType, component: components?.length === 1 ? components[0] : undefined } : undefined,
      labelStyle: { fill: 'var(--text-secondary)', fontSize: 'var(--font-xs)' }, labelBgStyle: { fill: 'var(--surface-raised)' } };
  });
  const next = { nodes: retainArray(nodes, previous.nodes), edges: retainArray(edges, previous.edges) };
  return next.nodes === previous.nodes && next.edges === previous.edges ? previous : next;
}
