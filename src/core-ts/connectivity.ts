import type { Network, ConnectionPolicy } from './graph';
import type { Edge as EdgeData } from './model';
import { subgraphStageTable } from './subgraph_stages';

/** Which wires are in effect (Refactor.103.1, human 2026-10-12). A stored wire only says where it goes; whether it is connected is read
 * from the graph with this build's rules: both ends are nodes this build can use, both ports are there, and the types fit. A port's
 * state is what it shows; a wire that is not in effect is broken between the wire and the port (human: "they should break between
 * the wire and the port") — so everything that asks whether a port is connected, or what flows into it, reads this and never the raw
 * list: wire planning, the cards, code generation. Ghost wires are the stored ones not in effect (ghosts.ts). Q37 1-3, Q72.
 * 哪些線接通了（R.103.1，人類 10-12）。存著的線只說它從哪裡到哪裡；接不接通，是用這一版的規則從圖讀出來的：兩端都是這一版能用的節點、兩端
 * 的接孔都在、型別合得上。接孔的狀態就是它看起來的樣子；沒接通的線斷在線和接孔之間（人類：「應該斷在線段跟接口之間」）——所以凡是問接孔
 * 有沒有接、接了什麼的，都讀這裡、不讀原始清單：接線規劃、卡片、產碼。Ghost 線＝存著但沒接通的線（ghosts.ts）。Q37 1-3、Q72。 */

export type GhostKind = 'unknown' | 'misplaced' | 'missing';

/** The nodes this build cannot use, and why (Q37 1-1; Q45: a reference to a declaration that no longer exists). 這一版用不了的節點與
 * 原因（Q37 1-1；Q45：引用的宣告已不存在）。 */
export function unusableNodes(network: Network): Map<string, GhostKind> {
  const nodes = new Map<string, GhostKind>();
  // Subgraph networks have no stage of their own; their nodes follow the stage of their instance.
  const stage = network.id.startsWith('subgraph:') ? undefined : network.id;
  let stagesOf: ((id: string) => string[]) | undefined; // one table for every instance here (TECH-3) 這裡所有實例共用一張表
  for (const node of network.nodes) {
    const data = node.data!, module = node.definition;
    const referred = module?.referencedDeclaration?.(data);
    if (!module) nodes.set(node.id, 'unknown');
    else if (stage && module.catalog.definition.stages && !module.catalog.definition.stages.includes(stage)) nodes.set(node.id, 'misplaced');
    // A subgraph instance whose content cannot run in this stage (Q46, Q37 1-4): kept, marked, back once the content fits.
    // 子圖內容不能在這個 Stage 用的實例：保留、標示，內容改回能用就恢復。
    else if (stage && module.referencedGraph && !(stagesOf ??= subgraphStageTable(network.graph.document, network.graph.registry))(module.referencedGraph(data)).includes(stage)) nodes.set(node.id, 'misplaced');
    // Declarations are referred to only at the top level of a stage (Q41). 宣告只在 stage 最外層引用。
    else if (referred !== undefined && !stage) nodes.set(node.id, 'misplaced');
    else if (referred !== undefined && !network.context.declaration(referred)) nodes.set(node.id, 'missing');
    else if (!module.supports(data, network.context)) nodes.set(node.id, 'unknown');
    else {
      // Ports that cannot be worked out make it a ghost too. 算不出接孔也是 Ghost。
      try { void node.interface; } catch { nodes.set(node.id, 'unknown'); }
    }
  }
  return nodes;
}

/** The stored wires in effect, as the stored objects (the same ones the raw list holds). 接通的線，用存著的物件（和原始清單是同一批）。 */
export function connectedWires(network: Network, policy: ConnectionPolicy, unusable: ReadonlyMap<string, GhostKind> = unusableNodes(network)): Set<EdgeData> {
  const connected = new Set<EdgeData>();
  for (const edge of network.edges) {
    const data = edge.data!;
    if (!unusable.has(data.from[0]) && !unusable.has(data.to[0]) && edge.connection(policy).valid) connected.add(data);
  }
  return connected;
}
