import type { Network, ConnectionPolicy } from './graph';
import type { Edge as EdgeData } from './model';
import { connectedWires, unusableNodes, type GhostKind } from './connectivity';

/** Ghosts (design-interview Q37 1-1, 1-3): what this build cannot use is kept exactly as stored,
 * shown, and left out of code generation — never deleted, never rewired, never a reason to refuse
 * the whole graph.
 * - unknown node: no definition, or a configuration the definition does not understand;
 * - misplaced node: a known definition that does not belong to this stage;
 * - ghost wire: a stored wire that is not in effect (connectivity.ts): an endpoint is a ghost node, a port is missing, or the types
 *   no longer fit. Code generation treats it as not connected, so that input uses its own value.
 * This names what is not in effect, for showing and saying it; whether a wire is connected is connectivity.ts's to answer
 * (Refactor.103.1). Ghost：這個版本用不了的東西原樣保留、標示出來、不參與產碼；不刪、不改接、也不因此拒絕整張圖。Ghost 線＝存著但沒接通的
 * 線，在產碼時當作沒接，該輸入用它沒接線時本來的值。這裡替沒接通的東西命名，用來顯示與告知；線接不接通由 connectivity.ts 回答（R.103.1）。 */
export type { GhostKind };
export interface Ghosts {
  readonly nodes: ReadonlyMap<string, GhostKind>;
  readonly edges: ReadonlySet<string>;
  /** The same ghost wires as stored data, for code paths that walk raw edges. */
  readonly edgeData: ReadonlySet<EdgeData>;
}

export function ghostsOf(network: Network, policy: ConnectionPolicy): Ghosts {
  const nodes = unusableNodes(network), connected = connectedWires(network, policy, nodes);
  const edges = new Set<string>(), edgeData = new Set<EdgeData>();
  for (const edge of network.edges) if (!connected.has(edge.data!)) { edges.add(edge.id); edgeData.add(edge.data!); }
  return { nodes, edges, edgeData };
}
