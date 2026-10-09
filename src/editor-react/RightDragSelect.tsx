import { createContext, useRef, useState, type PointerEvent, type MouseEvent, type TouchEvent, type ReactNode } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { Editor as EditorSession } from './editor';
import type { FlowNode, FlowEdge } from './projection';

// Box selection, the editor's only one (React Flow's own box is off: selectionKeyCode={null}), and
// node presses (Refactor.49: React Flow does not select, elementsSelectable is off; a press decides,
// as in the legacy editor, so a drag that follows moves what is now selected).
// Selection is RF runtime state: nothing here touches GraphDocument (design-interview Q29).
// 編輯器唯一的框選（RF 內建框選已關），以及按下節點（R.49：RF 不自己選；照舊產品在按下時決定，
// 接著的拖曳就移動新的選取）。選取屬畫面暫態，不碰作品。
// Rules aligned with TD (design-interview Q33/Q39): right-drag or Shift+left-drag on blank canvas;
// a node counts once the box touches it; Shift keeps the previous selection, otherwise the box replaces
// it (Ctrl behaves as no modifier). While dragging only a preview is shown; the selection changes on
// release (Refactor.50.1, human 2026-10-09: nodes no longer light up and go out mid-drag).
// 規則對齊 TD：空白處右鍵拖或 Shift＋左鍵拖；碰到即算；按 Shift 保留原選取，否則取代（Ctrl 同無修飾鍵）。
// 拖曳中只顯示預覽，放開才真的選取（R.50.1，人類：不再有拖曳途中亮了又熄的節點）。
type Drag = { x: number; y: number; previous: Set<string>; moved: boolean; right: boolean; touched: string[]; result: Set<string>; shown: boolean };
/** What the box would select if released now; null when no box is being dragged. 現在放開會選到哪些；沒在框選時為 null。 */
export const BoxPreviewContext = createContext<ReadonlySet<string> | null>(null);
/** Ctrl (or Cmd) toggles, Shift only adds, otherwise only this (TD as measured, Q39). */
export const pressKind = (event: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) =>
  event.ctrlKey || event.metaKey ? 'toggle' as const : event.shiftKey ? 'add' as const : 'only' as const;
const threshold = 3;
// After a real right-drag, swallow exactly the next context menu wherever the button is released.
// 右鍵拖曳放開時游標可能在畫布外（工具列等），只擋緊接著的那一次選單。
function blockNextMenu() {
  const block = (event: Event) => { event.preventDefault(); window.removeEventListener('contextmenu', block, true); };
  window.addEventListener('contextmenu', block, true);
  setTimeout(() => window.removeEventListener('contextmenu', block, true), 400);
}

