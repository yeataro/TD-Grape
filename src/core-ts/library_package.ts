/** Library packages (Refactor.123; design: workspace `work/refactor/library-package-build-design-2026-10-18.md` revision 3, design-interview
 * Q78 cont.). A folder of Library files is a package; the sources come in priority order (Q78: built-in first). One Library ID gets one
 * content: the highest source holding it wins (R3); inside it, the ID's own file (its root) wins over copies carried in other files (R1); an
 * ID only carried must be carried the same everywhere (R2). Every subgraph then uses the winners as its dependencies, rebuilt whole in memory
 * with stages and targets worked out again (R4); source files are never written. Then the checks: a definition broken by what it now
 * depends on (a ghost, in each target it supports), one no target can take, a failing caller check — and everything using a broken one is
 * unusable too. The build (one source) and the editor (all sources) call the same function.
 * 資源庫包：一個資料夾的資源庫檔是一個包；來源照優先順序給（Q78：內建優先）。一個 Library ID 只有一份內容：有它的來源中最優先的勝出（R3）；
 * 那個來源裡，它自己的檔（根）勝過別的檔夾帶的副本（R1）；只被夾帶的，各處要相同（R2）。每份子圖再照勝出的內容在記憶體中重建依賴、重算
 * stages／targets（R4）；原始檔不寫。然後檢查：被新的依賴弄壞（在它支援的每個 target 出現 Ghost）、沒有任何 target 能用、呼叫端的檢查不過——
 * 用到壞的那份的也都不能用。建置（一個來源）與編輯器（全部來源）用同一個函式。 */
import { copy, GRAPH_TARGETS, type Graph, type Node, type SubgraphData } from './model';
import type { Registry } from './node_module';
import { GraphDocument } from './graph';
import { equal } from './changes';
import { ghostsOf } from './ghosts';
import * as values from './values';
import { validLibraryId } from './library';
import { subgraphGroups } from './subgraph_stages';
import { readLibraryFile, shelfFromEntries, saveLibraryFile, definitionUses, LIBRARY_FORMAT, type LibraryFile, type LibraryEntry } from './library_files';

/** One package: its name and its files, each with a name the problems can point at. 一個包：名稱與檔案，每個檔有名字給問題清單指認。 */
export interface LibrarySource { readonly name: string; readonly files: readonly { readonly name: string; readonly content: unknown }[] }
export type LibraryProblemCode = 'unreadable' | 'duplicateRoot' | 'conflictingCopies' | 'missing' | 'cycle' | 'invalid' | 'noTarget'
  | 'ghost' | 'check' | 'dependsOnUnusable';
/** What went wrong and where: `at` names files as "source/file". 出了什麼問題、在哪裡：at 寫成「來源/檔名」。 */
export interface LibraryProblem { code: LibraryProblemCode; libraryId?: string; at: string[]; detail: string }
/** A subgraph a person can take: a root of the winning source, usable, as its resolved file. 使用者拿得到的子圖：勝出來源的根、可用、解析後的檔。 */
export interface LibraryItem<C> { libraryId: string; file: LibraryFile; at: string; checked: C }
export interface ResolvedLibrary<C> {
  /** In source order, then file order. 依來源、再依檔案的順序。 */
  items: LibraryItem<C>[];
  /** Every Library ID that cannot be used, with its first problem. 不能用的每個 Library ID 與它的第一個問題。 */
  unusable: Map<string, LibraryProblem>;
  problems: LibraryProblem[];
  /** Carried copies that differ from the content used: a hint, not a problem — that file shared alone would bring its copy (design §6,
   * Codex R123-5). 和採用的內容不同的夾帶副本：是提示、不是問題——那個檔單獨分享時會帶它的副本。 */
  stale: { libraryId: string; at: string }[];
}

/** A copy of one Library ID in one file; an own file that does not read holds its place with the problem and no content (Codex R123-3).
 * 一個檔裡某個 Library ID 的一份；讀不進的自己的檔，帶著問題、沒有內容，照樣佔位置。 */
type Candidate = { entry?: LibraryEntry; at: string; own: boolean; problem?: LibraryProblem };
const derived = (entry: LibraryEntry) => { const { stages: _s, targets: _t, ...rest } = entry; return rest; };
/** Two copies are the same content apart from what is worked out from it and provenance (C6; Codex R123-1); credits are content.
 * 兩份副本除了推算欄位與出處以外相同，就是同內容（C6）；credits 算內容。 */
