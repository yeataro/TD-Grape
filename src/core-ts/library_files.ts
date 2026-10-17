/** Library files (D-2, Refactor.121; fields: workspace `work/refactor/library-fields-draft-2026-10-15.md`, decided 10-15/16). One file is
 * one subgraph with the subgraphs it uses: `subgraph` plus `dependencies`, the same shape, nested instances naming each other by Library
 * ID — a file holds no in-graph IDs; they are given when a file is read. Saving is how a person turns a subgraph into a file (the
 * built-in Tint is made this way, tools/make_tint.cjs); reading checks every definition as a graph would, and the stored stages and
 * targets must match what the content gives. The core never reads a Library: callers hand files in.
 * 資源庫檔：一個檔＝一份子圖連同它用到的子圖：subgraph＋dependencies，形狀相同，巢狀實例用 Library ID 互指——檔裡沒有圖內 ID，讀檔時才配。
 * 存檔是使用者把子圖變成檔的方式（內建 Tint 也這樣做）；讀檔照圖的規則驗每份定義，存著的 stages／targets 要和內容算出的一樣。核心不讀
 * 資源庫：檔案由呼叫端給。 */
import { copy, GRAPH_FORMAT, GRAPH_VERSION, GRAPH_TARGETS, type Graph, type SubgraphData, type Node, type Credits, type DefinitionTexts } from './model';
import { contextFor, type Registry } from './node_module';
import { GraphDocument } from './graph';
import { equal } from './changes';
import { tidyGroups } from './groups';
import { validInterface, requireSubgraph } from './subgraph_interface';
import { wireDropRow, type WireFit } from './wire_drop';
import * as values from './values';
import { validLibraryId, closureOrder, now } from './library';
import { validateSubgraphData, withoutStoredUse } from './subgraph_operations';
import { subgraphGroups } from './subgraph_stages';
import { ScopeReferences } from './scope_references';
import { planLibraryEntry, applyLibraryEntry, type EntryChoice } from './library_policy';
import type { AllocateSubgraphId } from './subgraph_copies';

export const LIBRARY_FORMAT = 'grape-subgraph';
export const LIBRARY_VERSION = 1;
/** One definition as a file holds it. 檔裡的一份定義。 */
export type LibraryEntry = Omit<SubgraphData, 'id' | 'descriptionKey' | 'libraryId' | 'stages' | 'targets'> &
  { libraryId: string; stages: string[]; targets: string[] };
export interface LibraryFile { format: string; version: number; subgraph: LibraryEntry; dependencies: LibraryEntry[] }
/** What a person gives when saving: the description and the rest of the library fields, for the subgraph itself.
 * 存檔時使用者給的：說明與其他資源庫欄位，給子圖本身。 */
export interface LibraryDetails { category?: string; description?: string; comment?: string; credits?: Credits; texts?: DefinitionTexts }

const fail = (message: string) => Object.assign(Error(message), { code: 'library.file' });
const referenceOf = (registry: Registry, n: Node) => registry.get(n.nodeType)?.referencedGraph?.(n);

/** A Library ID from 16 random bytes, as a version 4 UUID; the caller gives the randomness (crypto.getRandomValues, which works on
 * plain http too). Library ID：16 個亂數位元組做成第 4 版 UUID；亂數由呼叫端給（crypto.getRandomValues，一般 http 也能用）。 */
