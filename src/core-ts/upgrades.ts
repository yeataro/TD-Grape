/** Node upgrades (Refactor.65, human 2026-10-10): when a release changes what a graph stores for a node — its type, a
 * setting's code, or a port's key — one rule here says how the old shape becomes the new one. Rules look at what the
 * graph holds, never at a version number, so they apply to a graph from any earlier release, and a chain of renames is
 * followed to its end. Two rules keep that sound: a retired code is never used again, and a change of meaning gets a new
 * code (then the old one becomes a rule here). Graphs of another format are not upgraded: they belong to the importer
 * (Q40, Q44). What nothing here covers stays a ghost (Q37).
 * 節點升級（人類 10-10）：發布後若改了圖裡存的節點寫法（節點種類、設定的代號、接孔），在這裡寫一條「舊的長這樣→換成新的」。
 * 規則看圖裡存的內容、不看版本號，所以任何舊版存的圖都適用，連續改名也會一路換到底。兩條規則讓它成立：拿掉的代號永不再用；
 * 意思改了就換新代號（舊代號變成這裡的一條）。別的格式不在這裡升級，交給匯入器（Q40、Q44）。這裡沒寫到的照舊是 Ghost（Q37）。 */
import { copy, formatProblem, type Graph, type NetworkData, type Node, type Value } from './model';
import { nameMissing } from './node_names';
import type { Registry } from './node_module';
import { tr, type Message } from './text';

/** One rule: which stored nodes it matches, what they become, and how their ports are renamed (wires follow, at the end
 * that touches the node: outputs for wires leaving it, inputs for wires arriving). 一條規則：比對哪些節點、換成什麼、
 * 接孔怎麼改名（線跟著改：出去的線改輸出端、進來的線改輸入端）。 */
export interface NodeUpgrade {
  readonly id: string;
  readonly nodeType: string;
  readonly params?: Readonly<Record<string, Value>>;
  readonly set?: { readonly nodeType?: string; readonly params?: Readonly<Record<string, Value>> };
  readonly outputs?: Readonly<Record<string, string>>;
  readonly inputs?: Readonly<Record<string, string>>;
  /** What changed, for people (the replacement report). 給人看的說明（替換報告）。 */
  readonly note: Message;
}

const TD_VALUE = 'sgrape.builtin.td_value';
/** The rules, oldest first. Never remove one: a graph saved long ago may still need it. 規則，舊的在前；不要刪，很久以前存的圖可能還用得到。 */
export const nodeUpgrades: readonly NodeUpgrade[] = Object.freeze([
  // Refactor.64: vUV.st folded into vUV, which has U, UV and UVW outputs. vUV.st 併進 vUV（U、UV、UVW 三個輸出）。
  { id: 'td-value-vuv-st', nodeType: TD_VALUE, params: { entry: 'vUVSt' }, set: { params: { entry: 'vUV' } }, outputs: { out: 'uv' },
    note: tr('upgrade.vUVSt', 'vUV.st became vUV; its wires now leave from the UV output') },
  { id: 'td-value-vuv-out', nodeType: TD_VALUE, params: { entry: 'vUV' }, outputs: { out: 'uvw' },
    note: tr('upgrade.vUVOut', 'vUV now has U, UV and UVW outputs; its wires now leave from the UVW output') },
]);

/** One node an upgrade changed: where it is, which rule, and how many wires followed. 被升級的一個節點：在哪、哪條規則、跟著改了幾條線。 */
export interface UpgradeChange { readonly network: string; readonly node: string; readonly rule: string; readonly note: Message; readonly wires: number }
export interface UpgradeResult { readonly graph: Graph; readonly changes: readonly UpgradeChange[] }

const matches = (node: Node, rule: NodeUpgrade) => node.nodeType === rule.nodeType
  && Object.entries(rule.params ?? {}).every(([key, value]) => JSON.stringify(node.params?.[key]) === JSON.stringify(value));

/** Apply one rule to one network, in place on a copy; returns the changes. 對一張網路套用一條規則（在複本上改）。 */
function upgradeNetwork(network: NetworkData, name: string, rule: NodeUpgrade): UpgradeChange[] {
  const changes: UpgradeChange[] = [];
  for (const node of network.nodes) {
    if (!matches(node, rule)) continue;
    let changed = false, wires = 0;
    if (rule.set?.nodeType && rule.set.nodeType !== node.nodeType) { node.nodeType = rule.set.nodeType; changed = true; }
    for (const [key, value] of Object.entries(rule.set?.params ?? {}))
      if (JSON.stringify(node.params[key]) !== JSON.stringify(value)) { node.params[key] = copy(value); changed = true; }
    for (const edge of network.edges) {
      const out = edge.from[0] === node.id ? rule.outputs?.[edge.from[1]] : undefined;
      const into = edge.to[0] === node.id ? rule.inputs?.[edge.to[1]] : undefined;
      if (out === undefined && into === undefined) continue;
      if (out !== undefined) (edge as { from: readonly [string, string] }).from = [node.id, out];
      if (into !== undefined) (edge as { to: readonly [string, string] }).to = [node.id, into];
      wires++;
    }
    if (changed || wires) changes.push({ network: name, node: node.id, rule: rule.id, note: rule.note, wires });
  }
  return changes;
}

/** Bring a stored graph up to the current node shapes. The input is never changed; a graph of another format (or a
 * malformed one) comes back as it is, for the importer or the format check. Rules are applied until none matches, so a
 * chain of renames is followed; a rule table that never settles is a programming error.
 * 把存著的圖升級成目前的節點寫法。不改輸入；別的格式（或壞掉的）原樣回傳，交給匯入器或格式檢查。規則一直套到沒有可換為止；
 * 停不下來代表規則表寫錯了。 */
// With the registry, nodes that should have a name and have none are named too (Refactor.76, human 2026-10-11: graphs made
// before names were given get them once, said like any upgrade). 有 registry 時，也替該有名字卻沒有的節點補名（R.76，人類：
// 給名字之前做的圖補一次，和其他升級一樣會說）。
export function upgradeGraph(value: Graph, rules: readonly NodeUpgrade[] = nodeUpgrades, registry?: Registry): UpgradeResult {
  if (formatProblem(value)) return { graph: value, changes: [] };
  const graph = copy(value);
  const networks: [string, NetworkData][] = [...Object.entries(graph.stages), ...(graph.subgraphs ?? []).map(s => [s.id, s.graph] as [string, NetworkData])];
  const changes: UpgradeChange[] = [];
  for (let pass = 0; ; pass++) {
    if (pass > rules.length) throw Error('Node upgrade rules do not settle');
    let found = 0;
    for (const rule of rules) for (const [name, network] of networks) {
      const step = upgradeNetwork(network, name, rule);
      found += step.length; changes.push(...step);
    }
    if (!found) break;
  }
  if (registry) for (const named of nameMissing(graph, registry))
    changes.push({ network: named.network, node: named.node, rule: 'node-name', note: named.note, wires: 0 });
  return changes.length ? { graph, changes } : { graph: value, changes: [] };
}
