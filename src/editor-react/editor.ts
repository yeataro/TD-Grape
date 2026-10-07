import { applyNodeChanges, applyEdgeChanges, type NodeChange, type EdgeChange, type Connection, type XYPosition } from '@xyflow/react';
import { core, compiler, requireSupported, parseDocument, type Graph, type GraphDocument, type Network, type Value, type Bootstrap } from './core';
import { project, type Projection, type FlowNode, type FlowEdge } from './projection';
import { type HostClient, type StateResponse } from './host';
import { HostSync, checkLoaded, type Compiled, type Delivery, type SyncStatus } from './host_sync';

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

export type EditorState = SyncStatus & { projection: Projection; version: number; undo: boolean; redo: boolean;
  message: string; glsl: string; targetPath: string };

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
  constructor(readonly host: HostClient, readonly bootstrap: Bootstrap, loaded: StateResponse, delay = 0, retry = 5000) {
    checkLoaded(host, bootstrap, loaded);
    const graph = parseDocument(loaded.state.document);
    requireSupported(graph);
    this.document = new core.GraphDocument(graph, core.registry);
    this.codegen = this.compile();
    this.sync = new HostSync(host, bootstrap, loaded, () => this.codegen, status => this.status(status), delay, retry);
    this.state = { ...this.sync.status, projection: project(this.document, { nodes: [], edges: [] }, bootstrap.typeContract),
      version: 0, undo: false, redo: false, message: '已載入 TD 文件', glsl: this.codegen.compiled?.pixel ?? '', targetPath: loaded.target };
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  graph = () => this.document.snapshot();
  private publish() { if (!this.disposed) this.listeners.forEach(listener => listener()); }
  private status(patch: Partial<EditorState>) { this.state = { ...this.state, ...patch }; this.publish(); }
  notice = (error: unknown) => this.status({ message: error instanceof Error ? error.message : String(error) });
  private compile(): Delivery {
    const graph = this.document.snapshot();
    try { return { graph, compiled: compiler.compile(graph, this.bootstrap.typeContract.glslCode) as Compiled }; }
    catch (error) { return { graph, error: String(error) }; }
  }

  // Build the entire candidate before committing history or notifying React.
  // 多個 node／edge 改動共用一次發布；任何例外都不留下半份作品。
  transact = (label: string, edit: (network: Network) => void) => {
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
  private commit(projection: Projection, label: string) {
    this.codegen = this.compile();
    const failed = this.codegen.error === undefined ? undefined : '產碼失敗：' + this.codegen.error;
    this.state = { ...this.state, projection, version: this.state.version + 1,
      undo: !!this.past.length, redo: !!this.future.length,
      glsl: this.codegen.compiled?.pixel ?? this.state.glsl,
      message: this.sync.blocked ? this.state.message : failed ?? label };
    this.sync.changed();
    this.state = { ...this.state, dirty: this.sync.status.dirty };
    this.publish();
  }
  edit = (id: string, command: string, value: Value) => this.transact('數值已更新，等待套用', net => net.node(id).edit(command, value));
  setInput = (id: string, key: string, value: Value) => this.transact('輸入值已更新，等待套用', net => {
    core.values.literal(value, net.node(id).port('input', key).type!);
    net.node(id).setInput(key, value);
  });
  configure = (id: string, type: string) => this.transact('型別已更新', net => net.node(id).configure({ type }));
  add = (uuid: string, position: XYPosition) => this.transact('節點已新增', net =>
    net.insert({ id: 'n' + crypto.randomUUID().replaceAll('-', ''), definitionUuid: uuid, params: {}, ui: { ...position } }));
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
  connect = (c: Connection) => this.transact('接線已更新', net => wire(net, c));
  remove = ({ nodes, edges }: { nodes: FlowNode[]; edges: FlowEdge[] }) => this.transact('選取項目已刪除', net => {
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
    if (done.length) this.transact('位置已更新', net => done.forEach(change => {
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
      this.commit(projection, redo ? 'Redo' : 'Undo');
    } catch (error) { this.notice(error); }
  };
  restoreDraft = (graph: Graph) => {
    try {
      requireSupported(graph);
      const before = this.graph(), next = new core.GraphDocument(graph, core.registry);
      const changes = core.changesBetween(before, graph, core.registry);
      if (!changes.changed) return true;
      const projection = project(next, this.state.projection, this.bootstrap.typeContract, changes);
      this.past.push(before); this.future = []; this.document = next; this.commit(projection, '已還原本頁草稿，等待套用');
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
      this.commit(projection, '已改用 TD 版本；按 Undo 可叫回編輯端的修改');
      this.sync.adopt(result.state); // identical to TD: nothing to send
    } catch (error) { this.notice(error); }
  };
  overwrite = async () => {
    if (this.sync.busy || this.state.phase !== 'conflict') return;
    try { await this.sync.overwrite(); } catch (error) { this.notice(error); }
  };
  save = async () => {
    try { this.notice(await this.sync.save()); } catch (error) { this.notice(error); }
  };
  dispose() { this.disposed = true; this.sync.dispose(); this.listeners.clear(); }
}
