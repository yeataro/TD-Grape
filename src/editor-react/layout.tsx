import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode,
  type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { say, tr, type Message } from './text';
import { PANELS } from './panels';
import { readPreference, writePreference } from './preferences';
import { DropdownMenu, type MenuItem } from './DropdownMenu';
import { Icon } from './icons';
import * as tree from './layout_tree';
import type { Drop, Edge, LayoutData, Pane, Path, Side } from './layout_tree';

// The editor's layout on screen (Refactor.53, 68; work/in-place-refactor-design/layout-tree.md): the tree of panes
// (layout_tree.ts) drawn between the title bar and the foot bar, its handles, moving panels by their tabs, and the Layout
// menu. The layout is a personal preference: kept in this browser, never in the project or the graph. A panel is only
// content; panes and tabs are this file's (design-interview Q47 5a: the shell changes, the content does not). Content
// comes from whoever draws the layout (the view being edited, Q47 4), never from globals.
// 畫面上的版面：窗格樹（layout_tree.ts）畫在標題列與底列之間、把手、拖分頁搬面板、Layout 選單。版面是個人偏好，只存在
// 這個瀏覽器，不進專案或圖。面板只是內容；窗格與分頁歸這個檔管（Q47 5a：換殼不換內容）。內容由畫版面的畫面提供，不讀全域。

export type { Side } from './layout_tree';
/** What a tab pane shows for one panel. 一個面板在分頁窗格裡顯示什麼。 */
/** A panel as the layout sees it: its name, its content, and its own menu if it has one (Refactor.83): the panel decides the items,
 * the layout only gives them a place. 版面看到的面板：名字、內容，以及它自己的選單（R.83）：項目由面板決定，版面只給位置。 */
export type PanelView = { title: Message; content: ReactNode; menu?: () => readonly MenuItem[] };

const defaults: tree.PanelDefaults = (Object.entries(PANELS) as [string, { side: Side; first?: true }][]).map(([id, row]) => [id, row.side, !!row.first]);
function stored(): LayoutData {
  try { return tree.readLayout(JSON.parse(readPreference('layout') ?? 'null'), defaults); }
  catch { return tree.defaultLayout(defaults); }
}

export type Layout = LayoutData & {
  toggleTitleBar(): void; toggleSide(side: Side): void; closeSide(side: Side): void;
  /** Whether a side has panels to show (its toggle is greyed out otherwise). 那一側有沒有面板可顯示。 */
  hasPanels(side: Side): boolean;
  /** Bring a panel forward: shown, its tab chosen, its side opened. 把面板叫到前面：顯示、選中、打開所在那一側。 */
  show(id: string): void; togglePanel(id: string): void; reset(): void;
  activate(path: Path, id: string): void; resize(path: Path, sizes: number[]): void; move(id: string, drop: Drop): void;
  /** Collapse a stacked tab pane to its tab bar, or open it (Refactor.80). 把疊著的分頁窗格收成分頁列，或打開（R.80）。 */
  collapse(path: Path, collapsed: boolean): void;
};
export function useLayout(): Layout {
  const [data, setData] = useState(stored);
  // Written shortly after the last change, so dragging a handle does not write on every move.
  // 停止變動後才寫入，拖把手時不會每一步都寫。
  useEffect(() => {
    const timer = setTimeout(() => writePreference('layout', JSON.stringify(data)), 250);
    return () => clearTimeout(timer);
  }, [data]);
  return useMemo(() => ({ ...data,
    toggleTitleBar: () => setData(old => ({ ...old, titleBar: !old.titleBar })),
    toggleSide: side => setData(old => ({ ...old, closed: { ...old.closed, [side]: !old.closed[side] } })),
    closeSide: side => setData(old => old.closed[side] ? old : { ...old, closed: { ...old.closed, [side]: true } }),
    hasPanels: side => tree.sideHasPanels(data, side),
    show: id => setData(old => tree.showPanel(old, id)),
    togglePanel: id => setData(old => old.hidden.includes(id) ? tree.showPanel(old, id) : tree.hidePanel(old, id)),
    reset: () => setData(old => ({ ...tree.defaultLayout(defaults), titleBar: old.titleBar })),
    activate: (path, id) => setData(old => tree.activate(old, path, id)),
    resize: (path, sizes) => setData(old => tree.resize(old, path, sizes)),
    move: (id, drop) => setData(old => tree.movePanel(old, id, drop)),
    collapse: (path, collapsed) => setData(old => tree.setCollapsed(old, path, collapsed)),
  }), [data]);
}

