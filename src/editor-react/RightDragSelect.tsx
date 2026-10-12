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
// menu: the browser asked for its menu while the right button was still held (macOS opens it on press): the menu opens on release
// if the press did not move. menu：右鍵還按著時瀏覽器就要開選單（macOS 在按下時開）：放開時沒移動才打開。
type Drag = { x: number; y: number; origin: { left: number; top: number }; previous: Set<string>; moved: boolean; right: boolean; touched: string[]; result: Set<string>; shown: boolean;
  target: Element; menu: boolean };
/** What a right-click or a long press opened the menu on (Refactor.93): a wire, a port, or else the nodes. 右鍵或長按在什麼上面打開選單
 * （R.93）：接線、接孔，或其他（節點）。 */
export type MenuOpen = { x: number; y: number; touch: boolean; host: HTMLElement; wire?: string; port?: { node: string; port: string; side: 'input' | 'output' } };
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
// After a long press, the release is not a tap (legacy graph_ui.js:2754): no click clears the selection or picks a wire.
// 長按之後，放開不算點一下（照舊產品）：不會因此清掉選取或點到接線。
function blockNextClick() {
  const block = (event: Event) => { event.preventDefault(); event.stopPropagation(); window.removeEventListener('click', block, true); };
  window.addEventListener('click', block, true);
  setTimeout(() => window.removeEventListener('click', block, true), 400);
}
/** A touch held this long without moving this far opens the menu (legacy graph_ui.js:2619). 觸控按住這麼久、沒移動這麼遠，就打開選單（照舊產品）。 */
const HOLD_MS = 550, HOLD_SLOP = 8;
// Where a long press does not open the menu: what has its own press (fields, buttons, a value's ladder) and ports (a wire starts).
// 長按不開選單的地方：有自己按住行為的（欄位、按鈕、數值梯尺）與接孔（開始拉線）。
const ownPress = 'input, textarea, select, button, [contenteditable="true"], .nodrag, .react-flow__handle';

