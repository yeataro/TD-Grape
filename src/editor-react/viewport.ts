import type { ReactFlowInstance, Viewport } from '@xyflow/react';
import { readPreference } from './preferences';

// How the view moves (Refactor.58.2; legacy app.js:545–580, floating-panels.md 14). One place for every framing move so
// they all glide the same way: the Frame selected button, F and H, a double-click on a node, the zoom presets.
// 畫面怎麼移動：所有「對準」都走這裡，滑動的方式一樣——Frame selected 按鈕、F 與 H、雙擊節點、縮放常用值。

/** How long a framing move glides (legacy frameDampingMs default). It can be switched off in the gear, not retimed (human
 * 2026-10-09: keep it simple). 對準時滑動多久（舊產品預設）。齒輪裡可以關掉、不能改時間（人類：別弄複雜）。 */
export const FRAME_MS = 333;
/** How every move glides: straight there, slowing as it arrives, as the legacy editor (stepCanvasMotion). React Flow's
 * default flies out and back in on the way (d3 interpolateZoom; human 2026-10-09: "out, in, out again").
 * 所有移動怎麼滑：直線過去、越接近越慢，同舊產品。React Flow 預設會先縮小再放大（d3 interpolateZoom；人類：推出、推入再推出）。 */
export const glide = { ease: (t: number) => 1 - (1 - t) ** 3, interpolate: 'linear' as const };
/** The glide now: none when switched off (preferences.ts `canvas.frameGlide`). 現在的滑動時間：關掉就是 0。 */
export const frameMs = () => readPreference('canvas.frameGlide') === 'off' ? 0 : FRAME_MS;

/** How far the view zooms out and in. 畫面縮放的範圍。 */
export const MIN_ZOOM = .15, MAX_ZOOM = 2.5;

/** Frame these nodes, or all of them when none are given (legacy fitSelection / fit). 對準這些節點；沒給就對準全部。 */
export const frameNodes = (flow: Pick<ReactFlowInstance, 'fitView'>, ids?: readonly string[]) => {
  // A framing move replaces any damped target, so the next wheel tick starts from where framing goes.
  // 對準取代阻尼的目標，下一下滾輪從對準後的位置開始算。
  damping?.interrupt();
  void flow.fitView({ ...(ids?.length ? { nodes: ids.map(id => ({ id })) } : {}), duration: frameMs(), padding: .2, maxZoom: 1, ...glide });
};

// Canvas damping (Refactor.58.2 trial; legacy canvasDamping 150 ms, app.js:545–580; human 2026-10-09: clean, fast, and the
// native handling and ours must never both act). While it is on, the mouse is ours alone and React Flow's own transition
// glides the view, so nothing re-renders while it moves (measured: 0 renders):
// - the wheel, and a trackpad pinch (it arrives as a wheel with Ctrl): taken in the capture phase before React Flow sees it;
// - dragging the background with the left or middle button (React Flow's own pan condition): taken the same way; a box
//   selection (RightDragSelect, outside) decides first and stops what it takes.
// Touch stays React Flow's (one finger pans, two fingers pinch; human uses an iPad). Each wheel tick and each drag move
// sets a target we keep, so fast ticks add up exactly as without damping. Off, nothing here runs.
// 畫布阻尼（試驗）：開著時滑鼠只由我們處理、畫面由 React Flow 原生的過渡滑動，移動中不重新渲染（量過：0 次）：
// - 滾輪與觸控板雙指縮放（它是帶 Ctrl 的滾輪）：在捕獲階段、React Flow 看到之前接走；
// - 用左鍵或中鍵拖背景（同 React Flow 原生平移的條件）：同樣接走；框選（外層的 RightDragSelect）先判斷、它要的它會攔下。
// 觸控仍由 React Flow 處理（單指平移、雙指縮放；人類用 iPad）。每一下滾輪、每一步拖曳都移動我們記的目標，快速連滾的縮放量和沒有阻尼時一樣。
// 關掉時這裡完全不執行。
export const DAMPING_MS = 150;
// One tick's zoom, as React Flow's own (@xyflow/system wheelDelta). 一下滾輪的縮放量，同 React Flow 原生。
const wheelStep = (event: WheelEvent) => -event.deltaY * (event.deltaMode === 1 ? .05 : event.deltaMode ? 1 : .002)
  * (event.ctrlKey && /Mac/i.test(navigator.platform) ? 10 : 1);

