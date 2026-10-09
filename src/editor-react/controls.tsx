import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { DropdownMenu, type MenuItem } from './DropdownMenu';
import { Icon, type IconName } from './icons';
import { say, tr, type Message } from './text';

// Shared controls of the editor frame (Refactor.53; human 2026-10-09: clean structure, colours and parts all
// reusable). Bars, zones and panels build from these; their look lives in style.css under the same names and
// reads the theme's purpose colours only.
// 編輯器外框共用的控制項（人類：結構乾淨、顏色與部件都可重用）。各列、各區、各面板都用這些組成；外觀在 style.css
// 同名的地方，只讀主題的用途色。

/** Why a control is shown but cannot be used yet (human 2026-10-09: placeholders show they are not usable).
 * 控制項擺著但還不能用的原因（人類：佔位要看得出不能用）。 */
export const notYet = tr('placeholder.notYet', 'Not available yet');

/** A button showing one icon; its label is the tooltip and the accessible name. `pressed` makes it a tool toggle
 * (lavender); `mode` marks a toggle that changes how dragging or selecting works (green when pressed); `expanded` says
 * a region it opens is shown (quiet, legacy sidebar toggles).
 * A disabled one stays hoverable so its tooltip can say why.
 * 一個圖示按鈕；label 是提示與無障礙名稱。pressed＝工具開關（淡紫）；mode＝會改變拖曳、選取等互動的模式開關（按下為綠）；
 * expanded＝它打開的區域正顯示著（低調，舊產品側欄開關）。停用時仍可滑過，好讓提示說明原因。 */
export function IconButton({ icon, label, onClick, pressed, expanded, disabled, title, mode, danger }: {
  icon: IconName; label: Message | string; onClick?: () => void; pressed?: boolean; expanded?: boolean; disabled?: boolean; title?: Message | string;
  mode?: boolean;
  /** Destroys something (delete): highlighted in the error red. 會刪掉東西：高亮用錯誤紅。 */
  danger?: boolean;
}) {
  return <button type="button" className={'icon-button' + (mode ? ' mode-toggle' : '') + (danger ? ' danger' : '')} aria-label={say(label)} title={say(title ?? label)} aria-pressed={pressed} aria-expanded={expanded}
    aria-disabled={disabled || undefined} onClick={disabled ? undefined : onClick}><Icon name={icon} /></button>;
}

/** A text button for something not built yet: in place, visibly unusable, saying so (human 2026-10-09).
 * 還沒做的功能的文字按鈕：擺在該在的位置、看得出不能用、滑鼠停留說明（人類）。 */
export const Placeholder = ({ label, className }: { label: Message; className?: string }) =>
  <button type="button" className={'placeholder' + (className ? ' ' + className : '')} aria-disabled="true" title={say(notYet)}>{say(label)}</button>;

/** A choice drawn with the editor's own rounded menu instead of the browser's (human 2026-10-09: never the
 * built-in one). The button shows the current value. 用編輯器自己的圓角選單做的選擇（人類：不用瀏覽器內建的）。 */
