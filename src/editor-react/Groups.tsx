import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { getNodesBounds, useReactFlow, useStore, ViewportPortal, type NodePositionChange, type Rect } from '@xyflow/react';
import { core, type GraphGroup } from './core';
import type { Editor as EditorSession } from './editor';
import type { MenuOpen } from './RightDragSelect';
import { pressKind } from './RightDragSelect';
import { Popover } from './controls';
import { Icon } from './icons';
import { say, tr, type Message } from './text';
import { GROUP_COLORS, DEFAULT_GROUP_COLOR as DEFAULT_COLOR } from './group_colors';

// Groups on the canvas (Refactor.98; design-interview G-3; legacy frames_ui.js, style.css:968-1001). A group's box is worked out
// from its members as React Flow measured them and never stored; each box watches only its own members, so panning, zooming or
// moving other nodes does not work it out again (human 2026-10-12). Layers as legacy: the body behind the wires, the title above
// them and below the nodes (nodes are one layer up, projection.ts). The title selects the members (a modifier toggles them), drags
// them (one Undo), renames on a double-click or F2, recolours from its dot, and removes the group (× keeps the nodes); a right-click
// selects the members and opens the menu of a selection (human 2026-10-12: legacy showed the browser's menu, which was wrong).
// 畫布上的群組（R.98；G-3；照舊產品）。外框依 React Flow 量到的成員算出、從不儲存；每個框只盯著自己的成員，平移、縮放或移動其他節點都
// 不重算（人類 10-12）。層次照舊產品：框身在線後面，標題在線前面、節點後面（節點在第 1 層，projection.ts）。標題：選取成員（修飾鍵切換）、
// 拖曳搬移（一步復原）、雙擊或 F2 改名、色點改色、× 拿掉群組（節點留著）；右鍵選取成員、打開多選的右鍵選單（人類 10-12：舊產品跳出
// 瀏覽器選單是錯的）。

/** Around the members, and the title bar above them, in flow units: the box scales with the view as nodes do (legacy frames_ui.js:2).
 * 成員四周的空間與上方的標題列，畫布單位：外框和節點一樣跟著縮放（照舊產品）。 */
export const GROUP_PAD = 24, GROUP_TITLE = 28;


/** A group's box from its members' bounds and the height of its body text, which sits between the title and the members, so the box
 * grows upwards and the members stay (Refactor.99, human 2026-10-12). 依成員範圍與內文高度算出的群組外框；內文在標題與成員之間，所以外框
 * 往上長、成員不動（R.99，人類 10-12）。 */
export const groupBox = (members: Rect, text = 0): Rect =>
  ({ x: members.x - GROUP_PAD, y: members.y - GROUP_PAD - text - GROUP_TITLE, width: members.width + 2 * GROUP_PAD, height: members.height + 2 * GROUP_PAD + text + GROUP_TITLE });
/** Each group's measured body text height, by group ID (flow units; none = no text). 每個群組量到的內文高度（畫布單位；沒有＝沒有內文）。 */
export type TextHeights = Readonly<Record<string, number>>;
/** The selection's bounds in flow units: its nodes, and the box of every group whose members are all selected, so the
 * multi-selection frame and the floating toolbar go around it (legacy selection_ui.js:93-98; human 2026-10-12). 選取的範圍（畫布
 * 單位）：節點，加上成員全被選取的群組外框，多選框與浮動工具列才會在外面（照舊產品；人類 10-12）。 */
type Lookup = NonNullable<Parameters<typeof getNodesBounds>[1]>;
export function selectionBounds(lookup: Lookup, ids: readonly string[], groups: readonly GraphGroup[], texts: TextHeights = {}): Rect {
  const chosen = new Set(ids), boxes = [getNodesBounds([...ids], lookup),
    ...groups.filter(group => group.nodes.every(id => chosen.has(id))).map(group => groupBox(getNodesBounds(group.nodes, lookup), texts[group.id]))];
  const left = Math.min(...boxes.map(box => box.x)), top = Math.min(...boxes.map(box => box.y));
  return { x: left, y: top, width: Math.max(...boxes.map(box => box.x + box.width)) - left, height: Math.max(...boxes.map(box => box.y + box.height)) - top };
}

