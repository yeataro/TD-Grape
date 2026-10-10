// A panel opened from a bar stays put against that bar (Refactor.75.1, human 2026-10-11: switching the density made the foot
// bar taller or shorter and the panel stayed where it was): it is placed at once, and again whenever its bar or the window
// changes size. Kept apart from React so it can be tested (audit since R.67, human 2026-10-11).
// 從列上打開的面板貼著那一列（R.75.1，人類：切換密度時底列變高變矮，面板卻留在原地）：馬上放一次，所在的列或視窗大小一變
// 就重新放。和 React 分開，才能測試。

/** Watches one element's size; returns how to stop. 監看一個元素的大小；回傳停止的方法。 */
export type Watch = (target: Element, changed: () => void) => () => void;
const watchSize: Watch = (target, changed) => { const observer = new ResizeObserver(changed); observer.observe(target); return () => observer.disconnect(); };
type Window = Pick<typeof globalThis, 'addEventListener' | 'removeEventListener'>;
/** The bar an element sits in (title, location or foot bar), if any. 元素所在的列（標題列、網址列、底列），沒有就是 null。 */
export const barOf = (element: Element) => element.closest('.title-bar, .location-bar, .foot-bar');
/** A panel or menu opened from a bar fades in (Refactor.75.21) and is glass (R.75.24, human 2026-10-11: every one opened from a
 * bar, none inside a pane). 從列上打開的面板或選單：淡入（R.75.21）、玻璃（R.75.24，人類：列上打開的全部，窗格裡的都不要）。 */
export const fromBar = (anchor: Element) => barOf(anchor) ? ' fade-in glass' : '';

/** Places now and whenever the anchor's bar (or the anchor, when it is in none) or the window changes size; returns how to
 * stop. 現在放一次，之後所在的列（不在列裡就是它自己）或視窗大小一變就再放；回傳停止的方法。 */
export function followBar(anchor: Element, place: () => void, watch: Watch = watchSize, win: Window = globalThis) {
  place();
  const stop = watch(barOf(anchor) ?? anchor, place);
  win.addEventListener('resize', place);
  return () => { stop(); win.removeEventListener('resize', place); };
}
