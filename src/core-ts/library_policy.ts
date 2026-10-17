/** The Library version policy (amendment 3, design-interview Q77; Refactor.119): one Library ID, at most one shared definition in a
 * graph; another copy with its own content stays local. Conflicts are settled where they appear, by whole plans the person chooses
 * (the editor shows them; the core only works them out and applies them), never by a search for the fewest copies (Codex R118.2-1:
 * that is NP-hard). Two entrances: opening a graph (repairLibraryCopies, C3) and bringing definitions in (planLibraryEntry, C4).
 * Library 版本政策：一個 Library ID 在圖裡至多一份共用定義；要保留另一份獨立內容就留成本地。衝突在出現的那一刻用整批方案解決，由使用者選
 * （畫面由編輯器呈現，核心只算方案與套用），不搜尋最少份數（一般化是 NP 困難）。兩個入口：開圖（C3）與進圖（C4）。 */
import { copy, type Graph, type SubgraphData, type NetworkData, type Node } from './model';
import type { Registry } from './node_module';
import { GraphDocument } from './graph';
import { standardForm, closureOrder, instancesOf, localize, now } from './library';
import { ScopeReferences } from './scope_references';
import { appendSubgraphs, type AllocateSubgraphId } from './subgraph_copies';
import { makeLocal, updateFromLibrary } from './library_operations';

const referenceOf = (registry: Registry, n: Node) => registry.get(n.nodeType)?.referencedGraph?.(n);
const networksOf = (document: Graph): NetworkData[] => [...Object.values(document.stages), ...(document.subgraphs ?? []).map(f => f.graph)];

/** Point every instance and scoped reference inside `value` (a document or one definition) from old IDs to new ones.
 * 把 value（整份文件或一份定義）裡的實例與 scoped 參照，從舊 ID 改指新 ID。 */
function redirect(registry: Registry, networks: NetworkData[], value: unknown, ids: ReadonlyMap<string, string>): void {
  for (const data of networks) for (const n of data.nodes) {
    const to = ids.get(referenceOf(registry, n) ?? '');
    const module = registry.get(n.nodeType);
    if (to !== undefined && module?.reference) n.params = { ...n.params, ...copy(module.reference(to)) };
  }
  ScopeReferences.walk(value, (ref, old) => {
    const to = ref.scope.startsWith('fn_') ? ids.get(ref.scope.slice(3)) : undefined;
    return to === undefined ? old : ScopeReferences.token('fn_' + to, ref.source);
  });
}

/** `start` with every read-only definition (among `defs`) that uses one of them, however deep: a read-only subgraph may only use
 * read-only ones (A3), so they go local together (C5). start 加上 defs 中所有（不論多深）用到它們的唯讀定義：唯讀只能用唯讀，所以一起轉本地。 */
function withReadOnlyAncestors(defs: readonly SubgraphData[], registry: Registry, start: Iterable<string>): Set<string> {
  const set = new Set(start);
  for (let grew = true; grew;) {
    grew = false;
    for (const f of defs) if (!set.has(f.id) && f.libraryId !== undefined && instancesOf(f, registry).some(ref => set.has(ref))) { set.add(f.id); grew = true; }
  }
  return set;
}

/** How many instances point straight at each definition (amendment 1's direct count). 每份定義被幾個實例直接指到。 */
function directInstances(document: Graph, registry: Registry): Map<string, number> {
  const count = new Map<string, number>();
  for (const data of networksOf(document)) for (const n of data.nodes) {
    const ref = referenceOf(registry, n);
    if (ref !== undefined) count.set(ref, (count.get(ref) ?? 0) + 1);
  }
  return count;
}

export interface DuplicateRepair { document: Graph; merged: Map<string, string>; localized: string[] }

/** C3 step 1: the copies sharing a Library ID, settled flat at the top level. Everything is decided once, on the document as given
 * (Codex R2-2): which copy stays (one the caller prefers, else the most direct instances, else the smallest in-graph ID — never list
 * order); the others with its content merge into it (or, `separate`, go local) and those with other content go local, with every
 * read-only definition using them. Merging only redirects references; a parent's standard form may change, as the person chose.
 * Returns a new document; the given one is untouched. Only definitions in `within` take part when it is given (a pasted batch).
 * C3 第 1 步：同 Library ID 的副本在最上層平著處理。一切只在給的原稿上決定一次：留哪份（呼叫端偏好的，否則直接實例最多，再否則圖內 ID
 * 最小——不看清單順序）；同內容的併入它（或 separate 時轉本地），不同內容的轉本地，連同用到它們的唯讀定義。合併只改引用；父的標準形可能
 * 因此改變，這是使用者選的。回傳新文件，不動原本的。給了 within 時只處理其中的定義（貼上的那一批）。 */
