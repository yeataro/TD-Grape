import type { Network, ConnectionPolicy } from './graph';
import type { Edge as EdgeData } from './model';

/** Ghosts (design-interview Q37 1-1, 1-3): what this build cannot use is kept exactly as stored,
 * shown, and left out of code generation — never deleted, never rewired, never a reason to refuse
 * the whole graph.
 * - unknown node: no definition, or a configuration the definition does not understand;
 * - misplaced node: a known definition that does not belong to this stage;
 * - ghost wire: an endpoint is a ghost node, a port is missing, or the types no longer fit.
 *   Code generation treats it as not connected, so that input uses its own value.
 * Ghost：這個版本用不了的東西原樣保留、標示出來、不參與產碼；不刪、不改接、也不因此拒絕整張圖。
 * Ghost 線在產碼時當作沒接，該輸入用它沒接線時本來的值。 */
// missing: a reference to a declaration that no longer exists (Q45). 引用的宣告已不存在。
export type GhostKind = 'unknown' | 'misplaced' | 'missing';
export interface Ghosts {
  readonly nodes: ReadonlyMap<string, GhostKind>;
  readonly edges: ReadonlySet<string>;
  /** The same ghost wires as stored data, for code paths that walk raw edges. */
  readonly edgeData: ReadonlySet<EdgeData>;
}

export function ghostsOf(network: Network, policy: ConnectionPolicy): Ghosts {
  const nodes = new Map<string, GhostKind>();
  // Subgraph networks have no stage of their own; their nodes follow the calling stage.
  const stage = network.id.startsWith('subgraph:') ? undefined : network.id;
  for (const node of network.nodes) {
    const data = node.data!, module = node.definition;
    const referred = module?.referencedDeclaration?.(data);
    if (!module) nodes.set(node.id, 'unknown');
    else if (stage && module.catalog.definition.stages && !module.catalog.definition.stages.includes(stage)) nodes.set(node.id, 'misplaced');
    // Declarations are referred to only at the top level of a stage (Q41). 宣告只在 stage 最外層引用。
    else if (referred !== undefined && !stage) nodes.set(node.id, 'misplaced');
    else if (referred !== undefined && !network.context.declaration(referred)) nodes.set(node.id, 'missing');
    else if (!module.supports(data, network.context)) nodes.set(node.id, 'unknown');
    else {
      // Ports that cannot be worked out make it a ghost too. 算不出接孔也是 Ghost。
      try { void node.interface; } catch { nodes.set(node.id, 'unknown'); }
    }
  }
  const edges = new Set<string>(), edgeData = new Set<EdgeData>();
  for (const edge of network.edges) {
    const data = edge.data!;
    if (nodes.has(data.from[0]) || nodes.has(data.to[0]) || !edge.connection(policy).valid) { edges.add(edge.id); edgeData.add(data); }
  }
  return { nodes, edges, edgeData };
}
