import { useEffect, useRef, type PointerEvent } from 'react';
import { useReactFlow, useStore, type NodePositionChange } from '@xyflow/react';
import type { Editor as EditorSession } from './editor';
import { say, tr } from './text';
import { HANDLES, spreadPositions, type Box, type Handle } from './selection_spread';
import { selectionBounds, type TextHeights } from './Groups';
import type { GraphGroup } from './core';

// Multi-selection frame (Refactor.50.3; human 2026-10-09: shown whenever two or more nodes are selected, never for one — legacy
// showed it unexpectedly, human 2026-10-12). Refactor.97 (human 2026-10-12: too thin, under a pixel when zoomed out; legacy's look
// and handles): drawn on the screen, not in the flow, so the dashed line stays 1px and its distance to the nodes stays the theme's
// --selection-gap at any zoom (legacy selection_ui.js:153-161); its eight handles spread the selection apart or draw it together
// (selection_spread.ts). A drag previews through the session's own node moves and is one change on release (one Undo); Esc puts it
// back. Hidden while the selection is out of view. 多選框（R.50.3；人類：選兩個以上才顯示，一個不顯示）。R.97（人類：太細、縮小時不到
// 一像素；樣子與把手照舊產品）：畫在螢幕上、不在畫布裡，虛線永遠 1px、離節點永遠是主題的 --selection-gap（照舊產品）；八個把手把選取拉開
// 或收攏（selection_spread.ts）。拖曳時用 session 自己的節點移動預覽，放開才算一次修改（一步復原）；Esc 還原。選取看不到時隱藏。

type Spread = { handle: Handle; pointer: number; x: number; y: number; zoom: number; boxes: Box[]; moved: boolean };
const THRESHOLD = 3;

// ids: the selected nodes, the session's own list (Refactor.106: no scan of every node). ids：選取的節點，session 自己的名單（R.106：不掃描全部節點）。
export function SelectionFrame({ ids, session, groups, texts }: { ids: readonly string[]; session: EditorSession; groups: readonly GraphGroup[]; texts: TextHeights }) {
  const flow = useReactFlow(), spread = useRef<Spread | null>(null);
  // The selection's bounds on screen, groups whose members are all selected included (Refactor.98), as a key so the frame draws
  // again only when they change (as the floating toolbar). 選取在螢幕上的範圍（含成員全被選取的群組，R.98），做成字串，變了才重畫（同浮動工具列）。
  const key = useStore(state => {
    if (ids.length < 2) return '';
    const box = selectionBounds({ nodeLookup: state.nodeLookup }, ids, groups, texts), [x, y, zoom] = state.transform;
    return [box.x * zoom + x, box.y * zoom + y, (box.x + box.width) * zoom + x, (box.y + box.height) * zoom + y, state.width, state.height].map(Math.round).join(',');
  });
  const move = (positions: Map<string, { x: number; y: number }>, dragging: boolean) =>
    session.nodeChanges([...positions].map(([id, position]): NodePositionChange => ({ type: 'position', id, position, dragging })));
  // Put back and let go there: no Undo step, no node left marked as dragged (as a group's title drag). 放回並在那裡放開：不多一步復原，
  // 節點不會留著拖曳中的標記（同群組標題的拖曳）。
  const back = () => { const start = spread.current; spread.current = null; if (start?.moved) move(new Map(start.boxes.map(box => [box.id, { x: box.x, y: box.y }])), false); };
  const backNow = useRef(back); backNow.current = back;
  // Esc puts the selection back; a wheel (the view moving) does too (legacy selection_ui.js:254-259). Esc 還原；滾輪（畫面在動）也還原（照舊產品）。
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (spread.current && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); backNow.current(); } };
    const wheel = () => { if (spread.current) backNow.current(); };
    addEventListener('keydown', key, true); addEventListener('wheel', wheel, { capture: true, passive: true });
    return () => { removeEventListener('keydown', key, true); removeEventListener('wheel', wheel, true); };
  }, []);
  if (!key) return null;
  const [left, top, right, bottom, width, height] = key.split(',').map(Number) as [number, number, number, number, number, number];
  if (right < 0 || left > width || bottom < 0 || top > height) return null;
  const begin = (event: PointerEvent<HTMLButtonElement>, handle: Handle) => {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    const boxes = ids.flatMap(id => { const node = flow.getInternalNode(id); return node ? [{ id, x: node.position.x, y: node.position.y,
      width: node.measured.width ?? 0, height: node.measured.height ?? 0 }] : []; });
    spread.current = { handle, pointer: event.pointerId, x: event.clientX, y: event.clientY, zoom: flow.getZoom(), boxes, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const drag = (event: PointerEvent<HTMLButtonElement>) => {
    const start = spread.current;
    if (!start || event.pointerId !== start.pointer) return;
    if (!start.moved && Math.hypot(event.clientX - start.x, event.clientY - start.y) < THRESHOLD) return;
    start.moved = true;
    move(spreadPositions(start.boxes, start.handle, (event.clientX - start.x) / start.zoom, (event.clientY - start.y) / start.zoom), true);
  };
  const end = (event: PointerEvent<HTMLButtonElement>) => {
    const start = spread.current;
    if (!start || event.pointerId !== start.pointer) return;
    spread.current = null;
    if (start.moved) move(spreadPositions(start.boxes, start.handle, (event.clientX - start.x) / start.zoom, (event.clientY - start.y) / start.zoom), false);
  };
  const label = say(tr('selection.spread', 'Spread apart or draw together'));
  return <div className="selection-frame" style={{ transform: `translate(${left}px, ${top}px)`, width: right - left, height: bottom - top }}>
    {HANDLES.map(handle => <button key={handle} type="button" tabIndex={-1} className="selection-handle nodrag nopan" data-handle={handle}
      title={label} aria-label={label} onPointerDown={event => begin(event, handle)} onPointerMove={drag} onPointerUp={end}
      onPointerCancel={back} onLostPointerCapture={() => { if (spread.current) back(); }} />)}
  </div>;
}
