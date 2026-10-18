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
import { copy, type Graph, type Node } from './model';
import type { Registry } from './node_module';
import { GraphDocument } from './graph';
import { equal } from './changes';
import { ghostsOf } from './ghosts';
import * as values from './values';
import { readLibraryFile, shelfFromEntries, saveLibraryFile, type LibraryFile, type LibraryEntry } from './library_files';

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
}

type Candidate = { entry: LibraryEntry; at: string; own: boolean };
/** Content without what is worked out from it. 去掉推算欄位的內容。 */
const content = (entry: LibraryEntry) => { const { stages: _s, targets: _t, ...rest } = entry; return rest; };
const refsOf = (registry: Registry, entry: LibraryEntry) => entry.graph.nodes
  .map((n: Node) => registry.get(n.nodeType)?.referencedGraph?.(n)).filter((id): id is string => id !== undefined);

export function resolveLibrary<C = undefined>(sources: readonly LibrarySource[], registry: Registry, check?: (file: LibraryFile) => C): ResolvedLibrary<C> {
  const problems: LibraryProblem[] = [], unusable = new Map<string, LibraryProblem>();
  const refuse = (problem: LibraryProblem) => { problems.push(problem); if (problem.libraryId !== undefined && !unusable.has(problem.libraryId)) unusable.set(problem.libraryId, problem); };
  // Each file as written must read (its own carried copies included); one that does not adds nothing. 每個檔照原樣要讀得進；讀不進的不貢獻任何內容。
  const candidates = sources.map(source => {
    const byId = new Map<string, Candidate[]>();
    for (const file of source.files) {
      const at = source.name + '/' + file.name;
      try { readLibraryFile(file.content, registry); } catch (error) { refuse({ code: 'unreadable', at: [at], detail: (error as Error).message }); continue; }
      const f = file.content as LibraryFile;
      [f.subgraph, ...(f.dependencies ?? [])].forEach((entry, i) => {
        const list = byId.get(entry.libraryId) ?? [];
        list.push({ entry: copy(entry), at, own: i === 0 }); byId.set(entry.libraryId, list);
      });
    }
    return byId;
  });
  // R3, then R1, then R2. Only the winning source's own disagreements count (Codex R2-1). 先 R3、再 R1、再 R2；只算勝出來源自己的不一致。
  const winners = new Map<string, Candidate>();
  for (const id of [...new Set(candidates.flatMap(byId => [...byId.keys()]))].sort()) {
    const found = candidates.find(byId => byId.has(id))!.get(id)!, own = found.filter(c => c.own);
    if (own.length > 1) { refuse({ code: 'duplicateRoot', libraryId: id, at: own.map(c => c.at).sort(), detail: 'Two files are both this subgraph' }); continue; }
    if (own.length === 1) { winners.set(id, own[0]!); continue; }
    const sorted = [...found].sort((a, b) => a.at < b.at ? -1 : a.at > b.at ? 1 : 0);
    if (sorted.some(c => !equal(content(c.entry), content(sorted[0]!.entry)))) {
      refuse({ code: 'conflictingCopies', libraryId: id, at: [...new Set(sorted.map(c => c.at))], detail: 'Carried with different content and no file of its own' });
      continue;
    }
    winners.set(id, sorted[0]!);
  }
  // R4: each winner's dependencies, depth first in node order (the order saving uses). R4：每份勝出內容的依賴，深度優先、照節點順序。
  const closures = new Map<string, string[]>();
  for (const id of winners.keys()) {
    const order: string[] = [], path: string[] = [];
    let problem: LibraryProblem | undefined;
    const visit = (at: string) => {
      if (problem) return;
      if (path.includes(at)) { problem = { code: 'cycle', libraryId: id, at: [winners.get(id)!.at], detail: 'Subgraphs use each other: ' + [...path.slice(path.indexOf(at)), at].join(' → ') }; return; }
      if (order.includes(at)) return;
      const winner = winners.get(at);
      if (!winner) {
        problem = unusable.has(at) ? { code: 'dependsOnUnusable', libraryId: id, at: [winners.get(id)!.at], detail: 'Uses ' + at + ', which has no single content' }
          : { code: 'missing', libraryId: id, at: [winners.get(id)!.at], detail: 'Uses ' + at + ', which no file holds' };
        return;
      }
      path.push(at); order.push(at);
      for (const ref of refsOf(registry, winner.entry)) visit(ref);
      path.pop();
    };
    visit(id);
    if (problem) refuse(problem); else closures.set(id, order);
  }
  // Rebuilt whole, then checked in each target the content supports (Codex R2-2). 整份重建，再在內容支援的每個 target 檢查。
  const resolved = new Map<string, LibraryFile>();
  for (const [id, order] of closures) {
    const at = winners.get(id)!.at;
    let shelf: Graph, file: LibraryFile;
    try {
      shelf = shelfFromEntries(order.map(x => winners.get(x)!.entry), registry);
      file = saveLibraryFile(shelf, registry, 'L0', () => { throw Error('A definition has no Library ID'); });
    } catch (error) { refuse({ code: 'invalid', libraryId: id, at: [at], detail: (error as Error).message }); continue; }
    if (!file.subgraph.targets.length) { refuse({ code: 'noTarget', libraryId: id, at: [at], detail: 'No graph target can take what it now holds' }); continue; }
    const broken = file.subgraph.targets.flatMap(target => {
      const network = new GraphDocument({ ...copy(shelf), target }, registry).networks.get('subgraph:L0')!, ghosts = ghostsOf(network, values.policy);
      const wires = network.edges.filter(e => ghosts.edges.has(e.id)).map(e => e.data!.from.join('.') + ' → ' + e.data!.to.join('.'));
      return [...[...ghosts.nodes.keys()].map(n => target + ': node ' + n), ...wires.map(w => target + ': wire ' + w)];
    });
    if (broken.length) { refuse({ code: 'ghost', libraryId: id, at: [at], detail: 'Broken by what it now uses: ' + broken.join('; ') }); continue; }
    resolved.set(id, file);
  }
  // The roots people take, checked by the caller (the build compiles them). 使用者拿的根，由呼叫端檢查（建置會產碼）。
  const roots = sources.flatMap(source => source.files.map(f => ({ at: source.name + '/' + f.name, id: (f.content as LibraryFile | null)?.subgraph?.libraryId })))
    .filter((r): r is { at: string; id: string } => typeof r.id === 'string' && winners.get(r.id)?.own === true && winners.get(r.id)!.at === r.at);
  const checked = new Map<string, C>();
  for (const { id, at } of roots) {
    const file = resolved.get(id);
    if (!file || !check) continue;
    try { checked.set(id, check(copy(file))); } catch (error) { refuse({ code: 'check', libraryId: id, at: [at], detail: (error as Error).message }); }
  }
  // Whatever uses an unusable one cannot be used either; only what is really broken and its users (Codex R2-1). 用到不能用的，也不能用。
  for (let grew = true; grew;) {
    grew = false;
    for (const [id, order] of closures) {
      if (unusable.has(id)) continue;
      const bad = order.find(x => x !== id && unusable.has(x));
      if (bad) { refuse({ code: 'dependsOnUnusable', libraryId: id, at: [winners.get(id)!.at], detail: 'Uses ' + bad + ', which cannot be used' }); grew = true; }
    }
  }
  const items = roots.filter(r => resolved.has(r.id) && !unusable.has(r.id))
    .map(r => ({ libraryId: r.id, file: resolved.get(r.id)!, at: r.at, checked: checked.get(r.id) as C }));
  return { items, unusable, problems };
}

