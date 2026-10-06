import { applyNodeChanges, applyEdgeChanges, type NodeChange, type EdgeChange, type Connection, type XYPosition } from '@xyflow/react';
import { core, compiler, requireSupported, same, type Graph, type GraphDocument, type Network, type Value, type Bootstrap } from './core';
import { project, type Projection, type FlowNode, type FlowEdge } from './projection';
import { HostClient, HostError, type StateResponse } from './host';

type Sent = { graph: Graph; revision: number };

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
const applyRequest = (host: HostClient, bootstrap: Bootstrap, sent: Sent, compiled: ReturnType<typeof compiler.compile>) => ({
  graph: sent.graph, revision: sent.revision, frontendArtifact: { protocol: compiler.protocol,
    targetId: host.target, baseRevision: sent.revision, snapshot: JSON.stringify(sent.graph),
    catalogHash: bootstrap.catalogHash, compiled } });

// Migration-period convenience: test graphs are disposable, so a graph this entry cannot
// open may be replaced by the default to restore the test environment. Normal compile and
// apply; a stale revision still conflicts.
// 遷移期便利行為：測試圖可丟棄，打不開時換成預設圖以恢復測試環境；照常產碼／套用，版本過期仍擋。
export async function resetToDefault(host: HostClient, bootstrap: Bootstrap) {
  const loaded = await host.call<StateResponse>('state');
  if (loaded.savedStateIssue || loaded.readOnlyReason || loaded.upgradeReview) throw Error(loaded.readOnlyReason || '此文件需要在舊入口處理載入問題。');
  if (loaded.frontendCompiler?.protocol !== compiler.protocol || loaded.frontendCompiler.catalogHash !== bootstrap.catalogHash)
    throw Error('前端核心與 TD bootstrap 版本不一致；請重新載入同一建置。');
  const sent = { graph: bootstrap.defaultDocument.graph, revision: loaded.state.revision };
  const compiled = compiler.compile(sent.graph, bootstrap.typeContract.glslCode);
  const result = await host.call<{ state: StateResponse['state'] }>('apply', applyRequest(host, bootstrap, sent, compiled));
  if (result.state?.revision !== sent.revision + 1 || !same(result.state.graph, sent.graph)) throw new HostError('宿主回覆與送出快照不一致。');
}
const conflictMessage = 'TD 文件已由其他操作更新；本地草稿保留。可「用編輯器草稿覆寫 TD」，或重新整理頁面改用 TD 版本（草稿可還原）。';
export type EditorState = { projection: Projection; version: number; revision: number; dirty: boolean;
  undo: boolean; redo: boolean; phase: 'ready' | 'sending' | 'error' | 'uncertain' | 'conflict';
  message: string; glsl: string; targetPath: string };

