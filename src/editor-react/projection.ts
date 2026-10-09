import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react';
import { core, same, typeColor, type GraphDocument, type GraphChanges, type Node,
  type NodePresentation, type PortSpec, type Bootstrap, type GhostKind, type Declaration } from './core';

export type FlowNode = RFNode<{
  authored: Node; label: string; colorGroup: string; view: NodePresentation; types: string[];
  /** connected: inputs with a wire; wired: outputs with at least one (port styles, Refactor.54.2). 接了線的輸入／輸出。 */
  inputs: PortSpec[]; outputs: PortSpec[]; connected: string[]; wired: string[]; ghost?: GhostKind;
  /** The declaration a reference node points to (its value is shown on the card, Refactor.55.2). 引用宣告節點指向的宣告。 */
  declaration?: Declaration;
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
const colorGroupOf = (module: { role: string; colorGroup?: string; referencedDeclaration?: (node: Node) => string }, node: Node, document: GraphDocument) => {
  if (module.colorGroup) return module.colorGroup;
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
  const dirty = new Set(delta?.nodes.filter(item => item.fields.some(key => key !== 'ui')).map(item => item.id));
  for (const edge of delta?.edges ?? []) {
    if (edge.before) { dirty.add(edge.before.to[0]); dirty.add(edge.before.from[0]); }
    if (edge.after) { dirty.add(edge.after.to[0]); dirty.add(edge.after.from[0]); }
  }
  const connected = new Map<string, string[]>(), outgoing = new Map<string, string[]>();
  for (const edge of network.data.edges) {
    const list = connected.get(edge.to[0]) ?? [];
    list.push(edge.to[1]); connected.set(edge.to[0], list);
    const out = outgoing.get(edge.from[0]) ?? [];
    if (!out.includes(edge.from[1])) out.push(edge.from[1]); outgoing.set(edge.from[0], out);
  }
  // Ghosts are judged by the core (ghosts.ts); a ghost's ports are the ones its stored wires use.
  // Ghost 由核心判斷；Ghost 節點的接孔就是它存著的線用到的那些。
  const ghosts = core.ghostsOf(network, core.values.policy);
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
        view: {}, types: [], inputs: ghostPorts(connected.get(node.id), 'input'), outputs: ghostPorts(outgoing.get(node.id), 'output'),
        connected: connected.get(node.id) ?? [], wired: outgoing.get(node.id) ?? [], ghost };
      data = data && same(data, next) ? data : next;
    } else if (!data || all || dirty.has(node.id) || data.ghost) {
      const module = node.definition!;
      const described = contract.definitions[authored.nodeType];
      const types: string[] = described?.selector === 'parameter'
        ? [...new Set<string>(described.variants.map((row: { type: string | null }) => row.type)
          .filter((type: string | null): type is string => !!type))] : [];
      const next = { authored, label: module.catalog.definition.label, colorGroup: colorGroupOf(module, authored, document),
        view: module.presentation?.(authored, network.context) ?? {}, types,
        inputs: Object.values(node.interface.inputs), outputs: Object.values(node.interface.outputs),
        connected: connected.get(node.id) ?? [], wired: outgoing.get(node.id) ?? [],
        declaration: module.referencedDeclaration ? document.document.declarations.find(d => d.id === module.referencedDeclaration!(authored)) : undefined };
      data = data && same(data, next) ? data : next;
    }
    if (old && old.data === data && same(old.position, position)) return old;
    return { ...old, id: node.id, type: 'grape' as const, position, data: data!,
      dragHandle: '.node-drag-surface' };
  });
  const priorEdges = new Map(previous.edges.map(edge => [edge.id, edge])), byId = new Map(nodes.map(node => [node.id, node]));
  const edges = network.edges.map(edge => {
    const saved = edge.data!, old = priorEdges.get(edge.id);
    // A ghost wire (Q37 1-3) is kept and drawn dashed; code generation treats it as not connected.
    // Ghost 線保留、畫成虛線；產碼時當作沒接。
    const ghost = ghosts.edges.has(edge.id);
    const sourceType = ghost ? '' : edge.from?.type ?? '', targetType = ghost ? '' : edge.to?.type ?? '';
    // The width is the theme's (--wire-width); only colour and dashes are per wire. The colour is also `color`, for looks
    // that follow it (the wire glow). 粗細由主題決定；每條線只決定顏色與虛線。顏色也放在 color，給跟著它的外觀用（接線光暈）。
    const style = ghost ? { stroke: 'var(--wire-ghost)', strokeDasharray: '6 4' } : { stroke: typeColor(sourceType), color: typeColor(sourceType) };
    const label = !ghost && sourceType !== targetType ? `${sourceType} → ${targetType}` : undefined;
    // A wire leaving a one-component output takes that component's colour under component tint (Refactor.59; legacy
    // app.js:623). 從單一分量輸出出發的線，在分量染色下用該分量色。
    const components = byId.get(saved.from[0])?.data.view.components?.outputs?.[saved.from[1]];
    const className = !ghost && components?.length === 1 ? 'component-' + components[0] : undefined;
    if (old && old.source === saved.from[0] && old.sourceHandle === saved.from[1] && old.className === className &&
        old.target === saved.to[0] && old.targetHandle === saved.to[1] && old.label === label && same(old.style, style)) return old;
    return { ...old, id: edge.id, source: saved.from[0], sourceHandle: saved.from[1], className,
      target: saved.to[0], targetHandle: saved.to[1], style, label,
      labelStyle: { fill: 'var(--text-secondary)', fontSize: 'var(--font-xs)' }, labelBgStyle: { fill: 'var(--surface-raised)' } };
  });
  const next = { nodes: retainArray(nodes, previous.nodes), edges: retainArray(edges, previous.edges) };
  return next.nodes === previous.nodes && next.edges === previous.edges ? previous : next;
}