const sameContent = (a: LibraryEntry, b: LibraryEntry) => {
  const { provenance: _a, ...x } = derived(a), { provenance: _b, ...y } = derived(b);
  return equal(x, y);
};
const refsOf = (registry: Registry, entry: LibraryEntry) => [...new Set(entry.graph.nodes
  .map((n: Node) => registry.get(n.nodeType)?.referencedGraph?.(n)).filter((id): id is string => id !== undefined))];
const noLibraryId = () => { throw Error('A definition has no Library ID'); };

export function resolveLibrary<C = undefined>(sources: readonly LibrarySource[], registry: Registry, check?: (file: LibraryFile) => C): ResolvedLibrary<C> {
  const problems: LibraryProblem[] = [], unusable = new Map<string, LibraryProblem>(), stale: ResolvedLibrary<C>['stale'] = [];
  const refuse = (problem: LibraryProblem) => { problems.push(problem); if (problem.libraryId !== undefined && !unusable.has(problem.libraryId)) unusable.set(problem.libraryId, problem); };
  // Each file as written must read (its own carried copies included); its copies are then taken as saving writes them, so a default
  // written out or left out is the same content (Codex R123-2). 每個檔照原樣要讀得進；再取存檔會寫出的樣子，預設值寫不寫都是同內容。
  const candidates = sources.map(source => {
    const byId = new Map<string, Candidate[]>();
    const add = (id: string, candidate: Candidate) => byId.set(id, [...(byId.get(id) ?? []), candidate]);
    for (const file of source.files) {
      const at = source.name + '/' + file.name;
      let saved: LibraryFile;
      try { saved = saveLibraryFile(readLibraryFile(file.content, registry).shelf, registry, 'L0', noLibraryId); } catch (error) {
        // One that still names its subgraph keeps that place, failed; one that does not adds nothing. 還認得出是哪份的，失敗地佔著位置；認不出的不貢獻。
        const named = file.content as Partial<LibraryFile> | null, id = named?.format === LIBRARY_FORMAT ? named.subgraph?.libraryId : undefined;
        const problem: LibraryProblem = { code: 'unreadable', ...(validLibraryId(id) ? { libraryId: id } : {}), at: [at], detail: (error as Error).message };
        problems.push(problem);
        if (validLibraryId(id)) add(id, { at, own: true, problem });
        continue;
      }
      [saved.subgraph, ...saved.dependencies].forEach((entry, i) => add(entry.libraryId, { entry, at, own: i === 0 }));
    }
    return byId;
  });
  // R3, then R1, then R2. Only the winning source's own disagreements count (Codex R2-1). 先 R3、再 R1、再 R2；只算勝出來源自己的不一致。
  const winners = new Map<string, { entry: LibraryEntry; at: string; own: boolean }>();
  for (const id of [...new Set(candidates.flatMap(byId => [...byId.keys()]))].sort()) {
    const found = candidates.find(byId => byId.has(id))!.get(id)!, own = found.filter(c => c.own);
    if (own.length > 1) { refuse({ code: 'duplicateRoot', libraryId: id, at: own.map(c => c.at).sort(), detail: 'Two files are both this subgraph' }); continue; }
    const sorted = [...found].sort((a, b) => a.at < b.at ? -1 : a.at > b.at ? 1 : 0), winner = own[0] ?? sorted[0]!;
    if (winner.problem) { unusable.set(id, winner.problem); continue; }
    if (!own.length && sorted.some(c => !sameContent(c.entry!, winner.entry!))) {
      refuse({ code: 'conflictingCopies', libraryId: id, at: [...new Set(sorted.map(c => c.at))], detail: 'Carried with different content and no file of its own' });
      continue;
    }
    winners.set(id, { entry: winner.entry!, at: winner.at, own: winner.own });
    for (const byId of candidates) for (const c of byId.get(id) ?? []) if (!c.own && c.entry && !sameContent(c.entry, winner.entry!)) stale.push({ libraryId: id, at: c.at });
  }
  const uses = new Map([...winners].map(([id, w]) => [id, refsOf(registry, w.entry)]));
  // Whatever uses an unusable one cannot be used either; only what is really broken and its users (Codex R2-1). 用到不能用的，也不能用。
  const spread = () => {
    for (let grew = true; grew;) {
      grew = false;
      for (const [id, refs] of uses) {
        const bad = unusable.has(id) ? undefined : refs.find(x => unusable.has(x));
        if (bad) { refuse({ code: 'dependsOnUnusable', libraryId: id, at: [winners.get(id)!.at], detail: 'Uses ' + bad + ', which cannot be used' }); grew = true; }
      }
    }
  };
  // R4 needs every dependency held once and no cycle (a cycle can be made only by resolving). R4 要每份依賴都有、沒有循環（循環可能是解析才造成的）。
  for (const [id, refs] of uses) {
    const gone = refs.find(x => !winners.has(x) && !unusable.has(x));
    if (gone) refuse({ code: 'missing', libraryId: id, at: [winners.get(id)!.at], detail: 'Uses ' + gone + ', which no file holds' });
  }
  const linked = [...winners].map(([id, w]) => ({ ...w.entry, id }) as unknown as SubgraphData);
  const cyclic = subgraphGroups({ subgraphs: linked } as Graph, registry).cyclic;
  for (const id of [...cyclic].sort()) {
    // The shortest way back to itself, for the message. 回到自己的最短路，寫在訊息裡。
    const back = new Map<string, string>(), queue = [id];
    let last: string | undefined;
    while (last === undefined) {
      const at = queue.shift()!;
      for (const next of uses.get(at)!) {
        if (next === id) { last = at; break; }
        if (cyclic.has(next) && !back.has(next)) { back.set(next, at); queue.push(next); }
      }
    }
    const path = [id];
    for (let at = last; at !== id; at = back.get(at)!) path.splice(1, 0, at);
    refuse({ code: 'cycle', libraryId: id, at: [winners.get(id)!.at], detail: 'Subgraphs use each other: ' + [...path, id].join(' → ') });
  }
  spread();
  // All usable winners on one shelf, checked once (Refactor.123.1: rebuilt per definition, a chain of 200 took seconds); then each in every
  // target it supports (Codex R2-2). 可用的勝出內容全放上同一個架子、驗一次；再在每份支援的每個 target 檢查。
  const ready = [...winners.keys()].filter(id => !unusable.has(id)), shelfId = new Map(ready.map((id, i) => [id, 'L' + i]));
  let shelf: Graph | undefined;
  try { shelf = ready.length ? shelfFromEntries(ready.map(id => winners.get(id)!.entry), registry) : undefined; }
  catch (error) { for (const id of ready) refuse({ code: 'invalid', libraryId: id, at: [winners.get(id)!.at], detail: (error as Error).message }); }
  if (shelf) {
    const where = definitionUses(shelf, registry), broken = new Map<string, string[]>();
    for (const id of ready) if (!where(shelfId.get(id)!).targets.length) refuse({ code: 'noTarget', libraryId: id, at: [winners.get(id)!.at], detail: 'No graph target can take what it now holds' });
    for (const target of GRAPH_TARGETS) {
      const here = ready.filter(id => !unusable.has(id) && where(shelfId.get(id)!).targets.includes(target));
      if (!here.length) continue;
      const document = new GraphDocument({ ...copy(shelf), target }, registry);
      for (const id of here) {
        const network = document.networks.get('subgraph:' + shelfId.get(id))!, ghosts = ghostsOf(network, values.policy);
        const wires = network.edges.filter(e => ghosts.edges.has(e.id)).map(e => e.data!.from.join('.') + ' → ' + e.data!.to.join('.'));
        const found = [...[...ghosts.nodes.keys()].map(n => target + ': node ' + n), ...wires.map(w => target + ': wire ' + w)];
        if (found.length) broken.set(id, [...(broken.get(id) ?? []), ...found]);
      }
    }
    for (const [id, found] of broken) refuse({ code: 'ghost', libraryId: id, at: [winners.get(id)!.at], detail: 'Broken by what it now uses: ' + found.join('; ') });
    spread();
  }
  // The roots people take, as files, checked by the caller (the build compiles them). 使用者拿的根，寫成檔，由呼叫端檢查（建置會產碼）。
  const roots = sources.flatMap(source => source.files.map(f => ({ at: source.name + '/' + f.name, id: (f.content as LibraryFile | null)?.subgraph?.libraryId })))
    .filter((r): r is { at: string; id: string } => typeof r.id === 'string' && winners.get(r.id)?.own === true && winners.get(r.id)!.at === r.at);
  const resolved = new Map<string, { file: LibraryFile; checked: C }>();
  for (const { id, at } of roots) {
    if (!shelf || unusable.has(id)) continue;
    let file: LibraryFile;
    try { file = saveLibraryFile(shelf, registry, shelfId.get(id)!, noLibraryId); }
    catch (error) { refuse({ code: 'invalid', libraryId: id, at: [at], detail: (error as Error).message }); continue; }
    try { resolved.set(id, { file, checked: (check ? check(copy(file)) : undefined) as C }); }
    catch (error) { refuse({ code: 'check', libraryId: id, at: [at], detail: (error as Error).message }); }
  }
  spread();
  const items = roots.filter(r => resolved.has(r.id) && !unusable.has(r.id))
    .map(r => ({ libraryId: r.id, file: resolved.get(r.id)!.file, at: r.at, checked: resolved.get(r.id)!.checked }));
  return { items, unusable, problems, stale };
}