export function Select<T extends string>({ label, value, options, onChange, disabled, children, className, title, sizeTo }: {
  label: Message | string; value: T; options: readonly { value: T; label: ReactNode }[]; onChange(value: T): void;
  disabled?: boolean; children?: ReactNode;
  /** Extra classes on the button (e.g. nodrag inside a node). 按鈕的額外 class（例如節點裡的 nodrag）。 */
  className?: string; title?: Message | string;
  /** Labels the button is at least as wide as, laid invisibly under the value, so selects in a group line up
   * whatever their value (human 2026-10-09: Uniform types as wide as RGBA). 按鈕至少和這些文字一樣寬：疊在值底下、
   * 看不見，一組選單不論值是什麼都對齊（人類：Uniform 型別和 RGBA 一樣寬）。 */
  sizeTo?: readonly ReactNode[];
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const items: MenuItem[] = options.map(option => ({ key: option.value, label: option.label, checked: option.value === value,
    select: () => onChange(option.value) }));
  return <>
    <button type="button" className={'select-button' + (className ? ' ' + className : '')} aria-label={say(label)} title={title && say(title)} aria-haspopup="menu" aria-expanded={!!anchor}
      aria-disabled={disabled || undefined} onClick={event => { if (!disabled) setAnchor(anchor ? null : event.currentTarget); }}>
      <span className={sizeTo ? 'select-sized' : undefined}><span>{children ?? options.find(option => option.value === value)?.label}</span>
        {sizeTo?.map((size, i) => <span key={i} className="select-size" aria-hidden="true">{size}</span>)}</span><Icon name="chevronDown" /></button>
    {anchor && <DropdownMenu anchor={anchor} items={items} label={say(label)} fit onClose={() => setAnchor(null)} />}
  </>;
}

/** A button that opens a menu of actions (no current value). `narrow` for an icon that is only a few dots wide
 * (the legacy foot-bar ⋮). 打開一串動作的按鈕。narrow：給只有幾個點寬的圖示（舊產品底列的 ⋮）。 */
export function MenuButton({ icon, label, items, narrow }: { icon: IconName; label: Message | string; items: readonly MenuItem[]; narrow?: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return <>
    <button type="button" className={'icon-button' + (narrow ? ' narrow' : '')} aria-label={say(label)} title={say(label)} aria-haspopup="menu" aria-expanded={!!anchor}
      onClick={event => setAnchor(anchor ? null : event.currentTarget)}><Icon name={icon} /></button>
    {anchor && <DropdownMenu anchor={anchor} items={items} label={say(label)} onClose={() => setAnchor(null)} />}
  </>;
}

/** Controls that belong together, separated from the next group by a thin line. 一組相關的控制項，和下一組之間有細線。 */
export const ToolGroup = ({ children }: { children: ReactNode }) => <div className="tool-group">{children}</div>;

/** A count on a heading (legacy source counts). `group` colours it by a colour group; without it, it is plain
 * (human 2026-10-09: the Sources area is coloured by group, the Add Node area is not). The tooltip says what it counts.
 * 標題上的數量（舊產品的來源數量）。給 group 就用該 colorGroup 上色，否則不上色（人類：來源區上色、新增節點區不上色）。 */
// With `onClick` it is a button (human 2026-10-09: a source card's count selects what uses it).
// 給 onClick 就是按鈕（人類：來源卡片的數量點了選取用到它的節點）。
export const Badge = ({ count, group, title, onClick }: { count: number; group?: string; title?: Message | string; onClick?(): void }) => {
  const props = { className: 'badge' + (group ? ' badge-group' : '') + (onClick ? ' badge-button' : ''), title: title === undefined ? undefined : say(title),
    style: group ? { '--badge-color': `var(--group-${group})` } as CSSProperties : undefined };
  return onClick ? <button type="button" {...props} onClick={onClick} disabled={!count}>{count}</button> : <span {...props}>{count}</span>;
};

/** A small panel called up from a button, drawn above or below it (whichever has room), closed by a click outside or
 * Esc (Refactor.54.1: the appearance and size panels, the message history). 從按鈕叫出的小面板：畫在按鈕上方或下方
 * （哪邊放得下就哪邊），點外面或 Esc 關閉（外觀、大小面板、訊息歷史）。 */
export function Popover({ anchor, label, onClose, className, children }: {
  anchor: HTMLElement; label: Message | string; onClose(): void; className?: string; children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null), [place, setPlace] = useState<CSSProperties>({ visibility: 'hidden' });
  useLayoutEffect(() => {
    const rect = anchor.getBoundingClientRect(), width = box.current?.offsetWidth ?? 0, height = box.current?.offsetHeight ?? 0;
    const left = Math.max(8, Math.min(rect.left, innerWidth - width - 8));
    setPlace(rect.bottom + 4 + height <= innerHeight - 8 ? { left, top: rect.bottom + 4 } : { left, bottom: innerHeight - rect.top + 4 });
  }, [anchor]);
  useEffect(() => {
    const away = (event: PointerEvent) => { if (!box.current?.contains(event.target as Node) && !anchor.contains(event.target as Node)) onClose(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    addEventListener('pointerdown', away, true); addEventListener('keydown', key);
    return () => { removeEventListener('pointerdown', away, true); removeEventListener('keydown', key); };
  }, [anchor, onClose]);
  return <div ref={box} className={'popover' + (className ? ' ' + className : '')} role="dialog" aria-label={say(label)} style={place}>{children}</div>;
}

/** An icon button that opens a Popover. 打開小面板的圖示按鈕。 */
/** Asks before something that cannot be taken back lightly (legacy confirmOverlay, inspector.js:2488): a title, what will
 * happen, Cancel (focused) and the action in the danger red. Esc or a click on the dimmed page cancels. Our own box, never
 * the browser's confirm(). 做不太能收回的事之前先問（照舊產品）：標題、會發生什麼、取消（預設焦點）與紅色的動作鍵。Esc 或點暗下的頁面＝取消。
 * 我們自己的框，不用瀏覽器的 confirm()。 */
export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: {
  title: Message | string; message: Message | string; confirmLabel: Message | string; onConfirm(): void; onCancel(): void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancel.current?.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onCancel(); } };
    addEventListener('keydown', key, true);
    return () => removeEventListener('keydown', key, true);
  }, [onCancel]);
  return createPortal(<div className="confirm-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onCancel(); }}>
    <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-label={say(title)}>
      <strong>{say(title)}</strong><p>{say(message)}</p>
      <div className="confirm-actions">
        <button type="button" ref={cancel} onClick={onCancel}>{say(tr('confirm.cancel', 'Cancel'))}</button>
        <button type="button" className="danger" onClick={onConfirm}>{say(confirmLabel)}</button>
      </div>
    </div>
  </div>, document.body);
}

