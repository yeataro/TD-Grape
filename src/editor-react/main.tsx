import { StrictMode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, memo } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlow, ReactFlowProvider, Background, Controls, useReactFlow, getBezierPath,
  type ConnectionLineComponentProps, type NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './theme/dark.css';
import './style.css';
import { creatableEntries, typeColor, UnsupportedGraphError, type Bootstrap } from './core';
import { HostClient, HostError, type StateResponse } from './host';
import { Editor as EditorSession, type EditorState } from './editor';
import { resetToDefault } from './host_sync';
import { RightDragSelect, pressKind } from './RightDragSelect';
import { SelectionFrame } from './SelectionFrame';
import { tr, say, TextError, errorText, type Message } from './text';
import { conflictMessage } from './host_sync';
import { PanelShell } from './PanelShell';
import { SourcesPanel } from './SourcesPanel';
import { NodeCard, SessionContext, TextContext, BodyDragContext } from './NodeCard';
import { ShellContext, GrapeOpEntry, GrapeOpMenu, EmptyCanvas, type Shell } from './shell';
import { listGrapeOps } from './grape_ops';
import { sourceNow, describeSource, describeNow, buildLabel, tdLine, type TdIdentity, type DraftSource } from './td_identity';
import type { Projection, FlowNode, FlowEdge } from './projection';

const nodeTypes: NodeTypes = { grape: NodeCard };
// The Grape OP in the address (Refactor.24): the Grape OP's Edit opens /shader/<id>/; ?target=<id> also
// works. No target, or one the project does not have, is a normal state of the shell (Refactor.51).
// 網址上的 Grape OP：Grape OP 的 Edit 打開 /shader/<id>/；?target=<id> 亦可。沒有或找不到都是外殼的一般狀態。
const addressTarget = () => new URLSearchParams(location.search).get('target') ?? location.pathname.match(/^\/shader\/([^/]+)\/$/)?.[1] ?? '';
const draftKeyOf = (target: string) => 'grape-react-draft:' + target;
const recoveryHelp = tr('status.recoveryHelp', 'On the computer running TD, check that TD is still open (restore its window if minimized), global cooking is on, and TD is not busy with a long task; on a remote device, check the network. After TD restarts, open the editor again from the Grape OP.');
// The status line shows one line; the whole message (e.g. TD's compile log) is in its tooltip (Refactor.38).
// 狀態列只顯示一行；完整內容（例如 TD 的編譯紀錄）在滑鼠提示裡。
function StatusText({ message }: { message: Message | string }) {
  const full = say(message), first = full.split('\n')[0];
  return <span title={full === first ? undefined : full}>{first}{full === first ? '' : ' …'}</span>;
}
function download(value: unknown, name = 'grape-draft.json') {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}
function ConnectionPreview(props: ConnectionLineComponentProps<FlowNode>) {
  const port = (props.fromHandle.type === 'source' ? props.fromNode.data.outputs : props.fromNode.data.inputs)
    .find(port => port.key === props.fromHandle.id);
  const [path] = getBezierPath({ sourceX: props.fromX, sourceY: props.fromY, targetX: props.toX, targetY: props.toY,
    sourcePosition: props.fromPosition, targetPosition: props.toPosition });
  return <path d={path} fill="none" stroke={typeColor(port?.type ?? '')} strokeWidth={1.3} strokeDasharray="5 4" />;
}
const Canvas = memo(function Canvas({ session, projection, bodyDrag, snap }: {
  session: EditorSession; projection: Projection; bodyDrag: boolean; snap: boolean;
}) {
  return <BodyDragContext.Provider value={bodyDrag}><RightDragSelect session={session}>
    <ReactFlow<FlowNode, FlowEdge> nodes={projection.nodes} edges={projection.edges} nodeTypes={nodeTypes}
      onNodesChange={session.nodeChanges} onEdgesChange={session.edgeChanges} onBeforeDelete={session.beforeDelete} onDelete={session.remove}
      onConnect={session.connect} isValidConnection={session.valid} connectionLineComponent={ConnectionPreview}
      onConnectEnd={(_event, state) => {
        if (state.toHandle && !state.isValid) session.notice(new TextError(tr('edit.wireRefused', 'The core refused this wire: the types or the graph structure do not fit.')));
        // Released on empty canvas from an input: pull that input's wire (Q33). 從輸入拉到空白處：拔線。
        else if (!state.toHandle && state.fromHandle?.type === 'target' && state.fromNode && state.fromHandle.id)
          session.disconnectInput(state.fromNode.id, state.fromHandle.id);
      }}
      onNodeDragStart={() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); }}
      // Selection is decided by the session, not React Flow (Refactor.49; reported to the human as an
      // exception): nodes on press (RightDragSelect), wires on click, blank canvas clears.
      // 選取由 session 決定、不是 RF（R.49，已向人類報告的例外）：節點在按下時、接線在點擊時、點空白清掉。
      elementsSelectable={false} multiSelectionKeyCode={null}
      onEdgeClick={(event, edge) => session.clickEdge(edge.id, pressKind(event))}
      onPaneClick={() => session.clearSelection()}
      edgesReconnectable={false} snapToGrid={snap} snapGrid={[22, 22]} fitView fitViewOptions={{ maxZoom: 1, padding: .2 }}
      minZoom={.15} maxZoom={2.5} colorMode="dark" deleteKeyCode={['Backspace', 'Delete']}
      selectionKeyCode={null}>{/* box selection is RightDragSelect's (touching counts, Shift adds; Q33/Q39) */}
      <Background gap={22} color="#393543" /><Controls showInteractive={false} />
      <SelectionFrame nodes={projection.nodes} />
    </ReactFlow>
  </RightDragSelect></BodyDragContext.Provider>;
});
// Personal preferences of the editing frame (this browser): kept by the shell so they survive switching
// Grape OP (Refactor.51.1). The Shared Sources panel remembers open/closed; the first time it is open.
// 編輯外框的個人偏好（這個瀏覽器）：由外殼保管，換 Grape OP 時不重設。共用來源面板記住開關，第一次預設打開。
type Prefs = { bodyDrag: boolean; snap: boolean; showSources: boolean; showCode: boolean;
  set(patch: Partial<Omit<Prefs, 'set'>>): void };
