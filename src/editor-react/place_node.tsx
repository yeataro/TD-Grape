import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactFlowInstance } from '@xyflow/react';
import type { Editor as EditorSession, NewNode, NewWire } from './editor';
import type { FlowNode, FlowEdge } from './projection';
import { motionOn } from './appearance';

// Place a node (GLOSSARY; Refactor.105, human 2026-10-12: "the node you add can still be given its place first, then really added
// or taken back"). As legacy's node placement (graph_ui.js:2360), after a pick in Create node opened by a right-click on a port, Tab,
// a double-click or the menu (R.105.1; a wire dropped on the canvas still adds at once): the chosen node is not in the graph yet; what adding it would make — the node and its wire, rehearsed on a discarded candidate — follows the pointer, and a
// left press adds it there in one step. Escape, Tab, another button, a press outside the canvas, leaving the window or a change to
// the graph take it back, leaving nothing. Nothing reaches the graph, TD, Undo or the Graph JSON View until the press.
// 放置節點（用語表；R.105，人類 10-12：「新增的這個節點，還可以先決定它的位置，再真的新增或者是反悔」）。同舊產品，在接孔右鍵、Tab、
// 雙擊或選單打開的浮動新增視窗選了項目之後（R.105.1；拉線放到畫布照舊直接新增）：選好的節點還不在圖裡；新增它會產生的東西——節點與它的線，在丟棄的候選上預演——跟著指標走，左鍵按下才在那裡一步新增。Esc、Tab、
// 其他按鍵、在畫布外按下、離開視窗、圖被改了，都是反悔，什麼都不留。按下之前圖、TD、上一步、Graph JSON View 都不知道它。

/** What the canvas draws while a node is placed; leaving: placed, fading out. 放置中畫布要畫的；leaving：已放下、淡出中。 */
export type Placing = { node: FlowNode; edges: FlowEdge[]; leaving?: boolean };
type Gesture = { spec: NewNode; wire?: NewWire; shown: Placing; client: { x: number; y: number }; version: number };

