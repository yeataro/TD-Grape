import { StrictMode, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, memo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlow, ReactFlowProvider, Background, Controls, ControlButton, useStore, useReactFlow, useConnection, getBezierPath,
  type ConnectionLineComponentProps, type EdgeTypes, type NodeTypes } from '@xyflow/react';
import { GhostEdge } from './GhostMark';
import { ConvertEdge } from './ConvertEdge';
import '@xyflow/react/dist/style.css';
import './theme/dark.css';
import './theme/td.css';
import './theme/light.css';
import './theme/sizes.css';
import { appearanceSubscribe, currentTheme } from './appearance';
import './style.css';
import { typeColor, UnsupportedGraphError, type Bootstrap } from './core';
import { GRAPE_ID, HostClient, HostError, type StateResponse } from './host';
import { Editor as EditorSession, type EditorState, type WireEnd, type NewWire } from './editor';
import { resetToDefault } from './host_sync';
import { RightDragSelect, pressKind, type MenuOpen } from './RightDragSelect';
import { CanvasMenu, selectionKey, type CanvasMenuRequest } from './CanvasMenu';
import { SelectionFrame } from './SelectionFrame';
import { FloatingToolbar } from './FloatingToolbar';
import { tr, say, TextError, errorText, language, languageSubscribe, type Message } from './text';
import { conflictMessage } from './host_sync';
import { glslErrors, errorNodes as findErrorNodes } from './glsl_errors';
import { LayoutView, useLayout, type Layout, type PanelView } from './layout';
import { PANELS, type PanelInput, type PanelRow } from './panels';
import { TitleBar, LocationBar, NetworkBar, FootBar, SPARE, useFullscreen, type CanvasPrefs, toggleFullscreen } from './bars';
import { Icon } from './icons';
import { NodeCard } from './NodeCard';
import { SessionContext, TextContext, BodyDragContext, MergingContext, ErrorNodesContext } from './contexts';
import { addChoices, type AddChoice } from './add_entries';
import { DragToAddLayer, useDropToAdd } from './drag_to_add';
import { usePlaceNode, type Placing } from './place_node';
import { OperationHint, useOperationHint } from './operation_hint';
import { CreateNode, type CreateRequest } from './CreateNode';
import { OptionsContext, defaultOptions, useOptions } from './options';
import { ShellContext, GrapeOpEntry, GrapeOpMenu, EmptyCanvas, LoadingCanvas, useShell, type Shell } from './shell';
import { listGrapeOps } from './grape_ops';
import { sourceNow, draftRow, nowRow, tdRow, detailLabel, tabTitle, type TdIdentity, type DraftSource } from './td_identity';
import { AlignedRows } from './controls';
import { DropdownMenu } from './DropdownMenu';
import type { Projection, FlowNode, FlowEdge } from './projection';
import { forgetPreferences, readPreference, writePreference } from './preferences';
import { MIN_ZOOM, MAX_ZOOM, dampCanvas, frameMs, frameNodes, glide, panningCursor } from './viewport';
import { matches, reactFlowKeys, withShortcut } from './shortcuts';
import { useCopyPaste, type CopyPaste } from './copy_paste';
import { GroupLayer, useGroupActions, type GroupActions, type TextHeights } from './Groups';
import type { GraphGroup } from './core';