export function libraryIdFrom(bytes: ArrayLike<number>): string {
  if (bytes.length < 16) throw Error('A Library ID needs 16 random bytes');
  const b = Array.from(bytes).slice(0, 16);
  b[6] = (b[6]! & 0x0f) | 0x40; b[8] = (b[8]! & 0x3f) | 0x80;
  const hex = b.map(x => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Where a definition can be used, worked out from its content: the stages (Q46) and the graph targets every node inside takes.
 * 定義能用在哪裡，由內容推算：Stage（Q46），以及裡面每個節點都接受的圖 target。 */
function usesOf(document: Graph, registry: Registry, id: string): { stages: string[]; targets: string[] } {
  const stages = [...subgraphGroups(document, registry).stagesOf(id)], closure = closureOrder(document, registry, id) ?? [];
  const targets = GRAPH_TARGETS.filter(target => closure.every(f => f.graph.nodes.every(n => {
    const module = registry.get(n.nodeType);
    return !module || module.supports(n, contextFor({ ...document, target }, f));
  })));
  return { stages, targets };
}

/** Save a definition and its closure as a Library file. A definition with a Library ID keeps it; one without gets a new one from
 * `newLibraryId`. `details` are the library fields the person gives for the subgraph itself. Scoped references cannot be written yet:
 * a file names its definitions only by Library ID, which is not a scope name (refused, not guessed).
 * 把一份定義連同閉包存成資源庫檔。已有 Library ID 的保留；沒有的由 newLibraryId 給新的。details 是使用者給子圖本身的資源庫欄位。scoped 參照
 * 暫時寫不出來：檔裡只用 Library ID 指定義，而它不是 scope 名稱（拒絕，不猜）。 */
export function saveLibraryFile(document: Graph, registry: Registry, rootId: string, newLibraryId: () => string, details: LibraryDetails = {}): LibraryFile {
  const order = closureOrder(document, registry, rootId);
  if (!order) throw fail('The subgraph uses a definition that is missing');
  const ids = new Map(order.map(f => [f.id, f.libraryId ?? newLibraryId()]));
  if (![...ids.values()].every(validLibraryId) || new Set(ids.values()).size !== ids.size) throw fail('Invalid or repeated Library ID');
  const entries = order.map((f, i): LibraryEntry => {
    let scoped = false;
    ScopeReferences.walk(f, (_, old) => { scoped = true; return old; }, false);
    if (scoped) throw fail('A Library file cannot hold scoped references yet');
    // Provenance travels with the definition (C6: saved and kept; Codex R121-3); only the in-graph ID and derived fields stay behind.
    // 出處跟著定義走（C6：會存檔、一直保留）；只留下圖內 ID 與推算欄位。
    const { id: _id, descriptionKey: _d, libraryId: _l, stages: _s, targets: _t, title, inputs, outputs, graph, ...rest } = copy(f);
    graph.nodes = graph.nodes.map(n => {
      const ref = referenceOf(registry, n), module = registry.get(n.nodeType);
      return ref === undefined || !module?.reference ? n : { ...n, params: { ...n.params, ...module.reference(ids.get(ref)!) } };
    });
    return { libraryId: ids.get(f.id)!, title, ...rest, ...(i === 0 ? copy(details) : {}), inputs, outputs, graph, ...usesOf(document, registry, f.id) };
  });
  return { format: LIBRARY_FORMAT, version: LIBRARY_VERSION, subgraph: entries[0]!, dependencies: entries.slice(1) };
}

/** Read a Library file into a shelf: a graph holding its definitions (in-graph IDs L0, L1, … in file order; L0 is the subgraph), each
 * checked as a graph's definition is. Refused: another format or a newer version, a repeated or malformed Library ID, a nested
 * instance naming a definition the file lacks, a dependency nothing uses, a cycle, stored stages or targets that differ from the
 * content's. 把資源庫檔讀成一個架子：一張放著它各份定義的圖（圖內 ID 依檔內順序 L0、L1…，L0 是子圖本身），每份照圖的定義驗。拒絕：
 * 別的格式或較新的版本、重複或格式不對的 Library ID、巢狀實例指到檔裡沒有的定義、沒人用的依賴、循環、存著的 stages／targets 和內容算出的不同。 */
export function readLibraryFile(value: unknown, registry: Registry): { shelf: Graph; root: string } {
  const file = value as Partial<LibraryFile> | null;
  if (!file || typeof file !== 'object' || file.format !== LIBRARY_FORMAT) throw fail('This is not a grape-subgraph file');
  if (!Number.isSafeInteger(file.version) || file.version! < 1) throw fail('The file version is missing or invalid');
  if (file.version! > LIBRARY_VERSION) throw fail('This file was saved by a newer Grape; update Grape to read it');
  if (!file.subgraph || typeof file.subgraph !== 'object' || (file.dependencies !== undefined && !Array.isArray(file.dependencies))) throw fail('The file has no subgraph');
  const entries = [file.subgraph, ...(file.dependencies ?? [])] as LibraryEntry[];
  const shelfIds = new Map<string, string>();
  entries.forEach((e, i) => {
    if (!e || typeof e !== 'object' || !validLibraryId(e.libraryId) || shelfIds.has(e.libraryId)) throw fail('Invalid or repeated Library ID');
    shelfIds.set(e.libraryId, 'L' + i);
  });
  const stored = new Map<string, { stages: unknown; targets: unknown }>();
  const subgraphs = entries.map((e, i) => {
    const f = copy(e) as unknown as SubgraphData;
    f.id = 'L' + i;
    stored.set(f.id, { stages: e.stages, targets: e.targets });
    if (!Array.isArray(f.graph?.nodes) || !Array.isArray(f.graph?.edges)) throw fail('A definition has no network');
    // What save refuses, read refuses too, so no file comes in that could not go back out (Codex R121-4). 存檔拒絕的，讀檔也拒絕。
    let scoped = false;
    ScopeReferences.walk(f, (_, old) => { scoped = true; return old; }, false);
    if (scoped) throw fail('A Library file cannot hold scoped references yet');
    if (f.graph.edges.some(e => !e || typeof e.id !== 'string' || !e.id)) throw fail('An edge is missing its id');
    f.graph.nodes = f.graph.nodes.map(n => {
      const ref = referenceOf(registry, n), module = registry.get(n.nodeType);
      if (ref === undefined || !module?.reference) return n;
      const to = shelfIds.get(ref);
      if (to === undefined) throw fail('A nested subgraph is missing from the file: ' + ref);
      return { ...n, params: { ...n.params, ...module.reference(to) } };
    });
    withoutStoredUse(f);
    try { validateSubgraphData(f); } catch (error) { throw fail('Invalid definition ' + e.libraryId + ': ' + (error as Error).message); }
    return f;
  });
  const shelf: Graph = { format: GRAPH_FORMAT, version: GRAPH_VERSION, target: 'top', declarations: [], subgraphs, stages: { pixel: { nodes: [], edges: [] } } };
  // Tidied as a graph tidies a definition when it comes in, so a copy brought in equals the shelf (Codex R121-2: a default group field
  // removed on the way in made the same file read as another version). 和定義進圖時一樣整理，帶進圖的副本才會等於架子上的（預設的群組欄位
  // 在進圖時被拿掉，同一個檔就被當成另一個版本）。
  tidyGroups(shelf);
  // Every interface uses known types and defaults its types take (Codex R121-1: a wrong default made the subgraph a ghost that the
  // build let through). 每個接口都是認得的型別、預設值是該型別接受的（錯的預設值讓子圖變成 Ghost，建置卻放行）。
  for (const f of subgraphs) {
    if (!validInterface(f)) throw fail('An interface uses an unknown type: ' + f.libraryId);
    try { requireSubgraph(contextFor(shelf, f)); } catch (error) { throw fail('Invalid interface ' + f.libraryId + ': ' + (error as Error).message); }
  }
  if (subgraphGroups(shelf, registry).cyclic.size) throw fail('The file holds a cycle of subgraphs');
  if ((closureOrder(shelf, registry, 'L0')?.length ?? 0) !== subgraphs.length) throw fail('The file holds a dependency nothing uses');
  for (const f of subgraphs) {
    const uses = usesOf(shelf, registry, f.id), was = stored.get(f.id)!;
    const same = (a: unknown, b: string[]) => Array.isArray(a) && a.length === b.length && b.every(x => a.includes(x));
    if (!same(was.stages, uses.stages) || !same(was.targets, uses.targets)) throw fail('Stored stages or targets do not match the content: ' + f.libraryId);
  }
  return { shelf, root: 'L0' };
}

/** Bring a read file's subgraph into a graph, the way a person pulls it in: the entry rule (amendment 3 C4) with the file as the batch.
 * Returns the in-graph ID now holding the subgraph. 把讀好的檔的子圖帶進圖，和使用者拉入的方式一樣：進圖規則（附錄三 C4），檔就是那一批。
 * 回傳現在放這份子圖的圖內 ID。 */
export function bringInLibraryFile(graph: GraphDocument, read: { shelf: Graph; root: string }, next: AllocateSubgraphId, choice: EntryChoice = {}, at = now()): string {
  const needed = (closureOrder(read.shelf, graph.registry, read.root) ?? []).map(f => f.id);
  const ids = applyLibraryEntry(graph, planLibraryEntry(graph.document, read.shelf, needed, graph.registry, choice, at), next);
  return ids.get(read.root)!;
}

/** What the build checks of one built-in file, and its wire-drop row (D-2; Codex R121): read and checked; already in the form saving
 * writes (so the file packed is the file read); brought into an empty graph the way a person pulls it; compiled there with every
 * definition of its closure usable. Throws on the first failure. `empty` is the default graph; `compiler` the code generator.
 * 建置對一個內建檔的檢查與它的拉線接線列：讀檔驗證；已經是存檔寫出的樣子（打包的檔就是讀到的檔）；照使用者拉入的方式帶進空圖；在那裡產碼，
 * 閉包裡每份定義都可用。遇到第一個失敗就丟出。 */
export function verifyLibraryFile(file: LibraryFile, registry: Registry, empty: Graph,
    compiler: { compile(g: Graph, rules: unknown): unknown; unusableSubgraphs(g: Graph): ReadonlySet<string> }, rules: unknown):
    { output: Record<string, WireFit>; input: Record<string, WireFit> } {
  const read = readLibraryFile(file, registry);
  if (!equal(copy(saveLibraryFile(read.shelf, registry, read.root, () => { throw fail('A definition has no Library ID'); })), copy(file)))
    throw fail('The file is not in the form saving writes; save it again');
  let made = 0, root = '';
  const after = new GraphDocument(copy(empty), registry).change(m => {
    root = bringInLibraryFile(m, read, () => 'library' + ++made, {}, '2000-01-01T00:00:00.000Z');
    m.networks.get('pixel')!.instantiateSubgraph(root, 'probe', { x: 0, y: 0 });
  }).after;
  compiler.compile(after, rules);
  const unusable = compiler.unusableSubgraphs(after), brought = closureOrder(after, registry, root) ?? [];
  if (brought.some(f => unusable.has(f.id))) throw fail('A definition cannot be used: ' + brought.filter(f => unusable.has(f.id)).map(f => f.libraryId).join(', '));
  const probe = after.stages.pixel!.nodes.find(n => n.id === 'probe')!;
  return wireDropRow(registry.get(probe.nodeType)!, probe, [...values.types, ...values.opaque], contextFor(after));
}