export function usePlaceNode(session: EditorSession | null, flow: Pick<ReactFlowInstance, 'screenToFlowPosition' | 'getInternalNode' | 'getViewport'>, grid: number | null) {
  const [placing, setPlacing] = useState<Placing | null>(null);
  const gesture = useRef<Gesture | null>(null);
  // Where the pointer last was, so placing starts at the pointer, not where the popup opened — a pick by Enter too (Refactor.105.2,
  // human 2026-10-12: start right where the pointer is). 指標最後在哪裡，讓放置從指標開始、不從視窗打開的地方——用 Enter 選也是
  // （R.105.2，人類 10-12：直接從滑鼠現在的位置開始）。
  const pointer = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const seen = (event: PointerEvent) => { pointer.current = { x: event.clientX, y: event.clientY }; };
    addEventListener('pointermove', seen, { capture: true, passive: true }); addEventListener('pointerdown', seen, { capture: true, passive: true });
    return () => { removeEventListener('pointermove', seen, { capture: true }); removeEventListener('pointerdown', seen, { capture: true }); };
  }, []);
  /** Begin placing at the pointer (where the popup opened, before the pointer has been seen); false when adding it would fail
   * (the caller adds it as before). 從指標開始放置（還沒看過指標時從視窗打開的地方）；新增會失敗時回 false。 */
  const start = useCallback((spec: NewNode, wire: NewWire | undefined, opened: { x: number; y: number }) => {
    const at = pointer.current ?? opened, preview = session?.placementPreview(spec, wire);
    if (!session || !preview) return false;
    // Drawn hidden until React Flow has measured it, so it never shows at a guessed place; its wire is hidden with it by the same
    // class (Refactor.106: a :has() over the whole canvas did this before). 量到大小之前先藏著，不在猜的位置出現；它的線用同一個
    // class 一起藏（R.106：之前用整個畫布的 :has()）。
    const shown: Placing = {
      node: { ...preview.node, position: flow.screenToFlowPosition(at), selected: false, draggable: false, selectable: false,
        connectable: false, focusable: false, deletable: false, className: 'placing measuring', zIndex: 1000 },
      edges: preview.edges.map(edge => ({ ...edge, selected: false, selectable: false, focusable: false, deletable: false,
        className: [edge.className, 'placing measuring'].filter(Boolean).join(' ') })),
    };
    gesture.current = { spec, wire, shown, client: at, version: session.snapshot().version };
    setPlacing(shown);
    return true;
  }, [session, flow]);
  // Each placing its own run (keyed by its node's id), so one that starts while the last fades out gets its listeners.
  // 每次放置各自一輪（用它節點的 id），上一個還在淡出時開始的新放置也有自己的監聽。
  const active = placing && !placing.leaving ? placing.node.id : null;
  useEffect(() => {
    const g = gesture.current;
    if (!active || !g || !session) return;
    const id = g.shown.node.id, stop = new AbortController(), options = { capture: true, signal: stop.signal };
    let frame = 0, titleHeight = 0, canvas: Element | null = null;
    // As legacy: centred across the pointer, its title bar's middle on it; on the grid when Snap is on. Its title's height and the canvas
    // are found once: they do not change while it is placed. 同舊產品：水平置中在指標，標題列的中間對著指標；Snap 開著時對齊格線。標題列
    // 的高度與畫布只找一次：放置中不會變。
    const where = () => {
      const size = flow.getInternalNode(id)?.measured;
      if (!titleHeight) {
        const title = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(id)}"] .node-title`);
        titleHeight = title?.offsetHeight ?? 0; canvas = title?.closest('.react-flow') ?? null;
      }
      if (!size?.width || !size.height || !titleHeight) return null;
      // With the pointer off the canvas (the popup can float over a panel), it waits at the canvas's edge nearest the pointer, whole,
      // and follows again once the pointer comes in (Refactor.105.5, human 2026-10-12: the first way). 指標在畫布外時（浮動視窗可以
      // 在面板上），它整個停在畫布靠近指標的那一邊，指標進來後再跟上（R.105.5，人類 10-12：第一種）。
      const box = canvas?.getBoundingClientRect(), zoom = flow.getViewport().zoom;
      let client = g.client;
      if (box && (client.x < box.left || client.x > box.right || client.y < box.top || client.y > box.bottom)) {
        const half = size.width * zoom / 2, top = titleHeight * zoom / 2, below = size.height * zoom - top;
        const within = (value: number, low: number, high: number) => low > high ? (low + high) / 2 : Math.min(high, Math.max(low, value));
        client = { x: within(client.x, box.left + half, box.right - half), y: within(client.y, box.top + top, box.bottom - below) };
      }
      const point = flow.screenToFlowPosition(client);
      let x = point.x - size.width / 2, y = point.y - titleHeight / 2;
      if (grid) { x = Math.round(x / grid) * grid; y = Math.round(y / grid) * grid; }
      return { x, y };
    };
    // Placed, it fades out over the node just added (Refactor.105.5, human 2026-10-12: 0.1 s; animation effects off: gone at once); taken
    // back, it goes at once. 放下時在剛新增的節點上淡出（R.105.5，人類 10-12：0.1 秒；動畫效果關掉時直接拿掉）；反悔時直接拿掉。
    const end = (placed = false) => {
      if (gesture.current !== g) return;
      gesture.current = null; stop.abort(); cancelAnimationFrame(frame);
      if (!placed || !motionOn() || g.shown.node.className !== 'placing') { setPlacing(null); return; }
      const leaving: Placing = { leaving: true, node: { ...g.shown.node, className: 'placing leaving' },
        edges: g.shown.edges.map(edge => ({ ...edge, className: edge.className + ' leaving' })) };
      setPlacing(leaving);
      // Gone when its fade-out has played (the time stays in the CSS; the build rewrites 100ms as .1s), or after a second at most.
      // 淡出播完就拿掉（時間只寫在 CSS；打包會把 100ms 改寫成 .1s），最多一秒。
      const gone = () => { removeEventListener('animationend', played); clearTimeout(late); setPlacing(now => now === leaving ? null : now); };
      const played = (event: AnimationEvent) => { if (event.animationName === 'placing-out') gone(); };
      const late = setTimeout(gone, 1000);
      addEventListener('animationend', played);
    };
    // The graph unchanged since it began (version counts graph edits, not selection). 開始以來圖沒變（version 數的是圖的修改，不是選取）。
    const valid = () => session.snapshot().version === g.version;
    // Once a frame: follow the pointer (and the view, when it pans or zooms under it). 每格一次：跟著指標（畫面平移縮放時也跟）。
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (!valid()) { end(); return; }
      const at = where();
      if (!at) return;
      const node = g.shown.node, moved = node.position.x !== at.x || node.position.y !== at.y;
      // Its measured size goes with it: React Flow reads the size from the node it is given, and a node without one is drawn hidden
      // until measured again — a blink on every move (Refactor.105.3). 量到的大小跟著它：React Flow 從交給它的節點讀大小，沒帶大小的
      // 節點會先藏起來等重新量——每動一次就閃一下（R.105.3）。
      const size = flow.getInternalNode(id)?.measured;
      const measured = !node.measured && size?.width && size.height ? { measured: { width: size.width, height: size.height } } : {};
      // Shown only once React Flow has it at its centred place: showing it in the same update as moving it showed it one frame at the
      // first, uncentred place (Refactor.105.3, human 2026-10-12: it seemed to flash in from somewhere). 等 React Flow 已把它放在置中的
      // 位置才顯示：和移動在同一次更新裡顯示，會有一格露在一開始沒置中的位置（R.105.3，人類 10-12：像是從哪裡閃現出來）。
      if (node.className !== 'placing') {
        if (moved || 'measured' in measured) { g.shown = { ...g.shown, node: { ...node, ...measured, position: at } }; setPlacing(g.shown); return; }
        const placed = flow.getInternalNode(id)?.internals.positionAbsolute;
        if (!placed || placed.x !== at.x || placed.y !== at.y) return;
        g.shown = { ...g.shown, node: { ...node, className: 'placing' },
          edges: g.shown.edges.map(edge => ({ ...edge, className: edge.className!.split(' ').filter(name => name !== 'measuring').join(' ') })) };
        setPlacing(g.shown); return;
      }
      if (!moved) return;
      g.shown = { ...g.shown, node: { ...node, position: at } };
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
      end(!!at);
      if (at) session.addNode(g.spec, at, g.wire);
    }, options);
    // The editor's shortcuts are held back while it is placed (legacy held every key); the browser's own keys (reload, its tools) still
    // work. Escape and Tab take it back. 放置中編輯器的快捷鍵都不作用（舊產品是所有按鍵）；瀏覽器自己的按鍵（重新整理、開發工具）照常。
    // Esc 與 Tab 反悔。
    addEventListener('keydown', event => {
      event.stopImmediatePropagation();
      if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); end(); }
    }, options);
    addEventListener('blur', () => end(), { signal: stop.signal });
    addEventListener('resize', () => end(), { signal: stop.signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden) end(); }, { signal: stop.signal });
    return () => { stop.abort(); cancelAnimationFrame(frame); };
  }, [active, session, flow, grid]);
  return { placing, start };
}