function usePrefs(): Prefs {
  const [prefs, setPrefs] = useState(() => ({ bodyDrag: true, snap: false, showCode: false,
    showSources: (() => { try { return localStorage.getItem('sgrapeSourcesPanel') !== 'closed'; } catch { return true; } })() }));
  return useMemo(() => ({ ...prefs, set: patch => {
    setPrefs(old => ({ ...old, ...patch }));
    if (patch.showSources !== undefined) {
      try { localStorage.setItem('sgrapeSourcesPanel', patch.showSources ? 'open' : 'closed'); } catch { /* storage may be blocked */ }
    }
  } }), [prefs]);
}
// No graph open: the same frame, nothing to show and nothing to do (Refactor.51.1). 沒有圖時：同一個外框，沒有內容、按鈕停用。
const idle = { undo: false, redo: false, dirty: false, phase: 'ready', level: 'info', message: '', revision: 0, version: 0,
  projection: { nodes: [], edges: [] }, declarations: [], references: {}, glsl: '', targetPath: '' } as unknown as EditorState;
const idleSubscribe = () => () => {}, idleSnapshot = () => idle;

// The editing frame: toolbar, status line, canvas, panels and footer, always the same layout whether a graph
// is open, loading or missing (human 2026-10-09: the layout must not jump while loading). With a session it
// edits that one graph; the shell above decides which one.
// 編輯外框：工具列、狀態列、畫布、面板、頁尾；有圖、載入中、沒有圖都是同一個版面（人類：載入中版面不能跑掉）。
// 有 session 時編輯那一張圖；換哪一張由外殼決定。
// td: the TD answering now; opened: the TD this graph was opened from (Refactor.52, shown side by side).
// td：現在回應的 TD；opened：開這張圖時的 TD（並排給人比對）。
function Workspace({ session, waiting, prefs, text, td, opened }: {
  session: EditorSession | null; waiting: Waiting; prefs: Prefs; text: (key: string) => string;
  td: TdIdentity | null; opened: TdIdentity | null;
}) {
  const state = useSyncExternalStore(session?.subscribe ?? idleSubscribe, session?.snapshot ?? idleSnapshot);
  const target = session?.host.target ?? '', draftKey = draftKeyOf(target);
  const tdNow = useRef(td); tdNow.current = td;
  const flow = useReactFlow();
  const [draft, setDraft] = useState(() => {
    if (!session) return null;
    try { return sessionStorage.getItem(draftKey); } catch { return null; }
  });
  const earlier = useMemo(() => { try { return draft ? JSON.parse(draft) as { source?: DraftSource } : null; } catch { return null; } }, [draft]);
  useEffect(() => {
    // Never overwrite a recovered draft before its owner chooses what to keep.
    // 尚未選擇時保留原草稿；快取失敗不能中止編輯或假裝已保存。
    if (!session || draft) return;
    try {
      // The draft says where it came from (Refactor.52): that TD, this page's address, when it was written.
      // 草稿記下來源：當時的 TD、這一頁的網址、寫入時間。
      if (state.dirty) sessionStorage.setItem(draftKey, JSON.stringify({ target, graph: session.graph(), source: sourceNow(tdNow.current) }));
      else sessionStorage.removeItem(draftKey);
    } catch { session.notice(new TextError(tr('draft.storageFailed', 'The browser cannot keep a draft; use Download draft to keep unsent changes.'))); }
  }, [state.version, state.dirty, session, draft, draftKey, target]);
  useEffect(() => {
    if (!session) return;
    const leave = (event: BeforeUnloadEvent) => { if (session.snapshot().dirty) { event.preventDefault(); event.returnValue = ''; } };
    const keys = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement;
      if (element.closest('input,select,textarea,[contenteditable="true"]')) return;
      if (!draft && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); session.history(event.shiftKey); }
    };
    addEventListener('beforeunload', leave); addEventListener('keydown', keys);
    return () => { removeEventListener('beforeunload', leave); removeEventListener('keydown', keys); };
  }, [session, draft]);
  const off = !session;
  return <SessionContext.Provider value={session}><TextContext.Provider value={text}>
    <nav aria-label={say(tr('toolbar.label', 'Editing toolbar'))} inert={!!draft}>
      <select aria-label={say(tr('toolbar.addNode', 'Add node'))} value="" disabled={off} onChange={event => {
        const canvas = document.querySelector('.canvas')!.getBoundingClientRect();
        const entry = creatableEntries[Number(event.target.value)]!;
        session!.add(entry.uuid, flow.screenToFlowPosition({ x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 }), entry.params);
      }}><option value="" disabled>{say(tr('toolbar.addNodePrompt', '+ Add node'))}</option>{creatableEntries.map((entry, i) => <option key={entry.uuid + ':' + entry.key} value={i}>
        {entry.literal ? entry.label : text(entry.label)}</option>)}</select>
      <button disabled={!state.undo} onClick={() => session!.history(false)}>{say(tr('toolbar.undo', 'Undo'))}</button>
      <button disabled={!state.redo} onClick={() => session!.history(true)}>{say(tr('toolbar.redo', 'Redo'))}</button>
      <label><input type="checkbox" checked={prefs.bodyDrag} onChange={event => prefs.set({ bodyDrag: event.target.checked })} />{say(tr('toolbar.bodyDrag', 'Body drag'))}</label>
      <label><input type="checkbox" checked={prefs.snap} onChange={event => prefs.set({ snap: event.target.checked })} />{say(tr('toolbar.snap', 'Snap'))}</label>
      <span className="spacer" />
      <button disabled={off || !state.dirty || ['sending', 'offline', 'uncertain', 'conflict'].includes(state.phase)} onClick={() => void session!.flush()}>{say(tr('toolbar.apply', 'Apply'))}</button>
      <button disabled={off || state.phase === 'sending'} onClick={() => void session!.save()}>{say(tr('toolbar.saveProject', 'Save TD project'))}</button>
      <button aria-pressed={prefs.showSources} onClick={() => prefs.set({ showSources: !prefs.showSources })}>{say(tr('toolbar.sources', 'Shared Sources'))}</button>
      <button onClick={() => prefs.set({ showCode: !prefs.showCode })}>{say(tr('toolbar.glsl', 'GLSL'))}</button>
      <button disabled={off} onClick={() => download({ target, graph: session!.graph(), source: sourceNow(td) })}>{say(tr('toolbar.downloadDraft', 'Download draft'))}</button>
    </nav>
    <div role="status" className={`status ${state.phase} ${state.level}`}><StatusText message={session ? state.message : waiting.message} />
      <small>{session ? say(tr('status.line', '{state} · revision {revision}', { revision: state.revision,
        state: state.phase === 'sending' ? tr('status.sending', 'Sending to TD') : state.dirty ? tr('status.unsent', 'Changes not yet sent to TD') : tr('status.synced', 'Synced with TD') }))
        : say(tr('status.noGraph', 'No graph open'))}</small>
      {session && ['offline', 'uncertain'].includes(state.phase) && <button onClick={() => void session.check()}>{say(tr('status.retry', 'Retry connection'))}</button>}
      {session && state.phase === 'offline' && <details className="recovery-help"><summary>{say(tr('status.howToRecover', 'How to recover'))}</summary>{say(recoveryHelp)}</details>}
    </div>
    {session && draft && <div className="draft-notice">{say(tr('draft.found', "Found an earlier draft for this page; showing TD's graph."))}
      {/* Side by side for people to compare; nothing is judged (Q63). 並排給人比對，不做判斷。 */}
      <span className="identity-compare"><span>{say(describeSource(earlier?.source))}</span><span>{say(describeNow(td))}</span></span>
      <button onClick={() => { try { const saved = JSON.parse(draft); if (saved.target !== target) throw new TextError(tr('draft.otherTarget', 'This draft belongs to another Grape OP.')); if (session.restoreDraft(saved.graph)) setDraft(null); } catch (error) { session.notice(error); } }}>{say(tr('draft.restore', 'Restore draft'))}</button>
      <button onClick={() => { try { download(JSON.parse(draft)); } catch (error) { session.notice(error); } }}>{say(tr('draft.downloadEarlier', 'Download earlier draft'))}</button>
      <button onClick={() => { setDraft(null); }}>{say(tr('draft.useTd', "Use TD's graph"))}</button>
    </div>}
    <main>
      {/* Floating and non-modal: editing continues while the choice is pending (Q7/Q28). */}
      {session && state.phase === 'conflict' && <div className="conflict-float" role="group" aria-label={say(tr('conflict.label', 'Choose a version'))}>
        <span>{say(conflictMessage)}</span>
        <span className="identity-compare"><span>{say(tr('conflict.opened', 'Opened from: {td}', { td: tdLine(opened) }))}</span>
          <span>{say(tr('conflict.tdNow', 'TD now: {td}', { td: tdLine(td) }))}</span></span>
        <button className="primary" onClick={() => void session.overwrite()}>{say(tr('conflict.useEditor', 'Editor (recommended)'))}</button>
        <button onClick={() => void session.useRemote()}>{say(tr('conflict.useTd', 'TD'))}</button>
      </div>}
      <div className="canvas" inert={!!draft}>
        {session ? <Canvas session={session} projection={state.projection} bodyDrag={prefs.bodyDrag} snap={prefs.snap} />
          : <EmptyCanvas message={waiting.message}>{waiting.reset && <button onClick={() => {
            if (confirm(say(tr('open.resetConfirm', "TD's graph will be replaced by the default graph, and the content listed above will be deleted. Continue?")))) void waiting.reset!();
          }}>{say(tr('open.reset', 'Load the default graph'))}</button>}</EmptyCanvas>}
        {draft && <div className="draft-blocker" />}</div>
      {prefs.showSources && <PanelShell title={tr('sources.title', 'Shared Sources')} onClose={() => prefs.set({ showSources: false })}>
        {session ? <SourcesPanel declarations={state.declarations} references={state.references} />
          : <p className="hint">{say(tr('sources.noGraph', 'Open a Grape OP to see its shared sources.'))}</p>}</PanelShell>}
      {prefs.showCode && <pre aria-label={say(tr('glsl.label', 'Generated GLSL'))}>{state.glsl || say(tr('glsl.empty', 'The generated GLSL appears after the first apply.'))}</pre>}</main>
    <footer>{say(tr('footer.scope', 'This round: common TOP nodes (no Uniforms or subgraphs) · changes apply when you release or commit a value · Ctrl/Cmd+Z to undo'))}</footer>
  </TextContext.Provider></SessionContext.Provider>;
}

