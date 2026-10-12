import { applyNodeChanges, applyEdgeChanges, type NodeChange, type EdgeChange, type Connection, type XYPosition } from '@xyflow/react';
import { core, compiler, requireSupported, parseDocument, type UpgradeChange, type Measure, type StructureProblem, type Graph, type GraphDocument, type Network, type Value, type Bootstrap,
  type Declaration, type NameProblem, type ObjectValue, type ComponentStyle, type Clip, type GraphGroup } from './core';
import { project, type Projection, type FlowNode, type FlowEdge, colorGroupOf } from './projection';
import { HostError, type HostClient, type StateResponse, type UniformStates } from './host';
import { HostSync, checkLoaded, savedMessage, type Compiled, type Delivery, type Link, type SyncStatus } from './host_sync';
import { tr, errorText, type Message } from './text';
import { ReportLog, type Level } from './reports';
import { LiveValues, type LiveMessage } from './live_values';
import { recordSync, type SyncRecord } from './sync_record';

// Handle id of a module-declared spare input. The module owns the command, port key,
// type and limit; this layer only runs that command and wires the declared port.
// 模組宣告的待新增輸入；命令、接孔、型別與上限都屬模組，這裡只執行並接到宣告的接孔。
/** The node type of a TD built-in value (Refactor.41). TD 內建值的節點類型。 */
const TD_VALUE = 'sgrape.builtin.td_value';

export const spareHandle = '__spare__';
/** A node to add (Refactor.54): a node type with its entry's params, or a preset Uniform (its declaration is
 * created the first time, Q61). 要新增的節點：節點種類加入口參數，或預設 Uniform（第一次放時建立宣告）。 */
export type NewNode = { nodeType: string; params: ObjectValue } | { preset: string };
/** The end of a wire being dragged: from an output (a new node's input takes it) or from an input (a new node's
 * output feeds it). 正在拉的線的這一端：從輸出（新節點的輸入接它）或從輸入（新節點的輸出接上它）。 */
/** What an In TOP receives now, as TD tells it (R.61.5). In TOP 現在收到的，TD 說的。 */
// `default`: the default image TD gives an unwired input now (Samples label, `none`), null when wired (61.6).
// default：TD 現在給沒接線輸入的預設圖（Samples 的 label 或 none），接了線是 null。
export type InputInfo = { path: string | null; width: number; height: number; format: string; default?: string | null };
export type WireEnd = { node: string; port: string; side: 'output' | 'input' };
/** Where a dropped wire goes on a new node, and the configuration to create it in (Refactor.77; core wire_drop.ts).
 * 線接到新節點的哪裡、用什麼設定建立（R.77）。 */
export type WireFit = Bootstrap['typeContract']['wireDrop'][string]['output'][string];
/** The wire a new node is made on: the end it starts from, the new node's port, and the configuration it is made in (Refactor.54, 77).
 * 新節點接上的線：從哪一端來、接到新節點哪個接孔、用什麼設定建立（R.54、77）。 */
export type NewWire = { end: WireEnd; port: string; configure?: WireFit['configure'] };
/** Random hex digits from the browser's secure random source. Not `crypto.randomUUID`: that one exists only on a secure page (https or
 * localhost), and the editor is also opened over plain http from another device (Refactor.103.4, human 2026-10-12: pasting on a phone
 * failed with "crypto.randomUUID is not a function"). 瀏覽器安全亂數產生的十六進位字。不用 crypto.randomUUID：它只在安全的頁面（https 或
 * localhost）存在，而編輯器也會從別的裝置用一般 http 打開（R.103.4，人類：手機上貼上失敗）。 */
const randomHex = (digits: number) => Array.from(crypto.getRandomValues(new Uint8Array(Math.ceil(digits / 2))), byte => byte.toString(16).padStart(2, '0')).join('').slice(0, digits);
const newId = () => 'n' + randomHex(32);
/** A new group's ID, for a new group and a pasted one alike. 新群組的 ID，新建與貼上都用。 */
const newGroupId = () => 'g' + randomHex(16);
/** A new declaration's ID. 新宣告的 ID。 */
const newDeclarationId = () => 'd' + randomHex(16);
/** A stored graph read for editing, the one way every graph comes in (Refactor.65, 98): its nodes in their current forms, checked that
 * it can be opened, then its groups tidied (1-2) — checked first, so a graph in another format is refused with its own message
 * instead of failing while being tidied. Nothing changed gives the same object back, so a caller can tell (useRemote).
 * 讀進來編輯的圖，每一條讀圖的路都走這裡（R.65、98）：節點換成目前的寫法、檢查能不能打開、再整理群組（1-2）——先檢查，別種格式的圖
 * 會照它自己的訊息被拒絕，而不是整理時壞掉。什麼都沒改就回傳同一個物件，呼叫的人分得出來（useRemote）。 */
function readStored(stored: Graph) {
  const { graph: read, changes } = core.upgradeGraph(stored, core.nodeUpgrades, core.registry);
  requireSupported(read);
  const tidied = structuredClone(read), groupsFixed = core.groups.tidyGroups(tidied) > 0;
  return { graph: groupsFixed ? tidied : read, changes, groupsFixed };
}
/** Said when groups were tidied on opening; it covers every kind of fix (members, repeats, values). 開圖時整理過群組要說的話；
 * 涵蓋各種修正（成員、重複、數值）。 */
const groupsFixedText = () => tr('groups.openFixed', 'Some groups held entries that could not be kept as they were (nodes not in the graph, a node listed twice, or invalid values); they were tidied.');
/** How far Duplicate puts the copy, right and down (legacy graph_ui.js:2429). 複製副本放多遠，往右下（照舊產品）。 */
const DUPLICATE_OFFSET = 48;
// Puts a new node into a document: the one path for adding, also used to rehearse on a discarded candidate.
// 把新節點放進文件：新增的唯一路徑，也用在丟棄的候選文件上預演。
// A preset Uniform's declaration, created the first time it is needed (Q61; Create in the Sources panel, Q61 supplement).
// 預設 Uniform 的宣告，第一次需要時建立（Q61；共用來源面板的 Create）。
function presetDeclaration(document: GraphDocument, entry: string) {
  const preset = core.uniformPresets.find(item => item.entry === entry)!;
  return document.document.declarations.find(d => d.kind === 'uniform' && d.entry === entry)
    ?? document.addDeclaration({ id: newDeclarationId(),
      kind: 'uniform', name: preset.name, type: preset.type, entry });
}
function insertNew(document: GraphDocument, spec: NewNode, position: XYPosition) {
  const net = document.networks.get('pixel')!, id = newId();
  if ('preset' in spec) {
    const declaration = presetDeclaration(document, spec.preset);
    net.insert({ id, nodeType: 'sgrape.builtin.declaration', params: { declarationId: declaration.id }, ui: { ...position } });
  } else net.insert({ id, nodeType: spec.nodeType, params: structuredClone(spec.params), ui: { ...position }, ...nameFor(net, spec.nodeType) });
  return id;
}
/** A new node's name, by the one naming rule (Refactor.76): Split_1, Split_2…; none for a node standing for a shared source.
 * 新節點的名稱，照同一套命名規則（R.76）：Split_1、Split_2…；代表共用來源的節點沒有。 */
function nameFor(net: Network, nodeType: string): { name?: string } {
  if (!core.takesName(core.registry, nodeType)) return {};
  return { name: core.newNodeName(String(core.registry.get(nodeType)!.catalog.definition.label), core.namesIn(net.data)) };
}
class Rehearsed extends Error {}
function wire(net: Network, c: Connection | FlowEdge) {
  if (!c.sourceHandle || !c.targetHandle) throw Error('Missing port');
  let port = c.targetHandle;
  if (port === spareHandle) {
    const node = net.node(c.target), spare = node.definition!.presentation?.(node.data!, net.context)?.spare;
    if (spare?.direction !== 'input' || spare.count >= spare.limit) throw Error('No spare input');
    node.edit(spare.command, {});
    port = spare.key;
  }
  net.connect(net.node(c.source).port('output', c.sourceHandle), net.node(c.target).port('input', port), core.values.policy);
}
// The wires of `before` that `after` no longer has (a rehearsal's answer). before 有、after 沒有的線（預演的答案）。
function gone(before: Network, after: Network): string[] {
  const still = new Set(after.data.edges.map(edge => edge.id));
  return before.data.edges.map(edge => edge.id).filter(id => !still.has(id));
}
// Pull an input's wire; the release and its preview share it (Refactor.78.1). 拔掉一個輸入的線；放開與預告共用（R.78.1）。
function unwire(net: Network, node: string, port: string) {
  const edges = net.node(node).port('input', port).edges;
  if (edges.length) net.disconnectAll(edges);
}

// The core reports limits as data (CapacityError.measures); this layer words them (Q34: core sends data, the UI words it).
// 核心以資料回報上限；用語由這一層決定。
const limitName: Record<Measure['key'], Message> = {
  nodesPerNetwork: tr('limit.nodesPerNetwork', 'nodes per network'), edgesPerNetwork: tr('limit.edgesPerNetwork', 'wires per network'),
  expandedNodes: tr('limit.expandedNodes', 'nodes after subgraph expansion'), subgraphDefinitions: tr('limit.subgraphDefinitions', 'subgraph definitions') };
const limitText = (measures: readonly Measure[]) => measures.map(m =>
  tr('limit.measure', '{name} {value}/{limit}', { name: limitName[m.key], value: m.value, limit: m.limit }));
