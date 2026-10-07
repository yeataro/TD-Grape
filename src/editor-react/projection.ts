import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react';
import { core, same, typeColor, type GraphDocument, type GraphChanges, type Node,
  type NodePresentation, type PortSpec, type Bootstrap } from './core';

export type FlowNode = RFNode<{
  authored: Node; label: string; colorGroup: string; view: NodePresentation; types: string[];
  inputs: PortSpec[]; outputs: PortSpec[]; connected: string[];
}, 'grape'>;
export type FlowEdge = RFEdge;
export type Projection = { nodes: FlowNode[]; edges: FlowEdge[] };
const retainArray = <T,>(next: T[], old: T[]) =>
  next.length === old.length && next.every((item, i) => item === old[i]) ? old : next;

// A transaction prepares BOTH collections before the session publishes anything.
// GraphChanges 提供候選範圍，RF 外殼留用未變引用；不建立第二份可寫作品。
// Colour group: a display-only tag (COLOR_SYSTEM.md, design-interview Q42). Derived from behaviour where
// possible; the core never reads it. 顏色組：只給畫面的 tag；能從行為推的就推，核心永遠不讀。
const colorGroupOf = (module: { role: string }) => module.role === 'output' ? 'output' : 'function';

export function project(document: GraphDocument, previous: Projection, contract: Bootstrap['typeContract'], changes?: GraphChanges): Projection {
  const network = document.networks.get('pixel')!;
  const delta = changes?.networks.find(item => item.id === 'pixel');
  const all = !changes || !!changes.global.length || !!changes.definitions.length || delta?.complete === false;
  const dirty = new Set(delta?.nodes.filter(item => item.fields.some(key => key !== 'ui')).map(item => item.id));
  for (const edge of delta?.edges ?? []) {
    if (edge.before) dirty.add(edge.before.to[0]);
    if (edge.after) dirty.add(edge.after.to[0]);
  }
  const connected = new Map<string, string[]>();
  for (const edge of network.data.edges) {
    const list = connected.get(edge.to[0]) ?? [];
    list.push(edge.to[1]); connected.set(edge.to[0], list);
  }
  const priorNodes = new Map(previous.nodes.map(node => [node.id, node]));
  const nodes = network.nodes.map(node => {
    const authored = node.data!, old = priorNodes.get(node.id);
    const position = { x: Number(authored.ui?.x ?? 0), y: Number(authored.ui?.y ?? 0) };
    let data = old?.data;
    if (!data || all || dirty.has(node.id)) {
      const module = node.definition!;
      const described = contract.definitions[authored.nodeType];
      const types: string[] = described?.selector === 'parameter'
        ? [...new Set<string>(described.variants.map((row: { type: string | null }) => row.type)
          .filter((type: string | null): type is string => !!type))] : [];
      const next = { authored, label: module.catalog.definition.label, colorGroup: colorGroupOf(module),
        view: module.presentation?.(authored, network.context) ?? {}, types,
        inputs: Object.values(node.interface.inputs), outputs: Object.values(node.interface.outputs),
        connected: connected.get(node.id) ?? [] };
      data = data && same(data, next) ? data : next;
    }
    if (old && old.data === data && same(old.position, position)) return old;
    return { ...old, id: node.id, type: 'grape' as const, position, data: data!,
      dragHandle: '.node-drag-surface' };
  });
  const priorEdges = new Map(previous.edges.map(edge => [edge.id, edge]));
  const edges = network.edges.map(edge => {
    const saved = edge.data!, old = priorEdges.get(edge.id);
    const sourceType = edge.from?.type ?? '', targetType = edge.to?.type ?? '';
    const valid = edge.connection(core.values.policy).valid;
    const style = { stroke: valid ? typeColor(sourceType) : '#f17b88', strokeWidth: 2 };
    const label = sourceType !== targetType ? `${sourceType} → ${targetType}` : undefined;
    if (old && old.source === saved.from[0] && old.sourceHandle === saved.from[1] &&
        old.target === saved.to[0] && old.targetHandle === saved.to[1] && old.label === label && same(old.style, style)) return old;
    return { ...old, id: edge.id, source: saved.from[0], sourceHandle: saved.from[1],
      target: saved.to[0], targetHandle: saved.to[1], style, label,
      labelStyle: { fill: '#c5c0d0', fontSize: 10 }, labelBgStyle: { fill: '#24232d' } };
  });
  const next = { nodes: retainArray(nodes, previous.nodes), edges: retainArray(edges, previous.edges) };
  return next.nodes === previous.nodes && next.edges === previous.edges ? previous : next;
}
