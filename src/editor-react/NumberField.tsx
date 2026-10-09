import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { ladderLayout, ladderPosition, ladderReadoutPosition, moveLadder, type LadderMotion } from './valueLadder';
import { fillFraction, moveScrub, presetValues, startScrub, type Scrub } from './valueScrub';
import { DropdownMenu } from './DropdownMenu';
import { tr, say } from './text';

type Ladder = LadderMotion & {
  initialDraft: string;
  readout: { left: number; top: number };
  pointer?: { id: number; button: number; mask: number };
};

// Draft/gesture state stays in this React control. Only release commits to the graph.
// 草稿與手勢由此 React 控制項持有；放開才提交圖，因此一個手勢只有一次 Undo。
// `preview`: called while the ladder or a drag moves and with the old value when it is cancelled (Uniform C).
// preview：梯尺或拖曳中呼叫；取消時以原值呼叫。
// The slider behaviour (Refactor.55, legacy inspector.js:139-300; value-input.md): the fill shows the value; a left
// drag changes it; a click without dragging starts typing, a double click selects all; holding still opens the value
// ladder; the right button lists common values and the default. 數值框的 slider 行為（照舊產品）：填色表示值；左鍵拖改值；
// 點一下沒拖就開始打字、雙擊全選；按住不動打開數值梯尺；右鍵列出常用值與預設值。
export function NumberField({ value, label, integer = false, unsigned = false, commit, preview, defaultValue }: {
  value: number; label: string; integer?: boolean; unsigned?: boolean;
  commit: (value: number) => void; preview?: (value: number) => void;
  /** The value's default, offered on the right-click list when it has one. 這個值的預設值；有才列在右鍵選單。 */
  defaultValue?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  const [ladder, setLadder] = useState<Ladder | null>(null);
  const gesture = useRef<Ladder | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const tooltipId = useId();
  const suppressContext = useRef(0);
  const skipBlur = useRef(false);
  const typing = useRef(false);
  const [error, setError] = useState('');
  // A left press waiting to become a drag, a click or a hold; then the drag itself. 左鍵按下後等著變成拖曳、點擊或按住；接著是拖曳本身。
  const press = useRef<{ x: number; y: number; id: number; timer: number; canScrub: boolean } | null>(null);
  const scrub = useRef<(Scrub & { id: number; from: number; stop: AbortController }) | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const lastClick = useRef<{ time: number; x: number; y: number } | null>(null);
  const [presets, setPresets] = useState(false);
  const active = ladder !== null;
  const normalize = (number: number) => unsigned ? Math.max(0, Math.trunc(number)) :
    integer ? Math.trunc(number) : number;

  // While the person drags or types here, values from outside (e.g. TD's live values, Uniform D2) wait
  // until they finish; they never cancel the gesture. 有人正在拖或輸入時，外面來的值（例如 TD 的即時值）等手勢結束，不會打斷它。
  useEffect(() => {
    if (gesture.current || typing.current || scrub.current) return;
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
    let shown = state.value;
    const paint = () => {
      setDraft(String(state.value));
      setLadder({ ...state });
      if (state.value !== shown) { shown = state.value; preview?.(state.value); }
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
      else if (!accept && shown !== value) preview?.(value); // cancelled: TD goes back 取消：TD 回到原值
    };
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
    };
  }, [active]);

  function pointerDown(event: PointerEvent<HTMLInputElement>) {
    if (event.button === 1 || (event.button === 2 && event.altKey)) {
      event.preventDefault(); event.stopPropagation();
      begin(event.clientX, event.clientY, { id: event.pointerId, button: event.button,
        mask: event.button === 1 ? 4 : 2 });
      if (gesture.current) event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    // While typing, the press is the browser's (caret, selection). 打字中的按下交給瀏覽器（游標、選取）。
    if (event.button !== 0 || event.metaKey || event.altKey || document.activeElement === input.current) return;
    event.preventDefault(); event.stopPropagation();
    const canScrub = !!draft.trim() && Number.isFinite(Number(draft)), target = event.currentTarget;
    const { clientX: x, clientY: y, pointerId: id } = event;
    target.setPointerCapture(id);
    press.current = { x, y, id, canScrub, timer: window.setTimeout(() => {
      // Held still: the value ladder, steered with the same button. 按住不動：數值梯尺，用同一個鍵操作。
      press.current = null;
      if (canScrub) { begin(x, y, { id, button: 0, mask: 1 }); if (gesture.current) target.setPointerCapture(id); }
    }, 450) };
  }

  function endScrub(accept: boolean) {
    const state = scrub.current; if (!state) return;
    scrub.current = null; state.stop.abort(); setScrubbing(false);
    if (input.current?.hasPointerCapture(state.id)) input.current.releasePointerCapture(state.id);
    setDraft(String(accept ? state.value : state.from));
    if (accept && state.value !== value) commit(state.value);
    else if (!accept && state.value !== value) preview?.(value); // cancelled: TD goes back 取消：TD 回到原值
  }

  function pointerMove(event: PointerEvent<HTMLInputElement>) {
    const state = scrub.current;
    if (state && event.pointerId === state.id) {
      if (!(event.buttons & 1)) { endScrub(false); return; }
      const before = state.value, next = moveScrub(state, event.clientX, { ctrl: event.ctrlKey, shift: event.shiftKey });
      if (next !== before) { setDraft(String(next)); preview?.(next); }
      return;
    }
    const held = press.current; if (!held || event.pointerId !== held.id) return;
    const dx = event.clientX - held.x, dy = event.clientY - held.y;
    if (held.canScrub && Math.abs(dx) > 4 && Math.abs(dx) >= Math.abs(dy)) {
      // A sideways move: drag the value (legacy: more than 4 pixels, more across than up or down).
      // 往旁邊移：拖曳改值（照舊產品：超過 4px、橫向多於縱向）。
      clearTimeout(held.timer); press.current = null;
      const from = normalize(Number(draft)), stop = new AbortController();
      scrub.current = { ...startScrub(from, held.x, event.currentTarget.getBoundingClientRect().width, integer,
        unsigned ? { min: 0 } : {}), id: held.id, from, stop };
      window.addEventListener('keydown', key => { if (key.key === 'Escape') { key.preventDefault(); key.stopImmediatePropagation(); endScrub(false); } },
        { capture: true, signal: stop.signal });
      window.addEventListener('blur', () => endScrub(false), { signal: stop.signal });
      setScrubbing(true);
      pointerMove(event);
    } else if (Math.hypot(dx, dy) > 8) { clearTimeout(held.timer); press.current = null; }
  }

  function pointerUp(event: PointerEvent<HTMLInputElement>) {
    if (scrub.current && event.pointerId === scrub.current.id) { endScrub(true); return; }
    const held = press.current; if (!held || event.pointerId !== held.id) return;
    clearTimeout(held.timer); press.current = null;
    // A click without dragging starts typing; a second one soon after selects all (legacy).
    // 點一下沒拖就開始打字；很快再點一下就全選（照舊產品）。
    const now = performance.now(), last = lastClick.current;
    const double = !!last && now - last.time < 500 && Math.hypot(held.x - last.x, held.y - last.y) < 5;
    lastClick.current = { time: now, x: held.x, y: held.y };
    input.current?.focus({ preventScroll: true });
    if (double) input.current?.select();
  }

  useEffect(() => () => { if (press.current) clearTimeout(press.current.timer); scrub.current?.stop.abort(); }, []);
  const choices = presetValues(integer, unsigned ? 0 : undefined, defaultValue);

  return <>
    <input ref={input} className={'number nodrag nowheel nopan' + (scrubbing ? ' scrubbing' : '')} aria-label={label} aria-invalid={!!error}
      style={{ '--fill': `${(fillFraction(Number(draft)) * 100).toFixed(4)}%` } as CSSProperties}
      aria-describedby={active ? tooltipId : undefined}
      title={error || (active ? undefined : say(tr('number.help', 'Drag sideways to change (Shift finer, Ctrl coarser). Click to type. Right button: common values. Middle button, Alt+right button or holding still: the value ladder — move up and down to pick a step, then past its left or right edge to change the value. Release to apply, Esc to cancel. Keyboard: Alt+L, arrow keys, Enter.')))}
      inputMode="decimal"
      value={draft} onChange={event => { typing.current = true; setDraft(event.target.value); }}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
      onPointerCancel={() => { if (press.current) { clearTimeout(press.current.timer); press.current = null; } endScrub(false); }}
      onMouseDown={event => { if (event.button === 1) event.preventDefault(); }}
      onAuxClick={event => event.preventDefault()}
      onContextMenu={event => {
        event.preventDefault();
        if (event.altKey || gesture.current || performance.now() < suppressContext.current) return;
        if (choices.length) setPresets(true);
      }}
      onBlur={() => {
        if (active || gesture.current) return;
        typing.current = false;
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
          typing.current = false; skipBlur.current = true; setError(''); setDraft(String(value)); event.currentTarget.blur();
        }
      }} />
    {presets && input.current && <DropdownMenu anchor={input.current} label={say(tr('number.presets', 'Common values'))} onClose={() => setPresets(false)}
      items={choices.map(choice => ({ key: String(choice.value), checked: Number(draft) === choice.value,
        label: choice.isDefault ? say(tr('number.presetDefault', '{value} (default)', { value: String(choice.value) })) : String(choice.value),
        select: () => { const next = normalize(choice.value); setDraft(String(next)); if (next !== value) commit(next); } }))} />}
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
