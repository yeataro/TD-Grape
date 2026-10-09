import { createPortal } from 'react-dom';
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { say, type Message } from './text';

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
  divider?: boolean; select(): void };

// Drawn at the page level, so a menu called up inside a zoomed node still lands under its anchor (a fixed
// position inside a transformed element would follow the transform). 畫在頁面層，從縮放中的節點叫出也落在正確位置。
export function DropdownMenu({ anchor, items, note, onClose, label, fit }: {
  anchor: HTMLElement; items: readonly MenuItem[]; onClose: () => void; label?: string;
  /** At least as wide as the anchor instead of the menu width (a select's choices). 至少和叫它的元素一樣寬（選擇器）。 */
  fit?: boolean;
  /** One line instead of, or above, the items (loading, empty, error). 項目之外的一行（載入中、空的、錯誤）。 */
  note?: Message | string;
}) {
  const menu = useRef<HTMLDivElement>(null), [place, setPlace] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    const box = anchor.getBoundingClientRect(), width = menu.current?.offsetWidth ?? 0, height = menu.current?.offsetHeight ?? 0;
    const below = box.bottom + 4 + height <= innerHeight - 8;
    setPlace({ left: Math.max(8, Math.min(box.left, innerWidth - width - 8)), top: below ? box.bottom + 4 : Math.max(8, box.top - 4 - height) });
  }, [anchor, items]);
  useEffect(() => {
    const away = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    const key = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') { onClose(); anchor.focus(); } };
    addEventListener('pointerdown', away, true); addEventListener('keydown', key);
    return () => { removeEventListener('pointerdown', away, true); removeEventListener('keydown', key); };
  }, [anchor, onClose]);
  useEffect(() => {
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
  return createPortal(<div ref={menu} className={'dropdown-menu' + (fit ? ' fit' : '')} role="menu" aria-label={label}
    style={fit ? { ...place, minWidth: anchor.offsetWidth } : place} onKeyDown={move}>
    {note && <p className="hint">{say(note)}</p>}
    {items.map(item => <Fragment key={item.key}>{item.divider && <hr />}
      <button role={item.checked === undefined ? 'menuitem' : 'menuitemradio'} aria-checked={item.checked === undefined ? undefined : item.checked}
        aria-disabled={item.disabled || undefined} title={item.title}
        onClick={() => { if (item.disabled) return; onClose(); item.select(); }}>{item.label}</button></Fragment>)}
  </div>, document.body);
}