// One authored document; drafts, selection and RF measurements are transient.
// 本輪真正的 UI caller 共用交易、圖歷史與交付；沒有通用命令／事件框架。
export class EditorSession {
  private document: GraphDocument;
  private state: EditorState;
  private listeners = new Set<() => void>();
  private past: Graph[] = [];
  private future: Graph[] = [];
  private timer?: ReturnType<typeof setTimeout>;
  private pending?: Promise<void>;
  private disposed = false;
  private blocked = false;
  private confirmed: Graph;
  private uncertain?: Sent;
  constructor(readonly host: HostClient, readonly bootstrap: Bootstrap, loaded: StateResponse,
    private readonly delay = 650) {
    if (loaded.savedStateIssue || loaded.readOnlyReason || loaded.upgradeReview) throw Error(loaded.readOnlyReason || '此文件需要在舊入口處理載入問題。');
    if (loaded.frontendCompiler?.protocol !== compiler.protocol || loaded.frontendCompiler.catalogHash !== bootstrap.catalogHash)
      throw Error('前端核心與 TD bootstrap 版本不一致；請重新載入同一建置。');
    if (loaded.state.targetId && loaded.state.targetId !== host.target) throw Error('Host target mismatch');
    requireSupported(loaded.state.graph);
    this.document = new core.GraphDocument(loaded.state.graph, core.registry);
    this.confirmed = this.document.snapshot();
    this.state = { projection: project(this.document, { nodes: [], edges: [] }, bootstrap.typeContract),
      version: 0, revision: loaded.state.revision, dirty: false, undo: false, redo: false,
      phase: 'ready', message: '已載入 TD 文件', glsl: '', targetPath: loaded.target };
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  graph = () => this.document.snapshot();
  private publish() { if (!this.disposed) this.listeners.forEach(listener => listener()); }
  private status(patch: Partial<EditorState>) { this.state = { ...this.state, ...patch }; this.publish(); }
  notice = (error: unknown) => this.status({ message: error instanceof Error ? error.message : String(error) });

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
  private commit(projection: Projection, label: string) {
    this.state = { ...this.state, projection, version: this.state.version + 1,
      dirty: true, undo: !!this.past.length, redo: !!this.future.length,
      message: this.blocked ? this.state.message : label };
    this.publish(); this.schedule();
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
  private schedule() {
    clearTimeout(this.timer);
    if (!this.disposed && !this.blocked) this.timer = setTimeout(() => { void this.flush(); }, this.delay);
  }
  flush = (): Promise<void> => {
    clearTimeout(this.timer);
    if (this.pending) return this.pending;
    if (this.disposed || this.blocked || !this.state.dirty) return Promise.resolve();
    this.pending = this.deliver().finally(() => { this.pending = undefined; });
    return this.pending;
  };
  private async deliver() {
    // Serialize writes. A late acknowledgement advances revision, never replaces local edits.
    // 每次只送一份快照；回覆只確認已送版本，不覆蓋其後的編輯或 Undo。
    while (this.state.dirty && !this.disposed && !this.blocked) {
      const sent = { graph: this.graph(), revision: this.state.revision };
      let compiled;
      try { compiled = compiler.compile(sent.graph, this.bootstrap.typeContract.glslCode); }
      catch (error) { this.status({ phase: 'error', message: '產碼失敗：' + String(error) }); return; }
      this.status({ phase: 'sending', message: '正在套用至 TD…', glsl: compiled.pixel });
      try {
        const result = await this.host.call<{ state: StateResponse['state'] }>('apply',
          applyRequest(this.host, this.bootstrap, sent, compiled));
        if (this.disposed) return;
        if (result.state?.revision !== sent.revision + 1 || !same(result.state.graph, sent.graph)) throw new HostError('宿主回覆與送出快照不一致。');
        this.confirmed = sent.graph;
        this.status({ revision: result.state.revision, dirty: !same(this.graph(), sent.graph),
          phase: 'ready', message: '已套用 TD；專案尚需保存' });
      } catch (error) {
        if (this.disposed) return;
        const conflict = error instanceof HostError && error.status === 409;
        const unknown = !(error instanceof HostError) || error.status === 0 || error.status >= 500;
        this.blocked = conflict || unknown; this.uncertain = this.blocked ? sent : undefined;
        this.status({ phase: conflict ? 'conflict' : unknown ? 'uncertain' : 'error',
          message: conflict ? conflictMessage + ' ' + String(error)
            : (this.blocked ? '交付未確認，已停止自動送出；請檢查連線。' : 'TD 拒絕套用：') + String(error) });
        return;
      }
    }
  }
  check = async () => {
    if (this.pending) return;
    try {
      const result = await this.host.call<StateResponse>('state');
      if (result.frontendCompiler.catalogHash !== this.bootstrap.catalogHash) throw Error('宿主版本已變更，請下載草稿後重新開啟。');
      const state = result.state, sent = this.uncertain;
      if (sent && state.revision === sent.revision + 1 && same(state.graph, sent.graph)) this.confirmed = sent.graph;
      else if (state.revision !== this.state.revision || !same(state.graph, this.confirmed)) {
        this.blocked = true; this.status({ phase: 'conflict', message: conflictMessage }); return;
      }
      this.blocked = false; this.uncertain = undefined;
      this.status({ revision: state.revision, dirty: !same(this.graph(), this.confirmed), phase: 'ready',
        message: '已確認 TD 版本；若有未送出修改，可按「套用」。' });
    } catch (error) { this.notice(error); }
  };
  // Migration-period convenience (old/new entries coexist), not product behaviour.
  // Rebase the draft on TD's latest revision and send it through the normal path;
  // a further change before delivery still returns a conflict.
  // 遷移期便利行為：以最新 revision 為基準重送草稿，照常產碼／驗證；期間再變仍擋。
  overwrite = async () => {
    if (this.pending || this.state.phase !== 'conflict') return;
    try {
      const result = await this.host.call<StateResponse>('state');
      if (result.frontendCompiler.catalogHash !== this.bootstrap.catalogHash) throw Error('宿主版本已變更，請下載草稿後重新開啟。');
      this.confirmed = result.state.graph; this.blocked = false; this.uncertain = undefined;
      const dirty = !same(this.graph(), this.confirmed);
      this.status({ revision: result.state.revision, dirty, phase: 'ready',
        message: dirty ? '以編輯器草稿覆寫 TD…' : '草稿與 TD 文件相同，已同步。' });
      await this.flush();
    } catch (error) { this.notice(error); }
  };
  save = async () => {
    await this.flush();
    if (this.state.dirty || this.blocked) { this.notice('尚有未成功套用的修改；請先處理錯誤。'); return; }
    try {
      const result = await this.host.call<{ saved: boolean | string }>('save', {});
      if (!result.saved) throw Error('TD 未確認專案保存成功；已套用的圖仍在宿主記憶體中。');
      this.notice('TD 專案已保存' + (typeof result.saved === 'string' ? '：' + result.saved : '') +
        (this.state.dirty ? '（仍有新修改待套用）' : ''));
    } catch (error) { this.notice(error); }
  };
  dispose() { this.disposed = true; clearTimeout(this.timer); this.listeners.clear(); }
}
