import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { fillFraction, moveScrub, presetValues, startScrub, type Scrub } from './valueScrub';
import { useValueLadder, type LadderPointer } from './useValueLadder';
import { DropdownMenu } from './DropdownMenu';
import { tr, say } from './text';

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
  const input = useRef<HTMLInputElement>(null);
  const skipBlur = useRef(false);
  const typing = useRef(false);
  const [error, setError] = useState('');
  // A left press waiting to become a drag, a click or a hold; then the drag itself. 左鍵按下後等著變成拖曳、點擊或按住；接著是拖曳本身。
  const press = useRef<{ x: number; y: number; id: number; timer: number; canScrub: boolean } | null>(null);
  const scrub = useRef<(Scrub & { id: number; from: number; stop: AbortController }) | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const lastClick = useRef<{ time: number; x: number; y: number } | null>(null);
  const [presets, setPresets] = useState(false);
  const normalize = (number: number) => unsigned ? Math.max(0, Math.trunc(number)) :
    integer ? Math.trunc(number) : number;
  const ladder = useValueLadder({ anchor: input, integer, normalize, show: next => setDraft(String(next)), preview, commit });

  // While the person drags or types here, values from outside (e.g. TD's live values, Uniform D2) wait
  // until they finish; they never cancel the gesture. 有人正在拖或輸入時，外面來的值（例如 TD 的即時值）等手勢結束，不會打斷它。
  useEffect(() => {
    if (ladder.gesture.current || typing.current || scrub.current) return;
    setDraft(String(value));
  }, [value, integer, unsigned]);

  function openLadder(x: number, y: number, pointer?: LadderPointer) {
    if (!draft.trim() || !Number.isFinite(Number(draft))) return;
    input.current?.focus({ preventScroll: true });
    ladder.begin(x, y, Number(draft), pointer);
  }

  function pointerDown(event: PointerEvent<HTMLInputElement>) {
    if (event.button === 1 || (event.button === 2 && event.altKey)) {
      event.preventDefault(); event.stopPropagation();
      openLadder(event.clientX, event.clientY, { id: event.pointerId, button: event.button, mask: event.button === 1 ? 4 : 2 });
      if (ladder.gesture.current) event.currentTarget.setPointerCapture(event.pointerId);
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
      if (canScrub) { openLadder(x, y, { id, button: 0, mask: 1 }); if (ladder.gesture.current) target.setPointerCapture(id); }
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
      aria-describedby={ladder.active ? ladder.id : undefined}
      title={error || (ladder.active ? undefined : say(tr('number.help', 'Drag sideways to change (Shift finer, Ctrl coarser). Click to type. Right button: common values. Middle button, Alt+right button or holding still: the value ladder — move up and down to pick a step, then past its left or right edge to change the value. Release to apply, Esc to cancel. Keyboard: Alt+L, arrow keys, Enter.')))}
      inputMode="decimal"
      value={draft} onChange={event => { typing.current = true; setDraft(event.target.value); }}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
      onPointerCancel={() => { if (press.current) { clearTimeout(press.current.timer); press.current = null; } endScrub(false); }}
      onMouseDown={event => { if (event.button === 1) event.preventDefault(); }}
      onAuxClick={event => event.preventDefault()}
      onContextMenu={event => {
        event.preventDefault();
        if (event.altKey || ladder.gesture.current || performance.now() < ladder.suppressContext.current) return;
        if (choices.length) setPresets(true);
      }}
      onBlur={() => {
        if (ladder.gesture.current) return;
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
          openLadder(rect.right, rect.top + rect.height / 2);
        } else if (event.key === 'Enter') event.currentTarget.blur();
        else if (event.key === 'Escape') {
          typing.current = false; skipBlur.current = true; setError(''); setDraft(String(value)); event.currentTarget.blur();
        }
      }} />
    {presets && input.current && <DropdownMenu anchor={input.current} label={say(tr('number.presets', 'Common values'))} onClose={() => setPresets(false)}
      items={choices.map(choice => ({ key: String(choice.value), checked: Number(draft) === choice.value,
        label: choice.isDefault ? say(tr('number.presetDefault', '{value} (default)', { value: String(choice.value) })) : String(choice.value),
        select: () => { const next = normalize(choice.value); setDraft(String(next)); if (next !== value) commit(next); } }))} />}
    {ladder.view}
  </>;
}
