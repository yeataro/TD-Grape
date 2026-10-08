import { StrictMode, useEffect, useState, useSyncExternalStore, memo } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlow, ReactFlowProvider, Background, Controls, useReactFlow, getBezierPath,
  type ConnectionLineComponentProps, type NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './theme/dark.css';
import './style.css';
import { core, creatableDefinitions, typeColor, UnsupportedGraphError, type Bootstrap } from './core';
import { HostClient, type StateResponse } from './host';
import { Editor as EditorSession } from './editor';
import { resetToDefault } from './host_sync';
import { RightDragSelect } from './RightDragSelect';
import { tr, say, TextError, errorText, type Message } from './text';
import { conflictMessage } from './host_sync';
import { NodeCard, SessionContext, TextContext, BodyDragContext } from './NodeCard';
import type { Projection, FlowNode, FlowEdge } from './projection';

const nodeTypes: NodeTypes = { grape: NodeCard };
// The only editor entry (Refactor.24): the Grape OP's Edit opens /shader/<id>/; ?target=<id> also works.
// 唯一的編輯器入口：Grape OP 的 Edit 打開 /shader/<id>/；?target=<id> 亦可。
const target = new URLSearchParams(location.search).get('target') ?? location.pathname.match(/^\/shader\/([a-f0-9]{32})\/$/)?.[1] ?? '';
const draftKey = 'grape-react-draft:' + target;
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
      edgesReconnectable={false} snapToGrid={snap} snapGrid={[22, 22]} fitView fitViewOptions={{ maxZoom: 1, padding: .2 }}
      minZoom={.15} maxZoom={2.5} colorMode="dark" deleteKeyCode={['Backspace', 'Delete']}
      selectionKeyCode={null}>{/* box selection is RightDragSelect's (touching counts, Shift adds; Q33/Q39) */}
      <Background gap={22} color="#393543" /><Controls showInteractive={false} />
    </ReactFlow>
  </RightDragSelect></BodyDragContext.Provider>;
});
function Editor({ session, text, version }: { session: EditorSession; text: (key: string) => string; version: string }) {
  const state = useSyncExternalStore(session.subscribe, session.snapshot);
  const flow = useReactFlow(), [bodyDrag, setBodyDrag] = useState(true), [snap, setSnap] = useState(false);
  const [showCode, setShowCode] = useState(false), [draft, setDraft] = useState(() => {
    try { return sessionStorage.getItem(draftKey); } catch { return null; }
  });
  useEffect(() => {
    // Never overwrite a recovered draft before its owner chooses what to keep.
    // 尚未選擇時保留原草稿；快取失敗不能中止編輯或假裝已保存。
    if (draft) return;
    try {
      if (state.dirty) sessionStorage.setItem(draftKey, JSON.stringify({ target, graph: session.graph() }));
      else sessionStorage.removeItem(draftKey);
    } catch { session.notice(new TextError(tr('draft.storageFailed', 'The browser cannot keep a draft; use Download draft to keep unsent changes.'))); }
  }, [state.version, state.dirty, session, draft]);
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => { if (session.snapshot().dirty) { event.preventDefault(); event.returnValue = ''; } };
    const keys = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement;
      if (element.closest('input,select,textarea,[contenteditable="true"]')) return;
      if (!draft && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); session.history(event.shiftKey); }
    };
    addEventListener('beforeunload', leave); addEventListener('keydown', keys);
    return () => { removeEventListener('beforeunload', leave); removeEventListener('keydown', keys); };
  }, [session, draft]);
  return <SessionContext.Provider value={session}><TextContext.Provider value={text}>
    <header><strong>TD-Grape <small>React · TOP · {version}</small></strong><span className="target">{state.targetPath}</span>
    </header>
    <nav aria-label={say(tr('toolbar.label', 'Editing toolbar'))} inert={!!draft}>
      <select aria-label={say(tr('toolbar.addNode', 'Add node'))} value="" onChange={event => {
        const canvas = document.querySelector('.canvas')!.getBoundingClientRect();
        session.add(event.target.value, flow.screenToFlowPosition({ x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 }));
      }}><option value="" disabled>{say(tr('toolbar.addNodePrompt', '+ Add node'))}</option>{creatableDefinitions.map(uuid => <option key={uuid} value={uuid}>
        {text(core.registry.get(uuid)!.catalog.definition.label)}</option>)}</select>
      <button disabled={!state.undo} onClick={() => session.history(false)}>{say(tr('toolbar.undo', 'Undo'))}</button>
      <button disabled={!state.redo} onClick={() => session.history(true)}>{say(tr('toolbar.redo', 'Redo'))}</button>
      <label><input type="checkbox" checked={bodyDrag} onChange={event => setBodyDrag(event.target.checked)} />{say(tr('toolbar.bodyDrag', 'Body drag'))}</label>
      <label><input type="checkbox" checked={snap} onChange={event => setSnap(event.target.checked)} />{say(tr('toolbar.snap', 'Snap'))}</label>
      <span className="spacer" />
      <button disabled={!state.dirty || ['sending', 'offline', 'uncertain', 'conflict'].includes(state.phase)} onClick={() => void session.flush()}>{say(tr('toolbar.apply', 'Apply'))}</button>
      <button disabled={state.phase === 'sending'} onClick={() => void session.save()}>{say(tr('toolbar.saveProject', 'Save TD project'))}</button>
      <button onClick={() => setShowCode(!showCode)}>{say(tr('toolbar.glsl', 'GLSL'))}</button>
      <button onClick={() => download({ target, graph: session.graph() })}>{say(tr('toolbar.downloadDraft', 'Download draft'))}</button>
    </nav>
    <div role="status" className={`status ${state.phase} ${state.level}`}><StatusText message={state.message} />
      <small>{say(tr('status.line', '{state} · revision {revision}', { revision: state.revision,
        state: state.phase === 'sending' ? tr('status.sending', 'Sending to TD') : state.dirty ? tr('status.unsent', 'Changes not yet sent to TD') : tr('status.synced', 'Synced with TD') }))}</small>
      {['offline', 'uncertain'].includes(state.phase) && <button onClick={() => void session.check()}>{say(tr('status.retry', 'Retry connection'))}</button>}
      {state.phase === 'offline' && <details className="recovery-help"><summary>{say(tr('status.howToRecover', 'How to recover'))}</summary>{say(recoveryHelp)}</details>}
    </div>
    {draft && <div className="draft-notice">{say(tr('draft.found', "Found an earlier draft for this page; showing TD's graph."))}
      <button onClick={() => { try { const saved = JSON.parse(draft); if (saved.target !== target) throw new TextError(tr('draft.otherTarget', 'This draft belongs to another Grape OP.')); if (session.restoreDraft(saved.graph)) setDraft(null); } catch (error) { session.notice(error); } }}>{say(tr('draft.restore', 'Restore draft'))}</button>
      <button onClick={() => { try { download(JSON.parse(draft)); } catch (error) { session.notice(error); } }}>{say(tr('draft.downloadEarlier', 'Download earlier draft'))}</button>
      <button onClick={() => { setDraft(null); }}>{say(tr('draft.useTd', "Use TD's graph"))}</button>
    </div>}
    <main>
      {/* Floating and non-modal: editing continues while the choice is pending (Q7/Q28). */}
      {state.phase === 'conflict' && <div className="conflict-float" role="group" aria-label={say(tr('conflict.label', 'Choose a version'))}>
        <span>{say(conflictMessage)}</span>
        <button className="primary" onClick={() => void session.overwrite()}>{say(tr('conflict.useEditor', 'Editor (recommended)'))}</button>
        <button onClick={() => void session.useRemote()}>{say(tr('conflict.useTd', 'TD'))}</button>
      </div>}
      <div className="canvas" inert={!!draft}><Canvas session={session} projection={state.projection} bodyDrag={bodyDrag} snap={snap} />{draft && <div className="draft-blocker" />}</div>
      {showCode && <pre aria-label={say(tr('glsl.label', 'Generated GLSL'))}>{state.glsl || say(tr('glsl.empty', 'The generated GLSL appears after the first apply.'))}</pre>}</main>
    <footer>{say(tr('footer.scope', 'This round: common TOP nodes (no Uniforms or subgraphs) · changes apply when you release or commit a value · Ctrl/Cmd+Z to undo'))}</footer>
  </TextContext.Provider></SessionContext.Provider>;
}

