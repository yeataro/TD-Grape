import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { core, typeColor, type Value } from './core';
import type { ComponentState } from './host';
import { NumberField, holdMs } from './NumberField';
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
/** The colour of a colour's i-th channel letter (R, G, B, A), the same as in the value boxes. 顏色第 i 個通道字母的顏色，同數值框。 */
export const componentColor = (i: number) => `var(--component-${'xyzw'[i]})`;

/** The colour of a value's first three components (0–1), as the browser's colour input writes it: what a swatch or
 * a plain default image shows. 數值前三個分量（0–1）的顏色，寫成瀏覽器顏色輸入的格式：色塊、純色預設圖用。 */
export const colorHex = (list: readonly unknown[]) =>
  '#' + list.slice(0, 3).map(item => Math.round(Math.max(0, Math.min(1, Number(item))) * 255).toString(16).padStart(2, '0')).join('');

/** Values laid out in the Parameter panel's columns (Refactor.76.2, human 2026-10-11: as TD's parameter dialog, names flush
 * right and fields flush left, with the type between): the expand triangle at the far left (TD's +), the name, the type, the
 * fields side by side; expanded, the side-by-side fields stay and each component also gets a line of its own under them, its
 * letter as the name and its own type (float…), as TD and the legacy panel. Each line is a row of the container's grid. The same widget and gestures as on a card;
 * only the arrangement differs.
 * 參數面板的欄位排法（R.76.2，人類：照 TD 參數視窗，名稱靠右、欄位靠左，中間多一欄型別）：展開三角形在最左（TD 的 +）、名稱、型別、
 * 並排的欄位；展開時並排的欄位留著，每個分量另在下面自己一行，分量字母當名稱、型別寫分量自己的（float…，照 TD 與舊產品）。每一行是容器格線的一列。和卡片同一個
 * widget、同樣的手勢，只有排法不同。 */
export const ValueColumns = createContext(false);

