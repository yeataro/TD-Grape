import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { core, type Value } from './core';
import type { ComponentState } from './host';
import { NumberField } from './NumberField';
import { useValueLadder } from './useValueLadder';
import { Select } from './controls';
import { Icon } from './icons';
import { DropdownMenu } from './DropdownMenu';
import { presetValues } from './valueScrub';
import { tr, say } from './text';

// The value widget, the one every value input uses (node inputs, values in a node's body, the Sources panel; human
// 2026-10-09). One row (the IO row) whether wired or not; a vector's fields side by side with the component names
// inside the boxes; a triangle shows one component per row, the only thing that changes the height (value-input.md).
// Its colours come from outside: it reads --field-bg, --field-fill, --field-text and --field-label, which a theme gives
// and any container may set (human 2026-10-09: a few colour sets defined from outside).
// 數值 widget，所有數值輸入共用（節點輸入、節點本體裡的值、共用來源面板）。不論有沒有接線都一行；向量各分量並排、
// 分量名稱寫在框內；三角形展開成一個分量一行，只有它會改變高度。顏色由外部給：只讀 --field-* 變數，主題給預設、容器可以換。
const booleans = [{ value: 'false', label: 'false' }, { value: 'true', label: 'true' }];

// Native input previews are local; native change commits the chosen colour.
// React 的 onChange 也會接到連續 input；改以原生 change 作提交，避免每次預覽一筆 Undo。
// While picking, the shown value may follow TD (it already got the previews, Uniform D2), so the pick
// is compared with the value it started from, and outside values wait until it ends.
// 選取中顯示的值可能跟著 TD 變（TD 已收到預覽），所以和選取開始時的值比較；外面來的值等選完再跟上。
function ColorField({ value, label, commit, preview }: { value: string; label: string; commit: (value: string) => void; preview?: (value: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);
  const started = useRef<string | null>(null);
  const latest = useRef({ value, commit });
  latest.current = { value, commit };
  useEffect(() => { if (started.current === null) setDraft(value); }, [value]);
  useEffect(() => {
    const element = input.current!;
    const accept = () => {
      const from = started.current ?? latest.current.value;
      started.current = null;
      if (element.value !== from) latest.current.commit(element.value);
      else setDraft(latest.current.value);
    };
    element.addEventListener('change', accept);
    return () => element.removeEventListener('change', accept);
  }, []);
  return <input ref={input} className="color-swatch nodrag" type="color" aria-label={label}
    value={draft} onInput={event => {
      if (started.current === null) started.current = value;
      setDraft(event.currentTarget.value); preview?.(event.currentTarget.value);
    }} onChange={() => {}} />;
}

// A component something else drives in TD (Uniform D1, Q60; TD's mode colours, as the legacy node did):
// only its state is shown, never edited here. 在 TD 被別的東西驅動的分量：只顯示狀態，這裡不能改。
function DrivenField({ state }: { state: ComponentState }) {
  const text = state.mode === 'expression' ? say(tr('uniform.expression', 'Expression: {text}', { text: state.text ?? '' }))
    : state.text ?? state.mode;
  const title = state.mode === 'export' ? say(tr('uniform.exportFrom', 'Driven by an Export from {origin}', { origin: state.source ?? '' })) : text;
  return <code className={`td-driven td-${state.mode}`} title={title}>{text}</code>;
}

// The leading text of a value (value-input.md 5): middle button (or Alt+right) on it opens the value ladder for the
// whole value, adding the same amount to every component (TouchDesigner; legacy VALUE_LADDER.md: integers stop as a
// group at their limit). An input's caption is its name and type; a value without a port shows "Color" or its type
// (tentative, value-input.md 四). 值的開頭文字：在上面按中鍵（或 Alt＋右鍵）打開整組的數值梯尺，每個分量加上同一個量
// （照 TouchDesigner；舊產品整列調值：整數碰到界限整組停）。輸入的開頭文字是名字與型別；沒有接孔的值顯示 Color 或型別（暫定）。
/** The colour of a value's first three components (0–1), as the browser's colour input writes it: what a swatch or
 * a plain default image shows. 數值前三個分量（0–1）的顏色，寫成瀏覽器顏色輸入的格式：色塊、純色預設圖用。 */
export const colorHex = (list: readonly unknown[]) =>
  '#' + list.slice(0, 3).map(item => Math.round(Math.max(0, Math.min(1, Number(item))) * 255).toString(16).padStart(2, '0')).join('');

export function ValueFields({ value, type, label, names = 'XYZW', color = false, commit, preview, modes, wired = false, defaults, caption }: {
  value: Value; type: string; label: string; names?: string; color?: boolean; commit: (value: Value) => void;
  /** While dragging or picking, before the value is committed (Uniform C). 拖曳或點選中、提交之前。 */
  preview?: (value: Value) => void;
  /** Each component's state in TD (Uniform D1); left out means a plain value. 各分量在 TD 的狀態；沒給＝一般數值。 */
  modes?: readonly (ComponentState | undefined)[];
  /** A wire gives this value: it keeps its place but is not shown (wiring never changes the height). 接線提供這個值：位置留著、不顯示。 */
  wired?: boolean;
  /** The value's default, per component (offered on the right-click list). 預設值（逐分量，列在右鍵選單）。 */
  defaults?: Value;
  /** The leading text; left out, "Color" or the type. 開頭文字；沒給就是 Color 或型別。 */
  caption?: ReactNode;
}) {
  const count = core.values.count(type), family = core.values.family(type);
  // Shown expanded on this page only, not saved (value-input.md 四: whether to keep it in the graph is open).
  // 展開只在這一頁、不存檔（要不要存進圖待人類決定）。
  const [expanded, setExpanded] = useState(false);
  // A component TD reports a value for shows TD's (Q57: TD is the authority; a bound one shows the value
  // it is bound to); otherwise the graph's. TD 有回報值的分量顯示 TD 的（Bind 顯示綁到的值），否則顯示圖裡的。
  const list = Array.from({ length: count }, (_, i) => modes?.[i]?.value !== undefined ? modes[i]!.value!
    : Array.isArray(value) ? value[i] ?? 0 : value);
  const hex = colorHex(list);
  const fromHex = (next: string): Value => [...([1, 3, 5].map(i => parseInt(next.slice(i, i + 2), 16) / 255)), ...list.slice(3)];
  // A component is edited here unless TD drives it (Uniform D1). 分量除非由 TD 驅動，否則在這裡編輯。
  const editable = (i: number) => { const mode = modes?.[i];
    return !mode || (mode.mode !== 'expression' && mode.mode !== 'export' && mode.mode !== 'other' && !(mode.mode === 'bind' && mode.editable === false)); };
  const integer = family === 'int' || family === 'uint';
  const groupable = !wired && family !== 'bool' && list.every((_, i) => editable(i));
  // The amount added to every component while the whole-value ladder moves; shown in the fields, committed once.
  // 整組梯尺移動中每個分量加上的量；顯示在各格，放開時提交一次。
  const [shift, setShift] = useState(0);
  const lowest = Math.min(...list.map(Number));
  const shifted = (amount: number): Value => count === 1 ? Number((Number(list[0]) + amount).toPrecision(15))
    : list.map(item => Number((Number(item) + amount).toPrecision(15)));
  const head = useRef<HTMLSpanElement>(null);
  const group = useValueLadder({ anchor: head, integer,
    normalize: amount => { const step = integer ? Math.trunc(amount) : amount; return family === 'uint' ? Math.max(step, -lowest) : step; },
    show: amount => setShift(group.gesture.current ? amount : 0),
    preview: preview && (amount => preview(shifted(amount))), commit: amount => commit(shifted(amount)),
    format: amount => (amount >= 0 ? '+' : '') + amount });
  // A colour value is a two-row widget: its swatch is a row of its own, the whole width and not indented; expanded, it is
  // the last row of the component column, as wide as the sliders (human 2026-10-09).
  // 顏色值是佔兩行的 widget：色塊自己一行、佔整塊寬度、左邊不縮進來；展開時是分量那一欄的最後一行，和 slider 一樣寬（人類）。
  const swatch = color && count >= 3 && <div className={'value-swatch nodrag nopan' + (wired ? ' wired' : '')} inert={wired || undefined}>
    <ColorField label={`${label} color`} value={hex}
      commit={next => commit(fromHex(next))} preview={preview && (next => preview(fromHex(next)))} /></div>;
  // Right button on the leading text: the same common-values menu as one box, setting every component (human 2026-10-09).
  // The default sets each component to its own default; merged into a common value when all of them share it.
  // 在開頭文字按右鍵：和單格一樣的常用值選單，設定整組（人類）。預設值是每個分量各回自己的預設；全部相同且是常用值時併入那一項。
  const [presets, setPresets] = useState(false);
  const own = defaults === undefined ? undefined : list.map((_, i) => Number(Array.isArray(defaults) ? defaults[i] : defaults));
  const shared = own && own.every(item => item === own[0]) ? own[0] : undefined;
  const choices: { key: string; label: string; value: Value; checked: boolean }[] = presetValues(integer, family === 'uint' ? 0 : undefined, shared)
    .map(choice => ({ key: String(choice.value), value: count === 1 ? choice.value : list.map(() => choice.value),
      checked: list.every(item => Number(item) === choice.value),
      label: choice.isDefault ? say(tr('number.presetDefault', '{value} (default)', { value: String(choice.value) })) : String(choice.value) }));
  if (own && shared === undefined) choices.unshift({ key: 'default', value: own, checked: list.every((item, i) => Number(item) === own[i]),
    label: say(tr('number.presetDefault', '{value} (default)', { value: `(${own.join(', ')})` })) });
  const leading = <span ref={head} className="value-caption nodrag nopan"
      title={groupable ? say(tr('value.groupHelp', 'Middle button or Alt+right button: change every component by the same amount with the value ladder. Right button: set every component to a common value or the default.')) : undefined}
      onPointerDown={event => {
        if (!groupable || !(event.button === 1 || (event.button === 2 && event.altKey))) return;
        event.preventDefault(); event.stopPropagation();
        group.begin(event.clientX, event.clientY, 0, { id: event.pointerId, button: event.button, mask: event.button === 1 ? 4 : 2 });
        if (group.gesture.current) event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onMouseDown={event => { if (event.button === 1) event.preventDefault(); }}
      onContextMenu={event => {
        event.preventDefault();
        if (!groupable || event.altKey || group.gesture.current || performance.now() < group.suppressContext.current) return;
        setPresets(true);
      }}>
      {caption ?? (color ? say(tr('value.color', 'Color')) : type)}</span>;
  return <div className="value-row">
    {leading}
    <div className={'value-group nodrag nopan' + (expanded ? ' expanded' : '') + (wired ? ' wired' : '')} inert={wired || undefined}>
    {count > 1 && <button type="button" className="value-expand" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}
      aria-label={say(tr('value.expand', 'Show each component on its own row'))} title={say(tr('value.expand', 'Show each component on its own row'))}>
      <Icon name="chevronDown" /></button>}
    <div className="value-fields" style={{ '--components': count } as CSSProperties}>
      {list.map((item, i) => {
        const withComponent = (next: Value) => { const values = [...list]; values[i] = next; return count === 1 ? next : values; };
        const change = (next: Value) => commit(withComponent(next));
        const mode = modes?.[i], bound = mode?.mode === 'bind';
        return <label key={i} className={'value-field' + (bound ? ' td-bind' : '')} title={bound ? mode.text : undefined}>
          {count > 1 && <span className="component" style={color ? { color: `var(--component-${'xyzw'[i]})` } : undefined}>{names[i]}</span>}
          {mode && (mode.mode === 'expression' || mode.mode === 'export' || mode.mode === 'other') ? <DrivenField state={mode} />
            : bound && mode.editable === false ? <code className="td-driven td-bind">{String(mode.value ?? '')}</code>
            : family === 'bool' ? <Select className="nodrag" label={`${label} ${i}`} value={String(!!item)} options={booleans}
            onChange={next => change(next === 'true')} /> :
            <NumberField label={`${label} ${i}`} value={Number(item) + shift} integer={integer} unsigned={family === 'uint'} commit={change}
              defaultValue={defaults === undefined ? undefined : Number(Array.isArray(defaults) ? defaults[i] : defaults)}
              preview={preview && (next => preview(withComponent(next)))} />}
        </label>;
      })}
      {expanded && swatch}
    </div>
    </div>
    {!expanded && swatch}
    {presets && head.current && <DropdownMenu anchor={head.current} label={say(tr('number.presets', 'Common values'))} onClose={() => setPresets(false)}
      items={choices.map(choice => ({ key: choice.key, label: choice.label, checked: choice.checked, select: () => commit(choice.value) }))} />}
    {group.view}
  </div>;
}
