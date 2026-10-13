import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { getNodesBounds, useReactFlow, useStore, ViewportPortal, type NodePositionChange, type Rect } from '@xyflow/react';
import { core, type GraphGroup } from './core';
import type { Editor as EditorSession } from './editor';
import type { MenuOpen } from './RightDragSelect';
import { pressKind } from './RightDragSelect';
import { Popover } from './controls';
import { Icon } from './icons';
import { Markdown } from './Markdown';
import { TextStyle, type TextPlace } from './TextStyle';
import { say, tr, type Message } from './text';
import { matches, withShortcut } from './shortcuts';
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
const GROUP_PAD = 24, GROUP_TITLE = 28;


/** A group's box from its members' bounds and the height of its body text. The text sits between the title and the members, so the box
 * grows upwards (Refactor.99, human 2026-10-12), or below the members, so it grows downwards (R.105.16, human 2026-10-13); the members
 * stay. 依成員範圍與內文高度算出的群組外框。內文在標題與成員之間，外框往上長（R.99，人類 10-12），或在成員下方，外框往下長（R.105.16，
 * 人類 10-13）；成員不動。 */
const groupBox = (members: Rect, text = 0, place: TextPlace = 'top'): Rect => {
  // The text block holds its own 12 above and below (Refactor.99.1, 101), so the whole band it sits in is the text's (a double-click
  // there edits it); without text, legacy's 24 on each side of the members. 內文區塊自己帶著上下各 12（R.99.1、101），它所在的那一整條
  // 都屬於內文（在那裡雙擊就編輯）；沒有內文時，成員兩側照舊產品各 24。
  const above = place === 'top' ? text || GROUP_PAD : GROUP_PAD, below = place === 'bottom' ? text || GROUP_PAD : GROUP_PAD;
  return { x: members.x - GROUP_PAD, y: members.y - above - GROUP_TITLE, width: members.width + 2 * GROUP_PAD, height: members.height + below + above + GROUP_TITLE };
};
/** Each group's measured body text height, by group ID (flow units; none = no text). 每個群組量到的內文高度（畫布單位；沒有＝沒有內文）。 */
export type TextHeights = Readonly<Record<string, number>>;
/** The selection's bounds in flow units: its nodes, and the box of every group whose members are all selected, so the
 * multi-selection frame and the floating toolbar go around it (legacy selection_ui.js:93-98; human 2026-10-12). 選取的範圍（畫布
 * 單位）：節點，加上成員全被選取的群組外框，多選框與浮動工具列才會在外面（照舊產品；人類 10-12）。 */