/** Take the mouse's wheel and background drag over on this element (React Flow's wrapper); `interrupt` forgets the
 * target (touch took over), `detach` gives everything back. 在這個元素（React Flow 外框）上接管滑鼠滾輪與拖背景；
 * interrupt 忘掉目標（觸控接手），detach 全部還回去。 */
let damping: { interrupt(): void } | null = null;  // the canvas's damper while one is attached 掛著的阻尼
export function dampCanvas(flow: Pick<ReactFlowInstance, 'getViewport' | 'setViewport'>, element: HTMLElement) {
  let target: Viewport | null = null, until = 0;
  const base = () => target && performance.now() < until ? target : flow.getViewport();
  const glide = (next: Viewport) => {
    target = next; until = performance.now() + DAMPING_MS;
    void flow.setViewport(next, { duration: DAMPING_MS, ...glide });
  };
  const wheel = (event: WheelEvent) => {
    if ((event.target as Element).closest('.nowheel')) return;
    event.preventDefault(); event.stopPropagation();
    const from = base(), zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, from.zoom * 2 ** wheelStep(event)));
    const box = element.getBoundingClientRect(), x = event.clientX - box.left, y = event.clientY - box.top;
    // The point under the pointer stays where it is. 游標下的那一點不動。
    glide({ zoom, x: x - (x - from.x) * zoom / from.zoom, y: y - (y - from.y) * zoom / from.zoom });
  };
  // A background drag: where the view was when it started plus how far the pointer went. 拖背景：開始時的位置加上游標移動的距離。
  let drag: { id: number; x: number; y: number; from: Viewport; moved: boolean } | null = null;
  const down = (event: PointerEvent) => {
    // React Flow's own pan condition: on its pane, never on anything marked nopan (nodes, fields). Being inside the pane is
    // not enough, nodes live inside it too (fix: nodes could not be dragged). 同 React Flow 原生平移的條件：在它的 pane 上、
    // 不在任何標了 nopan 的東西上（節點、欄位）。只看「在 pane 裡」不夠，節點也在裡面（修正：節點拖不動）。
    const on = event.target as Element;
    if (event.pointerType !== 'mouse' || event.button > 1 || !on.closest('.react-flow__pane') || on.closest('.nopan')) return;
    event.stopPropagation();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, from: base(), moved: false };
    try { element.setPointerCapture(event.pointerId); } catch { /* the pointer is already gone; moves still arrive while over the canvas 指標已離開；在畫布上時仍收得到移動 */ }
    element.querySelector('.react-flow__pane')?.classList.add('dragging');
  };
  // React Flow's pan listens to mousedown: it never starts while ours does. React Flow 的平移聽 mousedown：我們接手時它不會開始。
  const press = (event: MouseEvent) => { if (drag) event.stopPropagation(); };
  const move = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 3) return;
    drag.moved = true;
    glide({ zoom: drag.from.zoom, x: drag.from.x + dx, y: drag.from.y + dy });
  };
  const up = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    const moved = drag.moved; drag = null;
    element.querySelector('.react-flow__pane')?.classList.remove('dragging');
    // A drag is not a click on the background (that would clear the selection), as React Flow's own pan.
    // 拖過就不算點背景（否則會清掉選取），同 React Flow 原生平移。
    if (moved) element.addEventListener('click', event => event.stopPropagation(), { capture: true, once: true });
  };
  const options = { capture: true } as const;
  element.addEventListener('wheel', wheel, { capture: true, passive: false });
  element.addEventListener('pointerdown', down, options);
  element.addEventListener('mousedown', press, options);
  element.addEventListener('pointermove', move);
  element.addEventListener('pointerup', up);
  element.addEventListener('pointercancel', up);
  const interrupt = () => { target = null; };
  damping = { interrupt };
  return {
    interrupt,
    detach: () => {
      if (damping?.interrupt === interrupt) damping = null;
      element.removeEventListener('wheel', wheel, { capture: true });
      element.removeEventListener('pointerdown', down, options);
      element.removeEventListener('mousedown', press, options);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', up);
    },
  };
}
