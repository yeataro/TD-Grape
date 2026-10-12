import { motionOn } from './appearance';
import { glide } from './viewport';

// Scrolling a panel to a line (Refactor.102.2, human 2026-10-12): it glides when animation effects are on and jumps when they are
// off — the gear decides, not the browser. The browser's own smooth scrolling cannot be timed, so the glide is ours: the canvas's
// ease (slowing as it arrives), a little quicker than its framing. Used by the GLSL panel and the Graph JSON View.
// 把面板捲到某一行（R.102.2，人類 10-12）：動畫效果開著就滑過去，關著就直接跳——由齒輪決定，不是瀏覽器。瀏覽器自己的平滑捲動不能
// 指定時間，所以滑動是我們的：用畫布的曲線（越接近越慢），比畫布對準快一點。GLSL 面板與 Graph JSON View 在用。

/** How long a scroll glides. 捲動滑多久。 */
const SCROLL_MS = 250;
const gliding = new WeakMap<Element, number>();

/** The nearest box around the element that scrolls up and down. 元素外面最近一個可以上下捲的框。 */
function scroller(element: HTMLElement): HTMLElement | null {
  for (let box = element.parentElement; box; box = box.parentElement) {
    const overflow = getComputedStyle(box).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && box.scrollHeight > box.clientHeight) return box;
  }
  return null;
}

/** Bring an element to the middle of what scrolls it, up and down only; with `unlessSeen`, only when it is not already in view
 * (following a selection should not move what can be read). A new glide replaces one under way.
 * 把元素捲到捲動框的中間，只動上下；unlessSeen：已經看得到就不動（跟著選取時，不要移動正在讀的東西）。新的滑動取代還在進行的。 */
export function scrollToMiddle(element: HTMLElement, unlessSeen = false) {
  const box = scroller(element);
  if (!box) return;
  const area = box.getBoundingClientRect(), own = element.getBoundingClientRect();
  if (unlessSeen && own.top >= area.top && own.bottom <= area.bottom) return;
  const target = Math.max(0, Math.min(box.scrollHeight - box.clientHeight, box.scrollTop + own.top - area.top - (area.height - own.height) / 2));
  cancelAnimationFrame(gliding.get(box) ?? 0);
  if (!motionOn()) { box.scrollTop = target; return; }
  const from = box.scrollTop, start = performance.now();
  // A wheel or a press on the box stops the glide: the person scrolling takes over (deep clean 2026-10-12). 在框上滾滾輪或按下就停：
  // 人自己捲的優先（10-12 深度清潔）。
  const stop = () => { cancelAnimationFrame(gliding.get(box) ?? 0); gliding.delete(box); box.removeEventListener('wheel', stop); box.removeEventListener('pointerdown', stop); };
  box.addEventListener('wheel', stop, { passive: true }); box.addEventListener('pointerdown', stop);
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / SCROLL_MS);
    box.scrollTop = from + (target - from) * glide.ease(t);
    if (t < 1) gliding.set(box, requestAnimationFrame(step)); else stop();
  };
  gliding.set(box, requestAnimationFrame(step));
}