// Identified by name and data, not instanceof: the core may come from another script realm.
const capacityMessage = (error: unknown) => {
  const measures = (error as { name?: string; measures?: Measure[] } | null)?.name === 'CapacityError' ? (error as { measures?: Measure[] }).measures : undefined;
  return measures ? tr('limit.reached', 'Limit reached; this change was not applied: {limits}', { limits: limitText(measures) }) : undefined;
};
// Structure rules (Q42) arrive as data as well. 結構規則同樣以資料回報。
const structureText = (problems: readonly StructureProblem[]) => problems.map(p => p.expected === 0
  ? tr('structure.outputInSubgraph', 'a subgraph cannot contain a Color Output')
  : p.value === 0 ? tr('structure.outputMissing', 'the graph needs one Color Output')
  : tr('structure.outputTooMany', 'only one Color Output is allowed (now {count})', { count: p.value }));
const structureMessage = (error: unknown) => {
  const problems = (error as { name?: string; problems?: StructureProblem[] } | null)?.name === 'StructureError' ? (error as { problems?: StructureProblem[] }).problems : undefined;
  return problems ? tr('structure.refused', 'This change was not applied: {problems}', { problems: structureText(problems) }) : undefined;
};

// Declaration problems arrive as data too (declarations.ts). 宣告的問題同樣以資料回報。
const nameProblem = (problem: NameProblem, name: string) => problem === 'taken'
  ? tr('sources.nameTaken', 'The name {name} is already used by another shared source.', { name })
  : problem === 'reserved' ? tr('sources.nameReserved', '{name} is reserved by GLSL or TouchDesigner.', { name })
  : tr('sources.nameFormat', '{name} is not a valid name: start with a letter, then letters, digits or _ (no __).', { name });
const declarationMessage = (error: unknown) => {
  const e = error as { name?: string; problem?: string; subject?: string } | null;
  if (e?.name !== 'DeclarationError') return undefined;
  return ['taken', 'reserved', 'format'].includes(e.problem!) ? nameProblem(e.problem as NameProblem, e.subject ?? '')
    : tr('sources.declarationProblem', 'This change to a shared source was not applied ({problem}).', { problem: String(e.problem) });
};
const noteKey = (graph: Graph) => JSON.stringify(Object.values(graph.stages).concat((graph.subgraphs || []).map(f => f.graph))
  .map(net => net?.nodes.map(n => n.comment)));

// message is data (a Message), worded only when shown (Q34); level says how serious it is (Q35).
// declarations: the document's own frozen list (no copy); references: how many nodes use each one.
// TD's Uniform states are kept apart (tdSnapshot): they change every frame while TD moves a value, and
// only the fields showing them need to follow. TD 的 Uniform 現況另外存（tdSnapshot）：TD 動值時每格都變，只有顯示它的欄位要跟。
// glslMap: which node wrote each line of the GLSL (the core's source map, lines from 1), so a line leads to its node
// (Refactor.63). glslMap：GLSL 每一行由哪個節點產生（核心的 sourceMap，行號從 1），讓一行能找回它的節點。
// glslVariables: which node each variable belongs to, so its name in the GLSL is a link to the node (human 2026-10-10).
// glslVariables：每個變數屬於哪個節點，GLSL 裡的名字就是連到節點的超連結（人類）。
// upgrades: nodes the node upgrades changed when this graph was read (Refactor.65), for the replacement report; cleared when
// dismissed. upgrades：讀圖時被節點升級換掉的節點（替換報告用）；關掉就清空。
// glslDeclarations: which declaration each name written at the top of the GLSL is (Refactor.63.4), so its name selects every
// node using it. glslDeclarations：GLSL 檔頭寫出的名字是哪個宣告，點名字就選取所有引用它的節點。
export type GlslLine = { line: number; node: string };
export type EditorState = SyncStatus & { projection: Projection; version: number; undo: boolean; redo: boolean;
  message: Message | string; level: Level; glsl: string; glslMap: readonly GlslLine[];
  glslVariables: Readonly<Record<string, string>>; glslDeclarations: Readonly<Record<string, string>>; targetPath: string;
  upgrades: readonly UpgradeChange[];
  /** A save this page asked for has no answer yet (Refactor.75.13): the button waits, so pressing again does not ask
   * again. 這一頁要求的存檔還沒有回覆：按鈕等著，再按不會再要求一次。 */
  saving?: boolean;
  /** The sync state's own short record (Refactor.70.1, sync_record.ts). 同步狀態自己的短紀錄。 */
  syncRecords: readonly SyncRecord[];
  declarations: readonly Declaration[]; references: Readonly<Record<string, number>> };

// Coordinates editing: hands edits to the core, keeps the current document, Undo and editing
// state, compiles every finished edit, and hands the result to HostSync (design-interview Q38).
// Code generation no longer waits for delivery, so it keeps working while TD is away (Q28).
// 編輯協調者：把編輯交給核心、保管目前的作品／Undo／編輯狀態、每次修改完成即產碼，再交給 HostSync。
// 產碼不再等送出，TD 不在時照樣更新。
/** What dropping a wire on an input would change (Refactor.57, 76.16). 線放在某個輸入上會改變什麼。 */
export type WirePreview = { node: string; port: string; type: string; merged: string[]; replaced: string[] };

/** How a node names its vector components, and how many it has; null when its own type is not a vector (Refactor.85; legacy
 * inspector.js:1358: the node's type, or its source's): a node whose names are fixed by its kind (Split RGBA, Compose RGBA, TD
 * values) has no choice. Inputs and outputs alike (human 2026-10-11: input components show here, legacy's did not). One rule for
 * the Settings tab and for a node made from a wire. 節點怎麼稱呼向量分量、有幾個分量；自己的型別不是向量時是 null（R.85；照舊產品：
 * 節點的型別，或它引用的來源的型別）：名稱由種類寫死的節點（Split RGBA、Compose RGBA、TD 內建值）沒有選擇。輸入輸出都適用（人類 10-11：
 * 這裡看得到輸入的分量，舊產品看不到）。設定分頁與拉線新增用同一條規則。 */
function namesOf(net: Network, id: string, declarations: readonly Declaration[]): { style: ComponentStyle; count: number } | null {
  const node = net.node(id), module = node.definition;
  if (!node.data || !module || module.componentNamesFixed) return null;
  // Its own type: the one chosen, else its source's, else what it gives (a fixed vec3 value). 自己的型別：選的、否則來源的、否則輸出的（固定的 vec3 值）。
  const source = module.referencedDeclaration?.(node.data);
  const type = String(node.data.params.type ?? declarations.find(d => d.id === source)?.type ?? node.outputs[0]?.type ?? '');
  const count = core.values.types.includes(type) ? core.values.count(type) : 0;
  return count > 1 ? { style: core.componentStyle(module, node.data, net.context), count } : null;
}

