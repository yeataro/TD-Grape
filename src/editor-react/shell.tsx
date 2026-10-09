import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { DropdownMenu, type MenuItem } from './DropdownMenu';
import { BrandMark } from './icons';
import { listGrapeOps, type GrapeOpRow } from './grape_ops';
import type { TdIdentity } from './td_identity';
import { tr, say, errorText, type Message } from './text';

// The editor shell (Refactor.51; work/in-place-refactor-design/no-target-and-switching.md). It owns the one
// "go to this Grape OP" behaviour and the one Grape OP menu. Entries only open the menu from where they are
// (human 2026-10-09: a menu is called up from somewhere and drawn there; where an entry sits will move later),
// so moving or adding an entry never touches the menu or the switching. The editing of one graph (Editor)
// knows nothing about either.
// 編輯器外殼：擁有唯一的「換到這個 Grape OP」行為與唯一的 Grape OP 選單。入口只負責「從我這裡叫出選單」，選單畫在
// 叫它的地方（人類：入口之後會換位置）；所以搬動或增加入口不碰選單與切換。單張圖的編輯（Editor）兩者都不知道。
export type Shell = {
  /** The Grape OP being edited ('' when none). 正在編輯的 Grape OP（沒有時為空字串）。 */
  readonly current: string;
  /** Go to this Grape OP (asks first when changes are not yet in TD). 換過去（有還沒送到 TD 的修改時先問）。 */
  choose(id: string): void;
  /** Open the Grape OP menu next to this element. 在這個元素旁邊打開 Grape OP 選單。 */
  openMenu(anchor: HTMLElement): void;
};
export const ShellContext = createContext<Shell | null>(null);
export const useShell = () => useContext(ShellContext)!;

/** An entry: a button that calls the menu up from where it is. 入口：從自己這裡叫出選單的按鈕。 */
export function GrapeOpEntry({ label, className }: { label: Message | string; className?: string }) {
  const shell = useShell();
  return <button className={className} aria-haspopup="menu" onClick={event => shell.openMenu(event.currentTarget)}>{say(label)}</button>;
}

/** The one Grape OP menu: the Grape OPs as items of the dropdown widget; choosing one is the shell's switch.
 * 唯一的 Grape OP 選單：把 Grape OP 變成下拉選單的項目；選了就是外殼的切換。 */
export function GrapeOpMenu({ anchor, token, onClose, seen }: { anchor: HTMLElement; token: string; onClose: () => void;
  seen: (td: TdIdentity) => void }) {
  const shell = useShell();
  const [rows, setRows] = useState<GrapeOpRow[] | null>(null), [error, setError] = useState<Message | string>('');
  useEffect(() => {
    let live = true;
    listGrapeOps(token).then(found => { if (found.td) seen(found.td); if (live) setRows(found.rows); },
      failure => { if (live) setError(errorText(failure)); });
    return () => { live = false; };
  }, [token, seen]);
  const items: MenuItem[] = (rows ?? []).map(row => ({ key: row.id, checked: row.id === shell.current, select: () => shell.choose(row.id),
    label: <><span className="grape-op-kind">{row.kind.toUpperCase()}</span><span className="grape-op-path">{row.path}</span></> }));
  const note = error || (rows === null ? tr('picker.loading', 'Listing the Grape OPs…')
    : rows.length ? undefined : tr('picker.empty', 'This project has no Grape OP yet: create a Grape TOP in TD from the Tab menu.'));
  return <DropdownMenu anchor={anchor} items={items} note={note} onClose={onClose} label={say(tr('picker.label', 'Grape OPs in this project'))} />;
}

/** The canvas while no graph is open: a normal editor with nothing drawn yet (human 2026-10-09). 還沒有圖時的畫布。 */
/** A Grape OP is opening: the mark's waiting animation and what is happening, nothing to choose (Refactor.59.7).
 * Grape OP 正在打開：標誌的等待動畫與正在做什麼，沒有要選的東西。 */
export function LoadingCanvas({ message }: { message: Message | string }) {
  return <div className="empty-canvas loading-canvas"><BrandMark loading label={say(message)} /><p>{say(message)}</p></div>;
}

export function EmptyCanvas({ message, children }: { message: Message | string; children?: ReactNode }) {
  return <div className="empty-canvas"><p>{say(message)}</p>
    <GrapeOpEntry label={tr('picker.choose', 'Choose a Grape OP')} className="primary" />{children}</div>;
}