type Lookup = NonNullable<Parameters<typeof getNodesBounds>[1]>;
export function selectionBounds(lookup: Lookup, ids: readonly string[], groups: readonly GraphGroup[], texts: TextHeights = {}): Rect {
  const chosen = new Set(ids), boxes = [getNodesBounds([...ids], lookup),
    ...groups.filter(group => group.nodes.every(id => chosen.has(id))).map(group => groupBox(getNodesBounds(group.nodes, lookup), texts[group.id], group.textPlace))];
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
    // The selection in the graph's order, from the session's own list (Refactor.106). 照圖裡順序的選取，來自 session 自己的名單（R.106）。
    const groups = () => session?.groups() ?? [], selected = () => session?.selectedInOrder() ?? [];
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

// Memoised, as each GroupBox: a node drag re-renders the canvas every move, and a group only follows its own props and members
// (deep clean 2026-10-12: every box re-rendered on every drag frame). memo，每個 GroupBox 也是：拖節點時畫布每動一下都重繪，群組只跟著自己
// 的 props 與成員（10-12 深度清潔：原本每一格都重繪所有群組框）。
export const GroupLayer = memo(function GroupLayer({ groups, selected, session, actions, snap, grid, onMenu, texts, onText }: {
  groups: readonly GraphGroup[]; selected: ReadonlySet<string>; session: EditorSession; actions: GroupActions; snap: boolean; grid: number;
  onMenu(open: MenuOpen): void; texts: TextHeights;
  /** Reports the text's height; none when the text does not make the box taller (the gear). 回報內文高度；內文不撐高外框時（齒輪）不給。 */
  onText?(id: string, height: number): void;
}) {
  return <ViewportPortal>{groups.map(group => <GroupBox key={group.id} group={group} session={session} actions={actions} snap={snap} grid={grid}
    onMenu={onMenu} complete={group.nodes.every(id => selected.has(id))} text={texts[group.id] ?? 0} onText={onText} />)}</ViewportPortal>;
});

type Move = { pointer: number; x: number; y: number; zoom: number; start: Map<string, { x: number; y: number }>; moved: boolean };
const THRESHOLD = 3;

const GroupBox = memo(function GroupBox({ group, session, actions, snap, grid, complete, onMenu, text, onText }: {
  group: GraphGroup; session: EditorSession; actions: GroupActions; snap: boolean; grid: number; complete: boolean; onMenu(open: MenuOpen): void;
  text: number; onText?(id: string, height: number): void;
}) {
  const flow = useReactFlow(), move = useRef<Move | null>(null), [palette, setPalette] = useState<HTMLElement | null>(null);
  // The body text (Refactor.99): edited from the pencil, measured only when it or the box's width changes, never when other nodes move
  // or the view pans (human 2026-10-12). 內文（R.99）：按鉛筆編輯；只在內文或外框寬度改變時量，其他節點移動、平移都不量（人類 10-12）。
  const [writing, setWriting] = useState(false), block = useRef<HTMLDivElement>(null), area = useRef<HTMLTextAreaElement | null>(null);
  // The text appearance panel, from the T that takes the pencil's place while writing (Refactor.101). 文字外觀面板，從寫的時候取代鉛筆的 T 打開（R.101）。
  const [styling, setStyling] = useState<HTMLElement | null>(null), [previewScale, setPreviewScale] = useState<number | null>(null);
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
  // Only this group's members: other nodes moving, panning and zooming leave the key as it is, so the box is not drawn again (the
  // selector itself still runs on each store update). 只看這個群組的成員：其他節點移動、平移、縮放都不會改變這個值，外框就不重畫（選擇器
  // 本身在每次 store 更新時仍會跑）。
  const key = useStore(state => { const box = getNodesBounds(group.nodes, { nodeLookup: state.nodeLookup }); return [box.x, box.y, box.width, box.height].map(Math.round).join(','); });
  const renaming = actions.renaming === group.id;
  const place = (positions: Map<string, { x: number; y: number }>, dragging: boolean) =>
    session.nodeChanges([...positions].map(([id, position]): NodePositionChange => ({ type: 'position', id, position, dragging })));
  // Put back where the drag began and let go there: the document still holds those places, so no Undo step is made, and the nodes
  // are no longer marked as dragged. 放回拖曳開始的位置並在那裡放開：文件裡本來就是那些位置，不會多一步復原，節點也不再標成拖曳中。
  const back = () => { const start = move.current; move.current = null; if (start?.moved) place(start.start, false); };
  const backNow = useRef(back); backNow.current = back;
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (move.current && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); backNow.current(); } };
    addEventListener('keydown', key, true);
    return () => removeEventListener('keydown', key, true);
  }, []);
  const [x, y, width, height] = key.split(',').map(Number) as [number, number, number, number];
  const textPlace = group.textPlace ?? 'top', box = groupBox({ x, y, width, height }, text, textPlace), style = { '--group-color': group.color ?? DEFAULT_COLOR } as CSSProperties;
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
  const button = (label: Message, icon: 'pencil' | 'close', run: () => void) => <button type="button" className="group-button"
    aria-label={say(label)} title={say(label)} onClick={run}><Icon name={icon} /></button>;
  // Saved on leaving the field or with Ctrl+Enter, Esc puts it back (as the node's note, ParamsPanel.tsx; legacy textApply).
  // 離開欄位或 Ctrl＋Enter 存，Esc 還原（同節點的註記；照舊產品）。
  const write = (value: string | null) => {
    setWriting(false); setStyling(null);
    if (value !== null && value !== (group.text ?? '')) session.changeGroup(group.id, { text: value });
  };
  // Going to the T or its panel is not leaving the text (Refactor.101); closing the panel anywhere but the text ends the writing, as a
  // click outside does. 移到 T 或它的面板不算離開內文（R.101）；在內文以外的地方關掉面板就結束編輯，同點外面。
  const inStyle = (element: EventTarget | null) => !!(element as Element | null)?.closest?.('.group-text-style-panel, .group-text-style');
  const closeStyle = () => { setStyling(null); setPreviewScale(null); setTimeout(() => { if (area.current && document.activeElement !== area.current) write(area.current.value); }); };
  // The T closes its panel back to the text, still writing. 按 T 關掉面板回到內文，繼續寫。
  const toggleStyle = (anchor: HTMLElement) => {
    if (!styling) { setStyling(anchor); return; }
    setStyling(null); setPreviewScale(null); area.current?.focus();
  };
  // The field is as tall as its text: fitted when writing starts and when its size, alignment or width changes, and as it is typed in.
  // 輸入框和內文一樣高：開始寫、大小、對齊或寬度改變時重新量，打字時也量。
  const fit = (field: HTMLTextAreaElement) => { field.style.height = 'auto'; field.style.height = field.scrollHeight + 'px'; };
  // While the size is dragged it shows at once, stored only when let go (Refactor.101.1). 拖曳大小時立刻顯示，放開才存（R.101.1）。
  const look = { '--text-scale': previewScale ?? group.textScale ?? 1, textAlign: group.textAlign ?? 'left' } as CSSProperties;
  useLayoutEffect(() => { if (area.current) fit(area.current); }, [writing, previewScale, group.textScale, group.textAlign, box.width]);
  return <>
    <div className={'group-body' + (complete ? ' selected' : '')} style={{ ...style, transform: `translate(${box.x}px, ${box.y}px)`, width: box.width, height: box.height }} />
    {/* Under the title, above the members — or right below the members (R.105.16); it takes room at once when the pencil is pressed and
        grows with what is written (human 2026-10-12). 在標題下、成員上——或緊接在成員下面（R.105.16）；按鉛筆立刻有空間，隨寫的內容長高（人類 10-12）。 */}
    {/* A double-click on the text edits it (Refactor.101, human 2026-10-12: the band of the text, so the rest of the box stays canvas).
        雙擊內文就編輯（R.101，人類：內文那一條，框裡其他地方仍是畫布）。 */}
    {shown && <div ref={block} className={'group-text' + (writing ? ' writing' : '')} data-align={group.textAlign ?? 'left'}
      style={{ ...look, transform: `translate(${box.x + GROUP_PAD}px, ${textPlace === 'top' ? box.y + GROUP_TITLE : y + height}px)`, width: box.width - 2 * GROUP_PAD }}
      onDoubleClick={event => { if (writing || (event.target as Element).closest('a')) return; event.stopPropagation(); setWriting(true); }}>
      {writing ? <textarea className="nodrag nopan" defaultValue={group.text ?? ''} autoFocus rows={1} maxLength={core.groups.GROUP_TEXT_LIMIT}
        aria-label={say(tr('group.text', 'Group text'))}
        ref={area} onInput={event => fit(event.currentTarget)}
        onBlur={event => { if (!inStyle(event.relatedTarget)) write(event.currentTarget.value); }}
        onKeyDown={event => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); event.currentTarget.blur(); }
          else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); write(null); }
        }} />
        : <Markdown text={group.text ?? ''} />}
    </div>}
    <div className="group-title nopan nodrag" data-movable="" role="group" tabIndex={0} aria-label={group.name} style={{ ...style, transform: `translate(${box.x}px, ${box.y}px)`, width: box.width, height: GROUP_TITLE }}
      onPointerDown={down} onPointerMove={drag} onPointerUp={up} onPointerCancel={back} onLostPointerCapture={() => { if (move.current) back(); }}
      onDoubleClick={event => { if (!(event.target as Element).closest('button')) actions.setRenaming(group.id); }}
      onKeyDown={event => { if (matches('renameGroup', event) && !renaming) { event.preventDefault(); actions.setRenaming(group.id); } }}
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
        : <span className="group-name" title={withShortcut(say(tr('group.renameHint', 'Double-click to rename')), 'renameGroup')}>{group.name}</span>}
      <button type="button" className="group-color" aria-label={say(tr('group.color', 'Group color'))} title={say(tr('group.color', 'Group color'))}
        aria-haspopup="dialog" aria-expanded={!!palette} onClick={event => setPalette(palette ? null : event.currentTarget)} />
      {/* The pencil edits the body text (human 2026-10-12: renaming is the title's double-click); while writing, a T in its place opens
          the text's appearance (Refactor.101, human: keeps the title bar as it is; whether the T stays there for good, later). Pressing it
          keeps the field focused. 鉛筆編輯內文（人類 10-12：改名用雙擊標題）；寫的時候它的位置換成 T，打開文字外觀（R.101，人類：標題列維持原樣；
          T 要不要常駐之後再定）。按它不讓輸入框失去焦點。 */}
      {writing ? <button type="button" className="group-button group-text-style" aria-label={say(tr('group.textStyle', 'Text appearance'))}
        title={say(tr('group.textStyle', 'Text appearance'))} aria-haspopup="dialog" aria-expanded={!!styling}
        onMouseDown={event => event.preventDefault()} onClick={event => toggleStyle(event.currentTarget)}><Icon name="text" /></button>
        : button(tr('group.editText', 'Edit text'), 'pencil', () => setWriting(true))}
      {button(tr('group.remove', 'Remove group (keep nodes)'), 'close', () => session.removeGroup(group.id))}
    </div>
    {/* Drawn at the page level: inside the moving view a fixed box would follow its transform (as DropdownMenu). 畫在頁面層：在會動的
        畫面裡，固定位置的框會跟著它的變形（同 DropdownMenu）。 */}
    {palette && createPortal(<Popover anchor={palette} label={tr('group.color', 'Group color')} className="group-palette" onClose={() => setPalette(null)}>
      {GROUP_COLORS.map(color => <button key={color.value} type="button" className="group-swatch" style={{ '--group-color': color.value } as CSSProperties}
        aria-label={say(color.name)} title={say(color.name)} aria-pressed={(group.color ?? DEFAULT_COLOR) === color.value}
        onClick={() => { setPalette(null); session.changeGroup(group.id, { color: color.value }); }} />)}
    </Popover>, document.body)}
    {styling && createPortal(<Popover anchor={styling} label={tr('group.textStyle', 'Text appearance')} className="group-text-style-panel" onClose={closeStyle}>
      <TextStyle scale={group.textScale ?? 1} align={group.textAlign ?? 'left'} place={textPlace}
        onScale={textScale => session.changeGroup(group.id, { textScale })} onAlign={textAlign => session.changeGroup(group.id, { textAlign })}
        onPlace={next => session.changeGroup(group.id, { textPlace: next })}
        onPreview={setPreviewScale} />
    </Popover>, document.body)}
  </>;
});
