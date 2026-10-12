import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactFlowInstance } from '@xyflow/react';
import type { Editor as EditorSession, NewNode, WireEnd, WireFit } from './editor';
import type { FlowNode, FlowEdge } from './projection';

// Place a node (GLOSSARY; Refactor.105, human 2026-10-12: "the node you add can still be given its place first, then really added
// or taken back"). As legacy's node placement (graph_ui.js:2360), only after a right-click on a port: the chosen node is not in the
// graph yet; what adding it would make — the node and its wire, rehearsed on a discarded candidate — follows the pointer, and a
// left press adds it there in one step. Escape, Tab, another button, a press outside the canvas, leaving the window or a change to
// the graph take it back, leaving nothing. Nothing reaches the graph, TD, Undo or the Graph JSON View until the press.
// 放置節點（用語表；R.105，人類 10-12：「新增的這個節點，還可以先決定它的位置，再真的新增或者是反悔」）。同舊產品，只在接孔右鍵之後：
// 選好的節點還不在圖裡；新增它會產生的東西——節點與它的線，在丟棄的候選上預演——跟著指標走，左鍵按下才在那裡一步新增。Esc、Tab、
// 其他按鍵、在畫布外按下、離開視窗、圖被改了，都是反悔，什麼都不留。按下之前圖、TD、上一步、Graph JSON View 都不知道它。

type Wire = { end: WireEnd; port: string; configure?: WireFit['configure'] };
/** What the canvas draws while a node is placed. 放置中畫布要畫的。 */
export type Placing = { node: FlowNode; edges: FlowEdge[] };
type Gesture = { spec: NewNode; wire?: Wire; shown: Placing; client: { x: number; y: number }; version: number };

export function usePlaceNode(session: EditorSession | null, flow: Pick<ReactFlowInstance, 'screenToFlowPosition' | 'getInternalNode'>, grid: number | null) {
  const [placing, setPlacing] = useState<Placing | null>(null);
  const gesture = useRef<Gesture | null>(null);
  /** Begin placing; false when adding it would fail (the caller adds it as before). 開始放置；新增會失敗時回 false。 */
  const start = useCallback((spec: NewNode, wire: Wire | undefined, at: { x: number; y: number }) => {
    const preview = session?.placementPreview(spec, wire);
    if (!session || !preview) return false;
    // Drawn hidden until React Flow has measured it, so it never shows at a guessed place. 量到大小之前先藏著，不在猜的位置出現。
    const shown: Placing = {
      node: { ...preview.node, position: flow.screenToFlowPosition(at), selected: false, draggable: false, selectable: false,
        connectable: false, focusable: false, deletable: false, className: 'placing measuring', zIndex: 1000 },
      edges: preview.edges.map(edge => ({ ...edge, selected: false, selectable: false, focusable: false, deletable: false,
        className: [edge.className, 'placing'].filter(Boolean).join(' ') })),
    };
    gesture.current = { spec, wire, shown, client: at, version: session.snapshot().version };
    setPlacing(shown);
    return true;
  }, [session, flow]);
  const active = placing !== null;
  useEffect(() => {
    const g = gesture.current;
    if (!active || !g || !session) return;
    const id = g.shown.node.id, stop = new AbortController(), options = { capture: true, signal: stop.signal };
    let frame = 0;
    // As legacy: centred across the pointer, its title bar's middle on it; on the grid when Snap is on.
    // 同舊產品：水平置中在指標，標題列的中間對著指標；Snap 開著時對齊格線。
    const where = () => {
      const size = flow.getInternalNode(id)?.measured;
      const title = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(id)}"] .node-title`);
      if (!size?.width || !title) return null;
      const point = flow.screenToFlowPosition(g.client);
      let x = point.x - size.width / 2, y = point.y - title.offsetHeight / 2;
      if (grid) { x = Math.round(x / grid) * grid; y = Math.round(y / grid) * grid; }
      return { x, y };
    };
    const end = () => { if (gesture.current !== g) return; gesture.current = null; stop.abort(); cancelAnimationFrame(frame); setPlacing(null); };
    // The graph unchanged since it began (version counts graph edits, not selection). 開始以來圖沒變（version 數的是圖的修改，不是選取）。
    const valid = () => session.snapshot().version === g.version;
    // Once a frame: follow the pointer (and the view, when it pans or zooms under it). 每格一次：跟著指標（畫面平移縮放時也跟）。
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (!valid()) { end(); return; }
      const at = where();
      if (!at) return;
      const node = g.shown.node, moved = node.position.x !== at.x || node.position.y !== at.y;
      if (!moved && node.className === 'placing') return;
      g.shown = { ...g.shown, node: { ...node, position: at, className: 'placing' } };
      setPlacing(g.shown);
    };
    frame = requestAnimationFrame(tick);
    // The press that ends it is not also a click on what lies under it. 結束它的那一下，不同時算點到底下的東西。
    const swallow = () => {
      const block = (event: Event) => { event.preventDefault(); event.stopPropagation(); };
      for (const type of ['click', 'auxclick', 'contextmenu'] as const) addEventListener(type, block, { capture: true, once: true });
      setTimeout(() => { for (const type of ['click', 'auxclick', 'contextmenu'] as const) removeEventListener(type, block, { capture: true }); }, 400);
    };
    addEventListener('pointermove', event => { g.client = { x: event.clientX, y: event.clientY }; }, options);
    addEventListener('pointerdown', event => {
      event.preventDefault(); event.stopImmediatePropagation(); swallow();
      const onCanvas = (event.target as Element).closest('.react-flow__pane');
      if (event.button !== 0 || !onCanvas || !valid()) { end(); return; }
      // A finger has no hover: where it touches is where it goes. 手指沒有滑過：碰到哪裡就放哪裡。
      g.client = { x: event.clientX, y: event.clientY };
      const at = where();
      end();
      if (at) session.addNode(g.spec, at, g.wire);
    }, options);
    addEventListener('keydown', event => {
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.key === 'Escape' || event.key === 'Tab') end();
    }, options);
    addEventListener('blur', end, { signal: stop.signal });
    addEventListener('resize', end, { signal: stop.signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden) end(); }, { signal: stop.signal });
    return () => { stop.abort(); cancelAnimationFrame(frame); };
  }, [active, session, flow, grid]);
  return { placing, start };
}