// boxSelect: the toolbar's box-select switch, for touch and for people without modifier keys or a right button
// (legacy graph_ui.js:2490, 2572): then a plain left (one-finger) drag on blank canvas selects instead of panning.
// boxSelect：功能列的框選開關，給觸控、沒有修飾鍵或右鍵的人用（照舊產品）：開著時空白處一般左鍵（單指）拖曳＝框選、不平移。
export function RightDragSelect({ session, boxSelect = false, children }: { session: EditorSession; boxSelect?: boolean; children: ReactNode }) {
  const flow = useReactFlow<FlowNode, FlowEdge>(), host = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [preview, setPreview] = useState<ReadonlySet<string> | null>(null);
  // Only on blank canvas: wires and nodes sit inside the pane too, and a Shift press on a wire is a click
  // that adds it (Refactor.49.1, human 2026-10-09). 只在空白處：接線與節點也在 pane 裡，在接線上 Shift＋按下是加選它。
  const starts = (event: { button: number; shiftKey: boolean; target: EventTarget }) =>
    (event.button === 2 || (event.button === 0 && (event.shiftKey || boxSelect))) && !!(event.target as Element).closest('.react-flow__pane')
    && !(event.target as Element).closest('.react-flow__edge, .react-flow__node');
  const begin = (event: PointerEvent) => {
    const target = event.target as Element;
    // A press on a node (not on a port: that starts a wire) selects it before any drag starts.
    // 按在節點上（不是接孔：那是開始拉線）就在拖曳開始前選取。
    const card = event.button === 0 && !target.closest('.react-flow__handle') ? target.closest('.react-flow__node') : null;
    const id = card?.getAttribute('data-id');
    if (id) { session.pressNode(id, pressKind(event)); return; }
    if (!starts(event)) return;
    if (event.button === 0) event.stopPropagation(); // Shift+left (or box-select) drag selects instead of panning
    const previous = new Set(event.shiftKey ? flow.getNodes().filter(node => node.selected).map(node => node.id) : []);
    drag.current = { x: event.clientX, y: event.clientY, previous, moved: false, right: event.button === 2, touched: [], result: previous, shown: false };
    host.current!.setPointerCapture(event.pointerId);
  };
  // The pane pans on mousedown (d3-zoom), so a Shift+left press must stop there too. 平移由 mousedown 觸發，一併攔下。
  const press = (event: MouseEvent) => { if (event.button === 0 && starts(event)) event.stopPropagation(); };
  // Touch pans on touchstart; with box select on, one finger selects (two fingers still pan and zoom).
  // 觸控由 touchstart 平移；框選開著時單指框選（雙指照樣平移縮放）。
  const touch = (event: TouchEvent) => {
    if (boxSelect && event.touches.length === 1 && starts({ button: 0, shiftKey: false, target: event.target })) event.stopPropagation();
  };
  const select = (start: Drag, event: PointerEvent) => {
    const a = flow.screenToFlowPosition({ x: Math.min(start.x, event.clientX), y: Math.min(start.y, event.clientY) });
    const b = flow.screenToFlowPosition({ x: Math.max(start.x, event.clientX), y: Math.max(start.y, event.clientY) });
    // partially = true: touching the box is enough. 碰到即算。
    const hits = new Set(flow.getIntersectingNodes({ x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y }, true).map(node => node.id));
    for (const id of hits) if (!start.touched.includes(id)) start.touched.push(id); // in the order touched 依碰到的順序
    const result = new Set([...start.previous, ...hits]);
    // Cards redraw only when a node enters or leaves the box, not on every move (the legacy editor's
    // whole-view refreshes are not copied, human 2026-10-09). 只有節點進出框時卡片才重畫，不是每次移動都重畫。
    if (start.shown && result.size === start.result.size && [...result].every(id => start.result.has(id))) return;
    start.result = result; start.shown = true;
    setPreview(result);
  };
  const move = (event: PointerEvent) => {
    const start = drag.current; if (!start) return;
    if (!start.moved && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= threshold) return;
    start.moved = true;
    const origin = host.current!.getBoundingClientRect();
    setBox({ left: Math.min(start.x, event.clientX) - origin.left, top: Math.min(start.y, event.clientY) - origin.top,
      width: Math.abs(event.clientX - start.x), height: Math.abs(event.clientY - start.y) });
    select(start, event);
  };
  const end = (event: PointerEvent) => {
    const start = drag.current; drag.current = null; setBox(null);
    if (!start?.moved) return;
    if (start.right) blockNextMenu(); // the release may land anywhere, e.g. over the toolbar
    select(start, event);
    setPreview(null);
    // The one real change, on release (wires are cleared: nodes and wires are never selected together).
    // 放開時才真的改一次（接線清掉：節點與接線不混選）。
    session.boxSelect(start.result, start.touched);
  };
  // Blank canvas never shows the browser menu (macOS opens it on press, not release).
  // 畫布空白處不跳瀏覽器選單（macOS 在按下時就開）；舊產品此處是自己的選單。
  const menu = (event: MouseEvent) => { if ((event.target as Element).closest('.react-flow__pane')) event.preventDefault(); };
  return <div ref={host} className="right-select-host" onPointerDownCapture={begin} onMouseDownCapture={press} onTouchStartCapture={touch} onPointerMove={move}
    onPointerUp={end} onPointerCancel={() => { drag.current = null; setBox(null); setPreview(null); }} onContextMenuCapture={menu}>
    <BoxPreviewContext.Provider value={preview}>{children}</BoxPreviewContext.Provider>
    {box && <div className="right-select-box" style={box} />}
  </div>;
}