/** What the menus, the toolbar and the keys do with groups; held by the page so a new group opens for renaming (legacy
 * frames_ui.js:55-62). 選單、工具列、按鍵對群組做的事；由頁面保管，新群組才能直接進入改名（照舊產品）。 */
export type GroupActions = {
  canCreate(ids: readonly string[]): boolean; joinTarget(ids: readonly string[]): GraphGroup | null; inGroup(ids: readonly string[]): boolean;
  create(): void; join(): void; leave(): void;
  renaming: string | null; setRenaming(id: string | null): void;
};
export function useGroupActions(session: EditorSession | null): GroupActions {
  const [renaming, setRenaming] = useState<string | null>(null);
  return useMemo(() => {
    const groups = () => session?.groups() ?? [], selected = () => session?.snapshot().projection.nodes.filter(node => node.selected).map(node => node.id) ?? [];
    return {
      canCreate: ids => core.groups.canGroup(groups(), ids), joinTarget: ids => core.groups.joinTarget(groups(), ids),
      inGroup: ids => core.groups.inAnyGroup(groups(), ids),
      // Named "Group N", the first free N, in every language (legacy frames_ui.js:58; Refactor.98.1, human 2026-10-12: a name is data in
      // the graph, so the interface language must not change it, as node names). 名字是「Group N」、取第一個沒人用的 N，每種語言都一樣
      // （照舊產品；R.98.1，人類：名字是圖裡的資料，不該因為介面語言而變，同節點名稱）。
      create: () => {
        if (!session) return;
        const names = new Set(groups().map(group => group.name)), base = 'Group';
        let n = 1; while (names.has(base + ' ' + n)) n++;
        const id = session.createGroup(selected(), base + ' ' + n);
        if (id) setRenaming(id);
      },
      join: () => session?.joinGroup(selected()), leave: () => session?.leaveGroups(selected()),
      renaming, setRenaming,
    };
  }, [session, renaming]);
}

export function GroupLayer({ groups, selected, session, actions, snap, grid, onMenu, texts, onText }: {
  groups: readonly GraphGroup[]; selected: ReadonlySet<string>; session: EditorSession; actions: GroupActions; snap: boolean; grid: number;
  onMenu(open: MenuOpen): void; texts: TextHeights;
  /** Reports the text's height; none when the text does not make the box taller (the gear). 回報內文高度；內文不撐高外框時（齒輪）不給。 */
  onText?(id: string, height: number): void;
}) {
  return <ViewportPortal>{groups.map(group => <GroupBox key={group.id} group={group} session={session} actions={actions} snap={snap} grid={grid}
    onMenu={onMenu} complete={group.nodes.every(id => selected.has(id))} text={texts[group.id] ?? 0} onText={onText} />)}</ViewportPortal>;
}

type Move = { pointer: number; x: number; y: number; zoom: number; start: Map<string, { x: number; y: number }>; moved: boolean };
const THRESHOLD = 3;