// boxSelect: the toolbar's box-select switch, for touch and for people without modifier keys or a right button
// (legacy graph_ui.js:2490, 2572): then a plain left (one-finger) drag on blank canvas selects instead of panning.
// boxSelect：功能列的框選開關，給觸控、沒有修飾鍵或右鍵的人用（照舊產品）：開著時空白處一般左鍵（單指）拖曳＝框選、不平移。
export function RightDragSelect({ session, boxSelect = false, onMenu, children }: { session: EditorSession; boxSelect?: boolean; onMenu?(open: MenuOpen): void; children: ReactNode }) {
  const flow = useReactFlow<FlowNode, FlowEdge>(), host = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  // The right-click menu (Refactor.93; human 2026-10-12): a right press released without moving, or a touch held still (legacy).
  // A pressed node or wire not yet selected becomes the selection first; on blank canvas the selection stays (legacy graph_ui.js:2943).
  // 右鍵選單（R.93；人類 10-12）：右鍵按下沒移動就放開，或觸控按住不動（照舊產品）。按到還沒選的節點或接線，先變成選取；空白處選取不變（照舊產品）。
  const touches = useRef(new Set<number>()), touchUntil = useRef(0);
  const hold = useRef<{ id: number; x: number; y: number; at: { x: number; y: number }; target: Element; timer: number; fired: boolean } | null>(null);
  const open = (target: Element, x: number, y: number, touch: boolean) => {
    const handle = target.closest<HTMLElement>('.react-flow__handle'), base = { x, y, touch, host: host.current! };
    if (handle) {
      const node = handle.dataset.nodeid, port = handle.dataset.handleid;
      if (node && port) onMenu?.({ ...base, port: { node, port, side: handle.classList.contains('source') ? 'output' : 'input' } });
      return;
    }
    const wire = target.closest('.react-flow__edge')?.getAttribute('data-id') ?? undefined, node = target.closest('.react-flow__node')?.getAttribute('data-id');
    if (wire) session.clickEdge(wire, 'only'); else if (node) session.pressNode(node, 'only');
    onMenu?.({ ...base, wire });
  };
  const stopHold = () => { if (hold.current) clearTimeout(hold.current.timer); hold.current = null; };
  const startHold = (event: PointerEvent) => {
    touches.current.add(event.pointerId); stopHold();
    const target = event.target as Element;
    if (touches.current.size !== 1 || !target.closest('.react-flow__pane') || target.closest(ownPress)) return;
    const at = { x: event.clientX, y: event.clientY };
    hold.current = { id: event.pointerId, x: at.x, y: at.y, at, target, fired: false, timer: window.setTimeout(() => {
      const held = hold.current; if (!held) return;
      held.fired = true; drag.current = null; setBox(null); setPreview(null);
      open(held.target, held.at.x, held.at.y, true);
    }, HOLD_MS) };
  };
  const moveHold = (event: PointerEvent) => {
    const held = hold.current; if (!held || held.id !== event.pointerId || held.fired) return;
    if (Math.hypot(event.clientX - held.x, event.clientY - held.y) >= HOLD_SLOP) stopHold(); else held.at = { x: event.clientX, y: event.clientY };
  };
  const endHold = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    touches.current.delete(event.pointerId); touchUntil.current = performance.now() + 600;
    if (hold.current?.id === event.pointerId) { if (hold.current.fired) blockNextClick(); stopHold(); }
  };
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [preview, setPreview] = useState<ReadonlySet<string> | null>(null);
  // Only on blank canvas: wires and nodes sit inside the pane too, and a Shift press on a wire is a click
  // that adds it (Refactor.49.1, human 2026-10-09). 只在空白處：接線與節點也在 pane 裡，在接線上 Shift＋按下是加選它。
  const starts = (event: { button: number; shiftKey: boolean; target: EventTarget }) =>
    (event.button === 2 || (event.button === 0 && (event.shiftKey || boxSelect))) && !!(event.target as Element).closest('.react-flow__pane')
    && !(event.target as Element).closest('.react-flow__edge, .react-flow__node, .group-title');
  const begin = (event: PointerEvent) => {
    const target = event.target as Element;
    if (event.pointerType === 'touch') startHold(event);
    // A press on a node (not on a port: that starts a wire) selects it before any drag starts.
    // 按在節點上（不是接孔：那是開始拉線）就在拖曳開始前選取。
    const card = event.button === 0 && !target.closest('.react-flow__handle') ? target.closest('.react-flow__node') : null;
    const id = card?.getAttribute('data-id');
    if (id) { session.pressNode(id, pressKind(event)); return; }
    if (!starts(event)) return;
    if (event.button === 0) event.stopPropagation(); // Shift+left (or box-select) drag selects instead of panning
    const previous = new Set(event.shiftKey ? flow.getNodes().filter(node => node.selected).map(node => node.id) : []);
    // Where the canvas is, measured once: it does not move during a box drag (EDITOR_UI_RULES, continuous interactions;
    // Refactor.79.5). 畫布在哪，量一次：框選中它不會動（畫面規則「連續互動」；R.79.5）。
    const { left, top } = host.current!.getBoundingClientRect();
    drag.current = { x: event.clientX, y: event.clientY, origin: { left, top }, previous, moved: false, right: event.button === 2, touched: [], result: previous, shown: false,
      target, menu: false };
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
    // partially = true: touching the box is enough. At least one screen pixel each way: React Flow counts every node as
    // inside a box of no area (its "overlap >= box area" test is 0 >= 0), so a box dragged out and back lit up every node
    // (human 2026-10-09). 碰到即算。寬高至少一個螢幕像素：React Flow 把面積 0 的框當成包住所有節點（重疊 >= 框面積，0 >= 0），
    // 框拖出去又拖回原點時所有節點都亮了（人類）。
    const pixel = 1 / flow.getZoom();
    const hits = new Set(flow.getIntersectingNodes({ x: a.x, y: a.y, width: Math.max(b.x - a.x, pixel), height: Math.max(b.y - a.y, pixel) }, true).map(node => node.id));
    for (const id of hits) if (!start.touched.includes(id)) start.touched.push(id); // in the order touched 依碰到的順序
    const result = new Set([...start.previous, ...hits]);
    // Cards redraw only when a node enters or leaves the box, not on every move (the legacy editor's
    // whole-view refreshes are not copied, human 2026-10-09). 只有節點進出框時卡片才重畫，不是每次移動都重畫。
    if (start.shown && result.size === start.result.size && [...result].every(id => start.result.has(id))) return;
    start.result = result; start.shown = true;
    setPreview(result);
  };
  const move = (event: PointerEvent) => {
    moveHold(event);
    const start = drag.current; if (!start) return;
    // The button is no longer held but the release never arrived (it can be lost, e.g. outside an embedded
    // browser): end here, or the box would follow the pointer and cover every node.
    // 按鍵已放開、卻沒收到放開事件（例如在內嵌瀏覽器外放開時可能遺失）：在這裡結束，否則框會一直跟著游標、蓋住所有節點。
    if (!(event.buttons & (start.right ? 2 : 1))) { end(event); return; }
    if (!start.moved && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= threshold) return;
    start.moved = true;
    const { origin } = start;
    setBox({ left: Math.min(start.x, event.clientX) - origin.left, top: Math.min(start.y, event.clientY) - origin.top,
      width: Math.abs(event.clientX - start.x), height: Math.abs(event.clientY - start.y) });
    select(start, event);
  };
  function end(event: PointerEvent) {
    const start = drag.current; drag.current = null; setBox(null);
    if (!start?.moved) { if (start?.menu) open(start.target, start.x, start.y, false); return; }
    if (start.right) blockNextMenu(); // the release may land anywhere, e.g. over the toolbar
    select(start, event);
    setPreview(null);
    // The one real change, on release (wires are cleared: nodes and wires are never selected together).
    // 放開時才真的改一次（接線清掉：節點與接線不混選）。
    session.boxSelect(start.result, start.touched);
  }
  const cancel = (event: PointerEvent) => { endHold(event); drag.current = null; setBox(null); setPreview(null); };
  // The browser asks for its menu: on the network ours opens instead, unless what was pressed has its own (a value's presets: it
  // has taken the event) or is text (the browser's, to copy and paste). After a right drag the release was a box select (blocked
  // above); a touch has the long press instead. 瀏覽器要開它的選單：在網路區改開我們的，除非按到的東西有自己的（數值的常用值：它已經接手）
  // 或是文字（用瀏覽器的，好複製貼上）。右鍵拖曳之後的放開是框選（上面已擋）；觸控改用長按。
  const menu = (event: MouseEvent) => {
    const target = event.target as Element;
    if (event.defaultPrevented || !target.closest('.react-flow__pane') || target.closest('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault();
    if (touches.current.size || performance.now() < touchUntil.current) return;
    if (drag.current?.right) { drag.current.menu = true; return; }
    open(target, event.clientX, event.clientY, false);
  };
  return <div ref={host} className="right-select-host" onPointerDownCapture={begin} onMouseDownCapture={press} onTouchStartCapture={touch} onPointerMove={move}
    onPointerUp={event => { endHold(event); end(event); }} onPointerCancel={cancel} onLostPointerCapture={event => { if (drag.current) end(event); }} onContextMenu={menu}>
    <BoxPreviewContext.Provider value={preview}>{children}</BoxPreviewContext.Provider>
    {box && <div className="right-select-box" style={box} />}
  </div>;
}
