/** Library copies in a graph (basic design §3.7–3.10, amendment 1 A2–A6, amendment 2 B1–B4 revision 3; Refactor.118).
 * A definition carrying `libraryId` is a read-only copy: an ordinary edit may not change it, only the legal operations (add a copy,
 * make local, make single user, update from the Library, remove) may, and each passes through one transaction ledger. The gate at
 * the end of GraphDocument.change() checks the ledger against the edit's result. A graph without Library copies never builds a ledger
 * and the gate returns after one scan of the definition lists, with no content comparison (zero cost, measured). The core never reads a Library: content comes from the caller.
 * 圖裡的 Library 副本：帶 libraryId 的定義唯讀，一般修改不能改它，只有合法操作（加入副本、轉為本地、設為唯一、從 Library 更新、移除）
 * 可以，而且都經過同一張交易帳本；change() 末尾的關卡拿帳本對結果。沒有 Library 副本的圖不建帳本，關卡只掃一次定義清單、不比內容就返回（零成本，量過）。核心不讀
 * Library，內容由呼叫端給。 */
import { copy, type Graph, type SubgraphData, type Node } from './model';
import { equal } from './changes';
import type { Registry } from './node_module';
import { ScopeReferences } from './scope_references';

/** A Library identity is a UUID (Q74.1). Library ID 是 UUID。 */
export const validLibraryId = (id: unknown): id is string =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);

/** What the ledger holds for one read-only identity (in-graph ID + Library ID): its one current state (amendment 2 B1). 帳本裡一個
 * 唯讀身分（圖內 ID＋Library ID）目前唯一有效的狀態。 */
export type LibraryState = { kind: 'content'; data: SubgraphData } | { kind: 'local' } | { kind: 'removed' };
const key = (id: string, libraryId: string) => id + '\u0000' + libraryId;

/** One transaction's ledger. A state is first taken from the document as the transaction began; legal operations replace it, never
 * keep the old one. Content is held as its own copy, never shared with the candidate (B1-R2 implementation contract).
 * 一筆交易的帳本：初值取自交易開始時的文件；合法操作取代它、不保留舊值。內容存自己的複本，不和候選文件共用參照。 */
export class LibraryLedger {
  private readonly states = new Map<string, { id: string; libraryId: string; state: LibraryState }>();
  constructor(private readonly start: Graph) {}
  state(id: string, libraryId: string): LibraryState | undefined {
    const held = this.states.get(key(id, libraryId));
    if (held) return held.state;
    const f = this.start.subgraphs?.find(d => d.id === id && d.libraryId === libraryId);
    return f ? { kind: 'content', data: f } : undefined;
  }
  set(id: string, libraryId: string, state: LibraryState): void {
    this.states.set(key(id, libraryId), { id, libraryId, state: state.kind === 'content' ? { kind: 'content', data: copy(state.data) } : state });
  }
  /** Every identity the ledger was told about. 帳本被告知過的每個身分。 */
  entries(): readonly { id: string; libraryId: string; state: LibraryState }[] { return [...this.states.values()]; }
  get size(): number { return this.states.size; }
}

export const readOnly = (what: string) => Object.assign(Error('A subgraph from a Library is read-only (' + what + '); make it local to edit it'), { code: 'subgraph.readOnly' });

/** The start check of every legal operation (B1 contract 1): the definition as it stands in the candidate must equal the ledger's
 * current content. 合法操作的起點檢查：候選文件裡的那份必須等於帳本目前的內容。 */
export function requireCurrent(ledger: LibraryLedger, f: SubgraphData): void {
  if (f.libraryId === undefined) return;
  const state = ledger.state(f.id, f.libraryId);
  if (!state || state.kind !== 'content' || !equal(f, state.data)) throw readOnly('it was changed in this edit');
}

const instancesOf = (f: SubgraphData, registry: Registry) =>
  f.graph.nodes.flatMap(n => { const ref = registry.get(n.nodeType)?.referencedGraph?.(n); return ref === undefined ? [] : [ref]; });

/** The gate (B1, end of change()): every read-only identity in the ledger, before or after must end as the ledger says; and a
 * read-only definition may only use read-only ones (A3). A graph with no Library copy and no ledger returns after scanning the definition lists.
 * 關卡：帳本、before、after 裡每個唯讀身分的結局都要符合帳本；唯讀定義只能用唯讀定義（A3）。沒有 Library 副本也沒有帳本的圖，掃過定義清單就返回。 */
