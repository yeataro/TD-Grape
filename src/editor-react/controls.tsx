import { useState, type ReactNode } from 'react';
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

/** A button showing one icon; its label is the tooltip and the accessible name. `pressed` makes it a toggle.
 * A disabled one stays hoverable so its tooltip can say why. 一個圖示按鈕；label 是提示與無障礙名稱；pressed 使它成為開關。
 * 停用時仍可滑過，好讓提示說明原因。 */
export function IconButton({ icon, label, onClick, pressed, disabled, title }: {
  icon: IconName; label: Message | string; onClick?: () => void; pressed?: boolean; disabled?: boolean; title?: Message | string;
}) {
  return <button type="button" className="icon-button" aria-label={say(label)} title={say(title ?? label)} aria-pressed={pressed}
    aria-disabled={disabled || undefined} onClick={disabled ? undefined : onClick}><Icon name={icon} /></button>;
}

/** A text button for something not built yet: in place, visibly unusable, saying so (human 2026-10-09).
 * 還沒做的功能的文字按鈕：擺在該在的位置、看得出不能用、滑鼠停留說明（人類）。 */
export const Placeholder = ({ label, className }: { label: Message; className?: string }) =>
  <button type="button" className={'placeholder' + (className ? ' ' + className : '')} aria-disabled="true" title={say(notYet)}>{say(label)}</button>;

/** A choice drawn with the editor's own rounded menu instead of the browser's (human 2026-10-09: never the
 * built-in one). The button shows the current value. 用編輯器自己的圓角選單做的選擇（人類：不用瀏覽器內建的）。 */
export function Select<T extends string>({ label, value, options, onChange, disabled, children }: {
  label: Message | string; value: T; options: readonly { value: T; label: ReactNode }[]; onChange(value: T): void;
  disabled?: boolean; children?: ReactNode;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const items: MenuItem[] = options.map(option => ({ key: option.value, label: option.label, checked: option.value === value,
    select: () => onChange(option.value) }));
  return <>
    <button type="button" className="select-button" aria-label={say(label)} aria-haspopup="menu" aria-expanded={!!anchor}
      aria-disabled={disabled || undefined} onClick={event => { if (!disabled) setAnchor(anchor ? null : event.currentTarget); }}>
      <span>{children ?? options.find(option => option.value === value)?.label}</span><Icon name="chevronDown" /></button>
    {anchor && <DropdownMenu anchor={anchor} items={items} label={say(label)} onClose={() => setAnchor(null)} />}
  </>;
}

/** A button that opens a menu of actions (no current value). 打開一串動作的按鈕（沒有「目前值」）。 */
export function MenuButton({ icon, label, items }: { icon: IconName; label: Message | string; items: readonly MenuItem[] }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return <>
    <button type="button" className="icon-button" aria-label={say(label)} title={say(label)} aria-haspopup="menu" aria-expanded={!!anchor}
      onClick={event => setAnchor(anchor ? null : event.currentTarget)}><Icon name={icon} /></button>
    {anchor && <DropdownMenu anchor={anchor} items={items} label={say(label)} onClose={() => setAnchor(null)} />}
  </>;
}

/** Controls that belong together, separated from the next group by a thin line. 一組相關的控制項，和下一組之間有細線。 */
export const ToolGroup = ({ children }: { children: ReactNode }) => <div className="tool-group">{children}</div>;