/** A drag handle: drawn thin, grabbed by a wider area (human 2026-10-09). Reports the distance moved. `edge` puts it on the
 * leading or trailing edge of the part it belongs to. 把手：畫得細、可抓範圍寬（人類）。回報拖了多遠；edge＝放在所屬那一格的前緣或後緣。 */
export function ResizeHandle({ axis, edge = 'lead', label, onStart, onMove }: {
  axis: 'x' | 'y'; edge?: 'lead' | 'trail'; label: Message; onStart(): void; onMove(delta: number): void;
}) {
  const start = useRef<number | null>(null);
  const down = (event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    start.current = axis === 'x' ? event.clientX : event.clientY; onStart();
  };
  const move = (event: ReactPointerEvent) => {
    if (start.current === null) return;
    onMove((axis === 'x' ? event.clientX : event.clientY) - start.current);
  };
  const up = () => { start.current = null; };
  return <div className={'resize-handle resize-' + axis + ' ' + edge} role="separator" aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
    aria-label={say(label)} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />;
}

type Drag = (event: ReactPointerEvent, panel: string) => void;
const DragContext = createContext<MutableRefObject<Drag>>({ current: () => {} });
type Context = { layout: Layout; panels: Record<string, PanelView>; canvas: HTMLElement };

/** The whole layout: the tree, and the marks shown while a panel is moved. The network is drawn once, into its own
 * element, which is moved into whichever pane holds the canvas: it is never rebuilt, whatever the layout becomes around it
 * (R.68.4: the canvas can now sit inside any split). 整個版面：窗格樹，以及搬面板時的提示。網路區只畫一次，畫進自己的元素，
 * 再把這個元素搬進放畫布的那一格：版面怎麼變都不會重新建立（R.68.4：畫布現在可以在任何分割裡）。 */
export function LayoutView({ layout, panels, canvas }: { layout: Layout; panels: Record<string, PanelView>; canvas: ReactNode }) {
  const drag = useRef<Drag>(() => {});
  const host = useMemo(() => Object.assign(document.createElement('div'), { className: 'canvas-host' }), []);
  return <DragContext.Provider value={drag}>
    <PaneView pane={layout.root} path={[]} context={{ layout, panels, canvas: host }} />
    {createPortal(canvas, host)}
    <PanelDrag layout={layout} panels={panels} start={drag} />
  </DragContext.Provider>;
}

function PaneView({ pane, path, context }: { pane: Pane; path: number[]; context: Context }): ReactNode {
  if (pane.kind === 'canvas') return <CanvasHole host={context.canvas} />;
  if (pane.kind === 'tabs') return <TabPaneView pane={pane} path={path} context={context} stacked={tree.stacked(context.layout.root, path)} />;
  return <SplitPaneView pane={pane} path={path} context={context} />;
}
/** Where the network's element is put. 放網路區元素的地方。 */
function CanvasHole({ host }: { host: HTMLElement }) {
  const hole = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { hole.current!.append(host); }, [host]);
  return <div ref={hole} className="canvas-hole" />;
}

// A part keeps its identity while its neighbours change: the canvas's part always, a pane by the panels it holds.
// 一格在旁邊變動時保持身分：畫布那一格永遠是同一個，窗格以它放的面板認。
const keyOf = (pane: Pane) => tree.hasCanvas(pane) ? 'canvas'
  : 'p:' + tree.tabPanes(pane).flatMap(found => found.pane.panels).join(',');