export function repairDuplicates(document: Graph, registry: Registry,
    options: { separate?: boolean; prefer?: (f: SubgraphData, form: string | null) => boolean; within?: ReadonlySet<string>; at: string }): DuplicateRepair {
  const part = (document.subgraphs ?? []).filter(f => !options.within || options.within.has(f.id));
  const byLibrary = new Map<string, SubgraphData[]>();
  for (const f of part) if (f.libraryId !== undefined) (byLibrary.get(f.libraryId) ?? byLibrary.set(f.libraryId, []).get(f.libraryId)!).push(f);
  const groups = [...byLibrary.values()].filter(group => group.length > 1);
  if (!groups.length) return { document, merged: new Map(), localized: [] };
  const count = directInstances(document, registry), forms = new Map<string, string | null>();
  for (const group of groups) for (const f of group) forms.set(f.id, standardForm(document, registry, f.id));
  const merged = new Map<string, string>(), local = new Set<string>();
  for (const group of groups) {
    const rank = (f: SubgraphData) => [options.prefer?.(f, forms.get(f.id)!) ? 1 : 0, count.get(f.id) ?? 0] as const;
    const keep = [...group].sort((a, b) => { const [pa, ca] = rank(a), [pb, cb] = rank(b); return pb - pa || cb - ca || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); })[0]!;
    const form = forms.get(keep.id);
    for (const f of group) if (f !== keep) {
      if (!options.separate && form !== null && forms.get(f.id) === form) merged.set(f.id, keep.id); else local.add(f.id);
    }
  }
  const out = copy(document);
  if (merged.size) { redirect(registry, networksOf(out), out, merged); out.subgraphs = out.subgraphs!.filter(f => !merged.has(f.id)); }
  const going = withReadOnlyAncestors(out.subgraphs!.filter(f => !options.within || options.within.has(f.id)), registry, local);
  const localized: string[] = [];
  for (const f of out.subgraphs!) if (going.has(f.id) && f.libraryId !== undefined) { localize(f, options.at); localized.push(f.id); }
  return { document: out, merged, localized };
}

/** What a person chooses when definitions come in (C4): copies sharing a Library ID inside the batch merge (default) or stay
 * separate; a copy whose Library ID is here with other content keeps the graph's version (default: the incoming one and the read-only
 * ones using it in the batch come in local) or takes the incoming one (the graph's copy is updated). 進圖時使用者的選擇：批內同 Library ID
 * 的合併（預設）或分開；圖裡已有、內容不同的，保留圖裡版本（預設：帶進來的連同批內用到它的唯讀定義轉本地進來）或改用帶進來的（更新圖裡那份）。 */
export interface EntryChoice { duplicates?: 'merge' | 'separate'; conflicts?: 'keep' | 'incoming' }

/** A worked-out entry, ready to show and to apply. 算好的進圖方案，可以呈現、可以套用。 */
export interface EntryPlan {
  /** The batch as it comes in, its own duplicates settled. 帶進來的這批，自己的重複已處理。 */
  source: Graph;
  /** A merged source ID → the source ID it became. 被合併的來源 ID → 併入的那份。 */
  alias: Map<string, string>;
  /** Source ID → target ID with the same content. 同內容：來源 ID → 目標 ID。 */
  reused: Map<string, string>;
  /** Target ID → source ID whose content it takes ('incoming'). 目標 ID → 換成哪份來源的內容。 */
  updates: Map<string, string>;
  /** Source IDs that come in as new definitions, read-only or local. 以新定義進來的來源 ID（唯讀或本地）。 */
  imported: string[];
  /** Source IDs whose Library ID is here with other content. 圖裡已有同 Library ID、內容不同的來源 ID。 */
  conflicts: string[];
  /** Source IDs that come in local (their own duplicates, or kept out by 'keep'). 轉成本地進來的來源 ID。 */
  localized: string[];
}

/** C4: how `needed` (definitions of `source`, closed under their dependencies) come into `target`. First the batch's own duplicates
 * (C3 step 1); then each Library copy meets the one copy with its Library ID here (C2): the same standard form is reused, none comes
 * in read-only, other content follows the choice. No search: with one copy per Library ID on each side the pairing is fixed.
 * A batch without Library copies returns at once. C4：needed（source 的定義，含依賴）怎麼進 target。先處理這批自己的重複，再讓每份
 * Library 副本對上這裡唯一同 Library ID 的那份：同標準形沿用、沒有就唯讀進來、內容不同照選擇。不搜尋：兩邊各一份，對法是固定的。
 * 沒有 Library 副本的一批立即返回。 */
