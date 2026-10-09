import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent, type ReactNode } from 'react';
import { core, type Declaration } from './core';
import { tr, say } from './text';
import { useSession } from './contexts';
import { Badge, MenuButton } from './controls';
import { Icon } from './icons';
import { DRAG_TYPE } from './AddNodePanel';
import { OutputRow } from './PortRow';
import type { PortSpec } from '../core-ts/ports';

// The parts of a card in the Shared Sources panel (Refactor.57–58; split out of SourcesPanel.tsx). Styles: style.css,
// "A source card". 共用來源面板裡卡片的零件（從 SourcesPanel.tsx 拆出）。樣式在 style.css「A source card」。

/** A source's name, edited in place; Enter keeps it, Esc puts it back. 來源名稱，原地編輯；Enter 確定、Esc 還原。 */
export function NameField({ declaration }: { declaration: Declaration }) {
  const session = useSession(), [draft, setDraft] = useState(declaration.name);
  useEffect(() => setDraft(declaration.name), [declaration.name]);
  const commit = () => { if (draft !== declaration.name && !session.renameDeclaration(declaration.id, draft)) setDraft(declaration.name); };
  return <input className="source-name" aria-label={say(tr('sources.name', 'Name'))} value={draft}
    onChange={event => setDraft(event.target.value)} onBlur={commit}
    onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(declaration.name); event.currentTarget.blur(); } }} />;
}

// A source card shows its kind's colour on a strip at its left, as a node title turned on its side (human 2026-10-09
// trial; a handle for reordering may come later). 來源卡片左邊一條是它種類的顏色，像轉了方向的節點標題（人類試驗；之後可能當排序把手）。
export const groupColor = (group: string) => ({ '--group-color': `var(--group-${group})` }) as CSSProperties;
export const kindGroup = (declaration: Declaration) => core.declarationKinds.get(declaration.kind)?.colorGroup ?? 'function';

// Dragged onto the canvas, a source is added there, the same way as from the Add Node panel (its add-list id; human
// 2026-10-09). Only from the card itself, never from its fields and buttons, so text can still be selected.
// 拖到畫布上就在那裡新增，和 Add Node 面板同一條路（用它在新增清單的代號；人類）。只從卡片本身拖，不從輸入框和按鈕，文字仍可選取。
function useDragToCanvas(choice: string) {
  const grab = useRef(false);
  return { draggable: true,
    onPointerDown: (event: PointerEvent) => { grab.current = !(event.target as Element).closest('input, button, .value-row'); },
    onDragStart: (event: DragEvent) => {
      if (!grab.current) { event.preventDefault(); return; }
      event.dataTransfer.setData(DRAG_TYPE, choice); event.dataTransfer.effectAllowed = 'copy';
    } };
}

// One source card (human 2026-10-09, after the legacy card). Two columns: the triangle alone at the left; the head (name,
// type, use count, "⋯") and, open, the value in the right one, so they share one left edge and one right edge. The count
// is a tag as the section counts and never moves; "⋯" adds to the graph, selects references, deletes. No "+": the menu
// and dragging onto the canvas both add it (human).
// 一張來源卡片（人類，參考舊產品）。兩欄：左欄只有三角形；右欄是名稱列（名稱、型別、使用數、「⋯」）和打開後的數值，左右緣都對齊。
// 使用數是和區段數量一樣的標籤，位置不動；「⋯」加到圖上、選取引用、刪除。不放「＋」：選單和拖到畫布都能加（人類）。
// `group`: its colour group; `refKey`: what counts as a use (a declaration ID, or `tdValue:` and an entry); without
// `onRemove` it cannot be deleted (a TD value). group：顏色組；refKey：算使用數的依據；沒有 onRemove 就不能刪（TD 內建值）。
export function SourceCard({ group, refKey, choice, head, outputs, children, uses, onAdd, onRemove }: {
  group: string; refKey: string; choice: string; head: ReactNode; outputs: readonly PortSpec[]; children?: ReactNode; uses: number;
  onAdd(): void; onRemove?(): void;
}) {
  const session = useSession(), [open, setOpen] = useState(false), drag = useDragToCanvas(choice);
  return <div className="source-card" style={groupColor(group)} {...drag}>
    {outputs.length || children ? <button type="button" className="expand-toggle" aria-expanded={open} onClick={() => setOpen(!open)}
      aria-label={say(tr('sources.details', 'Show details'))} title={say(tr('sources.details', 'Show details'))}><Icon name="chevronDown" /></button>
      : <span className="expand-toggle" aria-hidden="true" />}
    <div className="source-head">
      {head}
      {/* Unused: a plain grey tag; in use: the kind's colour, and a click selects those nodes, as the menu's Select
          references (human 2026-10-09). 沒在用：灰色標籤；有在用：種類色，點了選取那些節點，同選單的選取引用（人類）。 */}
      <Badge count={uses} group={uses ? group : undefined}
        title={tr('sources.usedBySelect', 'Used by {count} node(s) · click to select them', { count: uses })}
        onClick={() => session.selectReferences(refKey)} />
      <MenuButton icon="menu" narrow label={tr('sources.more', 'More')} items={[
        { key: 'add', label: say(tr('sources.place', 'Add to graph')), select: onAdd },
        { key: 'select', label: say(tr('sources.selectReferences', 'Select references ({count})', { count: uses })), disabled: !uses,
          select: () => session.selectReferences(refKey) },
        ...(onRemove ? [{ key: 'delete', label: say(tr('sources.remove', 'Delete')), danger: true, divider: true, select: onRemove }] : []),
      ]} />
    </div>
    {/* Open: its outputs first, as a start node (glossary), then what it is (human 2026-10-09: as the legacy cards).
        打開：先是輸出（同起點節點），再是它的內容（人類：同舊產品卡片）。 */}
    {open && <div className="source-body">
      {outputs.map(port => <OutputRow key={port.key} label={port.key} type={port.type}><span className="port-dot" aria-hidden="true" /></OutputRow>)}
      {children}</div>}
  </div>;
}

/** A source not created yet (a time preset): a grey one-line card that can be dragged onto the canvas, closed and
 * without count or menu (human 2026-10-09). 還沒建立的來源（時間）：灰色的一行卡片，可以拖到畫布；不展開、沒有數量與選單（人類）。 */
export function UnusedCard({ choice, title, children }: { choice: string; title?: string; children: ReactNode }) {
  return <div className="source-card unused" title={title} {...useDragToCanvas(choice)}>
    <span className="expand-toggle" aria-hidden="true" />{children}</div>;
}