function SplitPaneView({ pane, path, context }: { pane: Extract<Pane, { kind: 'split' }>; path: number[]; context: Context }) {
  const { layout } = context, root = !path.length, element = useRef<HTMLDivElement>(null);
  const holdsCanvas = tree.hasCanvas(pane), centre = pane.children.findIndex(tree.hasCanvas), row = pane.direction === 'row';
  const closed = (index: number) => { const side = root ? tree.sideOf(layout.root, index) : null; return !!side && layout.closed[side]; };
  const visible = pane.children.map((child, index) => ({ child, index })).filter(({ child, index }) => tree.shown(child, layout.hidden) && !closed(index));
  const begin = useRef({ sizes: [] as number[], limit: 0, total: 0, across: 1 });
  const length = () => (row ? element.current?.clientWidth : element.current?.clientHeight) || 1;
  // Next to the canvas, a part is pixels: it stays between its minimum and what leaves the canvas its own; elsewhere parts
  // share the length and none goes below a pane's minimum. 畫布旁的一格是像素：不小於最小值、也要留給畫布它的最小值；其他地方平分長度。
  const startPixels = (index: number) => {
    const others = visible.filter(part => part.index !== index && part.index !== centre).reduce((sum, part) => sum + (pane.sizes[part.index] ?? 0), 0);
    begin.current = { sizes: [...pane.sizes], total: 0, across: 1,
      limit: Math.min(row ? tree.SIDE_MAX : Infinity, length() - others - (row ? tree.CANVAS_MIN_WIDTH : tree.CANVAS_MIN_HEIGHT)) };
  };
  const movePixels = (index: number, delta: number) => {
    const sizes = [...begin.current.sizes], minimum = row ? tree.SIDE_MIN : tree.PANE_MIN;
    sizes[index] = Math.round(Math.max(minimum, Math.min(Math.max(minimum, begin.current.limit), begin.current.sizes[index]! + delta)));
    layout.resize(path, sizes);
  };
  // The length is measured once, at the start of a drag (EDITOR_UI_RULES, continuous interactions). 長度在拖曳開始時量一次。
  const startShare = () => {
    const total = visible.reduce((sum, part) => sum + (pane.sizes[part.index] ?? 1), 0), across = length();
    begin.current = { sizes: [...pane.sizes], total, across, limit: (row ? tree.PANE_MIN_WIDTH : tree.PANE_MIN) / across * total };
  };
  const moveShare = (before: number, after: number, delta: number) => {
    const { sizes: start, total, limit, across } = begin.current, next = [...start];
    const share = delta / across * total, a = start[before]!, b = start[after]!;
    const moved = Math.max(limit - a, Math.min(b - limit, share));
    next[before] = a + moved; next[after] = b - moved; layout.resize(path, next);
  };
  // The outermost row keeps the canvas its minimum whenever the layout or the window changes (layout_tree sideToClose); a
  // side that was just opened is the one that stays. 最外層在版面或視窗改變時替畫布保住最小寬度；剛打開的那一側留著。
  const wasOpen = useRef<Record<Side, boolean> | null>(null);
  useLayoutEffect(() => {
    if (!root || !element.current) return;
    const observer = new ResizeObserver(() => {
      const now = { left: tree.sideOpen(layout, 'left'), right: tree.sideOpen(layout, 'right') }, before = wasOpen.current;
      wasOpen.current = now;
      const opened = before ? (['left', 'right'] as const).find(side => now[side] && !before[side]) ?? null : null;
      const closing = tree.sideToClose(layout, element.current?.clientWidth ?? 0, opened);
      if (closing) layout.closeSide(closing);
    });
    observer.observe(element.current);
    return () => observer.disconnect();
  }, [root, layout]);
  const axis = row ? 'x' : 'y';
  const label = row ? tr('layout.resizeZone', 'Resize the panel zone') : tr('layout.resizeGroups', 'Resize the panels above and below');
  // A part next to the canvas is a panel zone, named by the canvas edge it lies on (its line and shadows); others are plain.
  // 畫布旁的一格是面板區，以它靠的畫布邊命名（分隔線與陰影）；其他是一般的格子。
  const zone = (index: number) => !holdsCanvas || index === centre ? 'pane-slot'
    : 'panel-zone panel-zone-' + (row ? (index < centre ? 'left' : 'right') : (index < centre ? 'top' : 'bottom'));
  return <div ref={element} className={'split split-' + pane.direction + (root ? ' workspace' : '')}>
    {visible.map(({ child, index }, n) => {
      const before = visible[n - 1], after = visible[n + 1];
      // A collapsed part has no height to drag, so no handle touches it (Refactor.80). 收起的一格沒有高度可拖，旁邊不放把手（R.80）。
      const folded = (part?: Pane) => part?.kind === 'tabs' && !!part.collapsed, shut = folded(child);
      // In a split with the canvas, a handle belongs to the pixel part, on its edge towards the canvas; elsewhere it sits
      // between two parts on the later one's leading edge (R.53). 含畫布時，把手屬於像素那一格、在朝畫布的邊上；其他在兩格之間、後一格的前緣。
      const lead = before && !shut && (holdsCanvas || !folded(before.child)) && (holdsCanvas ? index > centre && <ResizeHandle axis={axis} label={label}
          onStart={() => startPixels(index)} onMove={delta => movePixels(index, -delta)} />
        : <ResizeHandle axis={axis} label={label} onStart={startShare} onMove={delta => moveShare(before.index, index, delta)} />);
      const trail = after && holdsCanvas && index < centre && !shut && <ResizeHandle axis={axis} edge="trail" label={label}
        onStart={() => startPixels(index)} onMove={delta => movePixels(index, delta)} />;
      // Next to the canvas, parts give way before the canvas goes below its minimum (one side on a narrow screen).
      // 畫布旁的格子先讓，畫布不會小於最小值（窄畫面上只開一側時）。
      const flex: CSSProperties = shut ? { flex: '0 0 auto' } : !holdsCanvas ? { flex: `${pane.sizes[index] ?? 1} 1 0` } : index !== centre ? { flex: `0 1 ${pane.sizes[index]}px` }
        : { flex: '1 0 0', [row ? 'minWidth' : 'minHeight']: row ? tree.CANVAS_MIN_WIDTH : tree.CANVAS_MIN_HEIGHT };
      return <div key={keyOf(child)} className={zone(index)} style={flex} data-pane={[...path, index].join('.')} data-kind={child.kind}>
        {lead}<PaneView pane={child} path={[...path, index]} context={context} />{trail}
      </div>;
    })}
  </div>;
}

