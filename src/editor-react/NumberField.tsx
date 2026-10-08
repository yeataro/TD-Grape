import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { ladderLayout, ladderPosition, ladderReadoutPosition, moveLadder, type LadderMotion } from './valueLadder';
import { tr, say } from './text';

type Ladder = LadderMotion & {
  initialDraft: string;
  readout: { left: number; top: number };
  pointer?: { id: number; button: number; mask: number };
};

// Draft/gesture state stays in this React control. Only release commits to the graph.
// 草稿與手勢由此 React 控制項持有；放開才提交圖，因此一個手勢只有一次 Undo。
export function NumberField({ value, label, integer = false, unsigned = false, commit }: {
  value: number; label: string; integer?: boolean; unsigned?: boolean;
  commit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [ladder, setLadder] = useState<Ladder | null>(null);
  const gesture = useRef<Ladder | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const tooltipId = useId();
  const suppressContext = useRef(0);
  const cancelGesture = useRef<() => void>(() => {});
  const skipBlur = useRef(false);
  const [error, setError] = useState('');
  const active = ladder !== null;
  const normalize = (number: number) => unsigned ? Math.max(0, Math.trunc(number)) :
    integer ? Math.trunc(number) : number;

  useEffect(() => {
    cancelGesture.current();
    setDraft(String(value));
  }, [value, integer, unsigned]);

  function begin(x: number, y: number, pointer?: Ladder['pointer']) {
    const number = Number(draft);
    if (!draft.trim() || !Number.isFinite(number) || gesture.current) return;
    input.current?.focus({ preventScroll: true });
    const steps = integer ? [100, 10, 1] : [10, 1, 0.1, 0.01, 0.001];
    const state: Ladder = {
      ...ladderPosition(x, y, steps.length, 2, innerWidth, innerHeight),
      readout: ladderReadoutPosition(input.current?.getBoundingClientRect() ??
        { left: x, top: y, bottom: y }, innerWidth, innerHeight),
      index: 2, steps, value: normalize(number), initialDraft: draft, pointer,
    };
    gesture.current = state;
    setDraft(String(state.value));
    setLadder({ ...state });
  }

  // Listeners exist only while the ladder is active, and are removed on teardown.
  // 只有梯尺開啟期間訂閱事件；取消、卸載或失焦即釋放，不做常駐輪詢。
  useEffect(() => {
    const state = gesture.current;
    if (!active || !state) return;
    const controller = new AbortController();
    const options = { capture: true, signal: controller.signal };
    const paint = () => {
      setDraft(String(state.value));
      setLadder({ ...state });
    };
    const finish = (accept: boolean) => {
      if (gesture.current !== state) return;
      gesture.current = null;
      controller.abort();
      setLadder(null);
      setDraft(accept ? String(state.value) : state.initialDraft);
      suppressContext.current = performance.now() + 400;
      if (state.pointer && input.current?.hasPointerCapture(state.pointer.id)) {
        input.current.releasePointerCapture(state.pointer.id);
      }
      if (accept && state.value !== value) commit(state.value);
    };
    cancelGesture.current = () => finish(false);
    const move = (event: globalThis.PointerEvent) => {
      if (!state.pointer || event.pointerId !== state.pointer.id) return;
      if (!(event.buttons & state.pointer.mask)) { finish(false); return; }
      event.preventDefault(); event.stopPropagation();
      const previousValue = state.value;
      const previousIndex = state.index;
      const wasOutside = !!state.drag;
      moveLadder(state, event.clientX, event.clientY, normalize);
      if (state.value !== previousValue || state.index !== previousIndex || wasOutside !== !!state.drag) paint();
    };
    const key = (event: KeyboardEvent) => {
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.key === 'Escape' || event.key === 'Tab') { finish(false); return; }
      if (event.key === 'Enter' && !state.pointer) { finish(true); return; }
      if (state.pointer) return;
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        state.index = Math.max(0, Math.min(state.steps.length - 1,
          state.index + (event.key === 'ArrowUp' ? -1 : 1)));
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const candidate = state.value + state.steps[state.index] * (event.key === 'ArrowRight' ? 1 : -1);
        if (Number.isFinite(candidate)) state.value = normalize(Number(candidate.toPrecision(15)));
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
    input.current?.addEventListener('blur', () => finish(false), options);
    input.current?.addEventListener('lostpointercapture', () => finish(false), options);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) finish(false);
    }, options);
    return () => {
      controller.abort();
      gesture.current = null;
      cancelGesture.current = () => {};
    };
  }, [active]);

  function pointerDown(event: PointerEvent<HTMLInputElement>) {
    if (event.button !== 1 && !(event.button === 2 && event.altKey)) return;
    event.preventDefault(); event.stopPropagation();
    begin(event.clientX, event.clientY, { id: event.pointerId, button: event.button,
      mask: event.button === 1 ? 4 : 2 });
    if (gesture.current) event.currentTarget.setPointerCapture(event.pointerId);
  }

  return <>
    <input ref={input} className="number nodrag nowheel nopan" aria-label={label} aria-invalid={!!error}
      aria-describedby={active ? tooltipId : undefined}
      title={error || (active ? undefined : say(tr('number.ladderHelp', 'Middle button / Alt+right button: move up and down the list to pick a step, then past its left or right edge to change the value. Release to apply, Esc to cancel. Keyboard: Alt+L, arrow keys, Enter.')))}
      inputMode="decimal"
      value={draft} onChange={event => setDraft(event.target.value)}
      onPointerDown={pointerDown}
      onMouseDown={event => { if (event.button === 1) event.preventDefault(); }}
      onAuxClick={event => event.preventDefault()}
      onContextMenu={event => {
        if (event.altKey || gesture.current || performance.now() < suppressContext.current) event.preventDefault();
      }}
      onBlur={() => {
        if (active || gesture.current) return;
        if (skipBlur.current) { skipBlur.current = false; return; }
        const number = Number(draft);
        if (draft.trim() && Number.isFinite(number)) {
          const next = normalize(number);
          setError('');
          setDraft(String(next));
          if (next !== value) commit(next);
        } else { setError(say(tr('number.notFinite', 'Enter a finite number'))); setDraft(String(value)); }
      }}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.altKey && event.key.toLowerCase() === 'l') {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          begin(rect.right, rect.top + rect.height / 2);
        } else if (event.key === 'Enter') event.currentTarget.blur();
        else if (event.key === 'Escape') {
          skipBlur.current = true; setError(''); setDraft(String(value)); event.currentTarget.blur();
        }
      }} />
    {ladder && createPortal(<div id={tooltipId} role="tooltip" aria-label="Value Ladder"
      className="value-ladder"
      // Replace the initial list with a readout, without changing its selection bounds.
      // 水平調值時換成不遮住輸入框的讀數；原列表的選擇區域保持不變。
      style={{ ...(ladder.drag ? ladder.readout : { left: ladder.left, top: ladder.top }),
        width: ladder.drag ? ladderLayout.readoutWidth : ladderLayout.width,
        padding: ladderLayout.inset - 1 }}>
      {ladder.drag ? <div className="ladder-readout">
        <output>{draft}</output><span>Δ {ladder.steps[ladder.index]}</span>
      </div> : <div className="ladder-steps">
        {ladder.steps.map((step, index) => <div key={step}
          style={{ height: ladderLayout.rowHeight, lineHeight: `${ladderLayout.rowHeight}px` }}
          className={index === ladder.index ? 'active' : ''}>{String(step).replace(/^0\./, '.')}</div>)}
      </div>}
    </div>, document.body)}
  </>;
}
