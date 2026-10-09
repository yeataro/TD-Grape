import { applyNodeChanges, applyEdgeChanges, type NodeChange, type EdgeChange, type Connection, type XYPosition } from '@xyflow/react';
import { core, compiler, requireSupported, parseDocument, type Measure, type StructureProblem, type Graph, type GraphDocument, type Network, type Value, type Bootstrap,
  type Declaration, type NameProblem, type ObjectValue } from './core';
import { project, type Projection, type FlowNode, type FlowEdge } from './projection';
import { type HostClient, type StateResponse, type UniformStates } from './host';
import { HostSync, checkLoaded, type Compiled, type Delivery, type SyncStatus } from './host_sync';
import { tr, errorText, type Message } from './text';
import { ReportLog, type Level } from './reports';
import { LiveValues, type LiveMessage } from './live_values';

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
export type WireEnd = { node: string; port: string; side: 'output' | 'input' };
const newId = () => 'n' + crypto.randomUUID().replaceAll('-', '');
// Puts a new node into a document: the one path for adding, also used to rehearse on a discarded candidate.
// 把新節點放進文件：新增的唯一路徑，也用在丟棄的候選文件上預演。
// A preset Uniform's declaration, created the first time it is needed (Q61; Create in the Sources panel, Q61 supplement).
// 預設 Uniform 的宣告，第一次需要時建立（Q61；共用來源面板的 Create）。
function presetDeclaration(document: GraphDocument, entry: string) {
  const preset = core.uniformPresets.find(item => item.entry === entry)!;
  return document.document.declarations.find(d => d.kind === 'uniform' && d.entry === entry)
    ?? document.addDeclaration({ id: 'd' + crypto.randomUUID().replaceAll('-', '').slice(0, 16),
      kind: 'uniform', name: preset.name, type: preset.type, entry });
}
function insertNew(document: GraphDocument, spec: NewNode, position: XYPosition) {
  const net = document.networks.get('pixel')!, id = newId();
  if ('preset' in spec) {
    const declaration = presetDeclaration(document, spec.preset);
    net.insert({ id, nodeType: 'sgrape.builtin.declaration', params: { declarationId: declaration.id }, ui: { ...position } });
  } else net.insert({ id, nodeType: spec.nodeType, params: structuredClone(spec.params), ui: { ...position } });
  return id;
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
export type EditorState = SyncStatus & { projection: Projection; version: number; undo: boolean; redo: boolean;
  message: Message | string; level: Level; glsl: string; targetPath: string;
  declarations: readonly Declaration[]; references: Readonly<Record<string, number>> };

// Coordinates editing: hands edits to the core, keeps the current document, Undo and editing
// state, compiles every finished edit, and hands the result to HostSync (design-interview Q38).
// Code generation no longer waits for delivery, so it keeps working while TD is away (Q28).
// 編輯協調者：把編輯交給核心、保管目前的作品／Undo／編輯狀態、每次修改完成即產碼，再交給 HostSync。
// 產碼不再等送出，TD 不在時照樣更新。
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
    const graph = parseDocument(loaded.state.document);
    requireSupported(graph);
    this.document = new core.GraphDocument(graph, core.registry);
    this.td = loaded.uniforms ?? {};
    this.live = new LiveValues(host.live, message => this.liveMessage(message), connected => this.liveLinked(connected));
    this.uniformValues = this.readUniformValues();
    this.codegen = this.compile();
    this.sync = new HostSync(host, bootstrap, loaded, () => this.codegen,
      (status, said) => this.status({ ...status, ...said }, 'sync'), delay, retry, editorVersion);
    this.state = { ...this.sync.status, projection: project(this.document, { nodes: [], edges: [] }, bootstrap.typeContract),
      version: 0, undo: false, redo: false, message: '', level: 'info', glsl: this.codegen.compiled?.pixel ?? '', targetPath: loaded.target,
      ...this.sources() };
    // TD-Grape's notices are said as they are, by TD-Grape (Q58). TD-Grape 的提醒照原樣、以 TD-Grape 的名義說。
    this.sync.onTd = (uniforms, notices) => {
      if (uniforms) this.setTd(uniforms);
      for (const notice of notices) this.status({ message: notice, level: 'warning' }, 'td');
    };
    this.tell('info', tr('edit.loaded', 'Loaded the graph from TD'));
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
  private inputs: Readonly<Record<string, string | null>> | null = null;
  private inputsTaken = 0;
  private readonly inputListeners = new Set<() => void>();
  inputsSubscribe = (listener: () => void) => { this.inputListeners.add(listener); return () => { this.inputListeners.delete(listener); }; };
  inputsSnapshot = () => this.inputs;
  inputsTake = () => this.inputsTaken;
  refreshInputs = async () => {
    try {
      const result = await this.host.call<{ inputs: { id: string; source: string | null }[] }>('inputs');
      if (this.disposed) return;
      this.inputs = Object.fromEntries(result.inputs.map(input => [input.id, input.source]));
      this.inputsTaken++;
      this.inputListeners.forEach(listener => listener());
    } catch { /* TD away: the previews say so when they ask 連不到 TD：預覽自己會說 */ }
  };
  private liveMessage(message: LiveMessage) {
    if (message.type === 'inputs') { void this.refreshInputs(); return; }
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
  private liveLinked(connected: boolean) {
    if (connected) return;
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
  private publish() { this.keepPrimary(); if (!this.disposed) this.listeners.forEach(listener => listener()); }
  private status(patch: Partial<EditorState>, source = 'editor') {
    if (patch.message) this.log.add(patch.level ?? 'info', patch.message, source);
    this.state = { ...this.state, ...patch }; this.publish();
  }
  private tell(level: Level, message: Message | string) { this.status({ message, level }); }
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
      glsl: this.codegen.compiled?.pixel ?? this.state.glsl,
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
  // `params` come from the menu entry the module declared (Q37 1-5); the graph does not record the entry.
  // params 來自模組宣告的入口；圖不記錄來自哪個入口。
  add = (uuid: string, position: XYPosition, params: ObjectValue = {}) => this.addNode({ nodeType: uuid, params }, position);
  /** Adds a node, and wires it to the dragged wire's end when given (one step, one Undo; Refactor.54).
   * 新增節點；有給拉線的那一端就順便接上（一步、一次 Undo）。 */
  addNode = (spec: NewNode, position: XYPosition, wire?: { end: WireEnd; port: string }) =>
    this.transactGraph(tr('edit.nodeAdded', 'Node added'), document => {
      const id = insertNew(document, spec, position), net = document.networks.get('pixel')!;
      if (!wire) return;
      const { end, port } = wire;
      if (end.side === 'output') net.connect(net.node(end.node).port('output', end.port), net.node(id).port('input', port), core.values.policy);
      else {
        // An input takes one wire: the new one replaces whatever was there. 輸入只接一條：新線取代原本的。
        const old = net.node(end.node).port('input', end.port).edges;
        if (old.length) net.disconnectAll(old);
        net.connect(net.node(id).port('output', port), net.node(end.node).port('input', end.port), core.values.policy);
      }
      // A vector node made from a wire takes the component names of the node at the other end, in the same step
      // (Refactor.59; legacy graph_ui.js:2346). 由拉線新增的向量節點沿用另一端節點的分量名稱樣式，同一步完成。
      const made = net.node(id), peer = net.node(end.node);
      if (made.definition?.inheritsComponentNames && peer.data)
        made.update({ ui: { ...made.data!.ui, componentNames: core.componentStyle(peer.definition, peer.data, net.context) } });
    });
  /** Which port of a new node would take this wire, rehearsed on a discarded candidate so the answer follows the
   * same rules as the real edit (Refactor.54; no separate core question). A port of exactly the wire's type comes
   * first. null: it does not fit. 新節點的哪個接孔能接這條線：在丟棄的候選文件上預演，答案與真正的修改同一套規則；
   * 型別完全相同的優先。null＝接不上。 */
  portFor = (spec: NewNode, end: WireEnd): { port: string; type: string } | null => {
    let found: { port: string; type: string } | null = null;
    try {
      this.document.change(document => {
        const id = insertNew(document, spec, { x: 0, y: 0 }), net = document.networks.get('pixel')!;
        const there = net.node(end.node).interface[end.side === 'output' ? 'outputs' : 'inputs'][end.port]?.type;
        const ports = Object.entries(net.node(id).interface[end.side === 'output' ? 'inputs' : 'outputs']);
        const fits = ports.filter(([key]) => net.plan(core.values.policy, { kind: 'wire',
          ...(end.side === 'output' ? { from: { node: end.node, port: end.port }, to: { node: id, port: key } }
            : { from: { node: id, port: key }, to: { node: end.node, port: end.port } }) }).ok);
        const best = fits.find(([, port]) => port.type === there) ?? fits[0];
        if (best) found = { port: best[0], type: best[1].type };
        throw new Rehearsed();
      });
    } catch (error) { if (!(error instanceof Rehearsed)) return null; }
    return found;
  };
  // Shared sources (Refactor.40; Q41, Q45): global constants for now. 共用來源：本輪只有全域常數。
  addConstant = () => {
    const name = core.freeLegacyName(this.document.document, 'cValue'); // legacy default name 舊產品的預設名
    this.transactGraph(tr('sources.added', 'Constant {name} added', { name }), document =>
      document.addDeclaration({ id: 'd' + crypto.randomUUID().replaceAll('-', '').slice(0, 16), kind: 'constant', name, type: 'float' }));
  };
  // Uniforms (Refactor.44, D1): a colour or not is chosen when it is added and never switched (Q59: the
  // Colors and Vectors pages differ, switching would drop what drives it in TD). A colour starts white.
  // Uniform：新增時就決定是不是顏色，之後不能切換（換頁會掉 TD 上的驅動）；顏色從白色開始。
  addUniform = (color = false) => {
    const name = core.freeLegacyName(this.document.document, color ? 'uColor' : 'uValue'); // legacy default names 舊產品的預設名
    this.transactGraph(tr('sources.uniformAdded', 'Uniform {name} added', { name }), document =>
      document.addDeclaration({ id: 'd' + crypto.randomUUID().replaceAll('-', '').slice(0, 16), kind: 'uniform', name,
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
      document.addDeclaration({ id: 'd' + crypto.randomUUID().replaceAll('-', '').slice(0, 16), kind: 'topInput', name, type: 'sampler2D' }));
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
  /** What a wire would change if dropped here (Refactor.57; CURRENT 2026-10-07, human: only nodes whose wiring changes
   * their ports pay for it): the target's inputs it would merge away (a component group) and the wires it would
   * replace. Rehearsed with the real edit on a discarded candidate, so the preview is what happens. null: no change
   * to show, or it does not fit. 線放在這裡會改變什麼：目標節點會被併掉的輸入、會被換掉的線。用真正的修改在丟棄的候選上
   * 預演，預告就是實際結果。只有接線會改變接孔的節點（模組有 wire）才預演；null＝沒有要預告的或接不上。 */
  wirePreview = (c: Connection): { node: string; merged: string[]; replaced: string[] } | null => {
    if (!c.sourceHandle || !c.targetHandle || c.targetHandle === spareHandle) return null;
    const net = this.document.networks.get('pixel')!;
    if (!net.node(c.target).definition?.wire) return null;
    const inputs = Object.keys(net.node(c.target).interface.inputs), edges = net.data.edges.map(edge => edge.id);
    let found: { node: string; merged: string[]; replaced: string[] } | null = null;
    try {
      this.document.change(candidate => {
        const after = candidate.networks.get('pixel')!;
        wire(after, c);
        const kept = new Set(Object.keys(after.node(c.target).interface.inputs)), still = new Set(after.data.edges.map(edge => edge.id));
        found = { node: c.target, merged: inputs.filter(key => !kept.has(key)), replaced: edges.filter(id => !still.has(id)) };
        throw new Rehearsed();
      });
    } catch (error) { if (!(error instanceof Rehearsed)) return null; }
    return found && ((found as { merged: string[] }).merged.length || (found as { replaced: string[] }).replaced.length) ? found : null;
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
  disconnectInput = (node: string, port: string) => this.transact(tr('edit.unwired', 'Wire removed'), net => {
    const edges = net.node(node).port('input', port).edges;
    if (edges.length) net.disconnectAll(edges);
  });
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
  restoreDraft = (graph: Graph) => {
    try {
      requireSupported(graph);
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
  useRemote = async () => {
    if (this.sync.busy || this.state.phase !== 'conflict') return;
    try {
      const result = await this.sync.read();
      const remote = parseDocument(result.state.document);
      requireSupported(remote);
      const before = this.graph(), next = new core.GraphDocument(remote, core.registry);
      const projection = project(next, this.state.projection, this.bootstrap.typeContract, core.changesBetween(before, remote, core.registry));
      this.past.push(before); this.future = []; this.document = next;
      this.sync.blocked = false; // the choice resolves the conflict before the step is recorded
      this.commit(projection, tr('conflict.usedTd', "Switched to TD's version; Undo brings back the editor's changes"));
      this.sync.adopt(result.state); // identical to TD: nothing to send
    } catch (error) { this.notice(error); }
  };
  overwrite = async () => {
    if (this.sync.busy || this.state.phase !== 'conflict') return;
    try { await this.sync.overwrite(); } catch (error) { this.notice(error); }
  };
  save = async () => {
    try { this.tell('info', await this.sync.save()); } catch (error) { this.notice(error); }
  };
  /** A new Grape ID for this Grape OP in TD (Refactor.52); null when it was not changed. 換新 Grape ID。 */
  renewId = async () => {
    try { return await this.sync.renew(); } catch (error) { this.notice(error); return null; }
  };
  dispose() { this.disposed = true; this.sync.dispose(); this.live.dispose(); this.listeners.clear(); this.tdListeners.clear(); this.selectionListeners.clear(); }
}