function TabPaneView({ pane, path, context, stacked }: { pane: Extract<Pane, { kind: 'tabs' }>; path: number[]; context: Context; stacked: boolean }) {
  const drag = useContext(DragContext), { layout, panels } = context;
  const ids = pane.panels.filter(id => !layout.hidden.includes(id)), active = ids.includes(pane.active) ? pane.active : ids[0]!;
  const collapsed = !!pane.collapsed;
  return <section className={'tab-pane' + (collapsed ? ' collapsed' : '')} aria-label={say(panels[active]?.title ?? '')}>
    <div className="tab-head">
      {/* Stacked in a column split, a pane collapses to its tab bar, every tab still in view; a tab opens it again (Refactor.80,
          human 2026-10-11). 疊在上下分割裡的窗格可以收成分頁列，分頁都還看得到；點分頁就再打開（R.80，人類）。 */}
      {stacked && <button type="button" className="expand-toggle pane-collapse" aria-expanded={!collapsed}
        aria-label={say(collapsed ? tr('layout.expandPane', 'Expand') : tr('layout.collapsePane', 'Collapse'))}
        title={say(collapsed ? tr('layout.expandPane', 'Expand') : tr('layout.collapsePane', 'Collapse'))}
        onClick={() => layout.collapse(path, !collapsed)}><Icon name="chevronDown" /></button>}
      {/* A tab is also the handle that moves its panel (legacy: drag the panel title). 分頁也是搬面板的把手（舊產品：拖面板標題）。 */}
      {/* The shown tab carries its panel's menu on its corner (Refactor.83, human 2026-10-11: the shown tab already takes half the bar,
          so no room is taken; legacy put a pop-out button on its tabs, inspector.js:2245). The button sits beside the tab, not in it
          (a button cannot hold one), so pressing it never starts a panel move. 選中的分頁右上角放它面板的選單（R.83，人類：選中的分頁本來
          就佔一半，不多佔空間；舊產品在分頁上放過彈出按鈕）。按鈕在分頁旁邊、不在裡面（按鈕裡不能放按鈕），按它不會開始搬面板。 */}
      <div className="panel-tabs" role="tablist">{ids.map(id => {
        const menu = id === active && !collapsed ? panels[id]?.menu : undefined;
        return <div key={id} role="presentation" className={'tab-slot' + (id === active ? ' shown' : '') + (menu ? ' with-menu' : '')}>
          <button role="tab" aria-selected={id === active} data-panel={id} className="panel-tab"
            onPointerDown={event => drag.current(event, id)} onClick={() => layout.activate(path, id)}>{say(panels[id]?.title ?? id)}</button>
          {menu && <PanelMenu title={panels[id]!.title} items={menu} />}
        </div>;
      })}</div>
    </div>
    {!collapsed && <div className="panel-content" role="tabpanel">{panels[active]?.content}</div>}
  </section>;
}

