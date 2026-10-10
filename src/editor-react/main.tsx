import { StrictMode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, memo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlow, ReactFlowProvider, Background, Controls, Panel, useStore, useReactFlow, useConnection, getBezierPath,
  type ConnectionLineComponentProps, type NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './theme/dark.css';
import './theme/td.css';
import './theme/light.css';
import './theme/sizes.css';
import { appearanceSubscribe, currentTheme } from './appearance';
import './style.css';
import { typeColor, UnsupportedGraphError, type Bootstrap } from './core';
import { HostClient, HostError, type StateResponse } from './host';
import { Editor as EditorSession, type EditorState, type WireEnd } from './editor';
import { resetToDefault } from './host_sync';
import { RightDragSelect, pressKind } from './RightDragSelect';
import { SelectionFrame } from './SelectionFrame';
import { tr, say, TextError, errorText, language, languageSubscribe, type Message } from './text';
import { conflictMessage } from './host_sync';
import { glslErrors, errorNodes as findErrorNodes } from './glsl_errors';
import { PanelZone, useLayout, type Layout, type PanelView } from './layout';
import { PANELS, type PanelInput } from './panels';
import { TitleBar, LocationBar, NetworkBar, FootBar, type CanvasPrefs } from './bars';
import { NodeCard } from './NodeCard';
import { SessionContext, TextContext, BodyDragContext, MergingContext, ErrorNodesContext } from './contexts';
import { addChoices, type AddChoice } from './add_entries';
import { DRAG_TYPE } from './AddNodePanel';
import { CreateNode, type CreateRequest } from './CreateNode';
import { OptionsContext, defaultOptions, useOptions } from './options';
import { ShellContext, GrapeOpEntry, GrapeOpMenu, EmptyCanvas, LoadingCanvas, useShell, type Shell } from './shell';
import { listGrapeOps } from './grape_ops';
import { sourceNow, draftRow, nowRow, tdRow, detailLabel, tabTitle, type TdIdentity, type DraftSource } from './td_identity';
import { AlignedRows } from './controls';
import { DropdownMenu } from './DropdownMenu';
import type { Projection, FlowNode, FlowEdge } from './projection';
import { readPreference, writePreference } from './preferences';
import { MIN_ZOOM, MAX_ZOOM, dampCanvas, frameMs, frameNodes, glide } from './viewport';

const nodeTypes: NodeTypes = { grape: NodeCard };
// The Grape OP in the address (Refactor.24): the Grape OP's Edit opens /shader/<id>/; ?target=<id> also
// works. No target, or one the project does not have, is a normal state of the shell (Refactor.51).
// 網址上的 Grape OP：Grape OP 的 Edit 打開 /shader/<id>/；?target=<id> 亦可。沒有或找不到都是外殼的一般狀態。
const addressTarget = () => new URLSearchParams(location.search).get('target') ?? location.pathname.match(/^\/shader\/([^/]+)\/$/)?.[1] ?? '';
const draftKeyOf = (target: string) => 'grape-react-draft:' + target;
function StuckNotice({ state, session, onShowGlsl }: { state: EditorState; session: EditorSession; onShowGlsl(line?: number): void }) {
  const { failure, lastKnownGood } = state.stuck!, first = glslErrors(failure.log)[0];
  const revision = lastKnownGood?.revision ?? '';
  return <div className="floating-notice error" role="group" aria-label={say(tr('shader.stuckLabel', 'Shader not applied'))}>
    <span>{say(failure.kind === 'internal'
      ? tr('shader.stuckInternal', 'TD-Grape ran into an internal error while applying the Shader; TD keeps running revision {revision}.', { revision })
      : tr('shader.stuckCompile', 'TD could not compile the Shader; TD keeps running revision {revision}.', { revision }))}</span>
    <span className="notice-detail">{first ? say(tr('glsl.lineError', 'Line {line}: {message}', { line: first.line, message: first.text }))
      : failure.log.split('\n').find(line => line.trim()) ?? ''}</span>
    {/* How to get out, and what editing costs meanwhile (Refactor.63.6.4, human 2026-10-10): each edit of the program is tried
        in TD, a compile that can pause TD briefly. 怎麼脫困，以及這段期間編輯的代價（人類）：每次改到程式 TD 都會試編，可能短暫卡頓。 */}
    {/* One sentence a line (human 2026-10-10: known long text breaks at the full stop). 一句一行（人類：已知較長的字在句號換行）。 */}
    {failure.kind === 'compile' && <span className="notice-detail">{say(tr('shader.stuckHint', 'Fix it by editing, or revert.'))}<br />
      {say(tr('shader.stuckCost', 'Until it compiles, TD tries again on each edit and may pause briefly.'))}</span>}
    <div className="notice-actions">
      <button onClick={() => onShowGlsl(first?.line)}>{say(tr('shader.showGlsl', 'Show in GLSL'))}</button>
      {lastKnownGood && <button onClick={session.revertToLastGood}>{say(tr('shader.revert', 'Revert to last good'))}</button>}</div>
  </div>;
}
function download(value: unknown, name = 'grape-draft.json') {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}
function ConnectionPreview(props: ConnectionLineComponentProps<FlowNode>) {
  const options = useOptions();
  const port = (props.fromHandle.type === 'source' ? props.fromNode.data.outputs : props.fromNode.data.inputs)
    .find(port => port.key === props.fromHandle.id);
  const [path] = getBezierPath({ sourceX: props.fromX, sourceY: props.fromY, targetX: props.toX, targetY: props.toY,
    sourcePosition: props.fromPosition, targetPosition: props.toPosition });
  // Over blank canvas from an output, a "+" says releasing opens Create node (Blender; human 2026-10-09). From an
  // input there is none: releasing there pulls the wire. 從輸出拉、停在空白處時線頭有「＋」：放開會打開新增節點；從輸入拉沒有（放開是拔線）。
  const plus = options.wireEndPlus && options.wireDropCreates && props.fromHandle.type === 'source' && !props.toHandle;
  // The dragged wire takes the component of a one-component port too (legacy graph_ui.js:1627). 拖曳中的線也帶單一分量。
  const view = props.fromNode.data.view.components, components = props.fromHandle.type === 'source'
    ? view?.outputs?.[props.fromHandle.id ?? ''] : view?.inputs?.[props.fromHandle.id ?? ''];
  return <g className={components?.length === 1 ? 'component-' + components[0] : undefined}><path d={path} fill="none"
    style={{ stroke: typeColor(port?.type ?? ''), strokeWidth: 'var(--wire-width-drag)' }} strokeDasharray="5 4" />
    {plus && <text className="wire-plus" x={props.toX + 9} y={props.toY - 7}>+</text>}</g>;
}
// The grid thins out when zoomed out, as the legacy editor (legacy app.js:590–598): the spacing doubles until
// dots are at least 14px apart on screen and the dots shrink with the zoom; Snap keeps the 22-unit grid.
// 拉遠時網格變疏（照舊產品）：螢幕上點距小於 14px 就把間距加倍，點跟著縮小；Snap 仍對齊 22 單位的網格。
const GRID = 22;
function AdaptiveGrid() {
  const zoom = useStore(state => state.transform[2]);
  let gap = GRID;
  while (gap * zoom < 14) gap *= 2;
  const dot = Math.max(.45, Math.min(1.65, 1.05 * Math.pow(zoom, .65)));
  return <Background gap={gap} size={dot / zoom} color="var(--grid-dot)" />;
}
// The zoom as a number; clicked, a list of common zooms opens (upward from the corner), high to low as the common values
// (human 2026-10-09). 縮放比例；點了打開常用縮放的清單（從角落往上開），和常用值一樣由高到低（人類）。
const zoomPresets = [200, 150, 100, 75, 50, 25];
function ZoomReadout() {
  const zoom = Math.round(useStore(state => state.transform[2]) * 100), flow = useReactFlow();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return <>
    <button type="button" className="zoom-readout" aria-haspopup="menu" aria-expanded={!!anchor}
      aria-label={say(tr('canvas.zoom', 'Zoom'))} title={say(tr('canvas.zoom', 'Zoom'))}
      onClick={event => setAnchor(anchor ? null : event.currentTarget)}>{zoom}%</button>
    {anchor && <DropdownMenu anchor={anchor} label={say(tr('canvas.zoom', 'Zoom'))} fit onClose={() => setAnchor(null)}
      items={zoomPresets.map(value => ({ key: String(value), label: `${value}%`, checked: zoom === value, select: () => void flow.zoomTo(value / 100, { duration: frameMs(), ...glide }) }))} />}
  </>;
}
const Canvas = memo(function Canvas({ session, projection, bodyDrag, snap, boxSelect, damping, errorNodes, stage, onCreate, onDropChoice }: {
  session: EditorSession; projection: Projection; bodyDrag: boolean; snap: boolean; boxSelect: boolean; damping: boolean;
  errorNodes: ReadonlySet<string> | null; stage: string;
  onCreate(request: CreateRequest): void; onDropChoice(id: string, at: { x: number; y: number }): void;
}) {
  const options = useOptions(), flow = useReactFlow();
  // Canvas damping takes the mouse's wheel and background drag over only while on (viewport.ts). 畫布阻尼只在開著時接管滑鼠。
  const surface = useRef<HTMLDivElement>(null), damper = useRef<ReturnType<typeof dampCanvas> | null>(null);
  useEffect(() => {
    if (!damping || !surface.current) return;
    const taken = damper.current = dampCanvas(flow, surface.current);
    return () => { taken.detach(); damper.current = null; };
  }, [damping, flow]);
  // React Flow's own colours follow the theme (COLOR_SYSTEM.md). React Flow 自己的顏色跟著主題。
  const theme = useSyncExternalStore(appearanceSubscribe, currentTheme);
  // Picking a wire up from its input end is React Flow's own reconnecting (Refactor.54, Blender-like; human
  // 2026-10-09). Only the input end moves. 從輸入端拿起線用 React Flow 自己的重接線（像 Blender）；只有輸入端能動。
  // While a wire is dragged over an input, preview what dropping it would change (Refactor.57, as the legacy editor):
  // the inputs it merges away light up, the wires it replaces fade. Asked only when the hovered port changes.
  // 拖線停在輸入上時預告放開會改變什麼（照舊產品）：會被併掉的輸入亮起、會被換掉的線變淡。只在停的接孔換了時問。
  const over = useConnection(state => {
    if (!state.inProgress || !state.toHandle || !state.fromHandle) return '';
    const [out, input] = state.fromHandle.type === 'source' ? [state.fromHandle, state.toHandle] : [state.toHandle, state.fromHandle];
    return out.type === 'source' && input.type === 'target' ? [out.nodeId, out.id, input.nodeId, input.id].join('\n') : '';
  });
  const preview = useMemo(() => {
    if (!over) return null;
    const [source, sourceHandle, target, targetHandle] = over.split('\n');
    return session.wirePreview({ source: source!, sourceHandle: sourceHandle!, target: target!, targetHandle: targetHandle! });
  }, [over, session, projection]);
  const replaced = useMemo(() => new Set(preview?.replaced), [preview]);
  const edges = useMemo(() => projection.edges.map(edge => ({ ...edge,
    ...(options.wirePickUp ? { reconnectable: 'target' as const } : {}),
    ...(replaced.has(edge.id) ? { className: 'replacing' } : {}) })), [projection.edges, options.wirePickUp, replaced]);
  // React Flow also reports the end of a reconnect as a connection end; that one is the reconnect's own.
  // RF 會把重接線的結束也當成一般拉線結束回報一次；那一次屬於重接線，不另外處理。
  const reconnecting = useRef(false);
  return <BodyDragContext.Provider value={bodyDrag}><MergingContext.Provider value={preview}><ErrorNodesContext.Provider value={errorNodes}>
    <RightDragSelect session={session} boxSelect={boxSelect}>
    <ReactFlow<FlowNode, FlowEdge> ref={surface} nodes={projection.nodes} edges={edges} nodeTypes={nodeTypes}
      zoomOnScroll={!damping} onMoveStart={event => { if (event) damper.current?.interrupt(); }}
      onNodesChange={session.nodeChanges} onEdgesChange={session.edgeChanges} onBeforeDelete={session.beforeDelete} onDelete={session.remove}
      onConnect={session.connect} isValidConnection={session.valid} connectionLineComponent={ConnectionPreview}
      onConnectEnd={(event, state) => {
        if (reconnecting.current) return;
        if (state.toHandle && !state.isValid) { session.notice(new TextError(tr('edit.wireRefused', 'The core refused this wire: the types or the graph structure do not fit.'))); return; }
        if (state.toHandle || !state.fromNode || !state.fromHandle?.id) return;
        const node = state.fromNode.id, port = state.fromHandle.id, side = state.fromHandle.type === 'source' ? 'output' : 'input';
        // Released on empty canvas from a connected input: pull that input's wire (Q33). 從接了線的輸入拉到空白處：拔線。
        if (side === 'input' && projection.edges.some(edge => edge.target === node && edge.targetHandle === port)) { session.disconnectInput(node, port); return; }
        // Otherwise Create node opens there with what fits (legacy graph_ui.js:15–20). 其他情況：在那裡打開新增節點，只列接得上的。
        if (!options.wireDropCreates) return;
        const data = state.fromNode.data as FlowNode['data'], point = 'changedTouches' in event ? event.changedTouches[0]! : event;
        const type = (side === 'output' ? data.outputs : data.inputs).find(item => item.key === port)?.type ?? '';
        onCreate({ screen: { x: point.clientX, y: point.clientY }, wire: { end: { node, port, side } as WireEnd, type } });
      }}
      edgesReconnectable={options.wirePickUp}
      onReconnectStart={() => { reconnecting.current = true; }}
      onReconnect={(edge, connection) => { if (connection.target && connection.targetHandle && (connection.target !== edge.target || connection.targetHandle !== edge.targetHandle))
        session.moveWire(edge.id, { node: connection.target, port: connection.targetHandle }); }}
      // Dropped where no input takes it: the wire is pulled, as from the input itself (Q33). 放到沒有輸入的地方：拔線。
      onReconnectEnd={(_event, edge, _type, state) => {
        setTimeout(() => { reconnecting.current = false; });
        if (!state.toHandle && edge.targetHandle) session.disconnectInput(edge.target, edge.targetHandle);
      }}
      onDoubleClick={event => { if ((event.target as Element).classList.contains('react-flow__pane')) onCreate({ screen: { x: event.clientX, y: event.clientY } }); }}
      onDragOver={event => { if (event.dataTransfer.types.includes(DRAG_TYPE)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } }}
      onDrop={event => { const id = event.dataTransfer.getData(DRAG_TYPE); if (id) { event.preventDefault(); onDropChoice(id, { x: event.clientX, y: event.clientY }); } }}
      onNodeDragStart={() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); }}
      // A double-click on a node's plain area frames it (human 2026-10-09; new, the legacy editor only entered subgraphs);
      // on its fields, buttons and ports it does what it did. 雙擊節點的非互動區＝對準它（人類；新的）；在欄位、按鈕、接孔上照舊。
      onNodeDoubleClick={(event, node) => {
        if (!(event.target as Element).closest('input, textarea, button, select, [contenteditable="true"], .react-flow__handle, .value-row'))
          frameNodes(flow, [node.id]);
      }}
      // Selection is decided by the session, not React Flow (Refactor.49; reported to the human as an
      // exception): nodes on press (RightDragSelect), wires on click, blank canvas clears.
      // 選取由 session 決定、不是 RF（R.49，已向人類報告的例外）：節點在按下時、接線在點擊時、點空白清掉。
      elementsSelectable={false} multiSelectionKeyCode={null}
      onEdgeClick={(event, edge) => session.clickEdge(edge.id, pressKind(event))}
      onPaneClick={() => session.clearSelection()}
      // Double-click on blank canvas opens Create node (legacy), so React Flow's double-click zoom is off
      // (reported to the human as an exception, Refactor.54). 雙擊空白處打開新增節點（照舊），所以關掉 RF 的雙擊放大（已報告的例外）。
      zoomOnDoubleClick={false}
      // A wire snaps to a port within 28px (React Flow's own setting; 20 by default). 拉線放開時 28px 內吸附到接孔。
      connectionRadius={28}
      snapToGrid={snap} snapGrid={[GRID, GRID]} fitView fitViewOptions={{ maxZoom: 1, padding: .2 }}
      minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} colorMode={theme === 'light' ? 'light' : 'dark'} deleteKeyCode={['Backspace', 'Delete']}
      selectionKeyCode={null}>{/* box selection is RightDragSelect's (touching counts, Shift adds; Q33/Q39) */}
      <AdaptiveGrid />
      {/* React Flow's own zoom controls, with the zoom as a number (human 2026-10-09: its default is fine).
          React Flow 自己的縮放控制，加上目前縮放百分比（人類：用它的預設即可）。 */}
      <Controls position="bottom-right" orientation="horizontal" showInteractive={false}><ZoomReadout /></Controls>
      <Panel position="bottom-left" className="canvas-caption"><strong>{stage}</strong>
        <span>{say(tr('canvas.nodeCount', '{count} node(s)', { count: projection.nodes.length }))}</span>
        <span>{say(tr('canvas.hint', 'Build your Shader from left to right.'))}</span></Panel>
      <SelectionFrame nodes={projection.nodes} />
    </ReactFlow>
  </RightDragSelect></ErrorNodesContext.Provider></MergingContext.Provider></BodyDragContext.Provider>;
});
// Canvas preferences of this page, kept by the shell so they survive switching Grape OP (Refactor.51.1).
// Panels and zones are the layout's (layout.tsx, Refactor.53).
// 畫布偏好，由外殼保管，換 Grape OP 時不重設。面板與面板區歸版面管（layout.tsx）。
// Body drag and canvas damping are kept in this browser (Q64; preferences.ts); Snap and box select last for the page.
// Damping and error-node marks start off while they are trials. Body 拖曳與畫布阻尼記在這個瀏覽器；試驗期間阻尼與錯誤節點標記預設關。
function usePrefs(): CanvasPrefs {
  const [prefs, setPrefs] = useState(() => ({ snap: false, boxSelect: false,
    bodyDrag: readPreference('canvas.bodyDrag') !== 'off', damping: readPreference('canvas.damping') === 'on',
    frameGlide: readPreference('canvas.frameGlide') !== 'off', errorNodes: readPreference('canvas.errorNodes') === 'on' }));
  return useMemo(() => ({ ...prefs, set: patch => {
    setPrefs(old => ({ ...old, ...patch }));
    if (patch.bodyDrag !== undefined) writePreference('canvas.bodyDrag', patch.bodyDrag ? 'on' : 'off');
    if (patch.damping !== undefined) writePreference('canvas.damping', patch.damping ? 'on' : 'off');
    if (patch.frameGlide !== undefined) writePreference('canvas.frameGlide', patch.frameGlide ? 'on' : 'off');
    if (patch.errorNodes !== undefined) writePreference('canvas.errorNodes', patch.errorNodes ? 'on' : 'off');
  } }), [prefs]);
}
// No graph open: the same frame, nothing to show and nothing to do (Refactor.51.1). Typed in full, no cast: a field
// added to EditorState must be added here too (Refactor.63.3: the GLSL panel read a missing glslMap and the page went blank).
// 沒有圖時：同一個外框，沒有內容、按鈕停用。完整寫出型別、不強制轉型：EditorState 加欄位時這裡也得補（63.3：GLSL 面板讀到沒有的 glslMap，整頁空白）。
const idle: EditorState = { undo: false, redo: false, dirty: false, phase: 'ready', level: 'info', message: '', revision: 0, version: 0,
  projection: { nodes: [], edges: [] }, declarations: [], references: {}, glsl: '', glslMap: [], glslVariables: {}, glslDeclarations: {}, targetPath: '' };
