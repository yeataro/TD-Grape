import { applyNodeChanges, applyEdgeChanges, type NodeChange, type EdgeChange, type Connection, type XYPosition } from '@xyflow/react';
import { core, compiler, requireSupported, parseDocument, type Measure, type StructureProblem, type Graph, type GraphDocument, type Network, type Value, type Bootstrap } from './core';
import { project, type Projection, type FlowNode, type FlowEdge } from './projection';
import { type HostClient, type StateResponse } from './host';
import { HostSync, checkLoaded, type Compiled, type Delivery, type SyncStatus } from './host_sync';
import { tr, errorText, type Message } from './text';
import { ReportLog, type Level } from './reports';

// Handle id of a module-declared spare input. The module owns the command, port key,
// type and limit; this layer only runs that command and wires the declared port.
// 模組宣告的待新增輸入；命令、接孔、型別與上限都屬模組，這裡只執行並接到宣告的接孔。
export const spareHandle = '__spare__';
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

const noteKey = (graph: Graph) => JSON.stringify(Object.values(graph.stages).concat((graph.subgraphs || []).map(f => f.graph))
  .map(net => net?.nodes.map(n => n.comment)));

// message is data (a Message), worded only when shown (Q34); level says how serious it is (Q35).
export type EditorState = SyncStatus & { projection: Projection; version: number; undo: boolean; redo: boolean;
  message: Message | string; level: Level; glsl: string; targetPath: string };

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
    this.codegen = this.compile();
    this.sync = new HostSync(host, bootstrap, loaded, () => this.codegen,
      (status, said) => this.status({ ...status, ...said }, 'sync'), delay, retry, editorVersion);
    this.state = { ...this.sync.status, projection: project(this.document, { nodes: [], edges: [] }, bootstrap.typeContract),
      version: 0, undo: false, redo: false, message: '', level: 'info', glsl: this.codegen.compiled?.pixel ?? '', targetPath: loaded.target };
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
      'This graph has {nodes} ghost nodes and {wires} ghost wires: kept as they are and left out of the shader; a ghost wire counts as not connected.',
      { nodes: ghosts.nodes.size, wires: ghosts.edges.size }));
    return total;
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  graph = () => this.document.snapshot();
  private publish() { if (!this.disposed) this.listeners.forEach(listener => listener()); }
  private status(patch: Partial<EditorState>, source = 'editor') {
    if (patch.message) this.log.add(patch.level ?? 'info', patch.message, source);
    this.state = { ...this.state, ...patch }; this.publish();
  }
  private tell(level: Level, message: Message | string) { this.status({ message, level }); }
  notice = (error: unknown) => {
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
  transact = (label: Message, edit: (network: Network) => void) => {
    try {
      const result = this.document.change(candidate => edit(candidate.networks.get('pixel')!));
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
    this.codegen = this.compile();
    const failed = this.codegen.error === undefined ? undefined : tr('edit.codegenFailed', 'Code generation failed: {reason}', { reason: this.codegen.error });
    if (!this.sync.blocked) this.log.add(failed ? 'warning' : 'info', failed ?? label, 'editor');
    this.state = { ...this.state, projection, version: this.state.version + 1,
      undo: !!this.past.length, redo: !!this.future.length,
      glsl: this.codegen.compiled?.pixel ?? this.state.glsl,
      ...(this.sync.blocked ? {} : { message: failed ?? label, level: failed ? 'warning' as const : 'info' as const }) };
    if (!this.sync.blocked) this.ghostTotal = this.reportGhosts(this.ghostTotal);
    this.sync.changed();
    this.state = { ...this.state, dirty: this.sync.status.dirty };
    this.publish();
  }
  edit = (id: string, command: string, value: Value) => this.transact(tr('edit.valueChanged', 'Value updated; waiting to apply'),
    net => net.node(id).edit(command, value));
  setInput = (id: string, key: string, value: Value) => this.transact(tr('edit.inputChanged', 'Input value updated; waiting to apply'), net => {
    core.values.literal(value, net.node(id).port('input', key).type!);
    net.node(id).setInput(key, value);
  });
  configure = (id: string, type: string) => this.transact(tr('edit.typeChanged', 'Type updated'), net => net.node(id).configure({ type }));
  add = (uuid: string, position: XYPosition) => this.transact(tr('edit.nodeAdded', 'Node added'), net =>
    net.insert({ id: 'n' + crypto.randomUUID().replaceAll('-', ''), nodeType: uuid, params: {}, ui: { ...position } }));
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
  check = () => this.sync.check();
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
  dispose() { this.disposed = true; this.sync.dispose(); this.listeners.clear(); }
}
