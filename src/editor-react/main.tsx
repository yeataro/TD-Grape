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
import { NodeCard, SessionContext, TextContext, BodyDragContext } from './NodeCard';
import type { Projection, FlowNode, FlowEdge } from './projection';

const nodeTypes: NodeTypes = { grape: NodeCard };
// The only editor entry (Refactor.24): the Grape OP's Edit opens /shader/<id>/; ?target=<id> also works.
// 唯一的編輯器入口：Grape OP 的 Edit 打開 /shader/<id>/；?target=<id> 亦可。
const target = new URLSearchParams(location.search).get('target') ?? location.pathname.match(/^\/shader\/([a-f0-9]{32})\/$/)?.[1] ?? '';
const draftKey = 'grape-react-draft:' + target;
const recoveryHelp = '請在執行 TD 的電腦上確認：TD 仍開著，若已最小化請還原視窗；全域 Cooking 已開啟；TD 若正在處理耗時工作請稍候；遠端裝置的區網連線正常。TD 重開後，請從 Grape 元件重新開啟編輯器。';
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
        if (state.toHandle && !state.isValid) session.notice('接線被核心拒絕：型別或圖結構不相容');
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
    } catch { session.notice('瀏覽器無法暫存草稿；請使用下載草稿保存未送出的修改。'); }
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
    <nav aria-label="編輯工具列" inert={!!draft}>
      <select aria-label="新增節點" value="" onChange={event => {
        const canvas = document.querySelector('.canvas')!.getBoundingClientRect();
        session.add(event.target.value, flow.screenToFlowPosition({ x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 }));
      }}><option value="" disabled>＋ 新增節點</option>{creatableDefinitions.map(uuid => <option key={uuid} value={uuid}>
        {text(core.registry.get(uuid)!.catalog.definition.label)}</option>)}</select>
      <button disabled={!state.undo} onClick={() => session.history(false)}>Undo</button>
      <button disabled={!state.redo} onClick={() => session.history(true)}>Redo</button>
      <label><input type="checkbox" checked={bodyDrag} onChange={event => setBodyDrag(event.target.checked)} />Body 拖曳</label>
      <label><input type="checkbox" checked={snap} onChange={event => setSnap(event.target.checked)} />Snap</label>
      <span className="spacer" />
      <button disabled={!state.dirty || ['sending', 'offline', 'uncertain', 'conflict'].includes(state.phase)} onClick={() => void session.flush()}>套用</button>
      <button disabled={state.phase === 'sending'} onClick={() => void session.save()}>保存 TD 專案</button>
      <button onClick={() => setShowCode(!showCode)}>GLSL</button>
      <button onClick={() => download({ target, graph: session.graph() })}>下載草稿</button>
    </nav>
    <div role="status" className={`status ${state.phase}`}><span>{state.message}</span>
      <small>{state.phase === 'sending' ? '正在送到 TD' : state.dirty ? '有修改尚未送到 TD' : '已同步到 TD'} · revision {state.revision}</small>
      {['offline', 'uncertain'].includes(state.phase) && <button onClick={() => void session.check()}>重試連線</button>}
      {state.phase === 'offline' && <details className="recovery-help"><summary>如何恢復</summary>{recoveryHelp}</details>}
    </div>
    {draft && <div className="draft-notice">找到此頁先前的草稿；目前顯示 TD 文件。
      <button onClick={() => { try { const saved = JSON.parse(draft); if (saved.target !== target) throw Error('草稿目標不同'); if (session.restoreDraft(saved.graph)) setDraft(null); } catch (error) { session.notice(error); } }}>還原草稿</button>
      <button onClick={() => { try { download(JSON.parse(draft)); } catch (error) { session.notice(error); } }}>下載先前草稿</button>
      <button onClick={() => { setDraft(null); }}>使用 TD 文件</button>
    </div>}
    <main>
      {/* Floating and non-modal: editing continues while the choice is pending (Q7/Q28). */}
      {state.phase === 'conflict' && <div className="conflict-float" role="group" aria-label="版本選擇">
        <span>TD 端的圖似乎有被修改，請選擇要使用的版本。</span>
        <button className="primary" onClick={() => void session.overwrite()}>編輯端（建議）</button>
        <button onClick={() => void session.useRemote()}>TD 端</button>
      </div>}
      <div className="canvas" inert={!!draft}><Canvas session={session} projection={state.projection} bodyDrag={bodyDrag} snap={snap} />{draft && <div className="draft-blocker" />}</div>
      {showCode && <pre aria-label="Generated GLSL">{state.glsl || '首次套用後顯示產碼。'}</pre>}</main>
    <footer>本輪：TOP 常用節點（不含 Uniform／子圖）· 放開／提交數值後自動套用 · Ctrl/Cmd＋Z 撤銷</footer>
  </TextContext.Provider></SessionContext.Provider>;
}

let host: HostClient | undefined, bootstrap: Bootstrap | undefined;
async function start() {
  const token = location.hash.slice(1) || sessionStorage.getItem('sgrapeToken') || '';
  sessionStorage.setItem('sgrapeToken', token); history.replaceState(null, '', location.pathname + location.search);
  if (!target) throw Error('沒有指定要編輯的 Grape OP。請在 TD 裡按 Grape OP 的 Edit 開啟編輯器。');
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
    <h1>無法在此入口開啟</h1><p style={{ whiteSpace: 'pre-line' }}>{String(error)}</p><p>此入口未送出編輯或套用請求。</p>
    {reset && <p><button disabled={busy} onClick={() => {
      if (!confirm('TD 這張圖會被換成預設圖，上面列出的內容會被刪除。確定？')) return;
      setBusy(true); setMessage('正在載入預設圖…');
      reset().then(() => location.reload(), failure => { setBusy(false); setMessage('載入失敗：' + String(failure)); });
    }}>載入預設圖</button>{message && ' ' + message}</p>}
  </div>;
}
void start().catch(error => {
  const client = host, files = bootstrap;
  const reset = error instanceof UnsupportedGraphError && client && files ? async () => resetToDefault(client, files,
    (await fetch('/build-info.json').then(response => response.json())).version) : undefined;
  createRoot(document.getElementById('root')!).render(<StartupError error={error} reset={reset} />);
});