export function ValueFields({ value, type, label, names = 'XYZW', color = false, commit, preview, modes, wired = false, defaults, caption, typeText }: {
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
  /** In columns, what the type column says; left out, the type. 欄位排法裡型別欄寫什麼；沒給就是型別。 */
  typeText?: ReactNode;
}) {
  const columns = useContext(ValueColumns);
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
  // The left button on the leading text (the name and the type), as on a value box (human 2026-10-11): a click opens or closes
  // the components, on a card as in the panel (TD; the left button did nothing there); holding still opens the whole-value
  // ladder; moving away does neither. 開頭文字（名稱與型別）上的左鍵，和數值框一樣（人類）：點一下展開／收起分量，卡片和面板都一樣
  // （照 TD；那裡左鍵本來沒有作用）；按住不動打開整組的梯尺；移開就都不做。
  const toggle = count > 1 ? () => setExpanded(open => !open) : undefined;
  const hold = useRef<{ x: number; y: number; id: number; timer: number } | null>(null);
  const letGo = () => { if (hold.current) { clearTimeout(hold.current.timer); hold.current = null; } };
  useEffect(() => letGo, []);
  const press = {
    onPointerDown: (event: ReactPointerEvent<HTMLSpanElement>) => {
      if (groupable && (event.button === 1 || (event.button === 2 && event.altKey))) {
        event.preventDefault(); event.stopPropagation();
        group.begin(event.clientX, event.clientY, 0, { id: event.pointerId, button: event.button, mask: event.button === 1 ? 4 : 2 });
        if (group.gesture.current) event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      if (event.button !== 0 || event.altKey || event.metaKey || (!toggle && !groupable)) return;
      event.preventDefault(); event.stopPropagation();
      const target = event.currentTarget, { clientX: x, clientY: y, pointerId: id } = event;
      target.setPointerCapture(id);
      hold.current = { x, y, id, timer: window.setTimeout(() => {
        hold.current = null;
        if (groupable) { group.begin(x, y, 0, { id, button: 0, mask: 1 }); if (group.gesture.current) target.setPointerCapture(id); }
      }, holdMs) };
    },
    onPointerMove: (event: ReactPointerEvent<HTMLSpanElement>) => {
      const held = hold.current;
      if (held && event.pointerId === held.id && Math.hypot(event.clientX - held.x, event.clientY - held.y) > 8) letGo();
    },
    onPointerUp: (event: ReactPointerEvent<HTMLSpanElement>) => {
      const held = hold.current; if (!held || event.pointerId !== held.id) return;
      letGo(); toggle?.();
    },
    onPointerCancel: letGo,
    onMouseDown: (event: ReactMouseEvent<HTMLSpanElement>) => { if (event.button === 1) event.preventDefault(); },
  };
  const leading = <span ref={head} className="value-caption nodrag nopan" data-toggle={toggle ? '' : undefined} {...press}
      title={groupable ? say(tr('value.groupHelp', 'Click: show or hide each component. Hold still, middle button or Alt+right button: change every component by the same amount with the value ladder. Right button: set every component to a common value or the default.')) : undefined}
      onContextMenu={event => {
        event.preventDefault();
        if (!groupable || event.altKey || group.gesture.current || performance.now() < group.suppressContext.current) return;
        setPresets(true);
      }}>
      {caption ?? (color ? say(tr('value.color', 'Color')) : type)}</span>;
  // One component's box; `letter`: its letter inside the box (side by side), or not (a line of its own names it).
  // 一個分量的框；letter：字母寫在框裡（並排時），或不寫（自己一行時由那一行的名稱寫）。
  const field = (item: unknown, i: number, letter: boolean) => {
    const withComponent = (next: Value) => { const values = [...list]; values[i] = next; return count === 1 ? next : values; };
    const change = (next: Value) => commit(withComponent(next));
    const mode = modes?.[i], bound = mode?.mode === 'bind';
    return <label key={i} className={'value-field' + (bound ? ' td-bind' : '')} title={bound ? mode.text : undefined}>
      {letter && count > 1 && <span className="component component-letter letter-slot" data-component={i}>{names[i]}</span>}
      {mode && (mode.mode === 'expression' || mode.mode === 'export' || mode.mode === 'other') ? <DrivenField state={mode} />
        : bound && mode.editable === false ? <code className="td-driven td-bind">{String(mode.value ?? '')}</code>
        : family === 'bool' ? <Select className="nodrag" label={`${label} ${i}`} value={String(!!item)} options={booleans}
        onChange={next => change(next === 'true')} /> :
        <NumberField label={`${label} ${i}`} value={Number(item) + shift} integer={integer} unsigned={family === 'uint'} commit={change}
          defaultValue={defaults === undefined ? undefined : Number(Array.isArray(defaults) ? defaults[i] : defaults)}
          preview={preview && (next => preview(withComponent(next)))} />}
    </label>;
  };
  const expand = count > 1 && <button type="button" className="value-expand" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}
    aria-label={say(tr('value.expand', 'Show each component on its own row'))} title={say(tr('value.expand', 'Show each component on its own row'))}>
    <Icon name="chevronDown" /></button>;
  const popups = <>{presets && head.current && <DropdownMenu anchor={head.current} label={say(tr('number.presets', 'Common values'))} onClose={() => setPresets(false)}
      items={choices.map(choice => ({ key: choice.key, label: choice.label, checked: choice.checked, select: () => commit(choice.value) }))} />}
    {group.view}</>;
  if (columns) return <>
    <div className="value-line">
      {expand}{leading}<span className="value-type nodrag nopan" data-toggle={toggle ? '' : undefined} {...press}>{typeText ?? type}</span>
      <div className={'value-group nodrag nopan' + (wired ? ' wired' : '')} inert={wired || undefined}>
        <div className="value-fields" style={{ '--components': count } as CSSProperties}>{list.map((item, i) => field(item, i, true))}</div></div>
    </div>
    {expanded && list.map((item, i) => <div className="value-line component-line" key={i}>
      <span className="value-caption"><span className="component-letter letter-slot" data-component={i}>{names[i]}</span></span>
      <span className="value-type" style={{ '--port-color': typeColor(family) } as CSSProperties}>{family}</span>
      <div className="value-group nodrag nopan">{field(item, i, false)}</div>
    </div>)}
    {swatch && <div className="value-line">{swatch}</div>}
    {popups}
  </>;
  return <div className="value-row">
    {leading}
    <div className={'value-group nodrag nopan' + (expanded ? ' expanded' : '') + (wired ? ' wired' : '')} inert={wired || undefined}>
    {expand}
    <div className="value-fields" style={{ '--components': count } as CSSProperties}>
      {list.map((item, i) => field(item, i, true))}
      {expanded && swatch}
    </div>
    </div>
    {!expanded && swatch}
    {popups}
  </div>;
}
