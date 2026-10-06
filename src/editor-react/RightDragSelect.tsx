import { useRef, useState, type PointerEvent, type MouseEvent, type ReactNode } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { EditorSession } from './session';
import type { FlowNode, FlowEdge } from './projection';

// Right-drag box selection, as in the legacy editor (docs/ui/UI_NAVIGATION.md,
// docs/features/CLIPBOARD_AND_EXPOSED.md). React Flow starts its own box only with the
// primary button, so this thin layer adds the right button. Selection is RF runtime state:
// nothing here touches GraphDocument (design-interview Q29).
// 舊產品的右鍵拖曳框選；RF 只用左鍵框選，這裡補右鍵。選取屬畫面暫態，不碰作品。
type Drag = { x: number; y: number; additive: boolean; moved: boolean };
const threshold = 4;
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
  const begin = (event: PointerEvent) => {
    if (event.button !== 2 || !(event.target as Element).closest('.react-flow__pane')) return;
    drag.current = { x: event.clientX, y: event.clientY, additive: event.shiftKey || event.ctrlKey || event.metaKey, moved: false };
    host.current!.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    const start = drag.current; if (!start) return;
    if (!start.moved && Math.hypot(event.clientX - start.x, event.clientY - start.y) < threshold) return;
    start.moved = true;
    const origin = host.current!.getBoundingClientRect();
    setBox({ left: Math.min(start.x, event.clientX) - origin.left, top: Math.min(start.y, event.clientY) - origin.top,
      width: Math.abs(event.clientX - start.x), height: Math.abs(event.clientY - start.y) });
  };
  const end = (event: PointerEvent) => {
    const start = drag.current; drag.current = null; setBox(null);
    if (!start?.moved) return;
    blockNextMenu(); // the release may land anywhere, e.g. over the toolbar
    const a = flow.screenToFlowPosition({ x: Math.min(start.x, event.clientX), y: Math.min(start.y, event.clientY) });
    const b = flow.screenToFlowPosition({ x: Math.max(start.x, event.clientX), y: Math.max(start.y, event.clientY) });
    // Same containment rule as React Flow's own Shift-drag box (whole node inside).
    const hits = new Set(flow.getIntersectingNodes({ x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y }, false).map(node => node.id));
    session.nodeChanges(flow.getNodes().map(node => ({ type: 'select' as const, id: node.id,
      selected: hits.has(node.id) || (start.additive && !!node.selected) })));
    // Node and wire selection stay separate, as in the legacy editor.
    session.edgeChanges(flow.getEdges().filter(edge => edge.selected).map(edge => ({ type: 'select' as const, id: edge.id, selected: false })));
  };
  // Blank canvas never shows the browser menu (macOS opens it on press, not release).
  // 畫布空白處不跳瀏覽器選單（macOS 在按下時就開）；舊產品此處是自己的選單。
  const menu = (event: MouseEvent) => { if ((event.target as Element).closest('.react-flow__pane')) event.preventDefault(); };
  return <div ref={host} className="right-select-host" onPointerDownCapture={begin} onPointerMove={move}
    onPointerUp={end} onPointerCancel={() => { drag.current = null; setBox(null); }} onContextMenuCapture={menu}>
    {children}
    {box && <div className="right-select-box" style={box} />}
  </div>;
}