/** What changed between two sets of resolved files (the build's report, design §6). Every member counts, carried ones too (Codex R123-4);
 * what follows its dependencies is told for the files' subgraphs. 兩組解析後的檔之間改了什麼（建置的修改報告）。每個成員都算，只被夾帶的也是；
 * 「跟著依賴變」對檔的子圖本身說。 */
export interface LibraryChanges {
  added: string[]; removed: string[];
  /** Its own content changed (provenance included: this is a report of the files, not the C6 comparison). 自己的內容改了（含出處：這是檔的報告，不是 C6 的比較）。 */
  changed: string[];
  /** A file's subgraph: its own content is the same; what it uses changed. 檔的子圖：自己沒變，用到的變了。 */
  following: string[];
  /** Interface ports added, removed or retyped, by port id. 接口的增、刪、改型別。 */
  ports: { libraryId: string; side: 'inputs' | 'outputs'; added: string[]; removed: string[]; retyped: string[] }[];
  titles: { libraryId: string; from: string; to: string }[];
}
export function libraryChanges(before: readonly LibraryFile[], after: readonly LibraryFile[]): LibraryChanges {
  const members = (files: readonly LibraryFile[]) => {
    const found = new Map<string, LibraryEntry>();
    for (const f of files) for (const e of [f.subgraph, ...f.dependencies]) if (!found.has(e.libraryId)) found.set(e.libraryId, e);
    return found;
  };
  const was = members(before), now = members(after);
  const wasFile = new Map(before.map(f => [f.subgraph.libraryId, f])), nowFile = new Map(after.map(f => [f.subgraph.libraryId, f]));
  const result: LibraryChanges = { added: [], removed: [], changed: [], following: [], ports: [], titles: [] };
  for (const id of [...new Set([...was.keys(), ...now.keys()])].sort()) {
    const a = was.get(id), b = now.get(id);
    if (!a) { result.added.push(id); continue; }
    if (!b) { result.removed.push(id); continue; }
    const fa = wasFile.get(id), fb = nowFile.get(id);
    if (!equal(derived(a), derived(b))) result.changed.push(id);
    else if (fa && fb && !equal(fa.dependencies.map(derived), fb.dependencies.map(derived))) result.following.push(id);
    if (a.title !== b.title) result.titles.push({ libraryId: id, from: a.title, to: b.title });
    for (const side of ['inputs', 'outputs'] as const) {
      const old = new Map(a[side].map(p => [p.id, p.type])), fresh = new Map(b[side].map(p => [p.id, p.type]));
      const added = [...fresh.keys()].filter(p => !old.has(p)), removed = [...old.keys()].filter(p => !fresh.has(p));
      const retyped = [...fresh.keys()].filter(p => old.has(p) && old.get(p) !== fresh.get(p));
      if (added.length || removed.length || retyped.length) result.ports.push({ libraryId: id, side, added, removed, retyped });
    }
  }
  return result;
}
