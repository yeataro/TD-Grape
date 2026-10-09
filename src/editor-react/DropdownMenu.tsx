import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { say, type Message } from './text';

// A dropdown menu widget (Refactor.51; human 2026-10-09: one dropdown component used as a widget, many places
// will need one). It only shows and operates a menu: drawn under the element that called it up, closed by a
// click outside or Esc, arrow keys move, the checked item is the current one. What the items are and what
// choosing one does belong to whoever uses it.
// 下拉選單元件（像 widget；人類：之後很多地方都會用到）。只負責顯示與操作：畫在叫它的元素下方、點外面或 Esc 關閉、
// 上下鍵移動、打勾＝目前的那一個。項目是什麼、選了做什麼，屬於用它的人。
export type MenuItem = { key: string; label: ReactNode; checked?: boolean; disabled?: boolean; title?: string; select(): void };

export function DropdownMenu({ anchor, items, note, onClose, label }: {
  anchor: HTMLElement; items: readonly MenuItem[]; onClose: () => void; label?: string;
  /** One line instead of, or above, the items (loading, empty, error). 項目之外的一行（載入中、空的、錯誤）。 */
  note?: Message | string;
}) {
  const menu = useRef<HTMLDivElement>(null), [place, setPlace] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    const box = anchor.getBoundingClientRect(), width = menu.current?.offsetWidth ?? 0;
    setPlace({ left: Math.max(8, Math.min(box.left, innerWidth - width - 8)), top: box.bottom + 4 });
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
    (menu.current?.querySelector<HTMLButtonElement>('button[aria-checked="true"]:not(:disabled)')
      ?? menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus();
  }, [items]);
  const move = (event: KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...menu.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(at + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
  };
  return <div ref={menu} className="dropdown-menu" role="menu" aria-label={label} style={place} onKeyDown={move}>
    {note && <p className="hint">{say(note)}</p>}
    {items.map(item => <button key={item.key} role="menuitemradio" aria-checked={!!item.checked} disabled={item.disabled}
      title={item.title} onClick={() => { onClose(); item.select(); }}>{item.label}</button>)}
  </div>;
}