/** A panel's own menu (Refactor.83). An on/off item stays open and shows its new state at once. 面板自己的選單（R.83）。開關項目選了不關、馬上顯示新狀態。 */
function PanelMenu({ title, items }: { title: Message; items: () => readonly MenuItem[] }) {
  const [open, setOpen] = useState(false), [, redraw] = useReducer((n: number) => n + 1, 0), button = useRef<HTMLButtonElement>(null);
  const label = say(tr('layout.panelMenu', '{panel} options', { panel: say(title) }));
  return <>
    <button ref={button} type="button" className="icon-button narrow panel-menu" aria-label={label} title={label} aria-haspopup="menu"
      aria-expanded={open} onClick={() => setOpen(!open)}><Icon name="chevronDown" /></button>
    {open && button.current && <DropdownMenu anchor={button.current} label={label} onClose={() => setOpen(false)}
      items={items().map(item => ({ ...item, select: () => { item.select(); redraw(); } }))} />}
  </>;
}

// Where a panel would go, worked out from what is under the pointer (legacy inspector.js:2314; human 2026-10-10, Resolume
// Wire). Everything is allowed for now (R.68.4, human: try it all first, then decide what to limit):
// - on a tab bar: between two tabs (a line);
// - on a tab pane: near an edge (its outer 15%, at least the corner mark; whichever edge is nearest) a new pane on that edge (a line on the edge, so the
//   part of one pane next to a boundary and the part of the next mean the same boundary: "between" is easy to hit); its
//   middle joins it as a tab, at the place chosen by where the pointer is across it (slots, one per tab it will have; Wire);
// - on the canvas: its top or bottom band, a pane above or below it; its left or right part (as wide as a side, R.68.1), a
//   pane beside it, or, in the outer part when nothing shows on that side, the panel on that side itself, full height
//   (human: the two must be told apart; the line's length shows which).
// 放到哪，由游標下方是什麼決定（舊產品；人類 10-10，Resolume Wire）。目前全部開放（R.68.4，人類：先都試過再決定限制）：
// - 分頁列上：兩個分頁之間（直線）；
// - 分頁窗格：靠近邊緣（外圍 15%、至少四角標記的寬度，取最近的那條邊；R.80.2）＝在那條邊切新的一格（邊上一條線，交界兩旁都算同一個交界，「中間」好觸發）；
//   中間＝合併成分頁，位置看游標在寬度的哪一段（格子，放下後有幾個分頁就幾格；Wire）；
// - 畫布：上下帶＝畫布上方或下方切一格；左右兩塊（和側欄一樣寬，R.68.1）＝畫布旁切一格；那一側沒東西顯示時，靠外的一段＝放到那一側本身、
//   整個高度（人類：兩者要分得出來；線的長度表示是哪一種）。
// A line is drawn on the edge it marks, its width the theme's (--drop-line). 線畫在它標的那條邊上，粗細由主題決定。
// A tabbed pane's edge: a share of the pane along that axis, never less than the drop frame's corner mark (--drop-edge,
// --drop-corner; Refactor.80.2, human 2026-10-11: half of the old 30%, with today's fixed width as the least; the corner mark
// keeps its size; R.74.2 had made the edge the fixed width only).
// 分頁窗格的「邊」：那個方向的一定比例，不小於放下框四角標記的寬度（--drop-edge、--drop-corner；R.80.2，人類：以前 30% 的一半，
// 最小就是現在的固定寬度；四角標記維持原大小；R.74.2 時邊只有固定寬度）。
const BAND = 56, OUTER = 96;
type EdgeZone = { share: number; least: number };
const edgeZone = (): EdgeZone => {
  const style = getComputedStyle(document.documentElement);
  return { share: (parseFloat(style.getPropertyValue('--drop-edge')) || 15) / 100, least: parseFloat(style.getPropertyValue('--drop-corner')) || 18 };
};
type Mark = { kind: 'across' | 'along' | 'frame'; left: number; top: number; width?: number; height?: number;
  /** What dropping here does, written beside the mark (R.68.2, human 2026-10-10); an upright line says which edge it is on,
   * so its words go inside. 放下會發生什麼，寫在提示旁（人類 10-10）；直線標明是哪一條邊，說明寫在內側。 */
  label?: Message; side?: Side;
  /** Joining as a tab: how many tabs the pane will have, and which one this is. 合併成分頁：會有幾個分頁、這是第幾個。 */
  slots?: { count: number; at: number } };