export function planLibraryEntry(target: Graph, source: Graph, needed: readonly string[], registry: Registry, choice: EntryChoice = {}, at = now()): EntryPlan {
  const within = new Set(needed);
  const empty = { alias: new Map<string, string>(), reused: new Map<string, string>(), updates: new Map<string, string>(), conflicts: [] as string[], localized: [] as string[] };
  if (!(source.subgraphs ?? []).some(f => within.has(f.id) && f.libraryId !== undefined)) return { source, ...empty, imported: [...needed] };
  const repair = repairDuplicates(source, registry, { separate: choice.duplicates === 'separate', within, at });
  // Always a copy: the plan may localize definitions and must never touch the caller's clip. 一定是複本：方案可能轉本地，不能動到呼叫端的剪貼簿。
  const batch = repair.document === source ? copy(source) : repair.document, byId = new Map((batch.subgraphs ?? []).map(f => [f.id, f]));
  const ids = needed.filter(id => !repair.merged.has(id));
  const here = new Map<string, SubgraphData>();
  for (const f of target.subgraphs ?? []) if (f.libraryId !== undefined) {
    if (here.has(f.libraryId)) throw Object.assign(Error('This graph has a Library subgraph more than once; repair it first'), { code: 'subgraph.libraryDuplicate' });
    here.set(f.libraryId, f);
  }
  const reused = new Map<string, string>(), updates = new Map<string, string>(), conflicts: string[] = [];
  let imported: string[] = [];
  // Parents before children: an equal parent fixes its whole closure position by position (equal standard forms align), so its
  // children need no form of their own — a reused chain costs one closure, not one per level. 父在子前：相同的父逐位定下整個閉包
  // （標準形相同就對得齊），子不必再算——沿用一條鏈只算一次閉包，不是每層一次。
  const order: string[] = [], seen = new Set<string>(), inside = new Set(ids);
  const place = (id: string) => {
    if (seen.has(id) || !inside.has(id)) return; seen.add(id);
    for (const child of instancesOf(byId.get(id)!, registry)) place(child);
    order.push(id);
  };
  ids.forEach(place); order.reverse();
  for (const id of order) {
    if (reused.has(id)) continue;
    const f = byId.get(id)!, mine = f.libraryId === undefined ? undefined : here.get(f.libraryId);
    if (!mine) { imported.push(id); continue; }
    const form = standardForm(batch, registry, id);
    if (form === null || form !== standardForm(target, registry, mine.id)) { conflicts.push(id); continue; }
    const from = closureOrder(batch, registry, id)!, to = closureOrder(target, registry, mine.id)!;
    from.forEach((g, i) => reused.set(g.id, to[i]!.id));
  }
  imported = ids.filter(id => imported.includes(id) && !reused.has(id));
  const localized = [...repair.localized];
  if (conflicts.length && choice.conflicts === 'incoming') for (const id of conflicts) updates.set(here.get(byId.get(id)!.libraryId!)!.id, id);
  else if (conflicts.length) {
    // Keep the graph's version: the incoming copies and every read-only one using them in this batch come in local (C5); nothing here
    // changes. 保留圖裡的版本：帶進來的那幾份，連同這批裡用到它們的唯讀定義，轉本地進來；圖裡什麼都不動。
    const going = withReadOnlyAncestors(ids.map(id => byId.get(id)!), registry, conflicts);
    for (const id of going) { const f = byId.get(id)!; if (f.libraryId !== undefined) { localize(f, at); localized.push(id); } reused.delete(id); }
    imported = [...imported, ...ids.filter(id => going.has(id) && !imported.includes(id))];
  }
  return { source: batch, alias: repair.merged, reused, updates, imported, conflicts, localized };
}

/** Apply an entry plan inside a transaction: the new definitions come in through the ID map (a Library copy as the legal add), then
 * each update takes its incoming content with references mapped to this graph. Returns the source ID → in-graph ID map, merged IDs
 * included, for the caller's own references. 在交易裡套用進圖方案：新定義經 ID 對照進來（Library 副本是合法的加入），再逐一更新成帶進來的
 * 內容（參照已對到這張圖）。回傳來源 ID → 圖內 ID 的對照（含被合併的），給呼叫端改自己的參照。 */
export function applyLibraryEntry(graph: GraphDocument, plan: EntryPlan, next: AllocateSubgraphId): Map<string, string> {
  const ids = new Map<string, string>([...plan.reused, ...[...plan.updates].map(([to, from]) => [from, to] as [string, string])]);
  for (const id of plan.imported) ids.set(id, next());
  for (const [from, to] of plan.alias) { const at = ids.get(to); if (at !== undefined) ids.set(from, at); }
  const byId = new Map((plan.source.subgraphs ?? []).map(f => [f.id, f]));
  if (plan.imported.length) appendSubgraphs(graph, plan.imported.map(id => byId.get(id)!), ids);
  for (const [to, from] of plan.updates) {
    const content = copy(byId.get(from)!);
    redirect(graph.registry, [content.graph], content, ids);
    content.id = to;
    updateFromLibrary(graph, to, content);
  }
  return ids;
}

