import { createPortal } from 'react-dom';
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type CSSProperties } from 'react';
import { say, type Message } from './text';
import { fromBar } from './follow_bar';
import { Icon, type IconName } from './icons';

// A dropdown menu widget (Refactor.51; human 2026-10-09: one dropdown component used as a widget, many places
// will need one). It only shows and operates a menu: drawn under the element that called it up (above it when
// there is no room below, e.g. from the foot bar), closed by a click outside or Esc, arrow keys move, the
// checked item is the current one. What the items are and what choosing one does belong to whoever uses it.
// A disabled item keeps its tooltip (a placeholder says why, Refactor.53), so it is marked, not disabled.
// 下拉選單元件（像 widget；人類：之後很多地方都會用到）。只負責顯示與操作：畫在叫它的元素下方（下面放不下就放上面，
// 例如從底列叫出）、點外面或 Esc 關閉、上下鍵移動、打勾＝目前的那一個。項目是什麼、選了做什麼，屬於用它的人。
// 停用的項目保留滑鼠提示（佔位要說明原因），所以用標記而不是真的 disabled。
export type MenuItem = { key: string; label: ReactNode; checked?: boolean; disabled?: boolean; title?: string;
  /** A line before this item, starting a new section. 在這一項前面畫一條線，開始新的一段。 */
  divider?: boolean;
  /** Destroys something: in the error red, as a danger button. 會刪掉東西：用錯誤紅，同危險按鈕。 */
  danger?: boolean;
  /** An on/off item (`checked` is its state): choosing it keeps the menu open, so several can be set (Refactor.68, the
   * Layout menu's panels). 開關項目（checked＝狀態）：選了選單不關，可以連續設好幾個（Layout 選單的面板）。 */
  checkbox?: boolean;
  /** An on/off item that closes the menu when chosen, as any other (Refactor.93: full screen in the right-click menu); with an icon,
   * on is shown by the pressed look instead of a check (legacy). 開關項目、選了照常關閉選單（R.93：右鍵選單的全螢幕）；有圖示時開著用按下的
   * 樣子表示、不打勾（照舊產品）。 */
  toggle?: boolean;
  /** Its icon. When any item has one, every item keeps the icon's column, and a check sits there (Refactor.93, legacy).
   * 圖示。只要有一項有圖示，每一項都留圖示那一欄，勾勾也打在那裡（R.93，照舊產品）。 */
  icon?: IconName;
  /** Its shortcut, on the right, quieter (Refactor.93). 快捷鍵，靠右、淡一點（R.93）。 */
  hint?: string;
  select(): void };

// Drawn at the page level, so a menu called up inside a zoomed node still lands under its anchor (a fixed
// position inside a transformed element would follow the transform). 畫在頁面層，從縮放中的節點叫出也落在正確位置。
/** Where a popup opens (Refactor.59.2): from a bar (title, location, foot) it keeps --popup-gap off the bar's edge, so it
 * floats like the network toolbar (human 2026-10-09); from anything else --popup-offset off the control. Below when it fits,
 * else above; never past the window's --popup-margin. Distances are the theme's.
 * 選單從哪裡打開：從列（標題、網址、底列）打開時離列邊緣 --popup-gap，像網路區功能列一樣浮著（人類）；其他離控制項 --popup-offset。
 * 下面放得下就放下面，否則放上面；不超過視窗邊緣 --popup-margin。距離都由主題決定。 */
/** Where a popup goes: below its bar when it fits, else above it. Above, it is held by its bottom edge (Refactor.75.1, human
 * 2026-10-11): a popup that then grows or shrinks keeps the edge next to what opened it, so it does not jump.
 * 彈出的位置：放得下就在那一列下方，否則在上方。在上方時用下緣固定（R.75.1，人類）：之後變高變矮，靠近開它的那一邊都不動，不會跳。 */
export function popupPlace(anchor: HTMLElement, width: number, height: number): CSSProperties {
  const size = (name: string) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
  const bar = anchor.closest('.title-bar, .location-bar, .foot-bar'), edge = (bar ?? anchor).getBoundingClientRect();
  const gap = size(bar ? '--popup-gap' : '--popup-offset'), margin = size('--popup-margin'), box = anchor.getBoundingClientRect();
  const left = Math.max(margin, Math.min(box.left, innerWidth - width - margin));
  if (edge.bottom + gap + height <= innerHeight - margin) return { left, top: edge.bottom + gap };
  return edge.top - gap - height >= margin ? { left, bottom: innerHeight - edge.top + gap } : { left, top: margin };
}

/** A popup opened at a point (a right-click, a long press): there, moved in to stay inside the window, never flipped (legacy
 * graph_ui.js:3051). 在一個點打開的彈出物（右鍵、長按）：就在那裡，超出視窗就往內移，不翻面（照舊產品）。 */
export function pointPlace(at: { x: number; y: number }, width: number, height: number): CSSProperties {
  const margin = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--popup-margin')) || 0;
  return { left: Math.max(margin, Math.min(at.x, innerWidth - width - margin)), top: Math.max(margin, Math.min(at.y, innerHeight - height - margin)),
    maxHeight: innerHeight - 2 * margin };
}

