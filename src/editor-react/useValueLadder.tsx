import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { ladderLayout, ladderPosition, ladderReadoutPosition, moveLadder, type LadderMotion } from './valueLadder';

export type LadderPointer = { id: number; button: number; mask: number };
type Ladder = LadderMotion & { from: number; readout: { left: number; top: number }; pointer?: LadderPointer };

// The value ladder as a gesture any control can start (docs/ui/VALUE_LADDER.md): one value box uses it on its value,
// a whole value on the amount added to every component (Refactor.55, value-input.md). It holds only the gesture;
// what is shown, previewed and committed belongs to the caller. One gesture commits once, so it is one Undo.
// Listeners exist only while it is open and are removed on teardown.
// 數值梯尺做成任何控制項都能開始的手勢：單格用在自己的值，整組用在「每個分量一起加上的量」。這裡只管手勢；
// 顯示、預覽、提交屬於呼叫的人。一個手勢只提交一次（一筆 Undo）。只有開啟期間訂閱事件。
export function useValueLadder(options: {
  /** The control it belongs to: the readout sits by it; losing it cancels. 屬於哪個控制項：讀數放旁邊；失去它就取消。 */
  anchor: RefObject<HTMLElement | null>;
  integer: boolean;
  normalize(value: number): number;
  /** What the control shows while the ladder moves, and at its end. 梯尺移動中與結束時控制項顯示的值。 */
  show(value: number): void;
  preview?(value: number): void;
  commit(value: number): void;
  /** How the readout writes the value. 讀數怎麼寫這個值。 */
  format?(value: number): string;
}) {
  const latest = useRef(options); latest.current = options;
  const [ladder, setLadder] = useState<Ladder | null>(null);
  const gesture = useRef<Ladder | null>(null);
  // The right button that steered it must not open a menu right after. 剛用右鍵操作完，不要緊接著跳出選單。
  const suppressContext = useRef(0);
  const id = useId();
  const active = ladder !== null;

  function begin(x: number, y: number, from: number, pointer?: LadderPointer) {
    if (gesture.current || !Number.isFinite(from)) return;
    const { anchor, integer, normalize, show } = latest.current;
    const steps = integer ? [100, 10, 1] : [10, 1, 0.1, 0.01, 0.001];
    const state: Ladder = {
      ...ladderPosition(x, y, steps.length, 2, innerWidth, innerHeight),
      readout: ladderReadoutPosition(anchor.current?.getBoundingClientRect() ?? { left: x, top: y, bottom: y }, innerWidth, innerHeight),
      index: 2, steps, value: normalize(from), from: normalize(from), pointer,
    };
    gesture.current = state;
    show(state.value);
    setLadder({ ...state });
  }

  useEffect(() => {
    const state = gesture.current;
    if (!active || !state) return;
    const controller = new AbortController();
    const options = { capture: true, signal: controller.signal };
    const anchor = latest.current.anchor.current;
    let shown = state.value;
    const paint = () => {
      latest.current.show(state.value);
      setLadder({ ...state });
      if (state.value !== shown) { shown = state.value; latest.current.preview?.(state.value); }
    };
    const finish = (accept: boolean) => {
      if (gesture.current !== state) return;
      gesture.current = null;
      controller.abort();
      setLadder(null);
      suppressContext.current = performance.now() + 400;
      if (state.pointer && anchor?.hasPointerCapture(state.pointer.id)) anchor.releasePointerCapture(state.pointer.id);
      const { show, commit, preview } = latest.current;
      show(accept ? state.value : state.from);
      if (accept && state.value !== state.from) commit(state.value);
      else if (!accept && shown !== state.from) preview?.(state.from); // cancelled: TD goes back 取消：TD 回到原值
    };
    const move = (event: globalThis.PointerEvent) => {
      if (!state.pointer || event.pointerId !== state.pointer.id) return;
      if (!(event.buttons & state.pointer.mask)) { finish(false); return; }
      event.preventDefault(); event.stopPropagation();
      const previousValue = state.value, previousIndex = state.index, wasOutside = !!state.drag;
      moveLadder(state, event.clientX, event.clientY, latest.current.normalize);
      if (state.value !== previousValue || state.index !== previousIndex || wasOutside !== !!state.drag) paint();
    };
    const key = (event: KeyboardEvent) => {
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.key === 'Escape' || event.key === 'Tab') { finish(false); return; }
      if (event.key === 'Enter' && !state.pointer) { finish(true); return; }
      if (state.pointer) return;
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        state.index = Math.max(0, Math.min(state.steps.length - 1, state.index + (event.key === 'ArrowUp' ? -1 : 1)));
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const candidate = state.value + state.steps[state.index]! * (event.key === 'ArrowRight' ? 1 : -1);
        if (Number.isFinite(candidate)) state.value = latest.current.normalize(Number(candidate.toPrecision(15)));
      }
      paint();
    };
    window.addEventListener('pointermove', move, options);
    window.addEventListener('pointerup', event => {
      if (event.pointerId === state.pointer?.id && event.button === state.pointer.button) {
        event.preventDefault(); event.stopPropagation(); finish(true);
      }
    }, options);
    window.addEventListener('pointercancel', () => finish(false), options);
    window.addEventListener('pointerdown', () => finish(false), options);
    window.addEventListener('keydown', key, options);
    window.addEventListener('blur', () => finish(false), { signal: controller.signal });
    window.addEventListener('resize', () => finish(false), options);
    window.addEventListener('wheel', () => finish(false), options);
    anchor?.addEventListener('blur', () => finish(false), options);
    anchor?.addEventListener('lostpointercapture', () => finish(false), options);
    document.addEventListener('visibilitychange', () => { if (document.hidden) finish(false); }, options);
    return () => { controller.abort(); gesture.current = null; };
  }, [active]);

  const view = ladder && createPortal(<div id={id} role="tooltip" aria-label="Value Ladder" className="value-ladder"
    // Replace the initial list with a readout, without changing its selection bounds.
    // 水平調值時換成不遮住控制項的讀數；原列表的選擇區域保持不變。
    style={{ ...(ladder.drag ? ladder.readout : { left: ladder.left, top: ladder.top }),
      width: ladder.drag ? ladderLayout.readoutWidth : ladderLayout.width, padding: ladderLayout.inset - 1 }}>
    {ladder.drag ? <div className="ladder-readout">
      <output>{latest.current.format?.(ladder.value) ?? String(ladder.value)}</output><span>Δ {ladder.steps[ladder.index]}</span>
    </div> : <div className="ladder-steps">
      {ladder.steps.map((step, index) => <div key={step} style={{ height: ladderLayout.rowHeight, lineHeight: `${ladderLayout.rowHeight}px` }}
        className={index === ladder.index ? 'active' : ''}>{String(step).replace(/^0\./, '.')}</div>)}
    </div>}
  </div>, document.body);

  return { active, id, begin, view, gesture, suppressContext };
}