type Hint = { drop: Drop; mark: Mark; refused?: Message } | null;
const across = (box: DOMRect, edge: 'top' | 'bottom'): Mark => ({ kind: 'across', left: box.left, top: edge === 'top' ? box.top : box.bottom, width: box.width });
const along = (box: DOMRect, side: Side): Mark => ({ kind: 'along', left: side === 'left' ? box.left : box.right, top: box.top, height: box.height, side });
const noRoom = tr('layout.noRoom', 'Not enough room here for another pane.');
const newPane = tr('layout.dropPane', 'New pane here'), asTab = tr('layout.dropTab', 'Join as a tab');
const onSide = { left: tr('layout.dropLeft', 'Put on the left side, full height'), right: tr('layout.dropRight', 'Put on the right side, full height') };
const tabOnSide = { left: tr('layout.dropLeftTab', 'Join the left side as a tab'), right: tr('layout.dropRightTab', 'Join the right side as a tab') };
const showing = (layout: Layout, side: Side) => layout.hasPanels(side) && !layout.closed[side];

/** A new pane on one edge of a pane: next to the canvas it takes pixels from the canvas, elsewhere it halves the pane.
 * 在某一格的某條邊旁新增一格：在畫布旁從畫布拿像素，其他地方平分那一格。 */
function beside(layout: Layout, path: number[], edge: Edge, box: DOMRect): Hint {
  const row = edge === 'left' || edge === 'right', target = tree.at(layout.root, path)!, parent = tree.at(layout.root, path.slice(0, -1));
  const canvas = document.querySelector('[data-kind="canvas"]')!.getBoundingClientRect();
  const fromCanvas = tree.hasCanvas(target) || (parent?.kind === 'split' && parent.direction === (row ? 'row' : 'column') && tree.hasCanvas(parent));
  const fits = fromCanvas ? row ? canvas.width - tree.SIDE_WIDTH >= tree.CANVAS_MIN_WIDTH : canvas.height - tree.PANE_HEIGHT >= tree.CANVAS_MIN_HEIGHT
    : row ? box.width / 2 >= tree.PANE_MIN_WIDTH : box.height / 2 >= tree.PANE_MIN;
  const mark = edge === 'left' || edge === 'right' ? along(box, edge) : across(box, edge);
  return { drop: { kind: 'beside', pane: path, edge }, mark: { ...mark, label: newPane }, refused: fits ? undefined : noRoom };
}