// What the shell shows while no graph is open: every stage is a normal editor with nothing drawn yet
// (human 2026-10-09). 還沒有圖時外殼顯示什麼：每個階段都是正常的編輯器、只是畫布上還沒有東西。
type Waiting = { message: Message | string; reset?: () => Promise<void> };
function App({ token, bootstrap, text, version }: { token: string; bootstrap: Bootstrap; text: (key: string) => string; version: string }) {
  const [target, setTarget] = useState(addressTarget);
  const [session, setSession] = useState<EditorSession | null>(null), [path, setPath] = useState('');
  const [waiting, setWaiting] = useState<Waiting>({ message: '' }), [reload, setReload] = useState(0);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null), [pending, setPending] = useState('');
  const prefs = usePrefs();
  // Which TD answers (Refactor.52): asked once at start, then updated by every reply that says so.
  // 哪個 TD 在回應：開頁時問一次，之後每個回覆都更新。
  const [td, setTd] = useState<TdIdentity | null>(null), [opened, setOpened] = useState<TdIdentity | null>(null);
  useEffect(() => { listGrapeOps(token).then(found => { if (found.td) setTd(found.td); }, () => { /* shown when the menu opens */ }); }, [token]);
  // Open the Grape OP in the address. 打開網址上的 Grape OP。
  useEffect(() => {
    let live = true, opened: EditorSession | null = null;
    setSession(null); setPath(''); setOpened(null);
    // "No target" and "wrong target" (human 2026-10-09). 「沒指目標」與「錯指目標」。
    if (!target) { setWaiting({ message: tr('picker.noTarget', 'Choose a Grape OP to edit.') }); return; }
    const wrong = { message: tr('picker.wrongTarget', 'This Grape OP is not in the current project. Choose another one.') };
    if (!/^[a-f0-9]{32}$/.test(target)) { setWaiting(wrong); return; }
    setWaiting({ message: tr('picker.opening', 'Opening the Grape OP…') });
    const client = new HostClient(target, token);
    client.seen = setTd;
    client.call<StateResponse>('state').then(loaded => {
      if (!live) return;
      setOpened(loaded.td ?? null);
      opened = new EditorSession(client, bootstrap, loaded, undefined, undefined, undefined, version);
      setSession(opened); setPath(loaded.target);
    }, error => {
      if (!live) return;
      if (error instanceof HostError && error.status === 404) { setWaiting(wrong); return; }
      setWaiting({ message: tr('picker.cannotOpen', 'This Grape OP cannot be opened here: {reason}', { reason: errorText(error) }),
        reset: error instanceof UnsupportedGraphError ? async () => { await resetToDefault(client, bootstrap, version); setReload(n => n + 1); } : undefined });
    });
    return () => { live = false; opened?.dispose(); };
  }, [target, token, bootstrap, version, reload]);
  useEffect(() => {
    const back = () => setTarget(addressTarget());
    addEventListener('popstate', back);
    return () => removeEventListener('popstate', back);
  }, []);
  // The one switching behaviour; entries only call the menu up (Refactor.51). 唯一的切換行為；入口只負責叫出選單。
  const closeMenu = useCallback(() => setAnchor(null), []);
  const go = useCallback((id: string) => { history.pushState(null, '', '/shader/' + id + '/'); setTarget(id); setPending(''); }, []);
  const shell = useMemo<Shell>(() => ({
    current: target,
    choose: id => { if (id === target) return; if (session?.snapshot().dirty) setPending(id); else go(id); },
    openMenu: element => setAnchor(element),
  }), [target, session, go]);
  const keepDraftAndGo = () => {
    try { sessionStorage.setItem(draftKeyOf(target), JSON.stringify({ target, graph: session!.graph(), source: sourceNow(td) })); go(pending); }
    catch (error) { session?.notice(error); }
  };
  const applyAndGo = async () => { await session!.flush(); if (!session!.snapshot().dirty) go(pending); };
  return <ShellContext.Provider value={shell}><TextContext.Provider value={text}>
    <header><strong>TD-Grape <small>React · TOP · {version}</small></strong>
      {/* The project file before the Grape OP path, as in the old product (Refactor.52); TD's build on hover.
          專案檔名放在 Grape OP 路徑前面（照舊）；滑鼠停留顯示 TD 版本。 */}
      {td && <span className="project-file" title={say(buildLabel(td))}>{td.file}</span>}
      <GrapeOpEntry className="target" label={path || tr('picker.choose', 'Choose a Grape OP')} /></header>
    {/* One frame for every stage; a new session starts its own editing state (drafts are per Grape OP).
        每個階段同一個外框；新的 session 有自己的編輯狀態（草稿依 Grape OP 分開）。 */}
    <Workspace key={session ? target : ''} session={session} waiting={waiting} prefs={prefs} text={text} td={td} opened={opened} />
    {anchor && <GrapeOpMenu anchor={anchor} token={token} onClose={closeMenu} seen={setTd} />}
    {pending && <div className="switch-dialog" role="dialog" aria-label={say(tr('switch.title', 'Switch Grape OP'))}>
      <p>{say(tr('switch.explanation', 'Some changes are not in TD yet. Apply them to TD, or keep a draft in this browser tab before switching (it can be restored when you come back).'))}</p>
      <button className="primary" onClick={() => void applyAndGo()}>{say(tr('switch.apply', 'Apply, then switch'))}</button>
      <button onClick={keepDraftAndGo}>{say(tr('switch.keep', 'Keep a draft, then switch'))}</button>
      <button onClick={() => setPending('')}>{say(tr('switch.cancel', 'Cancel'))}</button>
    </div>}
  </TextContext.Provider></ShellContext.Provider>;
}