export function requireLibrary(before: Graph, after: Graph, ledger: LibraryLedger | undefined, registry: Registry): void {
  const held = (g: Graph) => (g.subgraphs ?? []).filter(f => f.libraryId !== undefined);
  const was = held(before), now = held(after);
  if (!was.length && !now.length && !ledger?.size) return;
  const book = ledger ?? new LibraryLedger(before);
  const identities = new Map<string, { id: string; libraryId: string }>();
  for (const f of [...was, ...now]) identities.set(key(f.id, f.libraryId!), { id: f.id, libraryId: f.libraryId! });
  for (const entry of book.entries()) identities.set(key(entry.id, entry.libraryId), entry);
  const after_ = new Map((after.subgraphs ?? []).map(f => [f.id, f]));
  for (const { id, libraryId } of identities.values()) {
    const state = book.state(id, libraryId), found = after_.get(id);
    if (!state) { if (found?.libraryId === libraryId) throw readOnly('it entered without being added'); continue; }
    if (state.kind === 'content') { if (!found || !equal(found, state.data)) throw readOnly('it was changed'); continue; }
    // Made local means no Library ID at all, not merely not this one (Codex R118-1). 轉為本地＝不帶任何 Library ID，不只是不帶原本那個。
    if (state.kind === 'local') { if (found?.libraryId !== undefined) throw readOnly('it was made local'); continue; }
    if (found) throw readOnly('it was removed');
  }
  for (const f of now) for (const ref of instancesOf(f, registry))
    if (after_.get(ref)?.libraryId === undefined)
      throw Object.assign(Error('A read-only subgraph may only use read-only subgraphs'), { code: 'subgraph.readOnlyClosure' });
}

/** A JSON text with its object keys in order, so equal content gives equal text. 物件鍵排好序的 JSON，內容相同就字串相同。 */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return '{' + Object.keys(value).filter(k => (value as Record<string, unknown>)[k] !== undefined).sort()
      .map(k => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k])).join(',') + '}';
  return JSON.stringify(value);
}

/** The standard form of a definition with its closure (amendment 2 B4): the closure numbered in a fixed walk (root 0, then each
 * dependency as first met), instance references replaced by those numbers, each definition keeping its Library ID, without in-graph
 * IDs and derived fields. null when the closure is incomplete. Compared as text where both sides are at hand (no hash).
 * 閉包的標準形（B4）：固定走訪給編號（根＝0，依序首次遇到的依賴），實例參照換成編號，每份保留 Library ID，不含圖內 ID 與推算欄位；
 * 閉包不完整就是 null。兩邊都在手上時直接比字串，不算雜湊。 */
export function standardForm(document: Graph, registry: Registry, rootId: string): string | null {
  const order = closureOrder(document, registry, rootId);
  if (!order) return null;
  const numbers = new Map(order.map((f, i) => [f.id, i]));
  return canonical(order.map(f => {
    const { id: _id, stages: _stages, targets: _targets, ...rest } = copy(f);
    rest.graph.nodes = rest.graph.nodes.map((n: Node) => {
      const module = registry.get(n.nodeType), ref = module?.referencedGraph?.(n);
      return ref === undefined || !module?.reference ? n : { ...n, params: { ...n.params, ...module.reference('#' + numbers.get(ref)) } };
    });
    // A scoped reference to a network in the closure takes that network's number too: only renumbering in-graph IDs must not make two
    // copies differ (Codex R118-3). 指向閉包裡某張網路的 scoped 參照也換成那張網路的編號：只是圖內 ID 重配，不能讓兩份變得不同。
    ScopeReferences.walk(rest, (ref, old) => {
      const n = ref.scope.startsWith('fn_') ? numbers.get(ref.scope.slice(3)) : undefined;
      return n === undefined ? old : ScopeReferences.token('fn_' + n, ref.source);
    });
    return rest;
  }));
}

/** A definition's closure in the standard form's fixed walk (root first, then each dependency as first met); null when incomplete.
 * Two closures with equal standard forms line up position by position. 標準形固定走訪下的閉包（根在先，依序首次遇到的依賴）；不完整就是 null。
 * 標準形相同的兩個閉包可以逐位對齊。 */
export function closureOrder(document: Graph, registry: Registry, rootId: string): SubgraphData[] | null {
  const byId = new Map((document.subgraphs ?? []).map(f => [f.id, f])), seen = new Set<string>(), order: SubgraphData[] = [];
  const visit = (id: string): boolean => {
    if (seen.has(id)) return true;
    const f = byId.get(id); if (!f) return false;
    seen.add(id); order.push(f);
    return instancesOf(f, registry).every(visit);
  };
  return visit(rootId) ? order : null;
}

/** Each copy already in `target` that `source`'s definition may reuse (amendment 1 A5 rule 3, amendment 2 B3–B4): only a Library copy
 * with the same Library ID and the same standard form — and with it its whole closure, position by position, since reusing a parent
 * fixes what its children are. Returned as source ID → target ID maps; the caller keeps a batch consistent (Codex R118-2). A local
 * definition is never merged by content. target 裡每一份可以沿用的：只限同 Library ID、同標準形的 Library 副本——連同整個閉包逐位對應，
 * 因為沿用父就定了子是誰。回傳來源 ID→目標 ID 的對照；整批一致由呼叫端負責。本地定義永不按內容合併。 */
export function libraryReuses(target: Graph, source: Graph, id: string, registry: Registry): Map<string, string>[] {
  const f = source.subgraphs?.find(d => d.id === id);
  if (f?.libraryId === undefined) return [];
  const form = standardForm(source, registry, id), from = closureOrder(source, registry, id);
  if (form === null || !from) return [];
  return (target.subgraphs ?? []).filter(d => d.libraryId === f.libraryId && standardForm(target, registry, d.id) === form)
    .map(d => { const to = closureOrder(target, registry, d.id)!; return new Map(from.map((g, i) => [g.id, to[i]!.id])); });
}
