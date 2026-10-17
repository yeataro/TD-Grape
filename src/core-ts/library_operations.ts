/** The legal operations that change a Library copy beyond adding and removing it (Refactor.118; basic design §3.10–3.11,
 * amendment 1 A2–A3, amendment 2 B1 revision 3): Make Local and an explicit update. Each starts from the ledger's current content,
 * makes only its own change and records what it leaves (library.ts). 加入與移除以外，改變 Library 副本的合法操作：轉為本地、明確更新。
 * 每個都從帳本目前的內容起跑、只做自己的變化、記下結果。 */
import { copy, type SubgraphData, type Node, type NetworkData } from './model';
import type { GraphDocument } from './graph';
import { requireCurrent, localize, now } from './library';
import { appendSubgraphs, settle, type AllocateSubgraphId } from './subgraph_copies';
import { freeName, defaultInstanceNumber, newInstanceName, namesIn } from './node_names';
import { fitInstanceValues } from './subgraphs';
import { validateSubgraphData, withoutStoredUse } from './subgraph_operations';

const referenceOf = (graph: GraphDocument, n: Node) => graph.registry.get(n.nodeType)?.referencedGraph?.(n);
function definition(graph: GraphDocument, id: string): SubgraphData {
  const f = graph.document.subgraphs?.find(d => d.id === id);
  if (!f) throw Error('Subgraph definition no longer exists');
  return f;
}
const networks = (graph: GraphDocument): NetworkData[] => [...Object.values(graph.document.stages), ...(graph.document.subgraphs ?? []).map(d => d.graph)];

/** Make Local (§3.10, A3): with no read-only subgraph using it, the copy drops its Library ID in place; otherwise it forks — a local
 * B′ (new ID, named by the one naming rule) takes the instances outside read-only subgraphs, and those inside keep the read-only B.
 * Either way the local one records where it came from (amendment 3 C6). Returns the ID that now holds the local content. 轉為本地：沒有唯讀子圖在用它就就地拿掉 Library ID；否則分叉——本地 B′（新 ID、照同一套
 * 命名）接手唯讀子圖以外的實例，唯讀子圖裡的仍指唯讀的 B。兩種都記下出處。回傳現在放本地內容的 ID。 */
export function makeLocal(graph: GraphDocument, id: string, next: AllocateSubgraphId, at = now()): string {
  graph.assertEditable();
  const f = definition(graph, id), libraryId = f.libraryId;
  if (libraryId === undefined) throw Error('Not a Library copy');
  requireCurrent(graph.library, f);
  const readOnlyUsers = (graph.document.subgraphs ?? []).some(d => d.libraryId !== undefined && d.graph.nodes.some(n => referenceOf(graph, n) === id));
  if (!readOnlyUsers) { localize(f, at); graph.library.set(id, libraryId, { kind: 'local' }); return id; }
  // The fork comes in through the ID map, so its own scoped references follow it, as in Make Single User (Codex R118-4).
  // 分叉經由 ID 對照加入，自己的 scoped 參照跟著它走，同設為唯一。
  const fork = copy(f); localize(fork, at);
  fork.title = freeName(f.title, new Set((graph.document.subgraphs ?? []).map(d => d.title)), 80);
  const forkId = next();
  appendSubgraphs(graph, [fork], new Map([[id, forkId]]));
  const outside = [...Object.values(graph.document.stages), ...(graph.document.subgraphs ?? []).filter(d => d.libraryId === undefined && d.id !== forkId).map(d => d.graph)];
  for (const data of outside) for (const n of data.nodes) if (referenceOf(graph, n) === id) {
    const module = graph.registry.get(n.nodeType)!;
    n.params = { ...copy(n.params), ...copy(module.reference!(forkId)) };
  }
  return forkId;
}

/** An explicit update (§3.11, B1 contract 2): the copy takes the Library's content whole, keeping its in-graph ID and Library ID; every
 * instance follows the new interface (values refit, wires to removed ports dropped — the same rules as an interface edit) and, when
 * the title changes, instances still named by default follow it (B1-R2-1). A read-only subgraph holding an instance passes the start
 * check first and records what it becomes. The content comes from the caller, its nested references already mapped to this graph.
 * 明確更新：副本整份換成 Library 的內容，保留圖內 ID 與 Library ID；每個實例跟上新接口（實例值重套、接到被拿掉接口的線刪掉——和改接口同一套），
 * title 改了的話仍是預設名的實例跟著改名。含有實例的唯讀子圖先過起點檢查、再記下結果。內容由呼叫端給，巢狀參照已對到這張圖。 */
export function updateFromLibrary(graph: GraphDocument, id: string, content: SubgraphData): void {
  graph.assertEditable();
  const f = definition(graph, id), libraryId = f.libraryId;
  if (libraryId === undefined || content.libraryId !== libraryId) throw Error('An update keeps the Library ID');
  requireCurrent(graph.library, f);
  const next = withoutStoredUse(copy(content)); next.id = id;
  validateSubgraphData(next); settle(graph, next);
  const holders = (graph.document.subgraphs ?? []).filter(d => d.id !== id && d.graph.nodes.some(n => referenceOf(graph, n) === id));
  for (const d of holders) requireCurrent(graph.library, d);
  const list = graph.document.subgraphs!, at = list.findIndex(d => d.id === id);
  list[at] = next;
  const gone = (old: SubgraphData['inputs'], now: SubgraphData['inputs']) => new Set(old.filter(p => !now.some(q => q.id === p.id)).map(p => p.id));
  const goneInputs = gone(f.inputs, next.inputs), goneOutputs = gone(f.outputs, next.outputs);
  for (const data of networks(graph)) {
    const instances = new Set<string>(), taken = namesIn(data);
    for (const n of data.nodes) {
      if (referenceOf(graph, n) !== id) continue;
      instances.add(n.id);
      if (n.inputValues) n.inputValues = fitInstanceValues(n.inputValues, next.inputs);
      if (next.title === f.title || n.name === undefined) continue;
      const number = defaultInstanceNumber(n.name, f.title);
      if (number === null) continue;
      taken.delete(n.name); n.name = newInstanceName(next.title, taken, number); taken.add(n.name);
    }
    if (instances.size) data.edges = data.edges.filter(e =>
      !(instances.has(e.from[0]) && goneOutputs.has(e.from[1])) && !(instances.has(e.to[0]) && goneInputs.has(e.to[1])));
  }
  graph.library.set(id, libraryId, { kind: 'content', data: next });
  for (const d of holders) if (d.libraryId !== undefined) graph.library.set(d.id, d.libraryId, { kind: 'content', data: d });
}