export function DropdownMenu({ anchor, items, note, onClose, label, fit, at, touch }: {
  anchor: HTMLElement; items: readonly MenuItem[]; onClose: () => void; label?: string;
  /** Opened at this point instead of under the anchor (Refactor.93, the right-click menu); then any press outside closes it,
   * on the anchor too, and so do leaving the window and resizing it (legacy graph_ui.js:3062-3063). 在這個點打開、不在 anchor 下面
   * （R.93 右鍵選單）；這時在外面任何地方按下都關閉（包括 anchor），離開視窗、改變視窗大小也關閉（照舊產品）。 */
  at?: { x: number; y: number };
  /** Opened by touch: taller rows, no shortcuts (legacy style.css:950). 用觸控打開：列高一點、不顯示快捷鍵（照舊產品）。 */
  touch?: boolean;
  /** At least as wide as the anchor (a select's choices); otherwise as wide as its content. 至少和叫它的元素一樣寬（選擇器）；否則照內容寬。 */
  fit?: boolean;
  /** One line instead of, or above, the items (loading, empty, error). 項目之外的一行（載入中、空的、錯誤）。 */
  note?: Message | string;
}) {
  const menu = useRef<HTMLDivElement>(null), [place, setPlace] = useState<CSSProperties>({ left: 0, top: 0 });
  useLayoutEffect(() => {
    const width = menu.current?.offsetWidth ?? 0, height = menu.current?.offsetHeight ?? 0;
    setPlace(at ? pointPlace(at, width, height) : popupPlace(anchor, width, height));
  }, [anchor, items, at?.x, at?.y]);
  useEffect(() => {
    const away = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && (at || !anchor.contains(target))) onClose();
    };
    // Tab also leaves a menu opened at a point (legacy). 在點上打開的選單，Tab 也離開（照舊產品）。
    const key = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' && !(at && event.key === 'Tab')) return;
      event.preventDefault(); onClose(); anchor.focus();
    };
    addEventListener('pointerdown', away, true); addEventListener('keydown', key);
    if (at) { addEventListener('blur', onClose); addEventListener('resize', onClose); }
    return () => { removeEventListener('pointerdown', away, true); removeEventListener('keydown', key); removeEventListener('blur', onClose); removeEventListener('resize', onClose); };
  }, [anchor, onClose, !!at]);
  useEffect(() => {
    // Not again while the keyboard is already in the menu (an on/off item changed it). 鍵盤已在選單裡時不再移動（開關項目改了它）。
    if (menu.current?.contains(document.activeElement)) return;
    // A menu opened at a point takes the keyboard itself, on no item, so no item is ringed (Refactor.93, human 2026-10-12: no
    // frame); the arrow keys start on the first one. A choice starts on the current value. 在點上打開的選單由選單自己接鍵盤、不停在任何
    // 一項，所以沒有一項被框起來（R.93，人類：不需要這個框）；上下鍵從第一項開始。選擇從目前的值開始。
    if (at) { menu.current?.focus(); return; }
    (menu.current?.querySelector<HTMLButtonElement>('button[aria-checked="true"]:not([aria-disabled="true"])')
      ?? menu.current?.querySelector<HTMLButtonElement>('button:not([aria-disabled="true"])'))?.focus();
  }, [items]);
  const move = (event: KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...menu.current!.querySelectorAll<HTMLButtonElement>('button:not([aria-disabled="true"])')];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(at + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
  };
  // A menu opened from a bar fades in and is glass (R.75.24), one opened while editing (in a node, a panel) does not: it must keep up with the hand
  // (Refactor.75.21, human 2026-10-11). It closes at once. 從列上打開的選單淡入；編輯中打開的（節點、面板裡）不淡入，要跟手
  // （R.75.21，人類）。關閉立刻消失。
  const icons = items.some(item => item.icon);
  return createPortal(<div ref={menu} className={'dropdown-menu' + (fit ? ' fit' : '') + (icons ? ' with-icons' : '') + (touch ? ' touch' : '') + fromBar(anchor)} role="menu" aria-label={label}
    tabIndex={at ? -1 : undefined} style={fit ? { ...place, minWidth: anchor.offsetWidth } : place} onKeyDown={move}>
    {note && <p className="hint">{say(note)}</p>}
    {items.map(item => <Fragment key={item.key}>{item.divider && <hr />}
      <button role={item.checkbox || item.toggle ? 'menuitemcheckbox' : item.checked === undefined ? 'menuitem' : 'menuitemradio'}
        aria-checked={item.checked === undefined ? undefined : item.checked}
        aria-disabled={item.disabled || undefined} title={item.title} className={[item.danger && 'danger', item.toggle && item.icon && 'pressable'].filter(Boolean).join(' ') || undefined}
        onClick={() => { if (item.disabled) return; if (!item.checkbox) onClose(); item.select(); }}>
        {icons && <span className="menu-icon">{item.icon ? <Icon name={item.icon} /> : item.checked !== undefined && <Icon name="check" />}</span>}
        {item.label}{item.hint && <small className="menu-hint">{item.hint}</small>}</button></Fragment>)}
  </div>, document.body);
}
