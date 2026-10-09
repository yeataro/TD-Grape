import type { ReactFlowInstance, Viewport } from '@xyflow/react';

// How the view moves (Refactor.58.2; legacy app.js:545–580, floating-panels.md 14). One place for every framing move so
// they all glide the same way: the Frame selected button, F and H, a double-click on a node, the zoom presets.
// 畫面怎麼移動：所有「對準」都走這裡，滑動的方式一樣——Frame selected 按鈕、F 與 H、雙擊節點、縮放常用值。

/** How long a framing move glides (legacy frameDampingMs default; later a preference with the damping settings).
 * 對準時滑動多久（舊產品 frameDampingMs 的預設；之後和阻尼設定一起成為偏好）。 */
export const FRAME_MS = 333;

/** How far the view zooms out and in. 畫面縮放的範圍。 */
export const MIN_ZOOM = .15, MAX_ZOOM = 2.5;

/** Frame these nodes, or all of them when none are given (legacy fitSelection / fit). 對準這些節點；沒給就對準全部。 */
export const frameNodes = (flow: Pick<ReactFlowInstance, 'fitView'>, ids?: readonly string[]) =>
  void flow.fitView({ ...(ids?.length ? { nodes: ids.map(id => ({ id })) } : {}), duration: FRAME_MS, padding: .2, maxZoom: 1 });

// Canvas damping (Refactor.58.2 trial; legacy canvasDamping 150 ms, app.js:545–580; human 2026-10-09: clean, fast, and the
// native handling and ours must never both act). While it is on, the wheel (and a trackpad pinch, which arrives as a
// wheel) is ours alone: React Flow's zoomOnScroll and zoomOnPinch are off (reported to the human). Each tick moves a
// target we keep, so fast ticks add up exactly as without damping, and React Flow's own transition glides there, so
// nothing re-renders while it moves. Dragging stays React Flow's and follows the hand; a drag stops the glide.
// Off, nothing here runs and React Flow handles the wheel as it always does.
// 畫布阻尼（試驗）：開著時滾輪（含觸控板雙指縮放，它也是滾輪事件）只由我們處理，React Flow 的 zoomOnScroll／zoomOnPinch 關掉
// （已向人類報告）。每一下都移動我們記的目標，快速連滾的縮放量和沒有阻尼時一樣；滑過去由 React Flow 原生的過渡跑，移動中不重新渲染。
// 拖曳仍由 React Flow 處理、跟手；一拖就停止滑動。關掉時這裡完全不執行，滾輪還給 React Flow 原生。
export const DAMPING_MS = 150;
const easeOut = (t: number) => 1 - (1 - t) ** 3;  // slows as it arrives (legacy stepCanvasMotion) 越接近越慢（同舊產品）
// One tick's zoom, as React Flow's own (@xyflow/system wheelDelta). 一下滾輪的縮放量，同 React Flow 原生。
const wheelStep = (event: WheelEvent) => -event.deltaY * (event.deltaMode === 1 ? .05 : event.deltaMode ? 1 : .002)
  * (event.ctrlKey && /Mac/i.test(navigator.platform) ? 10 : 1);

/** Take the wheel over on this element; `interrupt` forgets the target (a drag took over), `detach` gives it back.
 * 在這個元素上接管滾輪；interrupt 忘掉目標（使用者開始拖曳），detach 還回去。 */
export function dampedWheel(flow: Pick<ReactFlowInstance, 'getViewport' | 'setViewport'>, element: HTMLElement) {
  let target: Viewport | null = null, until = 0;
  const wheel = (event: WheelEvent) => {
    if ((event.target as Element).closest('.nowheel')) return;
    event.preventDefault();
    const now = performance.now(), base = target && now < until ? target : flow.getViewport();
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, base.zoom * 2 ** wheelStep(event)));
    const box = element.getBoundingClientRect(), x = event.clientX - box.left, y = event.clientY - box.top;
    // The point under the pointer stays where it is. 游標下的那一點不動。
    target = { zoom, x: x - (x - base.x) * zoom / base.zoom, y: y - (y - base.y) * zoom / base.zoom };
    until = now + DAMPING_MS;
    void flow.setViewport(target, { duration: DAMPING_MS, ease: easeOut, interpolate: 'linear' });
  };
  element.addEventListener('wheel', wheel, { passive: false });
  return { interrupt: () => { target = null; }, detach: () => element.removeEventListener('wheel', wheel) };
}