const idleSubscribe = () => () => {}, idleSnapshot = () => idle;

// The editing frame below the title bar: the left zone, the network (location bar, its toolbar, the canvas),
// the right zone and the foot bar; the same layout whether a graph is open, loading or missing (human
// 2026-10-09: the layout must not jump while loading). With a session it edits that one graph and gives the
// panels their content (Q47 4: from the view being edited); the shell above decides which graph.
// 標題列以下的編輯外框：左區、網路區（網址列、功能列、畫布）、右區、底列；有圖、載入中、沒有圖都同一個版面。
// 有 session 時編輯那一張圖，並提供面板內容（Q47 4：從正在編輯的畫面來）；換哪一張由外殼決定。
// td: the TD answering now; opened: the TD this graph was opened from (Refactor.52, shown side by side).
// td：現在回應的 TD；opened：開這張圖時的 TD（並排給人比對）。
function Workspace({ session, waiting, prefs, layout, editing, text, td, opened }: {
  session: EditorSession | null; waiting: Waiting; prefs: CanvasPrefs; layout: Layout; editing: ReactNode;
  text: (key: string) => string; td: TdIdentity | null; opened: TdIdentity | null;
}) {
  const state = useSyncExternalStore(session?.subscribe ?? idleSubscribe, session?.snapshot ?? idleSnapshot);
  const target = session?.host.target ?? '', draftKey = draftKeyOf(target);
  const tdNow = useRef(td); tdNow.current = td;
  const shell = useShell();
  // "Also give this Grape OP a new Grape ID" (Refactor.52, Q63): optional, off by default (human 2026-10-09:
  // the usual case is the same Grape OP, and a new ID cannot be taken back). Done after the choice is in TD;
  // then the shell switches to the new ID.
  // 「順便換一個 Grape ID」：可選、預設不勾（人類：通常是同一份，換了收不回）。選擇送到 TD 後才換，再由外殼換過去。
  const [renew, setRenew] = useState(false);
  const decide = async (choice: () => unknown) => {
    await choice();
    if (!renew || !session) return;
    const id = await session.renewId();
    if (id) shell.choose(id);
  };
  const renewBox = <label className="check renew-id" title={say(tr('identity.renewHelp', 'Changes the ID of the Grape OP in the TD connected now, the same as its Regenerate ID button. Addresses with the old ID no longer open it.'))}>
    <input type="checkbox" checked={renew} onChange={event => setRenew(event.target.checked)} />{say(tr('identity.renew', 'Also give this Grape OP a new Grape ID'))}</label>;
  const flow = useReactFlow();
  // What can be added, shared by the Add Node panel and Create node (Refactor.54). 可新增的東西，兩個入口共用。
  const choices = useMemo(() => addChoices(state.declarations ?? [], text), [state.declarations, text]);
  const [creating, setCreating] = useState<CreateRequest | null>(null);
  const middle = () => { const box = document.querySelector('.canvas')!.getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 3 }; };
  const addAt = (choice: AddChoice, at: { x: number; y: number }, wire?: { end: WireEnd; port: string }) =>
    session?.addNode(choice.spec, flow.screenToFlowPosition(at), wire);
  const onCreate = useCallback((request: CreateRequest) => setCreating(request), []);
  const choicesRef = useRef(choices); choicesRef.current = choices;
  const onDropChoice = useCallback((id: string, at: { x: number; y: number }) => {
    const choice = choicesRef.current.find(item => item.id === id);
    if (choice) session?.addNode(choice.spec, flow.screenToFlowPosition(at));
  }, [session, flow]);
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
      // Tab opens Create node in the upper middle of the network (legacy graph_ui.js:2560), only while the keyboard focus is
      // on the network or on nothing, as the legacy editor (graph_ui.js:2518); elsewhere (a panel, a menu) Tab moves the
      // focus as usual (human 2026-10-09: keyboard use in panels). Tab 在網路區中間偏上打開新增節點；只在鍵盤焦點在網路區或
      // 什麼都沒選到時，同舊產品；在面板、選單裡 Tab 照常移動焦點（人類：面板要能用鍵盤）。
      else if (!draft && event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey
        && (element === document.body || element === document.documentElement || element.closest('.react-flow'))) {
        event.preventDefault(); setCreating({ screen: middle() });
      }
      // F frames the selection (all when none), H frames all, on the network only (legacy graph_ui.js:2545, selection_ui.js:92).
      // F 對準選取（沒選就全部）、H 對準全部，只在網路區（同舊產品）。
      else if (!draft && ['f', 'h'].includes(event.key.toLowerCase()) && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey
        && (element === document.body || element === document.documentElement || element.closest('.react-flow'))) {
        event.preventDefault();
        frameNodes(flow, event.key.toLowerCase() === 'f' ? flow.getNodes().filter(node => node.selected).map(node => node.id) : undefined);
      }
    };
    // While one of our sources or nodes is dragged, the pointer shows "add" everywhere, never "not allowed" (human
    // 2026-10-09); only the canvas takes the drop, elsewhere nothing happens. 拖我們的來源或節點時，到哪裡都顯示「新增」、
    // 不顯示禁止符號（人類）；只有畫布接受放下，其他地方什麼都不做。
    const dragging = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes(DRAG_TYPE)) return;
      event.preventDefault(); if (event.type === 'dragover') event.dataTransfer.dropEffect = 'copy';
    };
    addEventListener('beforeunload', leave); addEventListener('keydown', keys);
    addEventListener('dragover', dragging); addEventListener('drop', dragging);
    return () => { removeEventListener('beforeunload', leave); removeEventListener('keydown', keys);
      removeEventListener('dragover', dragging); removeEventListener('drop', dragging); };
  }, [session, draft]);
  // Trial (Refactor.63.6, human 2026-10-10): the nodes that wrote a line TD reported, only while this is the GLSL that failed
  // (legacy: only exact lines, only before the graph changes). Worked out only with the setting on and a failure.
  // 試驗：TD 回報的錯誤行是哪些節點寫的；只在目前就是失敗的那份 GLSL 時（舊產品：只認確定的行、圖改過就不標）。設定開著且有失敗才算。
  const failure = state.stuck?.failure;
  const errorNodes = useMemo(() => prefs.errorNodes ? findErrorNodes(failure, state.glsl, state.glslMap) : null,
    [prefs.errorNodes, failure, state.glsl, state.glslMap]);
  // The panels' content, from the graph being edited (Q47 4). 面板內容，來自正在編輯的圖。
  const input: PanelInput = { session, state, choices, add: choice => addAt(choice, middle()) };
  const panels: Record<string, PanelView> = Object.fromEntries(Object.entries(PANELS)
    .map(([id, row]) => [id, { title: row.title, content: row.content(input) }]));
  return <SessionContext.Provider value={session}><TextContext.Provider value={text}>
    <div className="workspace">
      <PanelZone side="left" layout={layout} panels={panels} />
      <section className="network" aria-label={say(tr('network.label', 'Network'))}>
        <LocationBar layout={layout} rightEmpty={!layout.right.groups.length}>{editing}</LocationBar>
        <div className="canvas">
          {/* While an earlier draft waits for a choice, only the network and its toolbar are locked; the notices stay usable.
              有草稿等待選擇時，只鎖住網路區與功能列；提示照樣能按。 */}
          <div className="canvas-body" inert={!!draft}>
          {session ? <Canvas session={session} projection={state.projection} bodyDrag={prefs.bodyDrag} snap={prefs.snap} boxSelect={prefs.boxSelect} damping={prefs.damping} errorNodes={errorNodes}
            stage={say(tr('stage.pixel', 'Pixel stage'))} onCreate={onCreate} onDropChoice={onDropChoice} />
            : waiting.loading ? <LoadingCanvas message={waiting.message} />
            : <EmptyCanvas message={waiting.message}>{waiting.reset && <button onClick={() => {
              if (confirm(say(tr('open.resetConfirm', "TD's graph will be replaced by the default graph, and the content listed above will be deleted. Continue?")))) void waiting.reset!();
            }}>{say(tr('open.reset', 'Load the default graph'))}</button>}</EmptyCanvas>}
          {draft && <div className="draft-blocker" />}</div>
          {/* What floats over the network's top edge, stacked with one gap: the toolbar, then notices — the found draft (a
              warning) and a conflict (human 2026-10-09: rounded floating panels below the toolbar, the same gap as to the
              canvas edge). 浮在網路區上緣的東西，用同一個間距往下排：功能列，然後是提示（找到草稿是警告、衝突）
              （人類：功能列下方的圓角浮板，間距同畫布邊框）。 */}
          <div className="network-overlay">
          <div className="network-bar-slot" inert={!!draft}><NetworkBar session={session} prefs={prefs} onGlsl={() => layout.show('glsl')} /></div>
          {session && draft && <div className="floating-notice warning" role="group" aria-label={say(tr('draft.label', 'Earlier draft'))}>
            <span>{say(tr('draft.found', "Found an earlier draft for this page; showing TD's graph."))}</span>
            {/* Side by side for people to compare; nothing is judged (Q63). 並排給人比對，不做判斷。 */}
            <AlignedRows className="identity-compare" rows={[draftRow(earlier?.source), nowRow(td)]} />
            <div className="notice-actions">{renewBox}
            <button onClick={() => void decide(async () => { try { const saved = JSON.parse(draft); if (saved.target !== target) throw new TextError(tr('draft.otherTarget', 'This draft belongs to another Grape OP.')); if (session.restoreDraft(saved.graph)) { setDraft(null); await session.flush(); } } catch (error) { session.notice(error); } })}>{say(tr('draft.restore', 'Restore draft'))}</button>
            <button onClick={() => { try { download(JSON.parse(draft)); } catch (error) { session.notice(error); } }}>{say(tr('draft.downloadEarlier', 'Download earlier draft'))}</button>
            <button onClick={() => void decide(() => setDraft(null))}>{say(tr('draft.useTd', "Use TD's graph"))}</button></div>
          </div>}
          {/* Floating and non-modal: editing continues while the choice is pending (Q7/Q28). */}
          {session && state.phase === 'conflict' && <div className="floating-notice" role="group" aria-label={say(tr('conflict.label', 'Choose a version'))}>
            <span>{say(conflictMessage)}</span>
            <AlignedRows className="identity-compare" rows={[tdRow(tr('conflict.openedLabel', 'Opened from'), opened), tdRow(tr('conflict.tdNowLabel', 'TD now'), td)]} />
            <div className="notice-actions">{renewBox}
            <button className="primary" onClick={() => void decide(session.overwrite)}>{say(tr('conflict.useEditor', 'Editor (recommended)'))}</button>
            <button onClick={() => void decide(session.useRemote)}>{say(tr('conflict.useTd', 'TD'))}</button></div>
          </div>}
          {/* The Shader stuck after a failed apply (Refactor.63, human 2026-10-10): what TD said, where in the GLSL, and back
              to the program TD still runs. Floating, never in the way of editing. 套用失敗、Shader 卡住：TD 說了什麼、在 GLSL 哪裡、
              回到 TD 仍在跑的那一版。浮動，不擋編輯。 */}
          {session && state.stuck && !draft && state.phase !== 'conflict' && <StuckNotice state={state} session={session}
            onShowGlsl={line => { layout.show('glsl'); if (line) session.focusGlslLine(line); }} />}
          </div></div>
        {session && creating && <CreateNode request={creating} choices={choices} session={session} onClose={() => setCreating(null)}
          onPick={(choice, port) => { setCreating(null); addAt(choice, creating.screen, creating.wire && port ? { end: creating.wire.end, port } : undefined); }} />}
      </section>
      <PanelZone side="right" layout={layout} panels={panels} />
    </div>
    <FootBar session={session} waiting={waiting.message} prefs={prefs} onAppearance={() => layout.show('appearance')} onDownload={() => download({ target, graph: session!.graph(), source: sourceNow(td) })} />
  </TextContext.Provider></SessionContext.Provider>;
}