function GroupBox({ group, session, actions, snap, grid, complete, onMenu, text, onText }: {
  group: GraphGroup; session: EditorSession; actions: GroupActions; snap: boolean; grid: number; complete: boolean; onMenu(open: MenuOpen): void;
  text: number; onText?(id: string, height: number): void;
}) {
  const flow = useReactFlow(), move = useRef<Move | null>(null), [palette, setPalette] = useState<HTMLElement | null>(null);
  // The body text (Refactor.99): edited from the pencil, measured only when it or the box's width changes, never when other nodes move
  // or the view pans (human 2026-10-12). 內文（R.99）：按鉛筆編輯；只在內文或外框寬度改變時量，其他節點移動、平移都不量（人類 10-12）。
  const [writing, setWriting] = useState(false), block = useRef<HTMLDivElement>(null);
  const shown = writing || !!group.text;
  // Measured only while the text makes the box taller (the gear); otherwise it sits in the room under the title. 只在內文撐高外框時
  // （齒輪）量；否則放在標題下原本的空間。
  useLayoutEffect(() => {
    const element = block.current;
    if (!onText) return;
    if (!element) { onText(group.id, 0); return; }
    const measure = () => onText(group.id, element.offsetHeight);
    measure();
    const watch = new ResizeObserver(measure); watch.observe(element);
    return () => { watch.disconnect(); onText(group.id, 0); };
  }, [shown, group.id, onText]);
  // Only this group's members: other nodes moving, panning and zooming leave the key as it is. 只看這個群組的成員：其他節點移動、平移、
  // 縮放都不會改變這個值。
  const key = useStore(state => { const box = getNodesBounds(group.nodes, { nodeLookup: state.nodeLookup }); return [box.x, box.y, box.width, box.height].map(Math.round).join(','); });
  const renaming = actions.renaming === group.id;
  const place = (positions: Map<string, { x: number; y: number }>, dragging: boolean) =>
    session.nodeChanges([...positions].map(([id, position]): NodePositionChange => ({ type: 'position', id, position, dragging })));
  const back = () => { const start = move.current; move.current = null; if (start?.moved) place(start.start, true); };
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (move.current && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); back(); } };
    addEventListener('keydown', key, true);
    return () => removeEventListener('keydown', key, true);
  });
  const [x, y, width, height] = key.split(',').map(Number) as [number, number, number, number];
  const box = groupBox({ x, y, width, height }, text), style = { '--group-color': group.color ?? DEFAULT_COLOR } as CSSProperties;
  // Pressing the title selects the members (legacy frames_ui.js:203); a modifier only toggles them, without a drag (graph_ui.js:1433).
  // 按下標題選取成員（照舊產品）；按著修飾鍵只切換、不拖（照舊產品）。
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as Element).closest('button, input')) return;
    const how = pressKind(event);
    session.selectGroup(group.id, how);
    if (how !== 'only') return;
    const start = new Map(group.nodes.flatMap(id => { const node = flow.getInternalNode(id); return node ? [[id, { ...node.position }] as const] : []; }));
    move.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, zoom: flow.getZoom(), start, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  // The members move together; with Snap on, the first one lands on the grid and the others keep their places to it (legacy
  // frames_ui.js:218). 成員一起移動；Snap 開著時第一個對齊格線、其他保持相對位置（照舊產品）。
  const moved = (event: PointerEvent<HTMLDivElement>, dragging: boolean) => {
    const start = move.current!;
    let dx = (event.clientX - start.x) / start.zoom, dy = (event.clientY - start.y) / start.zoom;
    const first = start.start.values().next().value;
    if (snap && first) { dx = Math.round((first.x + dx) / grid) * grid - first.x; dy = Math.round((first.y + dy) / grid) * grid - first.y; }
    place(new Map([...start.start].map(([id, p]) => [id, { x: p.x + dx, y: p.y + dy }])), dragging);
  };
  const drag = (event: PointerEvent<HTMLDivElement>) => {
    const start = move.current;
    if (!start || event.pointerId !== start.pointer) return;
    if (!start.moved && Math.hypot(event.clientX - start.x, event.clientY - start.y) < THRESHOLD) return;
    start.moved = true; moved(event, true);
  };
  const up = (event: PointerEvent<HTMLDivElement>) => {
    const start = move.current;
    if (!start || event.pointerId !== start.pointer) return;
    if (start.moved) moved(event, false);
    move.current = null;
  };
  const rename = (name: string) => {
    actions.setRenaming(null);
    const next = name.trim();
    if (next === group.name) return;
    if (!core.groups.validGroupName(next)) { session.warn(tr('group.invalidName', 'Use 1–80 characters without control characters.')); return; }
    session.changeGroup(group.id, { name: next });
  };
  const button = (label: Message, icon: 'pencil' | 'close', run: () => void, pressed?: boolean) => <button type="button" className="group-button"
    aria-label={say(label)} title={say(label)} aria-pressed={pressed} onClick={run}><Icon name={icon} /></button>;
  // Saved on leaving the field or with Ctrl+Enter, Esc puts it back (as the node's note, ParamsPanel.tsx; legacy textApply).
  // 離開欄位或 Ctrl＋Enter 存，Esc 還原（同節點的註記；照舊產品）。
  const write = (value: string | null) => {
    setWriting(false);
    if (value !== null && value !== (group.text ?? '')) session.changeGroup(group.id, { text: value });
  };
  return <>
    <div className={'group-body' + (complete ? ' selected' : '')} style={{ ...style, transform: `translate(${box.x}px, ${box.y}px)`, width: box.width, height: box.height }} />
    {/* Under the title, above the members; one line at once when the pencil is pressed, a line more for every line break (human
        2026-10-12). 在標題下、成員上；按鉛筆立刻多一行，每換一行多一行（人類 10-12）。 */}
    {shown && <div ref={block} className={'group-text' + (writing ? ' writing' : '')}
      style={{ transform: `translate(${box.x + GROUP_PAD}px, ${box.y + GROUP_TITLE}px)`, width: box.width - 2 * GROUP_PAD }}>
      {writing ? <textarea className="nodrag nopan" defaultValue={group.text ?? ''} autoFocus rows={1} maxLength={core.groups.GROUP_TEXT_LIMIT}
        aria-label={say(tr('group.text', 'Group text'))}
        ref={area => { if (area) { area.style.height = 'auto'; area.style.height = area.scrollHeight + 'px'; } }}
        onInput={event => { const area = event.currentTarget; area.style.height = 'auto'; area.style.height = area.scrollHeight + 'px'; }}
        onBlur={event => write(event.currentTarget.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); event.currentTarget.blur(); }
          else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); write(null); }
        }} />
        : group.text}
    </div>}
    <div className="group-title nopan nodrag" role="group" tabIndex={0} aria-label={group.name} style={{ ...style, transform: `translate(${box.x}px, ${box.y}px)`, width: box.width, height: GROUP_TITLE }}
      onPointerDown={down} onPointerMove={drag} onPointerUp={up} onPointerCancel={back} onLostPointerCapture={() => { if (move.current) back(); }}
      onDoubleClick={event => { if (!(event.target as Element).closest('button')) actions.setRenaming(group.id); }}
      onKeyDown={event => { if (event.key === 'F2' && !renaming) { event.preventDefault(); actions.setRenaming(group.id); } }}
      // The menu of a selection, for the members (human 2026-10-12). 對著成員的多選右鍵選單（人類 10-12）。
      onContextMenu={event => {
        event.preventDefault(); event.stopPropagation();
        session.selectGroup(group.id, 'only');
        const host = (event.currentTarget.closest('.right-select-host') as HTMLElement | null);
        if (host) onMenu({ x: event.clientX, y: event.clientY, touch: false, host });
      }}>
      {renaming ? <input className="group-name-input" defaultValue={group.name} maxLength={core.groups.GROUP_NAME_LIMIT} autoFocus aria-label={say(tr('group.name', 'Group name'))}
        onFocus={event => event.currentTarget.select()} onBlur={event => rename(event.currentTarget.value)}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.preventDefault(); actions.setRenaming(null); } }} />
        : <span className="group-name" title={say(tr('group.renameHint', 'Double-click or F2 to rename'))}>{group.name}</span>}
      <button type="button" className="group-color" aria-label={say(tr('group.color', 'Group color'))} title={say(tr('group.color', 'Group color'))}
        aria-haspopup="dialog" aria-expanded={!!palette} onClick={event => setPalette(palette ? null : event.currentTarget)} />
      {/* The pencil edits the body text (human 2026-10-12: renaming is the title's double-click). 鉛筆編輯內文（人類 10-12：改名用雙擊標題）。 */}
      {button(tr('group.editText', 'Edit text'), 'pencil', () => setWriting(true), writing)}
      {button(tr('group.remove', 'Remove group (keep nodes)'), 'close', () => session.removeGroup(group.id))}
    </div>
    {/* Drawn at the page level: inside the moving view a fixed box would follow its transform (as DropdownMenu). 畫在頁面層：在會動的
        畫面裡，固定位置的框會跟著它的變形（同 DropdownMenu）。 */}
    {palette && createPortal(<Popover anchor={palette} label={tr('group.color', 'Group color')} className="group-palette" onClose={() => setPalette(null)}>
      {GROUP_COLORS.map(color => <button key={color.value} type="button" className="group-swatch" style={{ '--group-color': color.value } as CSSProperties}
        aria-label={say(color.name)} title={say(color.name)} aria-pressed={(group.color ?? DEFAULT_COLOR) === color.value}
        onClick={() => { setPalette(null); session.changeGroup(group.id, { color: color.value }); }} />)}
    </Popover>, document.body)}
  </>;
}