export interface OpenChoice { duplicates?: 'merge' | 'separate'; versions?: 'update' | 'local' }
export interface OpenRepair {
  /** The graph as it will open. 打開後的圖。 */
  document: Graph;
  merged: Map<string, string>;
  /** In-graph IDs now local (step 1 and, with 'local', step 2). 轉成本地的圖內 ID。 */
  localized: string[];
  /** In-graph IDs whose content differs from the Library read this time. 和這次讀到的資源庫內容不同的圖內 ID。 */
  differing: string[];
  /** In-graph IDs updated ('update'). 更新了的圖內 ID。 */
  updated: string[];
}

/** C3, opening a graph: first its duplicates (step 1, flat, preferring the copy equal to the Library), then one whole choice for the
 * copies whose content differs from the Library read this time (step 2): update them all, or make them all local with every read-only
 * definition using them. `library` holds the Library definitions resolved for this graph (A7 settled by the caller, one per Library ID,
 * nested references among themselves); none means the Library was not found and only step 1 runs. Step 2 runs through change(), so
 * the result passes the same gates as any edit. Pure: returns the graph to open; the caller shows it and publishes it on confirm.
 * C3 開圖：先處理重複（第 1 步，平著做，偏好和資源庫相同的那份），再對和這次讀到的資源庫不同的副本整張圖二選一（第 2 步）：全部更新，或連同
 * 用到它們的唯讀定義全部轉本地。library 是呼叫端為這張圖解析好的資源庫定義（A7 已處理，每個 Library ID 一份，巢狀參照指彼此）；沒有就是
 * 找不到資源庫，只做第 1 步。第 2 步經過 change()，結果過同樣的關卡。純函式：回傳要打開的圖，呼叫端呈現、確認後發布。 */
export function repairLibraryCopies(document: Graph, registry: Registry, library: Graph | undefined, next: AllocateSubgraphId,
    choice: OpenChoice = {}, at = now()): OpenRepair {
  const shelf = new Map<string, SubgraphData>();
  for (const f of library?.subgraphs ?? []) if (f.libraryId !== undefined) {
    if (shelf.has(f.libraryId)) throw Object.assign(Error('The Library holds two contents for one Library ID'), { code: 'library.conflict' });
    shelf.set(f.libraryId, f);
  }
  const forms = new Map<string, string | null>();
  const formOf = (libraryId: string) => forms.has(libraryId) ? forms.get(libraryId)! : (forms.set(libraryId, standardForm(library!, registry, shelf.get(libraryId)!.id)), forms.get(libraryId)!);
  const step1 = repairDuplicates(document, registry, { separate: choice.duplicates === 'separate', at,
    prefer: (f, form) => form !== null && shelf.has(f.libraryId!) && form === formOf(f.libraryId!) });
  const base = step1.document;
  const differing = (base.subgraphs ?? []).filter(f => f.libraryId !== undefined && shelf.has(f.libraryId) &&
    formOf(f.libraryId) !== null && standardForm(base, registry, f.id) !== formOf(f.libraryId)).map(f => f.id);
  const result: OpenRepair = { document: base, merged: step1.merged, localized: [...step1.localized], differing, updated: [] };
  if (!differing.length) return result;
  const step = new GraphDocument(base, registry).change(m => {
    if (choice.versions === 'local') {
      // Every read-only user first, so each Make Local is in place and nothing forks (C5). 先轉所有唯讀使用者，每次轉本地都就地、不分叉。
      const going = withReadOnlyAncestors(m.document.subgraphs ?? [], registry, differing);
      while (going.size) {
        const free = [...going].find(id => !(m.document.subgraphs ?? []).some(d => going.has(d.id) && d.id !== id && d.libraryId !== undefined && instancesOf(d, registry).includes(id)));
        if (free === undefined) throw Error('Subgraph reference cycle');
        going.delete(free);
        if (m.document.subgraphs!.find(d => d.id === free)!.libraryId === undefined) continue;
        makeLocal(m, free, next, at); result.localized.push(free);
      }
      return;
    }
    // Update all: the Library's closures of the differing copies come in as an entry that takes the incoming content (C4 'incoming').
    // 全部更新：不同的那幾份在資源庫裡的閉包，照「改用帶進來的」進圖。
    const wanted = new Set<string>();
    for (const id of differing) for (const f of closureOrder(library!, registry, shelf.get(m.document.subgraphs!.find(d => d.id === id)!.libraryId!)!.id) ?? []) wanted.add(f.id);
    const plan = planLibraryEntry(m.document, library!, [...wanted], registry, { conflicts: 'incoming' }, at);
    applyLibraryEntry(m, plan, next);
    result.updated = [...plan.updates.keys()];
  });
  result.document = step.after;
  return result;
}