// What the shell shows while no graph is open: every stage is a normal editor with nothing drawn yet
// (human 2026-10-09). 還沒有圖時外殼顯示什麼：每個階段都是正常的編輯器、只是畫布上還沒有東西。
// loading: a Grape OP is on its way — its own state, never the "no graph" screen (human 2026-10-09).
// loading：Grape OP 正在打開，是自己的狀態，不用「沒有圖」的畫面（人類）。
type Waiting = { message: Message | string; reset?: () => Promise<void>; loading?: boolean };
function App({ token, bootstrap, text, version }: { token: string; bootstrap: Bootstrap; text: (key: string) => string; version: string }) {
  const [target, setTarget] = useState(addressTarget);
  const [session, setSession] = useState<EditorSession | null>(null), [path, setPath] = useState('');
  const [waiting, setWaiting] = useState<Waiting>({ message: '' }), [reload, setReload] = useState(0);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null), [pending, setPending] = useState('');
  const prefs = usePrefs(), layout = useLayout();
  // Which TD answers (Refactor.52): asked once at start, then updated by every reply that says so.
  // 哪個 TD 在回應：開頁時問一次，之後每個回覆都更新。
  const [td, setTd] = useState<TdIdentity | null>(null), [opened, setOpened] = useState<TdIdentity | null>(null);
  useEffect(() => { listGrapeOps(token).then(found => { if (found.td) setTd(found.td); }, () => { /* shown when the menu opens */ }); }, [token]);
  // The browser tab names the Grape OP being edited (Refactor.59.7). 瀏覽器分頁標題寫出正在編輯的 Grape OP。
  useEffect(() => { document.title = tabTitle(path, td); }, [path, td]);
  // Open the Grape OP in the address. 打開網址上的 Grape OP。
  useEffect(() => {
    let live = true, opened: EditorSession | null = null;
    setSession(null); setPath(''); setOpened(null);
    // "No target" and "wrong target" (human 2026-10-09). 「沒指目標」與「錯指目標」。
    if (!target) { setWaiting({ message: tr('picker.noTarget', 'Choose a Grape OP to edit.') }); return; }
    const wrong = { message: tr('picker.wrongTarget', 'This Grape OP is not in the current project. Choose another one.') };
    if (!/^[a-f0-9]{32}$/.test(target)) { setWaiting(wrong); return; }
    setWaiting({ message: tr('picker.opening', 'Opening the Grape OP…'), loading: true });
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
    {layout.titleBar && <TitleBar session={session} version={version} />}
    {/* One frame for every stage; a new session starts its own editing state (drafts are per Grape OP).
        每個階段同一個外框；新的 session 有自己的編輯狀態（草稿依 Grape OP 分開）。 */}
    <Workspace key={session ? target : ''} session={session} waiting={waiting} prefs={prefs} layout={layout} text={text} td={td} opened={opened}
      editing={<>
        {/* The project file before the Grape OP path, as in the old product (Refactor.52); TD's build on hover.
            專案檔名放在 Grape OP 路徑前面（照舊）；滑鼠停留顯示 TD 版本。 */}
        {td && <span className="project-file" title={say(detailLabel(td, version))}>{td.file}</span>}
        <GrapeOpEntry className="target" label={path || tr('picker.choose', 'Choose a Grape OP')} /></>} />
    {anchor && <GrapeOpMenu anchor={anchor} token={token} onClose={closeMenu} seen={setTd} />}
    {pending && <div className="switch-dialog" role="dialog" aria-label={say(tr('switch.title', 'Switch Grape OP'))}>
      <p>{say(tr('switch.explanation', 'Some changes are not in TD yet. Apply them to TD, or keep a draft in this browser tab before switching (it can be restored when you come back).'))}</p>
      <button className="primary" onClick={() => void applyAndGo()}>{say(tr('switch.apply', 'Apply, then switch'))}</button>
      <button onClick={keepDraftAndGo}>{say(tr('switch.keep', 'Keep a draft, then switch'))}</button>
      <button onClick={() => setPending('')}>{say(tr('switch.cancel', 'Cancel'))}</button>
    </div>}
  </TextContext.Provider></ShellContext.Provider>;
}

// The whole editor follows the language: a change re-renders it and gives the text context a new identity, so
// memoised cards re-word too; nothing is reloaded (Refactor.54). 整個編輯器跟著語言：切換時重畫，
// 文字 context 換一個新的，連記憶化的卡片也重新翻；不重新載入。
function Root(props: { token: string; bootstrap: Bootstrap; text: (key: string) => string; version: string }) {
  const current = useSyncExternalStore(languageSubscribe, language);
  const text = useMemo(() => (key: string) => props.text(key), [props.text, current]);
  return <OptionsContext.Provider value={defaultOptions}><App {...props} text={text} /></OptionsContext.Provider>;
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
    <Root token={token} bootstrap={files} text={text} version={build.version} /></ReactFlowProvider></StrictMode>);
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
