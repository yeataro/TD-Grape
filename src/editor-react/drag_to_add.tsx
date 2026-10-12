import { useEffect, useSyncExternalStore, type CSSProperties, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { motionOn } from './appearance';

// Drag to add a node (GLOSSARY; Refactor.104, human 2026-10-12): whatever is dragged from a panel onto the canvas becomes a node —
// a shared source's card, an Add Node row, the Create node popup's rows, later subgraphs. What is dragged is the item's add choice; how
// it is dragged, what follows the pointer and how the canvas takes it are here, once. Our own drag, as legacy's (inspector.js:3005):
// the browser's drag shows a fixed, see-through picture and hardly works on a phone. What follows the pointer is a tile — a node's
// title bar at 75% with its name and colour (human: "a tile with the title bar's rounding and the name").
// 拖曳新增節點（用語表；R.104，人類 10-12）：從面板拖到畫布上的，最後一律變成節點——共用來源卡片、新增節點的項目、浮動新增視窗的項目，
// 之後的子圖。拖的是項目的新增選項；怎麼拖、跟著指標的是什麼、畫布怎麼接，在這裡寫一次。自己做的拖曳，同舊產品：瀏覽器的拖曳是一張固定、
// 半透明的圖，手機上也幾乎不能用。跟著指標的是一個圖塊——75% 的節點標題列，有名字與顏色（人類：「標題列的圓角加上名稱」）。

/** Moved this far before it is a drag; a shorter press is a click (legacy). 移動這麼遠才算拖曳；更短的是點一下（照舊產品）。 */
const THRESHOLD = 8;
type Tile = { label: string; color: string };
type Carried = Tile & { choice: string; x: number; y: number; phase: 'carry' | 'drop' | 'cancel'; at: number };
let carried: Carried | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => carried;
const set = (next: Carried | null) => { carried = next; listeners.forEach(listener => listener()); };

/** The canvas's side: what a choice's tile looks like, and adding it where it is dropped. 畫布這邊：新增選項的圖塊長什麼樣、放下時新增。 */
type Target = { describe(choice: string): Tile | null; drop(choice: string, at: { x: number; y: number }): void };
let target: Target | null = null;

// A press on a control is that control's: these never start a drag. 按在控制項上是那個控制項的事：這些不開始拖曳。
const own = 'input, textarea, select, [contenteditable="true"], .value-row, button:not([data-drag-handle])';
// After a drag the release is not a click on the item. 拖曳之後的放開不算點了項目。
function blockNextClick() {
  const block = (event: Event) => { event.preventDefault(); event.stopPropagation(); removeEventListener('click', block, true); };
  addEventListener('click', block, true);
  setTimeout(() => removeEventListener('click', block, true), 400);
}

/** What makes an item draggable onto the canvas: spread its result on the item. `touch`: a finger starts it only on a part marked
 * `data-drag-handle` (an Add Node row's +, a card's title bar), elsewhere the list still scrolls; 'none': only a mouse or pen.
 * 讓項目可以拖到畫布：把結果放在項目上。touch：手指只在標了 data-drag-handle 的地方開始（新增節點的 +、卡片標題列），其他地方清單照樣
 * 捲動；'none'：只有滑鼠或筆。 */
export function dragToAdd(choice: string, options: { touch?: 'handle' | 'none' } = {}) {
  return {
    onPointerDown(event: PointerEvent) {
      const element = event.target as Element;
      if (event.button !== 0 || carried || element.closest(own)) return;
      if (event.pointerType === 'touch' && (options.touch === 'none' || !element.closest('[data-drag-handle]'))) return;
      const pointer = event.pointerId, start = { x: event.clientX, y: event.clientY };
      let started = false;
      const end = (dropped: { x: number; y: number } | null) => {
        removeEventListener('pointermove', move, true); removeEventListener('pointerup', up, true); removeEventListener('pointercancel', cancel, true);
        removeEventListener('keydown', escape, true); removeEventListener('blur', cancel);
        document.documentElement.classList.remove('dragging-to-add');
        if (!started) return;
        blockNextClick();
        const on = dropped && (document.elementFromPoint(dropped.x, dropped.y)?.closest('[data-drop-to-add]') ?? null);
        if (on && target) target.drop(choice, dropped!);
        const done: Carried = { ...carried!, phase: on ? 'drop' : 'cancel', at: performance.now() };
        // Without animation effects nothing would end the fade, so it goes at once. 沒有動畫效果就不會有淡出結束，直接拿掉。
        set(motionOn() ? done : null);
      };
      const move = (moved: globalThis.PointerEvent) => {
        if (moved.pointerId !== pointer) return;
        // The button let go without its release reaching us (outside the window): end here. 按鍵已放開卻沒收到放開（在視窗外）：在這裡結束。
        if (!(moved.buttons & 1)) { end(null); return; }
        if (!started) {
          if (Math.hypot(moved.clientX - start.x, moved.clientY - start.y) < THRESHOLD) return;
          const tile = target?.describe(choice);
          if (!tile) { end(null); return; }
          started = true; document.documentElement.classList.add('dragging-to-add');
          set({ ...tile, choice, x: moved.clientX, y: moved.clientY, phase: 'carry', at: performance.now() });
        } else set({ ...carried!, x: moved.clientX, y: moved.clientY });
        moved.preventDefault();
      };
      const up = (released: globalThis.PointerEvent) => { if (released.pointerId === pointer) end({ x: released.clientX, y: released.clientY }); };
      const cancel = () => end(null);
      const escape = (key: KeyboardEvent) => { if (key.key === 'Escape' && started) { key.preventDefault(); key.stopPropagation(); end(null); } };
      addEventListener('pointermove', move, true); addEventListener('pointerup', up, true); addEventListener('pointercancel', cancel, true);
      addEventListener('keydown', escape, true); addEventListener('blur', cancel);
    },
  };
}

/** The canvas takes drops while it is shown (one canvas). 畫布顯示時接受放下（只有一個畫布）。 */
export function useDropToAdd(next: Target) {
  useEffect(() => { target = next; return () => { if (target === next) target = null; }; }, [next]);
}

/** The tile that follows the pointer, drawn once for the page; it pops up when picked up, shrinks away when dropped, fades when given
 * up (animation effects off: none of that). 跟著指標的圖塊，整頁畫一個；拿起時彈出、放下時縮小消失、放棄時淡掉（動畫效果關掉時都沒有）。 */
export function DragToAddLayer() {
  const shown = useSyncExternalStore(subscribe, snapshot);
  if (!shown) return null;
  const finish = () => { if (carried?.at === shown.at && carried.phase !== 'carry') set(null); };
  return createPortal(<div className="drag-tile-place" style={{ transform: `translate(${shown.x}px, ${shown.y}px)` }} aria-hidden="true">
    <div className={'drag-tile ' + shown.phase} style={{ '--group-color': `var(--group-${shown.color})` } as CSSProperties}
      onAnimationEnd={shown.phase === 'carry' ? undefined : finish}><strong>{shown.label}</strong></div>
  </div>, document.body);
}