let host: HostClient | undefined, bootstrap: Bootstrap | undefined;
async function start() {
  const token = location.hash.slice(1) || sessionStorage.getItem('sgrapeToken') || '';
  sessionStorage.setItem('sgrapeToken', token); history.replaceState(null, '', location.pathname + location.search);
  if (!target) throw new TextError(tr('open.noTarget', 'No Grape OP to edit was given. In TD, press Open Editor on a Grape OP.'));
  const client = host = new HostClient(target, token);
  const [loaded, files, locales, build] = await Promise.all([
    client.call<StateResponse>('state'), fetch('/editor-bootstrap.json').then(response => response.json()) as Promise<Bootstrap>,
    fetch('/locales.json').then(response => response.json()),
    fetch('/build-info.json').then(response => response.json()),
  ]);
  bootstrap = files; // kept for the startup-error reset
  const session = new EditorSession(client, files, loaded, undefined, undefined, undefined, build.version);
  const text = (key: string) => locales.messages?.[key]?.en ?? key;
  createRoot(document.getElementById('root')!).render(<StrictMode><ReactFlowProvider><Editor session={session} text={text} version={build.version} /></ReactFlowProvider></StrictMode>);
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
void start().catch(error => {
  const client = host, files = bootstrap;
  const reset = error instanceof UnsupportedGraphError && client && files ? async () => resetToDefault(client, files,
    (await fetch('/build-info.json').then(response => response.json())).version) : undefined;
  createRoot(document.getElementById('root')!).render(<StartupError error={error} reset={reset} />);
});
