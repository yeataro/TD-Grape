import { useRef, useState, type PointerEvent, type MouseEvent, type ReactNode } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { Editor as EditorSession } from './editor';
import type { FlowNode, FlowEdge } from './projection';

// Box selection, the editor's only one (React Flow's own box is off: selectionKeyCode={null}).
// Selection is RF runtime state: nothing here touches GraphDocument (design-interview Q29).
// 編輯器唯一的框選（RF 內建框選已關）。選取屬畫面暫態，不碰作品。
// Rules aligned with TD (design-interview Q33/Q39): right-drag or Shift+left-drag on blank canvas;
// the selection follows the box live and a node counts once the box touches it; Shift keeps the
// previous selection, otherwise the box replaces it (Ctrl behaves as no modifier).
// 規則對齊 TD：空白處右鍵拖或 Shift＋左鍵拖；拖曳中即時選取、碰到即算；按 Shift 保留原選取，否則取代（Ctrl 同無修飾鍵）。
type Drag = { x: number; y: number; previous: Set<string>; moved: boolean; right: boolean };
const threshold = 3;
// After a real right-drag, swallow exactly the next context menu wherever the button is released.
// 右鍵拖曳放開時游標可能在畫布外（工具列等），只擋緊接著的那一次選單。
function blockNextMenu() {
  const block = (event: Event) => { event.preventDefault(); window.removeEventListener('contextmenu', block, true); };
  window.addEventListener('contextmenu', block, true);
  setTimeout(() => window.removeEventListener('contextmenu', block, true), 400);
}

export function RightDragSelect({ session, children }: { session: EditorSession; children: ReactNode }) {
  const flow = useReactFlow<FlowNode, FlowEdge>(), host = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const starts = (event: { button: number; shiftKey: boolean; target: EventTarget }) =>
    (event.button === 2 || (event.button === 0 && event.shiftKey)) && !!(event.target as Element).closest('.react-flow__pane');
  const begin = (event: PointerEvent) => {
    if (!starts(event)) return;
    if (event.button === 0) event.stopPropagation(); // Shift+left drag selects instead of panning
    const previous = new Set(event.shiftKey ? flow.getNodes().filter(node => node.selected).map(node => node.id) : []);
    drag.current = { x: event.clientX, y: event.clientY, previous, moved: false, right: event.button === 2 };
    host.current!.setPointerCapture(event.pointerId);
  };
  // The pane pans on mousedown (d3-zoom), so a Shift+left press must stop there too. 平移由 mousedown 觸發，一併攔下。
  const press = (event: MouseEvent) => { if (event.button === 0 && starts(event)) event.stopPropagation(); };
  const select = (start: Drag, event: PointerEvent) => {
    const a = flow.screenToFlowPosition({ x: Math.min(start.x, event.clientX), y: Math.min(start.y, event.clientY) });
    const b = flow.screenToFlowPosition({ x: Math.max(start.x, event.clientX), y: Math.max(start.y, event.clientY) });
    // partially = true: touching the box is enough. 碰到即算。
    const hits = new Set(flow.getIntersectingNodes({ x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y }, true).map(node => node.id));
    // Emit only nodes whose state changes, so a live drag stays cheap. 只送有變的節點。
    const changes = flow.getNodes().flatMap(node => {
      const selected = hits.has(node.id) || start.previous.has(node.id);
      return selected === !!node.selected ? [] : [{ type: 'select' as const, id: node.id, selected }];
    });
    if (changes.length) session.nodeChanges(changes);
  };
  const move = (event: PointerEvent) => {
    const start = drag.current; if (!start) return;
    if (!start.moved && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= threshold) return;
    if (!start.moved) {
      start.moved = true;
      // Node and wire selection stay separate, as in the legacy editor. 節點與接線選取分開。
      session.edgeChanges(flow.getEdges().filter(edge => edge.selected).map(edge => ({ type: 'select' as const, id: edge.id, selected: false })));
    }
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
  };
  // Blank canvas never shows the browser menu (macOS opens it on press, not release).
  // 畫布空白處不跳瀏覽器選單（macOS 在按下時就開）；舊產品此處是自己的選單。
  const menu = (event: MouseEvent) => { if ((event.target as Element).closest('.react-flow__pane')) event.preventDefault(); };
  return <div ref={host} className="right-select-host" onPointerDownCapture={begin} onMouseDownCapture={press} onPointerMove={move}
    onPointerUp={end} onPointerCancel={() => { drag.current = null; setBox(null); }} onContextMenuCapture={menu}>
    {children}
    {box && <div className="right-select-box" style={box} />}
  </div>;
}