function hintAt(layout: Layout, panel: string, x: number, y: number, zone: EdgeZone): Hint {
  const under = document.elementFromPoint(x, y) as HTMLElement | null, slot = under?.closest<HTMLElement>('[data-pane]');
  if (!under || !slot) return null;
  const path = slot.dataset.pane!.split('.').map(Number), pane = tree.at(layout.root, path), box = slot.getBoundingClientRect();
  const source = tree.paneOf(layout.root, panel), own = !!source && source.path.join('.') === path.join('.');
  if (pane?.kind === 'tabs') {
    const bar = under.closest<HTMLElement>('.panel-tabs');
    if (bar && slot.contains(bar)) {
      const tabs = [...bar.querySelectorAll<HTMLElement>('[data-panel]')];
      const next = tabs.find(tab => { const b = tab.getBoundingClientRect(); return x < b.left + b.width / 2; });
      const index = next ? pane.panels.indexOf(next.dataset.panel!) : pane.panels.length, strip = bar.getBoundingClientRect();
      const at = next ? next.getBoundingClientRect().left : tabs.at(-1)!.getBoundingClientRect().right;
      return { drop: { kind: 'tab', pane: path, index }, mark: { kind: 'along', left: at, top: strip.top, height: strip.height } };
    }
    // Each distance against its own axis's edge width, so a tall pane and a wide one are judged alike. 每個距離和它那個方向的邊寬比。
    const edgeY = Math.max(zone.least, box.height * zone.share), edgeX = Math.max(zone.least, box.width * zone.share);
    const near: [Edge, number][] = [['top', (y - box.top) / edgeY], ['bottom', (box.bottom - y) / edgeY],
      ['left', (x - box.left) / edgeX], ['right', (box.right - x) / edgeX]];
    const [edge, distance] = near.reduce((closest, item) => item[1] < closest[1] ? item : closest);
    if (distance < 1) return own && source!.pane.panels.length === 1 ? null : beside(layout, path, edge, box);
    // The tabs it will sit among (hidden ones keep their places but are not counted); the pointer's part of the width picks
    // the place. 會和哪些分頁並排（隱藏的保留位置、不算）；游標在寬度的哪一段決定位置。
    const others = pane.panels.filter(id => id !== panel && !layout.hidden.includes(id));
    if (!others.length) return null;
    const count = others.length + 1, at = Math.max(0, Math.min(count - 1, Math.floor((x - box.left) / box.width * count)));
    const index = at < others.length ? pane.panels.indexOf(others[at]!) : pane.panels.length;
    return { drop: { kind: 'tab', pane: path, index }, mark: { kind: 'frame', left: box.left, top: box.top, width: box.width, height: box.height, slots: { count, at }, label: asTab } };
  }
  if (pane?.kind === 'canvas') {
    if (y - box.top < BAND || box.bottom - y < BAND) return beside(layout, path, y - box.top < BAND ? 'top' : 'bottom', box);
    for (const side of ['left', 'right'] as const) {
      const distance = side === 'left' ? x - box.left : box.right - x, reach = Math.min(tree.SIDE_WIDTH, box.width * .4);
      if (distance >= reach) continue;
      if (showing(layout, side) || distance >= Math.min(OUTER, reach / 2)) return beside(layout, path, side, box);
      // The side itself, full height: its line runs the whole layout. 那一側本身、整個高度：線畫滿整個版面。
      const whole = document.querySelector('.workspace')!.getBoundingClientRect();
      return { drop: { kind: 'side', side }, mark: { ...along(whole, side), label: layout.hasPanels(side) ? tabOnSide[side] : onSide[side] },
        refused: box.width - tree.SIDE_WIDTH >= tree.CANVAS_MIN_WIDTH ? undefined : noRoom };
    }
  }
  return null;
}

/** Moving a panel by its tab (legacy inspector.js:2296): a drag starts after 6px; the panel's name follows the pointer;
 * the mark shows where it would go, red with the reason where it cannot; Esc or a drop elsewhere changes nothing.
 * 拖分頁搬面板（舊產品）：移動 6px 才開始；面板名跟著游標；提示畫出會放在哪，放不下時是紅的並說原因；Esc 或放在別處什麼都不變。 */