async function start() {
  const token = location.hash.slice(1) || sessionStorage.getItem('sgrapeToken') || '';
  sessionStorage.setItem('sgrapeToken', token); history.replaceState(null, '', location.pathname + location.search);
  // The shell needs no Grape OP to start (Refactor.51). 外殼開啟不需要 Grape OP。
  const [files, locales, build] = await Promise.all([
    fetch('/editor-bootstrap.json').then(response => response.json()) as Promise<Bootstrap>,
    fetch('/locales.json').then(response => response.json()),
    fetch('/build-info.json').then(response => response.json()),
  ]);
  const text = (key: string) => locales.messages?.[key]?.en ?? key;
  createRoot(document.getElementById('root')!).render(<StrictMode><ReactFlowProvider>
    <App token={token} bootstrap={files} text={text} version={build.version} /></ReactFlowProvider></StrictMode>);
}
function StartupError({ error, reset }: { error: unknown; reset?: () => Promise<void> }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  return <div className="startup-error">
    <h1>{say(tr('open.title', 'Cannot open the editor'))}</h1><p style={{ whiteSpace: 'pre-line' }}>{say(errorText(error))}</p>
    <p>{say(tr('open.nothingSent', 'No edit or apply request was sent.'))}</p>
    {reset && <p><button disabled={busy} onClick={() => {
      if (!confirm(say(tr('open.resetConfirm', "TD's graph will be replaced by the default graph, and the content listed above will be deleted. Continue?")))) return;
      setBusy(true); setMessage(say(tr('open.resetting', 'Loading the default graph…')));
      reset().then(() => location.reload(), failure => { setBusy(false); setMessage(say(tr('open.resetFailed', 'Loading failed: {reason}', { reason: errorText(failure) }))); });
    }}>{say(tr('open.reset', 'Load the default graph'))}</button>{message && ' ' + message}</p>}
  </div>;
}
// Only when the editor's own files cannot be read; a Grape OP problem is shown inside the shell.
// 只有編輯器自己的檔案讀不到時才用；Grape OP 的問題在外殼裡顯示。
void start().catch(error => createRoot(document.getElementById('root')!).render(<StartupError error={error} />));