export function PopoverButton({ icon, label, className, children }: { icon: IconName; label: Message | string; className?: string; children: ReactNode }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return <>
    <button type="button" className="icon-button" aria-label={say(label)} title={say(label)} aria-haspopup="dialog" aria-expanded={!!anchor}
      onClick={event => setAnchor(anchor ? null : event.currentTarget)}><Icon name={icon} /></button>
    {anchor && <Popover anchor={anchor} label={label} className={className} onClose={() => setAnchor(null)}>{children}</Popover>}
  </>;
}

/** Two or more choices side by side, one active (legacy Dark/Light, Standard/Comfortable, the stages).
 * 並排的幾個選項，一次一個（舊產品的 Dark／Light、Standard／Comfortable、Stage）。 */
export function Segmented<T extends string>({ label, value, options, onChange }: {
  label: Message | string; value: T; options: readonly { value: T; label: Message | string; disabled?: boolean; title?: Message | string }[]; onChange(value: T): void;
}) {
  return <div className="segmented" role="radiogroup" aria-label={say(label)}>
    {options.map(option => <button key={option.value} type="button" role="radio" aria-checked={option.value === value}
      aria-disabled={option.disabled || undefined} title={option.title === undefined ? undefined : say(option.title)}
      onClick={() => { if (!option.disabled) onChange(option.value); }}>{say(option.label)}</button>)}</div>;
}

/** Rows of the same kind of data laid out as a table: each column as wide as its widest cell, so the values line up
 * however long each label is (human 2026-10-09: "the same things are aligned like a table").
 * 同一種資料的幾列排成表格：每欄寬度取最寬的那格，標籤長短不同也對齊（人類：同樣的東西要用表格對齊）。 */
export function AlignedRows({ rows, className }: { rows: readonly (readonly (Message | string)[])[]; className?: string }) {
  const columns = Math.max(...rows.map(row => row.length), 1);
  return <div className={'aligned-rows' + (className ? ' ' + className : '')} style={{ gridTemplateColumns: `repeat(${columns}, max-content)` }}>
    {rows.flatMap((row, r) => Array.from({ length: columns }, (_, c) => <span key={r + ':' + c}>{row[c] === undefined ? '' : say(row[c]!)}</span>))}
  </div>;
}

/** A section whose heading folds it away (human 2026-10-09: without folding, the panel is a heap). The heading holds the
 * title (with its count) and, on the right, the section's own buttons, which do not fold it.
 * 標題可以折疊的一區（人類：不能折疊東西就一大堆）。標題放名稱（含數量），右邊是這一區自己的按鈕，按它們不會折疊。 */
// `hint`: what the section is for, shown when the pointer rests on its title, not as a paragraph that always takes room
// (human 2026-10-09: the wrapping hints were annoying; later the ⓘ went too, the title says it). Later the Help panel can
// take them. hint：這一段是做什麼的，滑過標題時顯示，不常駐佔位（人類：換行的說明很煩；之後 ⓘ 也拿掉，由標題帶）。之後可搬到 Help 面板。
// `remember`: a name to keep it open or closed by, in this browser (a personal preference; human 2026-10-09: the editor
// remembers); `open`: how it starts the first time. remember：記住開關用的名字，存在這個瀏覽器（個人偏好；人類：編輯器要記得）；
// open：第一次是開還是關。
export function FoldSection({ title, actions, hint, children, remember, open: initial = true }: {
  title: ReactNode; actions?: ReactNode; hint?: Message | string; children: ReactNode; remember?: string; open?: boolean;
}) {
  const key = remember && 'grape-fold-' + remember;
  const [open, setOpenState] = useState(() => {
    try { const stored = key ? localStorage.getItem(key) : null; return stored === null ? initial : stored === 'open'; } catch { return initial; }
  });
  const setOpen = (next: boolean) => {
    setOpenState(next);
    if (key) try { localStorage.setItem(key, next ? 'open' : 'closed'); } catch { /* storage may be blocked */ }
  };
  return <section className="fold-section">
    <header className="fold-heading"><span className="fold-title" title={hint && say(hint)}><button type="button" className="fold-toggle" aria-expanded={open} onClick={() => setOpen(!open)}
      aria-description={hint && say(hint)}><Icon name="chevronDown" />{title}</button></span>
      {actions && <span className="fold-actions">{actions}</span>}</header>
    {open && <div className="fold-body">{children}</div>}
  </section>;
}
