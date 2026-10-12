import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { say, useLanguage, type Message } from './text';

// The operation hint (GLOSSARY; Refactor.105.7, human 2026-10-13: shared now, and it must not take others' places): while something
// is going on, one short line saying how to finish it — placing a node first; wire hints later (legacy #connection, style.css:88, used
// it for wires, quick links and placing). One at a time, the latest. It sits in the canvas's bottom row, as tall as the controls there:
// centred, moved left when the controls at the right crowd it (over React Flow's credit if need be), narrowed with an ellipsis, and
// hidden when too little room is left. Never under the pointer.
// 操作提示（用語表；R.105.7，人類 10-13：確定會共用，而且不能佔到其他位置）：有事正在進行時，一行短句說怎麼完成——先給放置節點；之後
// 拉線的提示（舊產品 #connection 用在拉線、快速連線、放置）。一次一則，最新的。放在畫布下方那一排，和那裡的按鈕同高：置中，被右邊按鈕
// 擠到就往左讓（必要時蓋過 React Flow 的致謝），變窄時文字用「…」，空間太小就不顯示。不擋指標。

let shown: Message | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => shown;
const set = (next: Message | null) => { shown = next; listeners.forEach(listener => listener()); };

/** While something is going on, say how to finish it (null: nothing). The latest one shows; it goes when its user stops saying it.
 * 有事正在進行時，說怎麼完成（null：不說）。顯示最新的一則；說的人不說了就拿掉。 */
export function useOperationHint(message: Message | null) {
  const key = message ? message.code + JSON.stringify(message.params ?? {}) : '';
  useEffect(() => {
    if (!message) return;
    set(message);
    return () => { if (shown === message) set(null); };
  }, [key]); // the same words are the same hint 同樣的字就是同一則
}

/** How far it keeps from the canvas's sides and the controls; its widest; below this much room it is not shown.
 * 離畫布邊與按鈕多遠；最寬多少；空間少於這個就不顯示。 */
const GAP = 8, WIDEST = 480, NARROWEST = 120;

/** Drawn once, inside the canvas. 畫一次，在畫布裡。 */
export function OperationHint() {
  const message = useSyncExternalStore(subscribe, snapshot);
  const shownIn = useLanguage(); // the words, and so its width, follow the language 文字（所以寬度）跟著語言
  const pill = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; bottom: number; height: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const element = pill.current, canvas = element?.closest('.react-flow');
    if (!element || !canvas) return;
    const fit = () => {
      const box = canvas.getBoundingClientRect(), controls = canvas.querySelector('.react-flow__controls')?.getBoundingClientRect();
      const right = controls ? controls.left - box.left - GAP : box.width - GAP, room = right - GAP;
      if (room < NARROWEST) { setPlace(null); return; }
      // Its own width at most the room it has; centred on the canvas, moved left when the controls are in the way.
      // 寬度最多是它有的空間；在畫布置中，按鈕擋到時往左讓。
      element.style.maxWidth = Math.min(WIDEST, room) + 'px';
      const width = element.offsetWidth, left = Math.max(GAP, Math.min(box.width / 2 - width / 2, right - width));
      const height = controls?.height ?? 26, bottom = controls ? box.bottom - controls.bottom : GAP;
      setPlace(old => old && old.left === left && old.bottom === bottom && old.height === height && old.width === width ? old : { left, bottom, height, width });
    };
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(canvas); const controls = canvas.querySelector('.react-flow__controls'); if (controls) watch.observe(controls);
    return () => watch.disconnect();
  }, [message, shownIn]);
  if (!message) return null;
  return <div ref={pill} className="operation-hint" role="status" aria-live="polite"
    style={place ? { left: place.left, bottom: place.bottom, height: place.height } : { visibility: 'hidden' }}><span>{say(message)}</span></div>;
}