/** What changed between two sets of resolved files (the build's report, design §6). 兩組解析後的檔之間改了什麼（建置的修改報告）。 */
export interface LibraryChanges {
  added: string[]; removed: string[];
  /** Its own content changed. 自己的內容改了。 */
  changed: string[];
  /** Its own content is the same; what it uses changed. 自己沒變，用到的變了。 */
  following: string[];
  /** Interface ports added, removed or retyped, by port id. 接口的增、刪、改型別。 */
  ports: { libraryId: string; side: 'inputs' | 'outputs'; added: string[]; removed: string[]; retyped: string[] }[];
  titles: { libraryId: string; from: string; to: string }[];
}
export function libraryChanges(before: readonly LibraryFile[], after: readonly LibraryFile[]): LibraryChanges {
  const was = new Map(before.map(f => [f.subgraph.libraryId, f])), now = new Map(after.map(f => [f.subgraph.libraryId, f]));
  const result: LibraryChanges = { added: [], removed: [], changed: [], following: [], ports: [], titles: [] };
  for (const id of [...new Set([...was.keys(), ...now.keys()])].sort()) {
    const a = was.get(id), b = now.get(id);
    if (!a) { result.added.push(id); continue; }
    if (!b) { result.removed.push(id); continue; }
    if (!equal(content(a.subgraph), content(b.subgraph))) result.changed.push(id);
    else if (!equal(a.dependencies.map(content), b.dependencies.map(content))) result.following.push(id);
    if (a.subgraph.title !== b.subgraph.title) result.titles.push({ libraryId: id, from: a.subgraph.title, to: b.subgraph.title });
    for (const side of ['inputs', 'outputs'] as const) {
      const old = new Map(a.subgraph[side].map(p => [p.id, p.type])), fresh = new Map(b.subgraph[side].map(p => [p.id, p.type]));
      const added = [...fresh.keys()].filter(p => !old.has(p)), removed = [...old.keys()].filter(p => !fresh.has(p));
      const retyped = [...fresh.keys()].filter(p => old.has(p) && old.get(p) !== fresh.get(p));
      if (added.length || removed.length || retyped.length) result.ports.push({ libraryId: id, side, added, removed, retyped });
    }
  }
  return result;
}