const nodeTypes: NodeTypes = { grape: NodeCard };
// A ghost wire carries a small ghost at its middle (Refactor.75.27); React Flow's own wire otherwise. Ghost 線中點帶一隻小幽靈。
const edgeTypes: EdgeTypes = { ghost: GhostEdge, convert: ConvertEdge };
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
// The replacement report (Refactor.65, human 2026-10-10): nodes the node upgrades changed when the graph was read, each one
// leading to its node; a floating notice in the general style, dismissed by the person (it is also in the log).
// 替換報告（人類）：讀圖時被節點升級換掉的節點，每一筆都能帶到那個節點；一般樣式的浮動提示，由人關掉（訊息紀錄也有一份）。
function UpgradeNotice({ state, session, onGo }: { state: EditorState; session: EditorSession; onGo(id: string): void }) {
  const text = useContext(TextContext);
  const labelOf = (id: string) => {
    const node = state.projection.nodes.find(n => n.id === id);
    if (!node) return id;
    const { view, label } = node.data;
    return view.literalLabel && view.label ? view.label : text(view.label ?? label);
  };
  return <div className="floating-notice" role="group" aria-label={say(tr('upgrade.label', 'Updated nodes'))}>
    <span>{say(tr('upgrade.title', 'This graph had {count} node(s) in an older form. They were updated, and the graph is sent to TD like any edit.',
      { count: state.upgrades.length }))}</span>
    <ul className="upgrade-list">{state.upgrades.map(change => <li key={change.network + '/' + change.node + '/' + change.rule}>
      {change.network === 'pixel'
        ? <button type="button" className="upgrade-link" onClick={() => onGo(change.node)}>{labelOf(change.node)}</button>
        : <span title={say(tr('upgrade.inSubgraph', 'Inside a subgraph; open it to see this node.'))}>{change.node}</span>}
      {' '}<span className="notice-detail">{say(change.note)}{change.wires ? say(tr('upgrade.wires', ' ({count} wire(s) moved with it)', { count: change.wires })) : ''}</span>
    </li>)}</ul>
    <div className="notice-actions"><button onClick={session.dismissUpgrades}>{say(tr('upgrade.dismiss', 'OK'))}</button></div>
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
  // Over a port it can connect to it is "ready" (React Flow's own check, isValidConnection): solid and under the nodes
  // (style.css; Refactor.78, 78.1). Only the colour is per wire. 停在接得上的接孔上是 ready（React Flow 自己的檢查）：實線、在節點下面
  // （style.css；R.78、78.1）。每條線只決定顏色。
  const className = [components?.length === 1 ? 'component-' + components[0] : '', props.connectionStatus === 'valid' ? 'ready' : ''].join(' ').trim();
  return <g className={className || undefined}><path className="wire-drag" d={path} fill="none" style={{ stroke: typeColor(port?.type ?? '') }} />
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
      // No check on the current one (human 2026-10-12: no check here at all). 目前的那一個不打勾（人類 10-12：這裡根本不要勾勾）。
      items={zoomPresets.map(value => ({ key: String(value), label: `${value}%`, select: () => void flow.zoomTo(value / 100, { duration: frameMs(), ...glide }) }))} />}
  </>;
}
const NO_TEXT: TextHeights = {};
const Canvas = memo(function Canvas({ session, projection, bodyDrag, snap, boxSelect, damping, errorNodes, placing, onCreate, onMenu, focused, onFocus, clip, groups, grouping, textGrows }: {
  session: EditorSession; projection: Projection; bodyDrag: boolean; snap: boolean; boxSelect: boolean; damping: boolean;
  errorNodes: ReadonlySet<string> | null; placing: Placing | null;
  onCreate(request: CreateRequest): void; onMenu(open: MenuOpen): void;
  focused: boolean; onFocus(on: boolean | ((was: boolean) => boolean)): void; clip: CopyPaste; groups: readonly GraphGroup[]; grouping: GroupActions;
  textGrows: boolean;
}) {
  const options = useOptions(), flow = useReactFlow(), fullscreen = useFullscreen();
  // A new set only when the selection changes, not on every drag frame (deep clean 2026-10-12: the groups re-rendered each frame).
  // 選取變了才換一個新的集合，不是拖曳的每一格（10-12 深度清潔：群組每一格都重繪）。
  const selectedKey = projection.nodes.filter(node => node.selected).map(node => node.id).join('\u0000');
  const selectedIds = useMemo(() => new Set(selectedKey ? selectedKey.split('\u0000') : []), [selectedKey]);
  // Groups' body text heights, reported by each group when its text or width changes (Refactor.99): the selection's frame and toolbar
  // go around the grown box. 群組內文的高度，由各群組在內文或寬度改變時回報（R.99）：選取的框與工具列包住長高的外框。
  // Only with "group text makes the box taller" on (the gear; human 2026-10-12: the text and its height apart, so the height can be
  // turned off). 只在「群組內文撐高外框」開著時（齒輪；人類 10-12：內文和高度分開，高度可以關掉）。
  const [measured, setTexts] = useState<TextHeights>({}), texts = textGrows ? measured : NO_TEXT;
  const onText = useCallback((id: string, height: number) => setTexts(old => (old[id] ?? 0) === height ? old : { ...old, [id]: height }), []);
  // A right-click (or long press) on a port opens Create node for that port, there, instead of the menu (legacy graph_ui.js:2476);
  // elsewhere the menu. 在接孔上按右鍵（或長按）：在那裡打開只列接得上的新增節點，不開選單（照舊產品）；其他地方開選單。
  const menu = useCallback((open: MenuOpen) => {
    if (!open.port) { onMenu(open); return; }
    const { node, port, side } = open.port, data = flow.getNode(node)?.data as FlowNode['data'] | undefined;
    const type = (side === 'output' ? data?.outputs : data?.inputs)?.find(item => item.key === port)?.type ?? '';
    onCreate({ screen: { x: open.x, y: open.y }, wire: { end: { node, port, side } as WireEnd, type }, place: true });
  }, [flow, onCreate, onMenu]);
  // Canvas damping takes the mouse's wheel and background drag over only while on (viewport.ts). 畫布阻尼只在開著時接管滑鼠。
  const surface = useRef<HTMLDivElement>(null), damper = useRef<ReturnType<typeof dampCanvas> | null>(null);
  useEffect(() => {
    if (!damping || !surface.current) return;
    const taken = damper.current = dampCanvas(flow, surface.current);
    return () => { taken.detach(); damper.current = null; };
  }, [damping, flow]);
  // Zooming shows the up-down arrow (Refactor.104.7, human 2026-10-12): the wheel (a trackpad pinch too) over the canvas zooms it,
  // damped or not, and has no held state, so the canvas is marked while it turns and a moment after. The zoom buttons and framing
  // do not count (human). 縮放時是上下箭頭（R.104.7，人類 10-12）：在畫布上滾滾輪（觸控板雙指也是）就是縮放，有沒有阻尼都一樣；
  // 滾輪沒有「按住」的狀態，所以滾動時與停下後一下子標記畫布。縮放按鈕與對準不算（人類）。
  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    let timer = 0;
    const wheel = (event: WheelEvent) => {
      if ((event.target as Element).closest('.nowheel')) return;
      element.classList.add('zooming'); clearTimeout(timer);
      timer = window.setTimeout(() => element.classList.remove('zooming'), 200);
    };
    element.addEventListener('wheel', wheel, { capture: true, passive: true });
    return () => { element.removeEventListener('wheel', wheel, { capture: true }); clearTimeout(timer); element.classList.remove('zooming'); };
  }, []);
  // React Flow's own colours follow the theme (COLOR_SYSTEM.md). React Flow 自己的顏色跟著主題。
  const theme = useSyncExternalStore(appearanceSubscribe, currentTheme);
  // Picking a wire up from its input end is React Flow's own reconnecting (Refactor.54, Blender-like; human
  // 2026-10-09). Only the input end moves. 從輸入端拿起線用 React Flow 自己的重接線（像 Blender）；只有輸入端能動。
  // While a wire is dragged over an input, preview what dropping it would change (Refactor.57, as the legacy editor):
  // the inputs it merges away light up, the wires it replaces turn into wires that do not count (R.78). Asked only when
  // the hovered place changes. 拖線停在輸入上時預告放開會改變什麼（照舊產品）：會被併掉的輸入亮起、會被換掉的線變成不算數的線
  // （R.78）。只在停的地方換了時問。
  // Dragged from an input onto empty canvas, releasing pulls its wire (onConnectEnd below), so that is previewed too
  // (Refactor.78.1). A wire picked up by its end is hidden by React Flow while it moves, so it has nothing to show.
  // 從輸入拉到空白處，放開會拔線（下面的 onConnectEnd），也預告（R.78.1）。抓著線端拿起的線，移動中 React Flow 本來就不畫，不用預告。
  // `over` is a plain string so React Flow re-renders this only when the place changes: what releasing there does, then
  // its ends. over 是純字串，停的地方換了才重繪：放開會做什麼，接著是兩端。
  const over = useConnection(state => {
    if (state.inProgress && !state.toHandle && state.fromHandle?.type === 'target' && state.fromHandle.id)
      return ['pull', state.fromHandle.nodeId, state.fromHandle.id].join('\n');
    if (!state.inProgress || !state.toHandle || !state.fromHandle) return '';
    const [out, input] = state.fromHandle.type === 'source' ? [state.fromHandle, state.toHandle] : [state.toHandle, state.fromHandle];
    return out.type === 'source' && input.type === 'target' ? ['wire', out.nodeId, out.id, input.nodeId, input.id].join('\n') : '';
  });
  const preview = useMemo(() => {
    const [kind, ...ends] = over.split('\n');
    if (kind === 'pull') return session.pullPreview(ends[0]!, ends[1]!);
    if (kind !== 'wire') return null;
    const [source, sourceHandle, target, targetHandle] = ends as [string, string, string, string];
    return session.wirePreview({ source, sourceHandle, target, targetHandle });
  }, [over, session, projection]);
  // Cards follow only a preview that merges rows, so the other previews do not re-render every card.
  // 卡片只跟著會合併列的預告，其他預告不會讓每張卡片重繪。
  const merging = preview?.merged.length ? preview : null;
  // A wire about to go takes `replacing` in place of its classes: like a ghost wire, a wire that does not count has no
  // component tint (style.css). The list of ids keys the memo, so an equal preview keeps the same edges.
  // 即將不見的線改用 replacing、不留原本的 class：和 Ghost 線一樣，不算數的線沒有分量染色（style.css）。以 id 清單當依據，
  // 內容相同的預告沿用同一份線。
  const replacedKey = preview?.replaced.join('\n') ?? '';
  const edges = useMemo(() => {
    const replaced = new Set(replacedKey ? replacedKey.split('\n') : []);
    return projection.edges.map(edge => ({ ...edge,
      ...(options.wirePickUp ? { reconnectable: 'target' as const } : {}),
      ...(replaced.has(edge.id) ? { className: 'replacing' } : {}) }));
  }, [projection.edges, options.wirePickUp, replacedKey]);
  // React Flow also reports the end of a reconnect as a connection end; that one is the reconnect's own.
  // RF 會把重接線的結束也當成一般拉線結束回報一次；那一次屬於重接線，不另外處理。
  const reconnecting = useRef(false);
  return <BodyDragContext.Provider value={bodyDrag}><MergingContext.Provider value={merging}><ErrorNodesContext.Provider value={errorNodes}>
    <RightDragSelect session={session} boxSelect={boxSelect} onMenu={menu}>
    <ReactFlow<FlowNode, FlowEdge> data-drop-to-add="" ref={surface} attributionPosition="bottom-left"
      // A node being placed is drawn with the graph's, but is not in it (place_node.tsx). 放置中的節點和圖的一起畫，但不在圖裡。
      nodes={placing ? [...projection.nodes, placing.node] : projection.nodes} edges={placing ? [...edges, ...placing.edges] : edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
      zoomOnScroll={!damping} onMoveStart={event => { if (event) damper.current?.interrupt(); if (event?.type === 'mousedown') panningCursor(true); }}
      // Only a gesture's end: the damped pan moves the view by code, and each such move ends with no event. 只在手勢結束時：阻尼的平移
      // 用程式移動畫面，每次這樣的移動結束時都沒有事件。
      onMoveEnd={event => { if (event) panningCursor(false); }}
      onNodesChange={session.nodeChanges} onEdgesChange={session.edgeChanges} onBeforeDelete={session.beforeDelete} onDelete={session.remove}
      onConnect={session.connect} isValidConnection={session.valid} connectionLineComponent={ConnectionPreview}
      onConnectEnd={(event, state) => {
        if (reconnecting.current) return;
        // A warning, not an error: nothing broke, the wire just does not fit (Refactor.75.8, human 2026-10-11: red was too much).
        // 警告而非錯誤：沒有東西壞掉，只是這條線接不上（R.75.8，人類：紅字太重）。
        // Released on an input of the floating Parameter panel: wired to that input of the node it shows (Refactor.85; legacy
        // inspector.js:1571). 放在浮動參數面板的輸入接孔上：接到它顯示的那個節點的那個輸入（R.85；照舊產品）。
        const released = 'changedTouches' in event ? event.changedTouches[0]! : event;
        const panelPort = (document.elementFromPoint(released.clientX, released.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-panel-port]');
        if (panelPort && state.fromNode && state.fromHandle?.id && state.fromHandle.type === 'source') {
          const wire = { source: state.fromNode.id, sourceHandle: state.fromHandle.id, target: panelPort.dataset.panelNode!, targetHandle: panelPort.dataset.panelPort! };
          if (session.valid(wire)) session.connect(wire); else session.warn(tr('edit.wireRefused', 'Cannot connect: the types or the graph structure do not fit.'));
          return;
        }
        if (state.toHandle && !state.isValid) { session.warn(tr('edit.wireRefused', 'Cannot connect: the types or the graph structure do not fit.')); return; }
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
      onDoubleClick={event => { if ((event.target as Element).classList.contains('react-flow__pane')) onCreate({ screen: { x: event.clientX, y: event.clientY }, place: true }); }}
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
      minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} colorMode={theme === 'light' ? 'light' : 'dark'} deleteKeyCode={reactFlowKeys('delete')}
      selectionKeyCode={null}>{/* box selection is RightDragSelect's (touching counts, Shift adds; Q33/Q39) */}
      <AdaptiveGrid />
      {/* React Flow's own view controls, with the zoom as a number (human 2026-10-09: its default is fine), without its plus and
          minus (Refactor.83.3, human 2026-10-11: crowded, and not needed to edit; legacy had none, index.html:57): wheel, trackpad
          and pinch still zoom, and the number's menu sets it. React Flow 自己的視角控制，加上目前縮放百分比（人類 10-09：用預設即可），
          拿掉加減號（R.83.3，人類 10-11：太擠、編輯用不到；舊產品沒有）：滾輪、觸控板、雙指照樣縮放，縮放數字的選單也能設。 */}
      {/* The order is legacy's: zoom, Home, Focus graph (index.html:57; Refactor.96.1, human 2026-10-12: the zoom held between two
          buttons looked odd). 順序照舊產品：縮放、置中、專注編輯（R.96.1，人類：縮放夾在兩個按鈕中間很奇怪）。
          Home is ours, not React Flow's fit view (Refactor.94, human 2026-10-12: it looked the same as full screen): the four corners
          with a small node (human 2026-10-11), the same framing as H, with our words. Home 用我們的、不用 React Flow 的看見全部（R.94，
          人類：和全螢幕長得一模一樣）：四角框加小節點（人類 10-11），和 H 同一個對準，說明用我們的字。 */}
      {/* How to finish what is going on, in the bottom row beside the controls (operation_hint.tsx). 正在進行的事怎麼完成，在下方那一排。 */}
      <OperationHint />
      <Controls position="bottom-right" orientation="horizontal" showInteractive={false} showZoom={false} showFitView={false}>
        <ZoomReadout />
        <ControlButton onClick={() => frameNodes(flow)} aria-label={say(tr('canvasMenu.home', 'Home'))}
          title={withShortcut(say(tr('canvas.homeHint', 'Home: show the whole network')), 'home')}><Icon name="home" /></ControlButton>
        {/* Focus graph, after the zoom as legacy (index.html:57; human 2026-10-11: icon D, Ctrl+Enter, Esc leaves); while on, full screen
            comes here too, the foot bar being away (legacy app.js:1482). 專注編輯，照舊產品放在縮放後面（人類 10-11：圖示 D、Ctrl＋Enter、
            Esc 離開）；開著時全螢幕也搬到這裡，因為底列不在（照舊產品）。 */}
        <ControlButton aria-pressed={focused} onClick={() => onFocus(on => !on)}
          aria-label={say(focused ? tr('canvas.restoreLayout', 'Restore layout') : tr('canvas.focus', 'Focus graph'))}
          title={focused ? withShortcut(say(tr('canvas.restoreLayout', 'Restore layout')), 'focusGraph', 'leaveFocus')
            : withShortcut(say(tr('canvas.focusHint', 'Focus graph: only the network and its toolbar')), 'focusGraph')}>
          <Icon name={focused ? 'unfocus' : 'focus'} /></ControlButton>
        {focused && <ControlButton aria-pressed={fullscreen} disabled={!document.fullscreenEnabled}
          aria-label={say(fullscreen ? tr('canvasMenu.exitFullscreen', 'Exit fullscreen') : tr('canvasMenu.fullscreen', 'Fullscreen'))}
          title={say(fullscreen ? tr('canvasMenu.exitFullscreen', 'Exit fullscreen') : tr('canvasMenu.fullscreen', 'Fullscreen'))}
          onClick={() => toggleFullscreen(fullscreen)}><Icon name="fullscreen" /></ControlButton>}
      </Controls>
      {/* The lower-left caption is not shown for now (Refactor.83.4; CanvasCaption.tsx keeps it). 左下角說明暫時不顯示（R.83.4；程式在 CanvasCaption.tsx）。 */}
      {/* Groups behind and between (Groups.tsx), then the selection's frame and toolbar. 群組在後面與中間，然後是選取的框與工具列。 */}
      <GroupLayer groups={groups} selected={selectedIds} session={session} actions={grouping} snap={snap} grid={GRID} onMenu={menu} texts={texts} onText={textGrows ? onText : undefined} />
      <SelectionFrame nodes={projection.nodes} session={session} groups={groups} texts={texts} />
      <FloatingToolbar nodes={projection.nodes} edges={edges} clip={clip} groups={groups} grouping={grouping} texts={texts} />
    </ReactFlow>
  </RightDragSelect></ErrorNodesContext.Provider></MergingContext.Provider></BodyDragContext.Provider>;
});
// Canvas preferences of this page, kept by the shell so they survive switching Grape OP (Refactor.51.1).
// Panels and panes are the layout's (layout.tsx, Refactor.53, 68).
// 畫布偏好，由外殼保管，換 Grape OP 時不重設。面板與窗格歸版面管（layout.tsx）。
// Body drag and canvas damping are kept in this browser (Q64; preferences.ts); Snap and box select last for the page.
// Damping and error-node marks start off while they are trials. Body 拖曳與畫布阻尼記在這個瀏覽器；試驗期間阻尼與錯誤節點標記預設關。
function usePrefs(): CanvasPrefs {
  const [prefs, setPrefs] = useState(() => ({ snap: false, boxSelect: false,
    bodyDrag: readPreference('canvas.bodyDrag') !== 'off', damping: readPreference('canvas.damping') === 'on',
    frameGlide: readPreference('canvas.frameGlide') !== 'off', errorNodes: readPreference('canvas.errorNodes') === 'on',
    groupTextGrows: readPreference('canvas.groupTextGrows') !== 'off' }));
  return useMemo(() => ({ ...prefs, set: patch => {
    setPrefs(old => ({ ...old, ...patch }));
    if (patch.bodyDrag !== undefined) writePreference('canvas.bodyDrag', patch.bodyDrag ? 'on' : 'off');
    if (patch.damping !== undefined) writePreference('canvas.damping', patch.damping ? 'on' : 'off');
    if (patch.frameGlide !== undefined) writePreference('canvas.frameGlide', patch.frameGlide ? 'on' : 'off');
    if (patch.errorNodes !== undefined) writePreference('canvas.errorNodes', patch.errorNodes ? 'on' : 'off');
    if (patch.groupTextGrows !== undefined) writePreference('canvas.groupTextGrows', patch.groupTextGrows ? 'on' : 'off');
  } }), [prefs]);
}
// No graph open: the same frame, nothing to show and nothing to do (Refactor.51.1). Typed in full, no cast: a field
// added to EditorState must be added here too (Refactor.63.3: the GLSL panel read a missing glslMap and the page went blank).
// 沒有圖時：同一個外框，沒有內容、按鈕停用。完整寫出型別、不強制轉型：EditorState 加欄位時這裡也得補（63.3：GLSL 面板讀到沒有的 glslMap，整頁空白）。
const idle: EditorState = { undo: false, redo: false, dirty: false, phase: 'ready', level: 'info', message: '', revision: 0, version: 0,
  projection: { nodes: [], edges: [] }, declarations: [], references: {}, glsl: '', glslMap: [], glslVariables: {}, glslDeclarations: {}, targetPath: '', upgrades: [], syncRecords: [] };
const idleSubscribe = () => () => {}, idleSnapshot = () => idle;

// The editing frame below the title bar: the layout's panes around the network (location bar, its toolbar, the canvas;
// the canvas pane of the layout, Refactor.68) and the foot bar; the same layout whether a graph is open, loading or missing (human
// 2026-10-09: the layout must not jump while loading). With a session it edits that one graph and gives the
// panels their content (Q47 4: from the view being edited); the shell above decides which graph.
// 標題列以下的編輯外框：版面的窗格圍著網路區（網址列、功能列、畫布；版面裡的畫布那一格）、底列；有圖、載入中、沒有圖都同一個版面。
// 有 session 時編輯那一張圖，並提供面板內容（Q47 4：從正在編輯的畫面來）；換哪一張由外殼決定。
// td: the TD answering now; opened: the TD this graph was opened from (Refactor.52, shown side by side).
// td：現在回應的 TD；opened：開這張圖時的 TD（並排給人比對）。
function Workspace({ session, waiting, prefs, layout, file, target: where, text, td, opened }: {
  session: EditorSession | null; waiting: Waiting; prefs: CanvasPrefs; layout: Layout; file: ReactNode; target: ReactNode;
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
  const addAt = (choice: AddChoice, at: { x: number; y: number }, wire?: NewWire) =>
    session?.addNode(choice.spec, flow.screenToFlowPosition(at), wire);
  const onCreate = useCallback((request: CreateRequest) => setCreating(request), []);
  // Place a node (Refactor.105): after a port's right-click the picked node follows the pointer until a press adds it. 放置節點（R.105）。
  const place = usePlaceNode(session, flow, prefs.snap ? GRID : null), placing = place.placing;
  // While placing, how to finish it (legacy create.place), as an operation hint. 放置時，怎麼完成（照舊產品），用操作提示。
  useOperationHint(placing && !placing.leaving ? tr('create.place', 'Click to place the node · Esc to cancel') : null);
  // The right-click menu (Refactor.93): where it opened, and what was selected then. 右鍵選單（R.93）：在哪裡打開、當時選了什麼。
  const [menuAt, setMenuAt] = useState<CanvasMenuRequest | null>(null);
  const onMenu = useCallback((open: MenuOpen) => setMenuAt({ x: open.x, y: open.y, touch: open.touch, host: open.host, wire: open.wire,
    selection: session ? selectionKey(session.snapshot()) : '' }), [session]);
  const closeMenu = useCallback(() => setMenuAt(null), []);
  const choicesRef = useRef(choices); choicesRef.current = choices;
  // Drag to add a node (Refactor.104): the canvas takes the drop; the tile shows the choice's name and its node's colour. A drop also
  // closes the Create node popup it may have come from. 拖曳新增節點（R.104）：畫布接收放下；圖塊顯示選項名稱與節點顏色。放下時也關掉
  // 可能是它來源的浮動新增視窗。
  useDropToAdd(useMemo(() => {
    const find = (id: string) => choicesRef.current.find(item => item.id === id);
    return {
      describe: (id: string) => {
        const choice = find(id);
        return choice && session ? { label: choice.label, color: session.newNodeColor(choice.spec) ?? 'function' } : null;
      },
      drop: (id: string, at: { x: number; y: number }) => {
        const choice = find(id);
        if (choice) session?.addNode(choice.spec, flow.screenToFlowPosition(at));
        setCreating(null);
      },
    };
  }, [session, flow]));
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
  // Reset browser settings (Refactor.69; reset-settings.md, human 2026-10-10: reload afterwards, language too), as the legacy
  // editor (app.js:944): finish the value being typed first; ask; keep unsent changes as a draft (stop if the browser cannot);
  // forget every preference (all or none); reload. Drafts and anything in TD are not preferences and stay.
  // 重設瀏覽器設定（人類 10-10：之後重新整理、語言也重設），照舊產品：先完成正在輸入的值；確認；未送出的修改先存成草稿（存不了就停）；
  // 忘掉所有偏好（全部或都不）；重新整理。草稿與 TD 那邊的東西不是偏好，留著。
  const resetting = useRef(false);
  const resetSettings = () => {
    const tell = (message: Message) => session?.notice(new TextError(message));
    if ((document.activeElement as HTMLElement | null)?.matches('input, textarea')) { tell(tr('reset.finishFirst', 'Finish the value you are typing first, then reset.')); return; }
    if (!confirm(say(tr('reset.confirm', 'Reset every TD-Grape setting kept in this browser to the default: appearance, layout, language and canvas behaviour. The page then reloads: changes not yet in TD are kept as a draft first; the Undo history and the message log are cleared. Continue?')))) return;
    try { if (session?.snapshot().dirty && !draft) sessionStorage.setItem(draftKey, JSON.stringify({ target, graph: session.graph(), source: sourceNow(tdNow.current) })); }
    catch { tell(tr('reset.noDraft', 'Nothing was reset: the browser cannot keep a draft of the unsent changes. Use Download draft first.')); return; }
    try { forgetPreferences(); } catch { tell(tr('reset.failed', 'Nothing was reset: the browser did not let TD-Grape remove its settings.')); return; }
    resetting.current = true;
    location.reload();
  };
  // Copy, paste and duplicate (Refactor.96). 複製、貼上、複製副本（R.96）。
  const clip = useCopyPaste(session, prefs.snap, GRID, !!draft);
  // Groups (Refactor.98): the graph's, once per version; what the menus, toolbar and keys do with them. 群組（R.98）：圖的群組，每一版
  // 算一次；選單、工具列、按鍵對它們做的事。
  const groups = useMemo(() => session?.groups() ?? [], [session, state.version]), grouping = useGroupActions(session);
  useEffect(() => {
    if (!session) return;
    const leave = (event: BeforeUnloadEvent) => { if (session.snapshot().dirty && !resetting.current) { event.preventDefault(); event.returnValue = ''; } };
    // The editor's commands, their keys from the one table (shortcuts.ts, Refactor.95); where each applies is decided here. Copy and
    // paste come as the browser's own events (copy_paste.ts). 編輯器的指令，鍵都從那一張表來（shortcuts.ts，R.95）；在哪裡生效在這裡
    // 決定。複製、貼上走瀏覽器自己的事件（copy_paste.ts）。
    const keys = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement;
      if (element.closest('input,select,textarea,[contenteditable="true"]')) return;
      // On the network or on nothing, as legacy (graph_ui.js:2518); elsewhere (a panel, a menu) keys do what they do there
      // (human 2026-10-09: keyboard use in panels). 在網路區或沒有焦點時，同舊產品；在面板、選單裡按鍵照那裡的意思（人類：面板要能用鍵盤）。
      const network = element === document.body || element === document.documentElement || !!element.closest('.react-flow');
      const run = (action: () => void) => { event.preventDefault(); action(); };
      if (!draft && matches('undo', event)) run(() => session.history(false));
      else if (!draft && matches('redo', event)) run(() => session.history(true));
      // Tab opens Create node in the upper middle of the network (legacy graph_ui.js:2560). Tab 在網路區中間偏上打開新增節點（照舊產品）。
      // Tab, a double-click and the menu's Nodes place what is picked (Refactor.105.1, human 2026-10-12); a wire dropped on the canvas adds
      // it where it was dropped, as legacy. Tab、雙擊與選單的節點：選好的先放置（R.105.1，人類 10-12）；拉線放到畫布照舊產品，在放開處新增。
      else if (!draft && network && matches('add', event)) run(() => setCreating({ screen: middle(), place: true }));
      // P floats the Parameter panel, or sends it back (legacy graph_ui.js:2534; human 2026-10-11): on the network, in a floating
      // panel or with nothing focused. P 讓參數面板浮出來，或送回去（照舊產品；人類 10-11）：在網路區、浮動面板裡或沒有焦點時。
      else if ((network || element.closest('.floating-area')) && matches('floatingParameter', event)) run(() => { if (!event.repeat) layout.toggleFloat('params'); });
      // The right-click menu in the upper middle of the network, for the selection (legacy graph_ui.js:2559). 在網路區中間偏上打開右鍵選單，
      // 對著選取（照舊產品）。
      else if (!draft && network && matches('menu', event)) {
        const host = document.querySelector<HTMLElement>('.right-select-host');
        if (host) run(() => onMenu({ ...middle(), touch: false, host }));
      }
      // Focus graph on and off (legacy graph_ui.js:2522); Esc leaves it (human 2026-10-11). An Esc that closes a menu does not leave it:
      // focus is in the menu then, so `network` is false. 專注編輯開關（照舊產品）；Esc 離開（人類 10-11）。關選單的 Esc 不會離開：那時焦點
      // 在選單裡，network 是 false。
      else if (network && matches('focusGraph', event)) run(() => { if (!event.repeat) layout.setFocused(on => !on); });
      else if (network && layout.focused && !event.defaultPrevented && matches('leaveFocus', event)) run(() => layout.setFocused(false));
      // Duplicate the selection (legacy graph_ui.js:2568; the browser's bookmark is not opened). 複製副本（照舊產品；不開瀏覽器的書籤）。
      else if (!draft && network && matches('duplicate', event)) run(clip.duplicate);
      // Groups (legacy graph_ui.js:2550-2556): create, join, remove from. 群組（照舊產品）：建立、加入、移出。
      else if (!draft && network && matches('group', event)) run(grouping.create);
      else if (!draft && network && matches('joinGroup', event)) run(grouping.join);
      else if (!draft && network && matches('leaveGroup', event)) run(grouping.leave);
      // F frames the selection (all when none), H frames all (legacy graph_ui.js:2545, selection_ui.js:92). F 對準選取（沒選就全部）、
      // H 對準全部（照舊產品）。
      else if (!draft && network && matches('frame', event)) run(() => frameNodes(flow, flow.getNodes().filter(node => node.selected).map(node => node.id)));
      else if (!draft && network && matches('home', event)) run(() => frameNodes(flow));
    };
    addEventListener('beforeunload', leave); addEventListener('keydown', keys);
    return () => { removeEventListener('beforeunload', leave); removeEventListener('keydown', keys); };
  }, [session, draft, layout.focused, clip, grouping]);
  // Trial (Refactor.63.6, human 2026-10-10): the nodes that wrote a line TD reported, only while this is the GLSL that failed
  // (legacy: only exact lines, only before the graph changes). Worked out only with the setting on and a failure.
  // 試驗：TD 回報的錯誤行是哪些節點寫的；只在目前就是失敗的那份 GLSL 時（舊產品：只認確定的行、圖改過就不標）。設定開著且有失敗才算。
  const failure = state.stuck?.failure;
  const errorNodes = useMemo(() => prefs.errorNodes ? findErrorNodes(failure, state.glsl, state.glslMap) : null,
    [prefs.errorNodes, failure, state.glsl, state.glslMap]);
  // The panels' content, from the graph being edited (Q47 4). Kept while only the layout changes (a splitter drag re-renders
  // this every move): rebuilt when the graph, the choices or the language change (Refactor.79.3; EDITOR_UI_RULES, continuous
  // interactions). 面板內容，來自正在編輯的圖（Q47 4）。只有版面變時沿用（拖分隔線每動一下都會重繪這裡）：圖、可新增的東西或語言變了才重建
  // （R.79.3；畫面規則「連續互動」）。
  const adding = useRef(addAt); adding.current = addAt;
  const add = useCallback((choice: AddChoice) => adding.current(choice, middle()), []);
  const panels = useMemo<Record<string, PanelView>>(() => {
    const input: PanelInput = { session, state, choices, add };
    return Object.fromEntries((Object.entries(PANELS) as [string, PanelRow][]).map(([id, row]) => [id, { title: row.title, content: row.content(input), menu: row.menu, frame: row.frame }]));
  }, [session, state, choices, add, text]);
  // The location bar sits over the canvas; when its file or path would be cut there, it moves to a row of its own under the
  // title bar, as the legacy one always was, and comes back once the canvas can show it whole again, with a little to spare
  // (R.69.5, human 2026-10-10: try it, by what fits rather than a set width).
  // 網址列在畫布上方；在那裡檔名或路徑會被截斷時，移到標題列下方獨立一列（舊產品一直是這樣），等畫布又能完整放下它（多留一點）再移回來
  // （R.69.5，人類 10-10：照放不放得下、不設固定寬度，先試試看）。
  const [above, setAbove] = useState(false), whole = useRef(0), networkElement = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = networkElement.current;
    if (!above || !element) return;
    const observer = new ResizeObserver(() => { if (whole.current > 0 && element.clientWidth >= whole.current + SPARE) setAbove(false); });
    observer.observe(element);
    return () => observer.disconnect();
  }, [above]);
  // The network is the canvas pane of the layout: one fixed part, never moved or closed (Refactor.68).
  // 網路區是版面裡的畫布那一格：固定、不能移動或關閉。
  const network = <section className="network" ref={networkElement} aria-label={say(tr('network.label', 'Network'))}>
        {!above && !layout.focused && <LocationBar layout={layout} file={file} target={where} onCramped={() => { whole.current = 0; setAbove(true); }} />}
        <div className="canvas">
          {/* While an earlier draft waits for a choice, only the network and its toolbar are locked; the notices stay usable.
              有草稿等待選擇時，只鎖住網路區與功能列；提示照樣能按。 */}
          <div className="canvas-body" inert={!!draft}>
          {session ? <Canvas session={session} projection={state.projection} bodyDrag={prefs.bodyDrag} snap={prefs.snap} boxSelect={prefs.boxSelect} damping={prefs.damping} errorNodes={errorNodes}
            placing={placing} onCreate={onCreate} onMenu={onMenu} focused={layout.focused} onFocus={layout.setFocused} clip={clip} groups={groups} grouping={grouping} textGrows={prefs.groupTextGrows} />
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
          <div className="network-bar-slot" inert={!!draft}><NetworkBar session={session} prefs={prefs} onGlsl={() => layout.showOrFold('glsl')} /></div>
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
          {session && state.upgrades.length > 0 && !draft && state.phase !== 'conflict' && <UpgradeNotice state={state} session={session}
            onGo={id => { session.selectNode(id); frameNodes(flow, [id]); }} />}
          {session && state.stuck && !draft && state.phase !== 'conflict' && <StuckNotice state={state} session={session}
            onShowGlsl={line => { layout.show('glsl'); if (line) session.focusGlslLine(line); }} />}
          </div></div>
        {session && menuAt && <CanvasMenu request={menuAt} session={session} state={state} layout={layout} clip={clip} grouping={grouping} onClose={closeMenu}
          onCreate={at => setCreating({ screen: at, place: true })} />}
        <DragToAddLayer />
        {session && creating && <CreateNode request={creating} choices={choices} session={session} onClose={() => setCreating(null)}
          onPick={(choice, port) => {
            setCreating(null);
            const wire = creating.wire && port ? { end: creating.wire.end, port: port.port, configure: port.configure } : undefined;
            if (!(creating.place && place.start(choice.spec, wire, creating.screen))) addAt(choice, creating.screen, wire);
          }} />}
      </section>;
  return <SessionContext.Provider value={session}><TextContext.Provider value={text}>
    {above && !layout.focused && <LocationBar layout={layout} file={file} target={where} onWidth={width => { whole.current = width; }} />}
    <LayoutView layout={layout} panels={panels} canvas={network} />
    {!layout.focused && <FootBar session={session} waiting={waiting.message} prefs={prefs} project={td?.file} onAppearance={() => layout.show('appearance')} apart={layout.apart} onApart={layout.setApart} onReset={resetSettings} onDownload={() => download({ target, graph: session!.graph(), source: sourceNow(td) })} />}
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
    if (!GRAPE_ID.test(target)) { setWaiting(wrong); return; }
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
    {layout.titleBar && !layout.focused && <TitleBar session={session} version={version} />}
    {/* One frame for every stage; a new session starts its own editing state (drafts are per Grape OP).
        每個階段同一個外框；新的 session 有自己的編輯狀態（草稿依 Grape OP 分開）。 */}
    <Workspace key={session ? target : ''} session={session} waiting={waiting} prefs={prefs} layout={layout} text={text} td={td} opened={opened}
      // The project file before the Grape OP path, as in the old product (Refactor.52); TD's build on hover.
      // 專案檔名放在 Grape OP 路徑前面（照舊）；滑鼠停留顯示 TD 版本。
      file={td && <span className="project-file" title={say(detailLabel(td, version))}>{td.file}</span>}
      target={<GrapeOpEntry className="target" label={path || tr('picker.choose', 'Choose a Grape OP')} />} />
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
  // Node texts the core names by key (help, source groups, control labels): only the ones in use, in English (Refactor.74.1,
  // human 2026-10-10; the legacy translation file is a reference in docs/reference, not loaded).
  // 核心用代號指名的節點文字（說明、來源分類、控制項名稱）：只有用到的、英文（R.74.1，人類；舊翻譯檔放在 docs/reference 當參考，不載入）。
  const [files, nodeTexts, build] = await Promise.all([
    fetch('/editor-bootstrap.json').then(response => response.json()) as Promise<Bootstrap>,
    fetch('/node-texts.json').then(response => response.json()) as Promise<Record<string, string>>,
    fetch('/build-info.json').then(response => response.json()),
  ]);
  const text = (key: string) => nodeTexts[key] ?? key;
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