export class Editor {
  private document: GraphDocument;
  private state: EditorState;
  private listeners = new Set<() => void>();
  private past: Graph[] = [];
  private future: Graph[] = [];
  private codegen: Delivery;
  private disposed = false;
  private readonly sync: HostSync;
  // Uniform values go to TD the moment they change (Uniform C, Q53). Uniform 的值一改就送到 TD。
  private readonly live: LiveValues;
  private uniformValues = new Map<string, string>();
  // The code generator is received when created (config convention 4); omitted means the shared one.
  // 產碼器在建立時傳入（config 約定 4）；沒給就用共用的那個。測試用它模擬產碼失敗。
  // Every message also goes to the report log (Q35: the page makes one log and shares it).
  // 每則訊息也寫進回報紀錄（頁面建立一份、共用）。
  constructor(readonly host: HostClient, readonly bootstrap: Bootstrap, loaded: StateResponse, delay = 0, retry = 5000,
    private readonly generator: Pick<typeof compiler, 'key' | 'compile'> = compiler, editorVersion = 'unknown',
    readonly log = new ReportLog()) {
    checkLoaded(host, bootstrap, loaded);
    // Groups that need tidying are tidied on opening, said, and sent like an upgrade (design-interview 1-2).
    // 需要整理的群組在開圖時整理、說出來，像升級一樣送出（1-2）。
    const { graph, changes: upgrades, groupsFixed } = readStored(parseDocument(loaded.state.document));
    this.document = new core.GraphDocument(graph, core.registry);
    this.td = loaded.uniforms ?? {};
    // The live connection also tells, before anything is sent, that TD is gone or not answering (Refactor.71).
    // 即時連線也會在送出之前就說出 TD 不在或沒回應（R.71）。
    this.live = new LiveValues(host.live, message => this.liveMessage(message), (connected, code) => this.liveLinked(connected, code),
      { answering: responding => responding ? this.sync.found() : this.sync.lost('busy') });
    // This device losing its network is the browser's to say (Refactor.75). 這台裝置沒網路由瀏覽器說。
    if (typeof window !== 'undefined') { addEventListener('offline', this.deviceOffline); addEventListener('online', this.deviceOnline); }
    this.uniformValues = this.readUniformValues();
    this.codegen = this.compile();
    this.sync = new HostSync(host, bootstrap, loaded, () => this.codegen,
      (status, said) => this.status({ ...status, ...said,
        syncRecords: recordSync(this.state.syncRecords, this.state, status, said?.message, Date.now()) }, 'sync'), delay, retry, editorVersion);
    this.state = { ...this.sync.status, projection: project(this.document, { nodes: [], edges: [] }, bootstrap.typeContract),
      version: 0, undo: false, redo: false, message: '', level: 'info', glsl: this.codegen.compiled?.pixel ?? '',
      glslMap: this.glslMap() ?? [], glslVariables: this.codegen.compiled?.sourceMap.variables ?? {},
      glslDeclarations: this.codegen.compiled?.sourceMap.declarations ?? {}, targetPath: loaded.target, upgrades: [],
      syncRecords: recordSync([], null, this.sync.status, undefined, Date.now()), ...this.sources() };
    // TD-Grape's notices are said as they are, by TD-Grape (Q58). TD-Grape 的提醒照原樣、以 TD-Grape 的名義說。
    this.sync.onTd = (uniforms, notices) => {
      if (uniforms) this.setTd(uniforms);
      for (const notice of notices) this.status({ message: notice, level: 'warning' }, 'td');
    };
    this.tell('info', tr('edit.loaded', 'Loaded the graph from TD'));
    // Upgraded as it was read: reported, then sent like any edit so TD stores the current form (human 2026-10-10).
    // 讀圖時升級過：報告，再照一般編輯送出，讓 TD 存成目前的寫法（人類）。
    if (upgrades.length) this.reportUpgrades(upgrades);
    if (groupsFixed) this.tell('warning', groupsFixedText());
    if (upgrades.length || groupsFixed) { this.sync.upgraded(); this.state = { ...this.state, dirty: this.sync.status.dirty }; }
    // Opening never refuses an over-limit graph; it warns, and only growth is blocked (capacity.ts).
    // 開圖不拒絕超過上限的圖；只警告，修改時只擋「變大」。
    const over = core.overLimit(graph, core.registry);
    if (over.length) this.tell('warning', tr('limit.openWarning',
      'Warning: this graph is over the limit and cannot be compiled now; you can trim it and continue: {limits}', { limits: limitText(over) }));
    const broken = core.structureProblems(graph, core.registry);
    if (broken.length) this.tell('warning', tr('structure.openWarning',
      'Warning: this graph breaks the structure rules; you can fix it and continue: {problems}', { problems: structureText(broken) }));
    this.ghostTotal = this.reportGhosts(0);
  }
  /** Read a stored graph in its current node forms (Refactor.65): every way a graph comes in goes through here.
   * 把存著的圖讀成目前的節點寫法：每一條讀圖的路都經過這裡。 */
  private upgrade(graph: Graph): Graph {
    // With the registry: nodes made before names were given get one (Refactor.76). 帶 registry：給名字之前做的節點補上名字（R.76）。
    const { graph: read, changes, groupsFixed } = readStored(graph);
    if (changes.length) this.reportUpgrades(changes);
    if (groupsFixed) this.tell('warning', groupsFixedText());
    return read;
  }
  // The replacement report (Refactor.65, human 2026-10-10): a floating notice that names each node and leads to it, and one
  // log entry. 替換報告（人類）：逐一列出、可點到節點的浮動提示，以及一筆訊息紀錄。
  private reportUpgrades(changes: readonly UpgradeChange[]) {
    this.state = { ...this.state, upgrades: changes };
    this.tell('info', tr('upgrade.report', 'Updated {count} node(s) to their current form: {list}',
      { count: changes.length, list: changes.map(change => change.note) }));
  }
  dismissUpgrades = () => { this.state = { ...this.state, upgrades: [] }; this.publish(); };
  // Ghosts (Q37): said when the graph opens with some, and whenever an edit adds more.
  // Ghost：開圖時有就說；修改讓 Ghost 變多時也說。
  private ghostTotal = 0;
  private reportGhosts(previous: number) {
    const ghosts = core.ghostsOf(this.document.networks.get('pixel')!, core.values.policy);
    const total = ghosts.nodes.size + ghosts.edges.size;
    if (total > previous) this.tell('warning', tr('ghost.found',
      'This graph has {nodes} ghost node(s) and {wires} ghost wire(s): kept as they are and left out of the shader; a ghost wire counts as not connected.',
      { nodes: ghosts.nodes.size, wires: ghosts.edges.size }));
    return total;
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  // TD's Uniform states (Uniform D1, D2): from replies, then live from the WebSocket. Values are data:
  // they never reach the status line or the log. TD 的 Uniform 現況：來自回覆，之後由 WebSocket 即時更新；數值是資料，不進狀態列或 log。
  private td: UniformStates;
  private tdListeners = new Set<() => void>();
  tdSubscribe = (listener: () => void) => { this.tdListeners.add(listener); return () => { this.tdListeners.delete(listener); }; };
  tdSnapshot = () => this.td;
  private setTd(td: UniformStates) {
    this.td = td;
    if (!this.disposed) this.tdListeners.forEach(listener => listener());
  }
  // What each texture input has wired in, in TD (Refactor.60): asked when the Sources panel shows inputs, when TD says a
  // Grape OP was rewired, and when a snapshot is retaken. `inputsTaken` tells previews to take a new snapshot.
  // 每個貼圖輸入在 TD 接了什麼：共用來源面板顯示輸入時、TD 說重新接線時、重拍快照時才問。inputsTaken 讓預覽重拍。
  // Each input's In TOP name (in1…), the OP wired into it (null when nothing is), and what the In TOP receives now: from
  // which TOP, size and format (R.61.5). 每個輸入的 In TOP 名字、接進來的 OP（沒接是 null），以及 In TOP 現在收到的：來源、尺寸、格式。
  private inputs: Readonly<Record<string, Readonly<{ node: string; source: string | null; info: InputInfo | null }>>> | null = null;
  private inputsTaken = 0;
  private readonly inputListeners = new Set<() => void>();
  inputsSubscribe = (listener: () => void) => { this.inputListeners.add(listener); return () => { this.inputListeners.delete(listener); }; };
  inputsSnapshot = () => this.inputs;
  inputsTake = () => this.inputsTaken;
  // New snapshots when asked to (rewired, connected again) or when what is wired in changed (R.61.5); not after every apply.
  // 要求時（重新接線、重新連上）或接的東西變了才重拍；不是每次套用都重拍。
  refreshInputs = async (retake = true) => {
    try {
      const result = await this.host.call<{ inputs: { id: string; node: string; source: string | null; info?: InputInfo | null }[] }>('inputs');
      if (this.disposed) return;
      const before = this.inputs;
      this.inputs = Object.fromEntries(result.inputs.map(input => [input.id, { node: input.node, source: input.source, info: input.info ?? null }]));
      if (retake || !before || Object.entries(this.inputs).some(([id, input]) => before[id]?.source !== input.source)) this.inputsTaken++;
      this.inputListeners.forEach(listener => listener());
    } catch { /* TD away: the previews say so when they ask 連不到 TD：預覽自己會說 */ }
  };
  private liveMessage(message: LiveMessage) {
    if (message.type === 'inputs') { void this.refreshInputs(message.retake !== false); return; }
    if (message.type === 'refused') {
      this.status({ message: tr('live.refused', 'TD-Grape can no longer read this Grape OP in TD: {reason}', { reason: message.message }), level: 'error' }, 'td');
      return;
    }
    // The project was saved in TD (Refactor.71): every save says so here, whoever asked and however long it took
    // (Refactor.75.12). 在 TD 存檔了：每一次存檔都由這裡說，不管是誰要求、存了多久（R.75.12）。
    if (message.type === 'saved') {
      if (message.projectSaved) this.sync.savedInTd(message.projectSaved);
      this.status({ message: savedMessage(message.file, this.state), level: 'info' }, 'td');
      return;
    }
    if (message.type === 'state') { this.setTd(message.uniforms); return; }
    const next: Record<string, UniformStates[string]> = { ...this.td };
    for (const [id, values] of Object.entries(message.values)) {
      const states = next[id];
      if (!states) continue;
      next[id] = states.map((state, i) => values[i] === null || values[i] === undefined ? state : { ...state, value: values[i]! });
    }
    this.setTd(next);
  }
  // Disconnected: TD's values may go stale, so the fields fall back to the graph's (modes stay).
  // 斷線：TD 的值可能過時，欄位改回顯示圖裡的值（模式保留）。
  // Connected again: rewiring while away sent no word, so the inputs are asked once if they were asked before (R.61.1).
  // 重新連上：斷線期間的接線改變沒有通知，之前問過輸入的話就再問一次。
  private deviceOffline = () => this.sync.lost('device');
  private deviceOnline = () => this.sync.found();
  private liveLinked(connected: boolean, code?: number) {
    if (connected) { this.sync.found(); if (this.inputs) void this.refreshInputs(); return; }
    // Why it closed, as TD said in the close frame (editor_service.CLOSED_*); nothing said is "unreachable" (Refactor.75).
    // TD 在關閉訊框裡說的原因；沒說就是連不到。
    const told: Record<number, Link> = { 4001: 'closed', 4002: 'stopped', 4003: 'reloading', 4004: 'deleted' };
    this.sync.lost(told[code ?? 0] ?? (typeof navigator !== 'undefined' && navigator.onLine === false ? 'device' : 'unreachable'));
    const withoutValue = ({ value: _, ...rest }: UniformStates[string][number]) => rest;
    this.setTd(Object.fromEntries(Object.entries(this.td).map(([id, states]) => [id, states.map(withoutValue)])));
  }
  // What the editor just sent is shown at once where TD will take it; TD's echo confirms it.
  // 剛送出的值先顯示在 TD 會收下的分量；TD 回傳後確認。
  private sentLive(id: string, value: Value) {
    const states = this.td[id];
    if (!states) return;
    const values = Array.isArray(value) ? value : [value];
    this.setTd({ ...this.td, [id]: states.map((state, i) => (state.mode === 'constant' || (state.mode === 'bind' && state.editable !== false))
      && typeof values[i] === 'number' ? { ...state, value: values[i] as number } : state) });
  }
  snapshot = () => this.state;
  graph = () => this.document.snapshot();
  /** The graph's stages, in the order the editor shows them (Refactor.53: only the ones the graph has).
   * 這張圖有的 Stage，照編輯器顯示的順序（只列圖裡有的）。 */
  stageNames = () => ['vertex', 'pixel'].filter(name => name in this.document.document.stages);
  private publish() { this.keepPrimary(); this.keepWireKey(); if (!this.disposed) this.listeners.forEach(listener => listener()); }
  private status(patch: Partial<EditorState>, source = 'editor') {
    if (patch.message) this.log.add(patch.level ?? 'info', patch.message, source);
    this.state = { ...this.state, ...patch }; this.publish();
  }
  private tell(level: Level, message: Message | string) { this.status({ message, level }); }
  /** Something the person tried did not happen, nothing broke (Refactor.75.8: a refused wire is a warning, not an error).
   * 使用者想做的事沒有發生、但沒有東西壞掉（R.75.8：接線被拒絕是警告，不是錯誤）。 */
  warn = (message: Message) => this.tell('warning', message);
  private sources() {
    const references: Record<string, number> = {};
    for (const node of this.document.document.stages.pixel?.nodes ?? []) {
      // A declaration by its ID; a TD value by `tdValue:` and its entry (Refactor.58.1: TD value cards count too).
      // 宣告用 ID；TD 內建值用「tdValue:」加 entry（TD 內建值卡片也有數量）。
      const id = core.registry.get(node.nodeType)?.referencedDeclaration?.(node)
        ?? (node.nodeType === TD_VALUE ? 'tdValue:' + String(node.params.entry) : undefined);
      if (id !== undefined) references[id] = (references[id] ?? 0) + 1;
    }
    return { declarations: this.document.document.declarations, references };
  }
  notice = (error: unknown) => {
    const declaration = declarationMessage(error);
    if (declaration) { this.tell('warning', declaration); return; }
    const limit = capacityMessage(error) ?? structureMessage(error);
    this.tell(limit ? 'warning' : 'error', limit ?? errorText(error));
  };
  // Skips code generation when neither the fingerprint nor the notes changed (e.g. moving a node).
  // Notes only add GLSL comment lines: they refresh the GLSL shown here, never TD's program (rule B).
  // 指紋與註記都沒變（例如移動節點）就不產碼；註記只影響這裡顯示的 GLSL 註解，不讓 TD 重編（規則 B）。
  private notes = '';
  private compile(): Delivery {
    const graph = this.document.snapshot(), key = this.generator.key(graph), notes = noteKey(graph);
    if (this.codegen && key === this.codegen.key && notes === this.notes) return { ...this.codegen, graph };
    this.notes = notes;
    try { return { graph, key, compiled: this.generator.compile(graph, this.bootstrap.typeContract.glslCode) as Compiled }; }
    catch (error) { return { graph, key, error: String(error) }; }
  }

  // Build the entire candidate before committing history or notifying React.
  // 多個 node／edge 改動共用一次發布；任何例外都不留下半份作品。
  transact = (label: Message, edit: (network: Network) => void) =>
    this.transactGraph(label, candidate => edit(candidate.networks.get('pixel')!));
  // Edits at the document level (declarations) go through the same single path. 文件層級的修改走同一條路。
  transactGraph = (label: Message, edit: (document: GraphDocument) => void) => {
    try {
      const result = this.document.change(edit);
      if (!result.changes.changed) return;
      const next = new core.GraphDocument(result.after, core.registry);
      requireSupported(result.after);
      const projection = project(next, this.state.projection, this.bootstrap.typeContract, result.changes);
      this.past.push(result.before); if (this.past.length > 100) this.past.shift();
      this.future = []; this.document = next;
      this.commit(projection, label);
    } catch (error) { this.notice(error); }
  };
  // Every finished edit is compiled here, then offered to HostSync.
  // 每次修改完成都在這裡產碼，再交給 HostSync。
  private commit(projection: Projection, label: Message) {
    this.sendChangedUniforms();
    this.codegen = this.compile();
    const failed = this.codegen.error === undefined ? undefined : tr('edit.codegenFailed', 'Code generation failed: {reason}', { reason: this.codegen.error });
    if (!this.sync.blocked) this.log.add(failed ? 'warning' : 'info', failed ?? label, 'editor');
    this.state = { ...this.state, projection, version: this.state.version + 1, ...this.sources(),
      undo: !!this.past.length, redo: !!this.future.length,
      glsl: this.codegen.compiled?.pixel ?? this.state.glsl, glslMap: this.glslMap() ?? this.state.glslMap,
      glslVariables: this.codegen.compiled?.sourceMap.variables ?? this.state.glslVariables,
      glslDeclarations: this.codegen.compiled?.sourceMap.declarations ?? this.state.glslDeclarations,
      ...(this.sync.blocked ? {} : { message: failed ?? label, level: failed ? 'warning' as const : 'info' as const }) };
    if (!this.sync.blocked) this.ghostTotal = this.reportGhosts(this.ghostTotal);
    this.sync.changed();
    this.state = { ...this.state, dirty: this.sync.status.dirty };
    this.publish();
  }
  // Any finished edit that changes a Uniform's value (typing, a pick, Undo, a restored draft…) sends it
  // at once; the normal save follows. 任何讓 Uniform 值改變的修改（輸入、點選、Undo…）都立刻送，一般送出跟上。
  private readUniformValues() {
    return new Map(this.document.document.declarations.filter(d => d.kind === 'uniform').map(d => [d.id, JSON.stringify(d.value)]));
  }
  private sendChangedUniforms() {
    const now = this.readUniformValues();
    // A new Uniform is not in TD's program yet; the normal save brings it. 新的 Uniform 還不在 TD 的程式裡，由一般送出帶過去。
    for (const [id, value] of now) {
      const old = this.uniformValues.get(id);
      if (old !== undefined && old !== value) { this.live.send(id, JSON.parse(value) as Value); this.sentLive(id, JSON.parse(value) as Value); }
    }
    this.uniformValues = now;
  }
  /** While a value is being dragged: TD only, never the graph or Undo (Q41 3-4). 拖曳中：只送 TD，不改圖、不進 Undo。 */
  previewDeclarationValue = (id: string, value: Value) => {
    const declaration = this.document.document.declarations.find(d => d.id === id);
    if (declaration?.kind !== 'uniform') return;
    try { core.values.literal(value, declaration.type); } catch { return; }
    this.live.send(id, value);
    this.sentLive(id, value);
  };
  edit = (id: string, command: string, value: Value) => this.transact(tr('edit.valueChanged', 'Value updated; waiting to apply'),
    net => net.node(id).edit(command, value));
  setInput = (id: string, key: string, value: Value) => this.transact(tr('edit.inputChanged', 'Input value updated; waiting to apply'), net => {
    core.values.literal(value, net.node(id).port('input', key).type!);
    net.node(id).setInput(key, value);
  });
  configure = (id: string, type: string) => this.transact(tr('edit.typeChanged', 'Type updated'), net => net.node(id).configure({ type }));
  /** Rename a node from what was typed (Refactor.76, human 2026-10-11): spaces become underscores; a taken name moves up to the
   * next free number, as a new node or a copy would (one rule, as TD); a name GLSL cannot use is refused and said. One Undo step.
   * 依輸入改名（R.76，人類）：空白變底線；撞名時往上加到沒人用的號碼，和新增、複製同一套（照 TD）；GLSL 用不了的名稱拒絕並說明。一步 Undo。 */
  rename = (id: string, typed: string) => {
    const name = core.storedName(typed), current = this.document.networks.get('pixel')!.node(id).data?.name;
    if (!name || name === current) return;
    if (!core.validNodeName(name, this.bootstrap.typeContract.glslCode.reservedNames)) {
      this.warn(tr('name.invalid', 'A node name starts with a letter, cannot start with gl_, TD or sg_, and cannot be a GLSL word: {name}', { name: core.shownName(name) }));
      return;
    }
    this.transact(tr('edit.renamed', 'Node renamed'), net => {
      const taken = core.namesIn(net.data);
      if (current !== undefined) taken.delete(current);
      net.node(id).update({ name: core.freeName(name, taken) });
    });
  };
  /** A node's component names and count, or null (see namesOf). 節點的分量名稱與分量數，或 null（見 namesOf）。 */
  componentNamesOf = (id: string) => namesOf(this.document.networks.get('pixel')!, id, this.document.document.declarations);
  /** Name a node's vector components (Refactor.85; legacy inspector.js:1358): appearance only, kept in the graph, one Undo; the
   * node's own default is kept as nothing, so the graph only records a choice. 設定節點的分量名稱（R.85；照舊產品）：只是外觀、存在
   * 圖裡、一次 Undo；選回節點自己的預設就不記，圖裡只記真正的選擇。 */
  setComponentNames = (id: string, style: ComponentStyle) => {
    if (!core.componentStyles.includes(style) || this.componentNamesOf(id)?.style === style) return;
    this.transact(tr('edit.componentNames', 'Component names changed'), net => {
      const node = net.node(id), { componentNames: _, ...ui } = node.data!.ui ?? {};
      const fallback = core.componentStyle(node.definition, { ...node.data!, ui }, net.context);
      node.update({ ui: style === fallback ? ui : { ...ui, componentNames: style } });
    });
  };
  /** A node's note (Refactor.76; the graph's `comment`). 節點的註記（R.76；圖裡的 comment）。 */
  setNote = (id: string, text: string) => {
    if ((this.document.networks.get('pixel')!.node(id).data?.comment ?? '') === text) return;
    this.transact(tr('edit.noteChanged', 'Note updated'), net => net.node(id).update({ comment: text }));
  };
  // `params` come from the menu entry the module declared (Q37 1-5); the graph does not record the entry.
  // params 來自模組宣告的入口；圖不記錄來自哪個入口。
  add = (uuid: string, position: XYPosition, params: ObjectValue = {}) => this.addNode({ nodeType: uuid, params }, position);
  /** Adds a node, and wires it to the dragged wire's end when given (one step, one Undo; Refactor.54).
   * 新增節點；有給拉線的那一端就順便接上（一步、一次 Undo）。 */
  addNode = (spec: NewNode, position: XYPosition, wire?: NewWire) =>
    this.transactGraph(tr('edit.nodeAdded', 'Node added'), document => { this.insertWired(document, spec, position, wire); });
  /** What adding this node (wired when given) would draw, rehearsed on a discarded candidate with the same edit as addNode
   * (Refactor.105: place a node): the new node and the wires touching it, as the canvas draws them. null: adding it fails.
   * 新增這個節點（有給線就接上）會畫出什麼，用和 addNode 同一個修改在丟棄的候選上預演（R.105：放置節點）：新節點與碰到它的線，
   * 照畫布畫的樣子。null＝新增會失敗。 */
  placementPreview = (spec: NewNode, wire?: NewWire) => this.rehearse(document => {
    const id = this.insertWired(document, spec, { x: 0, y: 0 }, wire), drawn = project(document, this.state.projection, this.bootstrap.typeContract);
    const node = drawn.nodes.find(item => item.id === id);
    return node ? { node, edges: drawn.edges.filter(edge => edge.source === id || edge.target === id) } : null;
  });
  private insertWired(document: GraphDocument, spec: NewNode, position: XYPosition, wire?: NewWire) {
    const id = insertNew(document, spec, position), net = document.networks.get('pixel')!;
    if (!wire) return id;
    const { end, port, configure } = wire;
    // Made in the configuration the wire-drop table chose (e.g. Add as vec4), in the same step (Refactor.77).
    // 用拉線新增表選的設定建立（例如 Add 建成 vec4），同一步完成（R.77）。
    if (configure) net.node(id).configure(configure);
    if (end.side === 'output') net.connect(net.node(end.node).port('output', end.port), net.node(id).port('input', port), core.values.policy);
    else {
      // An input takes one wire: the new one replaces whatever was there. 輸入只接一條：新線取代原本的。
      const old = net.node(end.node).port('input', end.port).edges;
      if (old.length) net.disconnectAll(old);
      net.connect(net.node(id).port('output', port), net.node(end.node).port('input', end.port), core.values.policy);
    }
    // A node made from a wire takes the component names of the node at the other end, in the same step (Refactor.59; legacy
    // graph_ui.js:2346 did it for vector nodes). Trial (Refactor.85.2, human 2026-10-11: try it): every node that has names to
    // choose, by the same rule as the Settings tab, not only vector nodes; the default is not stored.
    // 由拉線新增的節點沿用另一端節點的分量名稱，同一步完成（R.59；舊產品只給向量節點）。試驗（R.85.2，人類：試試看）：凡是有分量名稱可選的節點
    // 都沿用，規則和設定分頁同一條，不只向量節點；預設不記。
    const made = net.node(id), peer = net.node(end.node);
    if (made.data && peer.data && namesOf(net, id, this.document.document.declarations)) {
      const style = core.componentStyle(peer.definition, peer.data, net.context), { componentNames: _, ...ui } = made.data.ui ?? {};
      made.update({ ui: style === core.componentStyle(made.definition, { ...made.data, ui }, net.context) ? ui : { ...ui, componentNames: style } });
    }
    return id;
  }
  /** Where a dropped wire would go on a new node made from this choice (Refactor.77, design-interview Q37 1-5 supplement):
   * looked up in the table the build wrote with the real rules; choices only the document knows (declared sources,
   * preset Uniforms, TD values) are still rehearsed below until the same table is made for a document. null: it does not fit.
   * 線接到由這個選項新增的節點哪裡（R.77，Q37 1-5 補充）：查建置時用真正規則寫好的表；只有作品知道的選項（宣告的來源、預設 Uniform、
   * TD 內建值）先照下面的方式預演，等之後為作品算同一份表。null＝接不上。 */
  wireFit = (id: string, spec: NewNode, end: WireEnd): WireFit | null => {
    const row = this.bootstrap.typeContract.wireDrop[id];
    if (!row) return this.portFor(spec, end);
    const net = this.document.networks.get('pixel')!;
    const type = net.node(end.node).interface[end.side === 'output' ? 'outputs' : 'inputs'][end.port]?.type;
    return (type && row[end.side][type]) || null;
  };
  /** The colour group a new node would have, rehearsed on a discarded candidate (Refactor.104: the drag-to-add tile). 新節點會是哪個
   * 顏色組，在丟棄的候選文件上預演（R.104：拖曳新增的圖塊）。 */
  newNodeColor = (spec: NewNode): string | null => this.rehearse(document => {
    const id = insertNew(document, spec, { x: 0, y: 0 }), node = document.networks.get('pixel')!.node(id);
    return node.definition ? colorGroupOf(node.definition, node.data!, document) : null;
  });
  /** Which port of a new node would take this wire, rehearsed on a discarded candidate so the answer follows the
   * same rules as the real edit (Refactor.54; no separate core question). A port of exactly the wire's type comes
   * first. null: it does not fit. 新節點的哪個接孔能接這條線：在丟棄的候選文件上預演，答案與真正的修改同一套規則；
   * 型別完全相同的優先。null＝接不上。 */
  portFor = (spec: NewNode, end: WireEnd): { port: string; type: string } | null => this.rehearse(document => {
    const id = insertNew(document, spec, { x: 0, y: 0 }), net = document.networks.get('pixel')!;
    const there = net.node(end.node).interface[end.side === 'output' ? 'outputs' : 'inputs'][end.port]?.type;
    const ports = Object.entries(net.node(id).interface[end.side === 'output' ? 'inputs' : 'outputs']);
    const fits = ports.filter(([key]) => net.plan(core.values.policy, { kind: 'wire',
      ...(end.side === 'output' ? { from: { node: end.node, port: end.port }, to: { node: id, port: key } }
        : { from: { node: id, port: key }, to: { node: end.node, port: end.port } }) }).ok);
    const best = fits.find(([, port]) => port.type === there) ?? fits[0];
    return best ? { port: best[0], type: best[1].type } : null;
  });
  /** Run an edit on a discarded candidate and return what it reports; nothing is kept, nothing is published. The one way
   * this session asks "what would happen" (Create node's ports, the drag preview). null: the edit failed.
   * 在丟棄的候選上跑一次修改、回傳它報告的結果；什麼都不留、不發布。這個 session 問「會發生什麼」只走這一條（新增節點的接孔、
   * 拖線預告）。null＝修改失敗。 */
  private rehearse<T>(edit: (candidate: GraphDocument) => T): T | null {
    const out: { value?: T } = {};
    try { this.document.change(candidate => { out.value = edit(candidate); throw new Rehearsed(); }); }
    catch (error) { if (!(error instanceof Rehearsed)) return null; }
    return out.value ?? null;
  }
  // Shared sources (Refactor.40; Q41, Q45): global constants for now. 共用來源：本輪只有全域常數。
  addConstant = () => {
    const name = core.freeLegacyName(this.document.document, 'cValue'); // legacy default name 舊產品的預設名
    this.transactGraph(tr('sources.added', 'Constant {name} added', { name }), document =>
      document.addDeclaration({ id: newDeclarationId(), kind: 'constant', name, type: 'float' }));
  };
  // Uniforms (Refactor.44, D1): a colour or not is chosen when it is added and never switched (Q59: the
  // Colors and Vectors pages differ, switching would drop what drives it in TD). A colour starts white.
  // Uniform：新增時就決定是不是顏色，之後不能切換（換頁會掉 TD 上的驅動）；顏色從白色開始。
  addUniform = (color = false) => {
    const name = core.freeLegacyName(this.document.document, color ? 'uColor' : 'uValue'); // legacy default names 舊產品的預設名
    this.transactGraph(tr('sources.uniformAdded', 'Uniform {name} added', { name }), document =>
      document.addDeclaration({ id: newDeclarationId(), kind: 'uniform', name,
        ...(color ? { type: 'vec4', color: true, value: [1, 1, 1, 1] } : { type: 'float' }) }));
  };
  // Preset Uniforms (time, Q61): placing one creates its Uniform the first time and reuses it after; one
  // step, one Undo. The core fills in the name and type. 預設 Uniform：第一次放到圖上時建立，之後重用；名字型別由核心照表填。
  placePreset = (entry: string, position: XYPosition) => this.addNode({ preset: entry }, position);
  /** Create a preset Uniform without placing it (human 2026-10-09: an unused one is a grey card with Create).
   * 建立預設 Uniform、不放到圖上（人類：沒用到的是灰色卡片，只有 Create）。 */
  createPreset = (entry: string) => this.transactGraph(tr('sources.presetCreated', '{name} created',
    { name: core.uniformPresets.find(item => item.entry === entry)?.name ?? entry }), document => { presetDeclaration(document, entry); });
  // TOP texture inputs (Refactor.43): each becomes an input of the Grape OP in TD, in list order.
  // TOP 貼圖輸入：每一筆在 TD 成為 Grape OP 的輸入接口，照清單順序。
  addTopInput = () => {
    // The stored name stays internal; people see the position name (sTD2DInputs[i]). 存的名字只在內部；人看到的是位置名。
    const name = core.freeDeclarationName(this.document.document, 'input');
    const shown = 'sTD2DInputs[' + this.document.document.declarations.filter(d => d.kind === 'topInput').length + ']';
    this.transactGraph(tr('sources.inputAdded', 'Texture input {name} added', { name: shown }), document =>
      document.addDeclaration({ id: newDeclarationId(), kind: 'topInput', name, type: 'sampler2D' }));
  };
  setDefaultTexture = (id: string, defaultTexture: string) =>
    this.transactGraph(tr('sources.defaultTextureChanged', 'Default image updated; waiting to apply'), document => { document.changeDeclaration(id, { defaultTexture }); });
  /** False when the name cannot be used; the reason is on the status line. 名稱不能用時回傳 false。 */
  renameDeclaration = (id: string, name: string) => {
    const problem = core.declarationNameProblem(this.document.document, name, id);
    if (problem) { this.tell('warning', nameProblem(problem, name)); return false; }
    this.transactGraph(tr('sources.renamed', 'Renamed to {name}', { name }), document => { document.changeDeclaration(id, { name }); });
    return true;
  };
  setDeclarationType = (id: string, type: string) =>
    this.transactGraph(tr('sources.typeChanged', 'Shared source type updated'), document => { document.changeDeclaration(id, { type }); });
  setDeclarationValue = (id: string, value: Value) =>
    this.transactGraph(tr('sources.valueChanged', 'Shared source value updated; waiting to apply'), document => { document.changeDeclaration(id, { value }); });
  removeDeclaration = (id: string) =>
    this.transactGraph(tr('sources.removed', 'Shared source deleted with the nodes that used it'), document => document.removeDeclaration(id));
  placeDeclaration = (id: string, position: XYPosition) => this.addNode({ nodeType: 'sgrape.builtin.declaration', params: { declarationId: id } }, position);
  // TD built-in values (Refactor.41; Q45 01): no declaration, the node picks a table entry.
  placeTdValue = (entry: string, position: XYPosition) => this.addNode({ nodeType: TD_VALUE, params: { entry } }, position);
  valid = (c: Connection | FlowEdge) => {
    if (!c.sourceHandle || !c.targetHandle) return false;
    try {
      // A spare port does not exist yet: rehearse the real edit on a discarded candidate.
      // 待新增接孔尚不存在：在丟棄的候選文件上走與提交相同的路徑。
      if (c.targetHandle === spareHandle) { this.document.change(candidate => wire(candidate.networks.get('pixel')!, c)); return true; }
      return this.document.networks.get('pixel')!.plan(core.values.policy, { kind: 'wire',
        from: { node: c.source, port: c.sourceHandle }, to: { node: c.target, port: c.targetHandle } }).ok;
    } catch { return false; }
  };
  connect = (c: Connection) => this.transact(tr('edit.wired', 'Wire updated'), net => wire(net, c));
  /** What a wire would change if dropped on this input (Refactor.57, 78; design-interview Q72): the target's inputs it would
   * merge away (a component group) and the wires it would replace, on any node. Rehearsed with the release's own edit, so
   * the preview is what happens. Also the input and the wire's type, so the merging rows can be one band in the wire's colour
   * (Refactor.76.16). null: nothing to show, or it does not fit.
   * 線放在這個輸入上會改變什麼（R.57、78；Q72）：目標節點會被併掉的輸入、會被換掉的線，任何節點都一樣。用放開時同一個修改預演，
   * 預告就是實際結果。也帶上輸入與線的型別，會合併的列才能畫成線色的一整條（R.76.16）。null＝沒有要預告的或接不上。 */
  wirePreview = (c: Connection): WirePreview | null => {
    if (!c.sourceHandle || !c.targetHandle || c.targetHandle === spareHandle) return null;
    const net = this.document.networks.get('pixel')!, inputs = Object.keys(net.node(c.target).interface.inputs);
    const type = net.node(c.source).interface.outputs[c.sourceHandle]?.type ?? '';
    const found = this.rehearse(candidate => {
      const after = candidate.networks.get('pixel')!;
      wire(after, c);
      const kept = after.node(c.target).interface.inputs;
      return { merged: inputs.filter(key => !(key in kept)), replaced: gone(net, after) };
    });
    return found && (found.merged.length || found.replaced.length) ? { node: c.target, port: c.targetHandle, type, ...found } : null;
  };
  /** What releasing a wire dragged from this input onto empty canvas would change: the input's wire is pulled (Q33), so that
   * wire shows as about to go (Refactor.78.1, human 2026-10-11: treat it as a wire about to be replaced; new, the legacy editor
   * only wrote a hint). Rehearsed with the release's own edit. null: the input has no wire.
   * 從這個輸入拉到空白處放開會改變什麼：拔掉它的線（Q33），那條線預告為即將不見（R.78.1，人類：和即將被換掉的線一樣；
   * 新的，舊產品只寫提示）。用放開時同一個修改預演；null＝這個輸入沒有線。 */
  pullPreview = (node: string, port: string): WirePreview | null => {
    const net = this.document.networks.get('pixel')!;
    const replaced = this.rehearse(candidate => {
      const after = candidate.networks.get('pixel')!;
      unwire(after, node, port);
      return gone(net, after);
    });
    return replaced?.length ? { node, port, type: '', merged: [], replaced } : null;
  };
  /** A wire picked up from an input and dropped on another input moves there (Refactor.54; human 2026-10-09:
   * yes, move it, as Blender). One step, one Undo. 從輸入拿起的線放到另一個輸入：搬過去（人類：要，像 Blender）。 */
  moveWire = (edgeId: string, to: { node: string; port: string }) => this.transact(tr('edit.wireMoved', 'Wire moved'), net => {
    const edge = net.edges.find(item => item.id === edgeId), from = edge?.from;
    if (!edge || !from) throw Error('The wire is gone');
    net.disconnectAll([edge]);
    const old = net.node(to.node).port('input', to.port).edges;
    if (old.length) net.disconnectAll(old);
    net.connect(from, net.node(to.node).port('input', to.port), core.values.policy);
  });
  // Dragging from a connected input onto empty canvas pulls its wire (legacy behaviour, Q33).
  // 從有接線的輸入拉到空白處＝拔線（舊產品行為）。
  disconnectInput = (node: string, port: string) => this.transact(tr('edit.unwired', 'Wire removed'), net => unwire(net, node, port));
  // Delete skips nodes the core keeps (Color Output) and those nodes' unselected wires; the rest goes.
  // 刪除時跳過核心不准刪的節點（Color Output）及其未被選取的接線，其餘照刪。
  beforeDelete = async ({ nodes, edges }: { nodes: FlowNode[]; edges: FlowEdge[] }) => {
    const kept = new Set(nodes.filter(node => !core.removable(core.registry.get(node.data.authored.nodeType))).map(node => node.id));
    this.keptNote = kept.size ? tr('edit.outputKeptOthersDeleted', 'Color Output cannot be deleted; the other selected items were deleted') : undefined;
    if (!kept.size) return true;
    if (kept.size === nodes.length && edges.every(edge => !edge.selected)) this.tell('warning', tr('edit.outputKept', 'Color Output cannot be deleted'));
    return { nodes: nodes.filter(node => !kept.has(node.id)),
      edges: edges.filter(edge => edge.selected || !(kept.has(edge.source) || kept.has(edge.target))) };
  };
  private keptNote?: Message;
  /** Copy, paste and duplicate (Refactor.96; core clipboard.ts): a copy of the selected nodes, or null when none can be copied.
   * 複製、貼上、複製副本（R.96；核心 clipboard.ts）：選取節點的複製，一個都不能複製時是 null。 */
  copyNodes = (ids: Iterable<string>) => core.copyNodes(this.document, ids, this.host.target);
  /** Paste a copy with its top-left at `at` (flow coordinates); the pasted nodes become the selection, the last one primary (legacy
   * graph_ui.js:2823). Only a copy from this Grape OP for now (human 2026-10-12). Whether it was pasted. 把複製貼上、左上角在 at
   * （畫布座標）；貼上的節點變成選取，最後一個是主要選取（照舊產品）。目前只接受這個 Grape OP 的複製（人類 10-12）。回傳有沒有貼上。 */
  paste = (clip: Clip, at: XYPosition, label: Message = tr('edit.pasted', 'Pasted')) => {
    if (clip.source !== this.host.target) {
      this.warn(tr('edit.pasteOtherOp', 'Pasting nodes copied from another Grape OP is not available yet.'));
      return false;
    }
    let ids: string[] = [];
    const version = this.state.version;
    this.transactGraph(label, document => { ids = core.pasteClip(document, clip, at, newId, newGroupId); });
    if (this.state.version === version || !ids.length) return false;
    this.boxSelect(new Set(ids), [...ids].reverse());
    return true;
  };
  /** Duplicate: a copy of the selection pasted 48px right and down of it, wires between them kept (legacy graph_ui.js:2424).
   * 複製副本：選取的複製貼在它右下各 48px，其間的線保留（照舊產品）。 */
  duplicate = (ids: Iterable<string>) => {
    const clip = this.copyNodes(ids);
    if (!clip) return false;
    const corner = core.clipCorner(clip);
    return this.paste(clip, { x: corner.x + DUPLICATE_OFFSET, y: corner.y + DUPLICATE_OFFSET }, tr('edit.duplicated', 'Duplicated'));
  };
  /** The groups of the network being edited (Refactor.98; core groups.ts), worked out once per version of the graph.
   * 正在編輯的網路的群組（R.98；核心 groups.ts），圖每一版只算一次。 */
  groups = (): readonly GraphGroup[] => {
    if (this.grouped?.document !== this.document) this.grouped = { document: this.document, groups: core.groups.groupsOf(this.document.document.stages.pixel!) };
    return this.grouped.groups;
  };
  private grouped: { document: GraphDocument; groups: readonly GraphGroup[] } | null = null;
  /** A new group of these nodes (G-3, Ctrl+G); its ID, or null when they cannot make one. 用這些節點建立群組（G-3，Ctrl＋G）；回傳 ID，
   * 不能建立時是 null。 */
  createGroup = (ids: readonly string[], name: string) => {
    const id = newGroupId(), version = this.state.version;
    this.transact(tr('edit.grouped', 'Group created'), net => core.groups.createGroup(net, ids, { id, name }));
    return this.state.version === version ? null : id;
  };
  joinGroup = (ids: readonly string[]) => this.transact(tr('edit.joinedGroup', 'Moved into the group'), net => core.groups.joinGroup(net, ids));
  leaveGroups = (ids: readonly string[]) => this.transact(tr('edit.leftGroup', 'Removed from the group'), net => core.groups.leaveGroups(net, ids));
  removeGroup = (id: string) => this.transact(tr('edit.ungrouped', 'Group removed (its nodes stay)'), net => core.groups.removeGroup(net, id));
  changeGroup = (id: string, patch: { name?: string; color?: string; text?: string; textScale?: number; textAlign?: 'left' | 'center' | 'right' }) =>
    this.transact(tr('edit.groupChanged', 'Group updated'), net => core.groups.changeGroup(net, id, patch));
  /** Select a group's members (legacy frames_ui.js:182-189): plain = only them; Ctrl toggles them as one (all selected: off);
   * Shift adds. 選取群組的成員（照舊產品）：一般＝只選它們；Ctrl 整組切換（全選著就取消）；Shift 加選。 */
  selectGroup = (id: string, how: 'only' | 'toggle' | 'add') => {
    const group = this.groups().find(item => item.id === id);
    if (!group) return;
    const selected = this.selectedNodes(), all = group.nodes.every(node => selected.has(node));
    if (how === 'only') selected.clear();
    for (const node of group.nodes) if (how === 'toggle' && all) selected.delete(node); else selected.add(node);
    this.boxSelect(selected, [...group.nodes].reverse());
  };
  remove = ({ nodes, edges }: { nodes: FlowNode[]; edges: FlowEdge[] }) => this.transact(this.keptNote ?? tr('edit.deleted', 'Selected items deleted'), net => {
    this.keptNote = undefined;
    const ids = new Set(edges.map(edge => edge.id));
    net.disconnectAll(net.edges.filter(edge => ids.has(edge.id)));
    net.removeAll(nodes.map(node => net.node(node.id)));
  });
  // Selection (design-interview Q33, Q39; Refactor.49). Who is selected lives on the projection (React
  // Flow's `selected`); this decides it, React Flow does not (elementsSelectable is off). Nodes and wires
  // are never selected together (legacy). The primary node is the last one pressed: never stored, never
  // undone, never sent to TD. 選取：誰被選存在投影上，由這裡決定（RF 不自己選）。節點與接線不混選（舊產品）。
  // 主要選取＝最後按下的節點；不存圖、不進 Undo、不送 TD。
  private primary: string | null = null;
  private selectionListeners = new Set<() => void>();
  selectionSubscribe = (listener: () => void) => { this.selectionListeners.add(listener); return () => { this.selectionListeners.delete(listener); }; };
  primarySnapshot = () => this.primary;
  // The selected shared source (Refactor.103; legacy selectInputSource, inspector.js:2534): one at a time, never with nodes or wires
  // (legacy); for now it only locates its declaration (human 2026-10-12: what else it does, later; no batch selection yet). Not
  // stored, not undone. 選到的共用來源（R.103；照舊產品）：一次一個，不和節點、接線同時選（照舊產品）；目前只用來定位它的宣告（人類 10-12：
  // 還能做什麼之後再說；先不批次選取）。不存圖、不進 Undo。
  private source: string | null = null;
  sourceSnapshot = () => this.source;
  private setSource(id: string | null) {
    if (this.source === id) return;
    this.source = id;
    if (!this.disposed) this.selectionListeners.forEach(listener => listener());
  }
  /** Select a shared source: the canvas selection goes. 選取一個共用來源：畫布上的選取清掉。 */
  selectSource = (id: string) => { this.reselect(new Set(), new Set()); this.setPrimary(null); this.setSource(id); };
  // The selected wires as one key, so a panel follows them without redrawing on every move (Refactor.103). 選到的接線做成一個字串，
  // 面板跟著它、不會每一下都重畫（R.103）。
  private wireKey = '';
  selectedWiresSnapshot = () => this.wireKey;
  private keepWireKey() {
    const key = this.state.projection.edges.filter(edge => edge.selected).map(edge => edge.id).join('\u0000');
    if (key === this.wireKey) return;
    this.wireKey = key;
    if (!this.disposed) this.selectionListeners.forEach(listener => listener());
  }
  private setPrimary(id: string | null) {
    if (this.primary === id) return;
    this.primary = id;
    if (!this.disposed) this.selectionListeners.forEach(listener => listener());
  }
  // The primary must stay a selected node (it may be deleted, unselected or undone away).
  // 主要選取必須是被選的節點（可能被刪、取消或 Undo 掉）。
  private keepPrimary() {
    if (this.primary !== null && !this.state.projection.nodes.some(node => node.id === this.primary && node.selected)) this.setPrimary(null);
  }
  private reselect(nodes: ReadonlySet<string>, edges: ReadonlySet<string>) {
    // Any canvas selection, or clearing it, lets go of a selected source (legacy). 畫布上的選取（或清掉選取）放開選到的來源（照舊產品）。
    this.setSource(null);
    const { projection } = this.state;
    const nodeChanges = projection.nodes.flatMap(node => nodes.has(node.id) === !!node.selected ? []
      : [{ type: 'select' as const, id: node.id, selected: nodes.has(node.id) }]);
    const edgeChanges = projection.edges.flatMap(edge => edges.has(edge.id) === !!edge.selected ? []
      : [{ type: 'select' as const, id: edge.id, selected: edges.has(edge.id) }]);
    if (!nodeChanges.length && !edgeChanges.length) return;
    this.state = { ...this.state, projection: { nodes: nodeChanges.length ? applyNodeChanges(nodeChanges, projection.nodes) : projection.nodes,
      edges: edgeChanges.length ? applyEdgeChanges(edgeChanges, projection.edges) : projection.edges } };
    this.publish();
  }
  private selectedNodes = () => new Set(this.state.projection.nodes.filter(node => node.selected).map(node => node.id));
  /** A node pressed: plain = only it (a node already selected keeps the group, legacy), toggle = Ctrl,
   * add = Shift (TD as measured, Q39). 按下節點：一般＝只選它（已選的保留整組）；Ctrl＝切換；Shift＝只加選。 */
  pressNode = (id: string, how: 'only' | 'toggle' | 'add') => {
    const selected = this.selectedNodes(), was = selected.has(id), primary = this.primary;
    if (how === 'only' && !was) selected.clear();
    if (how === 'toggle' && was) selected.delete(id); else selected.add(id);
    this.reselect(selected, new Set());
    // Taking the primary away hands it to the last selected one (legacy graph_ui.js:1467).
    // 取消主要選取時，交給最後一個仍被選的（舊產品）。
    this.setPrimary(selected.has(id) ? id : primary === id || primary === null ? [...selected].at(-1) ?? null : primary);
  };
  /** A wire clicked: the same rules as nodes (human 2026-10-09: wire and node multi-selection behave
   * alike), so a plain click on a selected wire keeps the group too; wires and nodes are not selected
   * together. 點接線：規則和節點一樣（人類：多選行為要一致），一般點擊已選的接線也保留整組；接線與節點不混選。 */
  clickEdge = (id: string, how: 'only' | 'toggle' | 'add') => {
    const selected = new Set(this.state.projection.edges.filter(edge => edge.selected).map(edge => edge.id)), was = selected.has(id);
    if (how === 'only' && !was) selected.clear();
    if (how === 'toggle' && was) selected.delete(id); else selected.add(id);
    this.reselect(new Set(), selected);
    this.setPrimary(null);
  };
  /** Select every node that uses a source (legacy Select references; human 2026-10-09). 選取所有用到這個來源的節點（照舊產品）。 */
  selectReferences = (id: string) => {
    const entry = id.startsWith('tdValue:') ? id.slice(8) : undefined;
    const nodes = this.state.projection.nodes.filter(node => entry === undefined ? node.data.declaration?.id === id
      : node.data.authored.nodeType === TD_VALUE && node.data.authored.params.entry === entry).map(node => node.id);
    this.boxSelect(new Set(nodes), nodes);
    return nodes;
  };
  clearSelection = () => { this.reselect(new Set(), new Set()); this.setPrimary(null); };
  /** A box selection, applied once on release (Refactor.50.1): these nodes, no wires. The primary stays
   * if still selected, else the first node the box touched (Q33). 框選，放開時套用一次：這些節點、沒有接線；
   * 原主要仍被選就不換，否則換成第一個碰到的。 */
  boxSelect = (nodes: ReadonlySet<string>, touched: readonly string[]) => {
    const primary = this.primary;
    this.reselect(nodes, new Set());
    this.setPrimary(primary !== null && nodes.has(primary) ? primary : touched.find(id => nodes.has(id)) ?? null);
  };
  nodeChanges = (changes: NodeChange<FlowNode>[]) => {
    const runtime = changes.filter(change => change.type !== 'remove' && change.type !== 'add' && change.type !== 'replace');
    if (!runtime.length) return;
    const nodes = applyNodeChanges(runtime, this.state.projection.nodes);
    // Gesture updates never mutate the document; only completion records history.
    // RF 的量測／選取／拖曳各自可寫，放開時才提交一筆作品交易。
    this.state = { ...this.state, projection: { ...this.state.projection, nodes } };
    const done = runtime.filter(change => change.type === 'position' && change.dragging === false && change.position);
    const version = this.state.version;
    if (done.length) this.transact(tr('edit.moved', 'Position updated'), net => done.forEach(change => {
      if (change.type === 'position') net.node(change.id).update({ ui: { ...net.node(change.id).data!.ui, ...change.position } });
    }));
    if (this.state.version === version) this.publish();
  };
  edgeChanges = (changes: EdgeChange<FlowEdge>[]) => {
    const runtime = changes.filter(change => change.type === 'select');
    if (!runtime.length) return;
    if (runtime.some(change => change.type === 'select' && change.selected)) this.setSource(null); // a wire chosen 選了接線
    this.state = { ...this.state, projection: { ...this.state.projection,
      edges: applyEdgeChanges(runtime, this.state.projection.edges) } }; this.publish();
  };
  history = (redo: boolean) => {
    const source = redo ? this.future : this.past, destination = redo ? this.past : this.future;
    const graph = source.at(-1); if (!graph) return;
    try {
      const before = this.document.snapshot(), next = new core.GraphDocument(graph, core.registry);
      const projection = project(next, this.state.projection, this.bootstrap.typeContract, core.changesBetween(before, graph, core.registry));
      source.pop(); destination.push(before); this.document = next;
      this.commit(projection, redo ? tr('edit.redone', 'Redo') : tr('edit.undone', 'Undo'));
    } catch (error) { this.notice(error); }
  };
  restoreDraft = (saved: Graph) => {
    try {
      const graph = this.upgrade(saved);
      const before = this.graph(), next = new core.GraphDocument(graph, core.registry);
      const changes = core.changesBetween(before, graph, core.registry);
      if (!changes.changed) return true;
      const projection = project(next, this.state.projection, this.bootstrap.typeContract, changes);
      this.past.push(before); this.future = []; this.document = next;
      this.commit(projection, tr('draft.restored', "Restored this page's draft; waiting to apply"));
      return true;
    } catch (error) { this.notice(error); return false; }
  };
  flush = () => this.sync.flush();
  check = () => this.sync.checkNow();
  // Conflict choice "TD 端" (Q28, 2026-10-07 human chose A): adopt TD's document as an
  // ordinary history step, so one Undo recalls the editor's version without blocking anything.
  // 衝突時選「TD 端」：把 TD 版本當成一般編輯步驟採用；按一次 Undo 即叫回編輯端的修改（重新整理後失效）。
  private glslMap(): GlslLine[] | undefined {
    return this.codegen.compiled?.sourceMap.pixel.map(row => ({ line: row.line, node: row.node }));
  }
  // A line of the GLSL to show (Refactor.63): asked by the compile-failure notice, followed by the GLSL panel; `n` makes
  // asking for the same line again count. 要顯示的 GLSL 行：編譯失敗提示要求、GLSL 面板跟著捲過去；n 讓同一行再要一次也算。
  private glslFocus = { line: 0, n: 0 };
  private readonly glslListeners = new Set<() => void>();
  glslFocusSubscribe = (listener: () => void) => { this.glslListeners.add(listener); return () => { this.glslListeners.delete(listener); }; };
  glslFocusSnapshot = () => this.glslFocus;
  focusGlslLine = (line: number) => { this.glslFocus = { line, n: this.glslFocus.n + 1 }; this.glslListeners.forEach(listener => listener()); };
  /** Select one node, as clicking it would (a GLSL line leads to its node, Refactor.63). 選取一個節點（GLSL 的行找回它的節點）。 */
  selectNode = (id: string) => this.boxSelect(new Set([id]), [id]);
  /** Select one wire, as a click on it (Refactor.103: from the Graph JSON View). 選取一條接線，同點它（R.103：從 Graph JSON View）。 */
  selectWire = (id: string) => { this.reselect(new Set(), new Set([id])); this.setPrimary(null); };
  /** Back to the graph of the program TD still runs (Last Known Good, design-interview Q38 2-5; Refactor.63): loaded the
   * way TD's version is when a conflict is resolved, as one Undo step, then delivered as any edit; Uniforms take no part
   * of their own (human 2026-10-10). 回到 TD 仍在跑的那一版的圖：照衝突時採用 TD 版本的方式載入、一步 Undo，再照一般編輯送出；
   * Uniform 不另外處理（人類）。 */
  revertToLastGood = () => {
    const good = this.state.stuck?.lastKnownGood;
    if (!good) return;
    try {
      const graph = this.upgrade(parseDocument(good.document));
      const before = this.graph(), next = new core.GraphDocument(graph, core.registry);
      const projection = project(next, this.state.projection, this.bootstrap.typeContract, core.changesBetween(before, graph, core.registry));
      this.past.push(before); this.future = []; this.document = next;
      this.commit(projection, tr('shader.revertedToLastGood', 'Back to the graph TD runs (revision {revision}); Undo brings back your changes',
        { revision: good.revision }));
    } catch (error) { this.notice(error); }
  };
  useRemote = async () => {
    if (this.sync.busy || this.state.phase !== 'conflict') return;
    try {
      const result = await this.sync.read();
      const stored = parseDocument(result.state.document), remote = this.upgrade(stored);
      const before = this.graph(), next = new core.GraphDocument(remote, core.registry);
      const projection = project(next, this.state.projection, this.bootstrap.typeContract, core.changesBetween(before, remote, core.registry));
      this.past.push(before); this.future = []; this.document = next;
      this.sync.blocked = false; // the choice resolves the conflict before the step is recorded
      this.commit(projection, tr('conflict.usedTd', "Switched to TD's version; Undo brings back the editor's changes"));
      this.sync.adopt(result.state); // identical to TD: nothing to send
      if (remote !== stored) this.sync.upgraded(); // unless it was upgraded as it was read 除非讀的時候升級過
    } catch (error) { this.notice(error); }
  };
  overwrite = async () => {
    if (this.sync.busy || this.state.phase !== 'conflict') return;
    try { await this.sync.overwrite(); } catch (error) { this.notice(error); }
  };
  /** One line when asked, one when TD says it is saved; the reply speaks only when something went wrong (Refactor.75.12, human
   * 2026-10-11: leave a line for what happens, people work out the rest). A big project can take longer than the service
   * waits (10 s): TD has started, and says so when it is done. 要求時一行、TD 說存好時一行；回覆只在出問題時說話
   * （R.75.12，人類：有事就留訊息，因果使用者自己知道）。大專案可能存得比服務等的 10 秒久：TD 已開始，存好時會說。 */
  save = async () => {
    if (this.state.saving) return;
    this.status({ saving: true, message: tr('save.saving', 'Saving the TD project…'), level: 'info' });
    try { await this.sync.save(); } catch (error) {
      if (error instanceof HostError && error.code === 'application_outcome_unknown')
        this.warn(tr('save.noAnswer', 'TD started saving but has not answered yet; it will say so when the project is saved.'));
      // TD never took it (its queue drops a request it did not reach in time; Refactor.75.14, human 2026-10-11: said in the
      // editor's words, not the raw reply). TD 沒接手（佇列把來不及處理的請求作廢；R.75.14，人類：用編輯器的話說，不顯示原始回覆）。
      else if (error instanceof HostError && error.code === 'manager_not_responding')
        this.warn(tr('save.notProcessed', 'TD did not process this save (TD was not responding); nothing was saved, and it will not save later by itself.'));
      else this.notice(error);
    } finally { if (!this.disposed) this.status({ saving: false }); }
  };
  /** A new Grape ID for this Grape OP in TD (Refactor.52); null when it was not changed. 換新 Grape ID。 */
  renewId = async () => {
    try { return await this.sync.renew(); } catch (error) { this.notice(error); return null; }
  };
  dispose() {
    if (typeof window !== 'undefined') { removeEventListener('offline', this.deviceOffline); removeEventListener('online', this.deviceOnline); }
    this.disposed = true; this.sync.dispose(); this.live.dispose(); this.listeners.clear(); this.tdListeners.clear(); this.selectionListeners.clear(); }
}