function PanelDrag({ layout, panels, start }: { layout: Layout; panels: Record<string, PanelView>; start: MutableRefObject<Drag> }) {
  const [drag, setDrag] = useState<{ panel: string; x: number; y: number; hint: Hint } | null>(null);
  const now = useRef(layout); now.current = layout;
  // A line's words go above it, or below when above would leave the layout (the title bar; R.68.3, human 2026-10-10).
  // 線的說明放在上方；上方會超出版面（蓋到標題列）時放到下方（人類 10-10）。
  // Measured when the line moves, not on every pointer move (EDITOR_UI_RULES, continuous interactions).
  // 線換位置時才量，不是指標每動一下都量（畫面規則「連續互動」）。
  const label = useRef<HTMLSpanElement>(null), [below, setBelow] = useState(false);
  const lineAt = drag?.hint?.mark.kind === 'across' ? drag.hint.mark.top : null;
  useLayoutEffect(() => {
    const element = label.current;
    if (lineAt === null || !element) return;
    const gap = parseFloat(getComputedStyle(element).getPropertyValue('--drop-label-gap')) || 0;
    setBelow(lineAt - gap - element.offsetHeight < (document.querySelector('.workspace')?.getBoundingClientRect().top ?? 0));
  }, [lineAt]);
  start.current = (event, panel) => {
    if (event.button !== 0) return;
    const x0 = event.clientX, y0 = event.clientY, pointer = event.pointerId, controller = new AbortController();
    const options = { capture: true, signal: controller.signal };
    // The theme's edge zone, read once per drag, not on every move. 主題的邊緣範圍，每次拖曳讀一次，不是每次移動都讀。
    let moving = false, hint: Hint = null;
    const zone = edgeZone();
    const finish = (accept: boolean) => {
      controller.abort(); document.documentElement.classList.remove('moving-panel'); setDrag(null);
      if (!moving) return;
      // The click that ends a drag is not a tab click. 結束拖曳的那一下不算點分頁。
      const swallow = (click: Event) => { click.preventDefault(); click.stopImmediatePropagation(); };
      addEventListener('click', swallow, { capture: true, once: true }); setTimeout(() => removeEventListener('click', swallow, true), 0);
      if (accept && hint && !hint.refused) now.current.move(panel, hint.drop);
    };
    addEventListener('pointermove', move => {
      if (move.pointerId !== pointer) return;
      if (!(move.buttons & 1)) { finish(false); return; }
      // A finger wobbles more than a mouse: a little further before a press becomes a drag. 手指比滑鼠抖：多一點距離才算拖曳。
      if (!moving && Math.hypot(move.clientX - x0, move.clientY - y0) < (event.pointerType === 'touch' ? 10 : 6)) return;
      move.preventDefault(); move.stopPropagation();
      if (!moving) { moving = true; document.documentElement.classList.add('moving-panel'); }
      hint = hintAt(now.current, panel, move.clientX, move.clientY, zone);
      setDrag({ panel, x: move.clientX, y: move.clientY, hint });
    }, options);
    addEventListener('pointerup', up => { if (up.pointerId === pointer) finish(true); }, options);
    addEventListener('pointercancel', cancel => { if (cancel.pointerId === pointer) finish(false); }, options);
    addEventListener('keydown', key => { if (key.key === 'Escape' && moving) { key.preventDefault(); key.stopPropagation(); finish(false); } }, options);
  };
  if (!drag) return null;
  const mark = drag.hint?.mark;
  return createPortal(<>
    {/* Where it cannot go, the label gives the reason instead (one place to read). 放不下時，標籤改寫原因（只看一個地方）。 */}
    {mark && <div className={'drop-mark ' + mark.kind + (mark.side ? ' ' + mark.side : '') + (drag.hint!.refused ? ' refused' : '') + (below ? ' below' : '')}
      style={{ left: mark.left, top: mark.top, width: mark.width, height: mark.height }}>
      {mark.kind === 'frame' && ['tl', 'tr', 'bl', 'br'].map(corner => <span key={corner} className={'drop-corner ' + corner} />)}
      {mark.slots && <span className="drop-slots">{Array.from({ length: mark.slots.count }, (_, index) =>
        <span key={index} className={'drop-slot' + (index === mark.slots!.at ? ' at' : '')} />)}</span>}
      {(drag.hint!.refused ?? mark.label) && <span ref={label} className="drop-label">{say(drag.hint!.refused ?? mark.label!)}</span>}</div>}
    <div className="drag-label" style={{ left: drag.x + 14, top: drag.y + 10 }}>{say(panels[drag.panel]?.title ?? drag.panel)}</div>
  </>, document.body);
}

/** The Layout menu (legacy inspector.js:2396; floating-panels.md 6): each panel shown or hidden, and the default layout.
 * Layout 選單：每個面板顯示或隱藏，以及回到預設配置。 */
export function LayoutMenu({ layout }: { layout: Layout }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const items: MenuItem[] = [
    ...(Object.entries(PANELS) as [string, { title: Message }][]).map(([id, row]) => ({ key: id, label: say(row.title), checkbox: true,
      checked: !layout.hidden.includes(id), select: () => layout.togglePanel(id) })),
    { key: 'reset', label: say(tr('layout.reset', 'Default layout')), divider: true, select: layout.reset },
  ];
  return <>
    <button type="button" aria-haspopup="menu" aria-expanded={!!anchor} onClick={event => setAnchor(anchor ? null : event.currentTarget)}>
      {say(tr('layout.menu', 'Layout'))}</button>
    {anchor && <DropdownMenu anchor={anchor} items={items} label={say(tr('layout.menu', 'Layout'))} onClose={() => setAnchor(null)} />}
  </>;
}
