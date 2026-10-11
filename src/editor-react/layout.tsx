import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode,
  type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { say, tr, type Message } from './text';
import { PANELS } from './panels';
import { readPreference, writePreference } from './preferences';
import { DropdownMenu, type MenuItem } from './DropdownMenu';
import { Icon } from './icons';
import { FloatingContext } from './contexts';
import * as tree from './layout_tree';
import type { Corner, Drop, Edge, LayoutData, Pane, Path, Side } from './layout_tree';

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
export type PanelView = { title: Message; content: ReactNode; menu?: () => readonly MenuItem[]; frame?: 'own' };

const defaults: tree.PanelDefaults = (Object.entries(PANELS) as [string, { side: Side; first?: true }][]).map(([id, row]) => [id, row.side, !!row.first]);
const homes: tree.Homes = Object.fromEntries((Object.entries(PANELS) as [string, { corner?: Corner }][]).filter(([, row]) => row.corner).map(([id, row]) => [id, row.corner!]));
function stored(): LayoutData {
  try { return tree.keepHomes(tree.readLayout(JSON.parse(readPreference('layout') ?? 'null'), defaults), homes); }
  catch { return tree.defaultLayout(defaults); }
}

export type Layout = LayoutData & {
  toggleTitleBar(): void; toggleSide(side: Side): void; closeSide(side: Side): void;
  /** Whether a side has panels to show (its toggle is greyed out otherwise). 那一側有沒有面板可顯示。 */
  hasPanels(side: Side): boolean;
  /** Bring a panel forward: shown, its tab chosen, its side opened. 把面板叫到前面：顯示、選中、打開所在那一側。 */
  show(id: string): void; togglePanel(id: string): void; reset(): void;
  /** Shown, or folded as its triangle would when in view (the GLSL button, Refactor.86.4). 叫出來，看得到時就照它的三角形收起（GLSL 按鈕，R.86.4）。 */
  showOrFold(id: string): void;
  activate(path: Path, id: string): void; resize(path: Path, sizes: number[]): void; move(id: string, drop: Drop): void;
  /** Collapse a stacked tab pane to its tab bar, or open it (Refactor.80). 把疊著的分頁窗格收成分頁列，或打開（R.80）。 */
  collapse(path: Path, collapsed: boolean): void;
  /** Floating (Refactor.84, 88): a panel with a home floats there or goes back (P); any other floats free where it is dropped, is
   * moved and sized there, and closes. 浮動（R.84、88）：有家的面板浮在家或回去（P）；其他的自由浮動在放下的地方，在那裡移動、調大小、關閉。 */
  toggleFloat(id: string): void; floatOut(id: string, place: tree.FloatPlace): void; placeFloats(places: Record<string, tree.FloatPlace>): void;
  /** A floating panel clicked comes to the front (Refactor.89.1). 點到的浮動面板到最前面（R.89.1）。 */
  raise(id: string): void;
  /** Floating frames with tabs (Refactor.90): a panel joins one, a whole frame joins another, a whole frame docks. 有分頁的浮動框
   * （R.90）：一個面板加入、整個框併入另一個、整個框停靠。 */
  joinFloat(id: string, frame: string, index: number): void; mergeFloat(from: string, frame: string, index: number): void; dockFrame(frame: string, drop: Drop): void;
  /** Floating panels keep clear of each other ("forbid overlap" in the gear, off by default; Refactor.89.1, human 2026-10-12): a
   * personal preference, kept in this browser. 浮動面板彼此避開（齒輪裡的「禁止重疊」，預設關；R.89.1，人類 10-12）：個人偏好，存在這個瀏覽器。 */
  apart: boolean; setApart(on: boolean): void;
  setFloat(id: string, patch: { width?: number; height?: number; collapsed?: boolean }): void; close(id: string): void;
  /** Panels that float in one corner only (the panel table's `corner`). 只浮在某一角的面板（面板表的 corner）。 */
  homes: tree.Homes;
};
export function useLayout(): Layout {
  const [data, setData] = useState(stored), [apart, setApart] = useState(() => readPreference('floating.apart') === 'on');
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
    showOrFold: id => setData(old => tree.showOrFold(old, id)),
    togglePanel: id => setData(old => old.hidden.includes(id) ? tree.showPanel(old, id) : tree.hidePanel(old, id)),
    reset: () => setData(old => ({ ...tree.defaultLayout(defaults), titleBar: old.titleBar })),
    activate: (path, id) => setData(old => tree.activate(old, path, id)),
    resize: (path, sizes) => setData(old => tree.resize(old, path, sizes)),
    move: (id, drop) => setData(old => tree.movePanel(old, id, drop)),
    collapse: (path, collapsed) => setData(old => tree.setCollapsed(old, path, collapsed)),
    toggleFloat: id => setData(old => tree.toggleFloat(old, id, homes)),
    floatOut: (id, place) => setData(old => tree.floatOut(old, id, place)),
    placeFloats: places => setData(old => tree.placeFloats(old, places)),
    homes,
    setFloat: (id, patch) => setData(old => tree.setFloat(old, id, patch)),
    close: id => setData(old => tree.hidePanel(old, id)),
    raise: id => setData(old => tree.raise(old, id)),
    joinFloat: (id, frame, index) => setData(old => tree.joinFloat(old, id, frame, index, homes)),
    mergeFloat: (from, frame, index) => setData(old => tree.mergeFloat(old, from, frame, index)),
    dockFrame: (frame, drop) => setData(old => tree.dockFrame(old, frame, drop)),
    apart, setApart: on => { setApart(on); writePreference('floating.apart', on ? 'on' : 'off'); },
  }), [data, apart]);
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

/** `part`: a floating frame is moved by its title bar ('frame'), one of its panels by its tab ('tab'; Refactor.90). part：浮動框抓
 * 標題列是搬整個框（frame），抓分頁是搬那一個面板（tab；R.90）。 */
type Drag = (event: ReactPointerEvent, panel: string, part?: 'frame' | 'tab') => void;
const DragContext = createContext<MutableRefObject<Drag>>({ current: () => {} });
/** The floating area as last drawn (its size, gap, title height, and where each panel is), read when a drag starts.
 * 浮動範圍上次畫的樣子（大小、間隙、標題高、每個面板在哪），開始拖曳時讀。 */
type Geometry = { width: number; height: number; gap: number; title: number; rects: Record<string, tree.FloatRect> };
/** The panels a hand on `id`'s edge is about to size; `line`: it is a seam. 手在 id 的邊上時要調的面板；line：是縫。 */
type Sizing = { ids: string[]; id: string; edge: tree.FloatEdge; line: boolean };
/** How near an edge a floating panel snaps to it (Q47 5; a number to tune); sizing one panel, how near another's edge line its edge
 * lines up (Refactor.88.2, human 2026-10-12: 16). 浮動面板離邊多近就吸過去（Q47 第 5 點；可調）；調單一個面板時，它的邊離別人的邊線多近
 * 就對齊（R.88.2，人類 10-12：16）。 */
const SNAP = 12, SNAP_SIZE = 16;
/** When a move or a sizing ends: free panels kept by group, the one just handled first (Refactor.88.5). `after`: the layout the
 * move leads to, when it is not yet the layout's. 移動或調大小結束時：自由浮動面板依組記位置，剛動的排最前面（R.88.5）。after：這一下之後的
 * 版面（還沒成為版面時）。 */
function settle(layout: Layout, rects: Record<string, tree.Box>, area: { width: number; height: number; gap: number }, first: string, after: LayoutData = layout) {
  const places = tree.anchored(rects, after, area.width, area.height, area.gap);
  if (!places[first]) return layout.placeFloats(places);
  const { [first]: own, ...rest } = places;
  layout.placeFloats({ [first]: own!, ...rest });
}
type Context = { layout: Layout; panels: Record<string, PanelView>; canvas: HTMLElement };

/** The whole layout: the tree, and the marks shown while a panel is moved. The network is drawn once, into its own
 * element, which is moved into whichever pane holds the canvas: it is never rebuilt, whatever the layout becomes around it
 * (R.68.4: the canvas can now sit inside any split). 整個版面：窗格樹，以及搬面板時的提示。網路區只畫一次，畫進自己的元素，
 * 再把這個元素搬進放畫布的那一格：版面怎麼變都不會重新建立（R.68.4：畫布現在可以在任何分割裡）。 */
export function LayoutView({ layout, panels, canvas }: { layout: Layout; panels: Record<string, PanelView>; canvas: ReactNode }) {
  const drag = useRef<Drag>(() => {}), geometry = useRef<Geometry | null>(null);
  const host = useMemo(() => Object.assign(document.createElement('div'), { className: 'canvas-host' }), []);
  return <DragContext.Provider value={drag}>
    <PaneView pane={layout.root} path={[]} context={{ layout, panels, canvas: host }} />
    {createPortal(<>{canvas}<FloatingPanels layout={layout} panels={panels} host={host} geometry={geometry} /></>, host)}
    <PanelDrag layout={layout} panels={panels} start={drag} geometry={geometry} />
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
  const visible = pane.children.map((child, index) => ({ child, index })).filter(({ child, index }) => tree.shown(child, tree.away(layout)) && !closed(index));
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
  const drag = useContext(DragContext), { layout, panels } = context, [menuAt, openMenu, closeMenu] = useMenuAt();
  const away = tree.away(layout), ids = pane.panels.filter(id => !away.includes(id)), active = ids.includes(pane.active) ? pane.active : ids[0]!;
  const collapsed = !!pane.collapsed;
  return <section className={'tab-pane' + (collapsed ? ' collapsed' : '')} aria-label={say(panels[active]?.title ?? '')}>
    <div className="tab-head">
      {/* A tab is also the handle that moves its panel (legacy: drag the panel title). 分頁也是搬面板的把手（舊產品：拖面板標題）。 */}
      {/* The shown tab carries its panel's menu on its corner (Refactor.83, human 2026-10-11: the shown tab already takes half the bar,
          so no room is taken; legacy put a pop-out button on its tabs, inspector.js:2245). The button sits beside the tab, not in it
          (a button cannot hold one), so pressing it never starts a panel move. 選中的分頁右上角放它面板的選單（R.83，人類：選中的分頁本來
          就佔一半，不多佔空間；舊產品在分頁上放過彈出按鈕）。按鈕在分頁旁邊、不在裡面（按鈕裡不能放按鈕），按它不會開始搬面板。 */}
      {/* Stacked in a column split, a pane collapses to its tab bar, every tab still in view; a tab opens it again (Refactor.80,
          human 2026-10-11). Its triangle sits on the shown tab's left as the menu sits on its right, as wide as any icon button
          (Refactor.83.2, human: easier to press and tidier); collapsed, it stays there to open the pane. It is the pane's, not the
          panel's. 疊在上下分割裡的窗格可以收成分頁列，分頁都還看得到；點分頁就再打開（R.80，人類）。三角形在顯示中分頁的左邊，和選單在
          右邊一樣，一般圖示按鈕寬（R.83.2，人類：好按、好看）；收起時留在原地用來打開。它屬於窗格，不屬於面板。 */}
      <div className="panel-tabs" role="tablist">{ids.map(id => {
        // Every panel has a menu now (Pop out, Close panel; Refactor.84). 每個面板現在都有選單（Pop out、關閉面板；R.84）。
        const menu = id === active && !collapsed ? panelMenu(layout, id, panels[id]) : undefined;
        const fold = id === active && stacked;
        return <div key={id} role="presentation" className={'tab-slot' + (id === active ? ' shown' : '') + (menu ? ' with-menu' : '') + (fold ? ' with-fold' : '')}>
          {fold && <button type="button" className="icon-button pane-collapse" aria-expanded={!collapsed}
            aria-label={say(collapsed ? tr('layout.expandPane', 'Expand') : tr('layout.collapsePane', 'Collapse'))}
            title={say(collapsed ? tr('layout.expandPane', 'Expand') : tr('layout.collapsePane', 'Collapse'))}
            onClick={() => layout.collapse(path, !collapsed)}><Icon name="chevronDown" /></button>}
          <button role="tab" aria-selected={id === active} data-panel={id} className="panel-tab" onContextMenu={openMenu}
            onPointerDown={event => drag.current(event, id)} onClick={() => layout.activate(path, id)}>{say(panels[id]?.title ?? id)}</button>
          {menu && <PanelMenu title={panels[id]!.title} items={menu} />}
        </div>;
      })}</div>
    </div>
    {!collapsed && <div className="panel-content" role="tabpanel">{panels[active]?.content}</div>}
    {menuAt?.dataset.panel && <PanelMenuPopup title={panels[menuAt.dataset.panel]?.title ?? tr('layout.panel', 'Panel')}
      items={panelMenu(layout, menuAt.dataset.panel, panels[menuAt.dataset.panel])} anchor={menuAt} onClose={closeMenu} />}
  </section>;
}

/** A panel's own menu (Refactor.83). An on/off item stays open and shows its new state at once. 面板自己的選單（R.83）。開關項目選了不關、馬上顯示新狀態。 */
function PanelMenu({ title, items }: { title: Message; items: () => readonly MenuItem[] }) {
  const [open, setOpen] = useState(false), button = useRef<HTMLButtonElement>(null);
  const label = say(tr('layout.panelMenu', '{panel} options', { panel: say(title) }));
  return <>
    <button ref={button} type="button" className="icon-button panel-menu" aria-label={label} title={label} aria-haspopup="menu"
      aria-expanded={open} onClick={() => setOpen(!open)}><Icon name="panelMenu" /></button>
    {open && button.current && <PanelMenuPopup title={title} items={items} anchor={button.current} onClose={() => setOpen(false)} />}
  </>;
}
/** A panel's menu, opened from ≡ or by right-clicking the panel's tab or title (human 2026-10-11: two ways in, right-click for every
 * panel, ≡ the one you see). An on/off item stays open and shows its new state at once. 面板的選單，從 ≡ 或在面板的分頁、標題上按右鍵
 * 打開（人類 10-11：兩個入口，右鍵每個面板都有，≡ 是看得到的那個）。開關項目選了不關、馬上顯示新狀態。 */
function PanelMenuPopup({ title, items, anchor, onClose }: { title: Message; items: () => readonly MenuItem[]; anchor: HTMLElement; onClose(): void }) {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  return <DropdownMenu anchor={anchor} label={say(tr('layout.panelMenu', '{panel} options', { panel: say(title) }))} onClose={onClose}
    items={items().map(item => ({ ...item, select: () => { item.select(); redraw(); } }))} />;
}
/** Right-click opens the panel's menu under what was clicked. 按右鍵在按到的地方下面打開面板選單。 */
function useMenuAt(): [HTMLElement | null, (event: ReactMouseEvent<HTMLElement>) => void, () => void] {
  const [at, setAt] = useState<HTMLElement | null>(null);
  return [at, event => { event.preventDefault(); setAt(event.currentTarget); }, () => setAt(null)];
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
// - 畫布：上下帶＝畫布上方或下方切一格；左右兩塊（和側欄一樣寬，R.68.1）＝畫布旁切一格；
// - 整個版面的最外緣（R.87，人類 10-12：最左邊整個高度的位置進不去）：沿那條邊多一格，整個高度或整個寬度，永遠在、優先於裡面的格子
//   （人類：兩者要分得出來；線的長度表示是哪一種）。
// A line is drawn on the edge it marks, its width the theme's (--drop-line). 線畫在它標的那條邊上，粗細由主題決定。
// A tabbed pane's edge: a share of the pane along that axis, never less than the drop frame's corner mark (--drop-edge,
// --drop-corner; Refactor.80.2, human 2026-10-11: half of the old 30%, with today's fixed width as the least; the corner mark
// keeps its size; R.74.2 had made the edge the fixed width only).
// 分頁窗格的「邊」：那個方向的一定比例，不小於放下框四角標記的寬度（--drop-edge、--drop-corner；R.80.2，人類：以前 30% 的一半，
// 最小就是現在的固定寬度；四角標記維持原大小；R.74.2 時邊只有固定寬度）。
const BAND = 56;
type EdgeZone = { share: number; least: number };
const edgeZone = (): EdgeZone => {
  const style = getComputedStyle(document.documentElement);
  return { share: (parseFloat(style.getPropertyValue('--drop-edge')) || 15) / 100, least: parseFloat(style.getPropertyValue('--drop-corner')) || 18 };
};
type Mark = { kind: 'across' | 'along' | 'frame' | 'ghost'; left: number; top: number; width?: number; height?: number;
  /** What dropping here does, written beside the mark (R.68.2, human 2026-10-10); an upright line says which edge it is on,
   * so its words go inside. 放下會發生什麼，寫在提示旁（人類 10-10）；直線標明是哪一條邊，說明寫在內側。 */
  label?: Message; side?: Side;
  /** Joining as a tab: how many tabs the pane will have, and which one this is. 合併成分頁：會有幾個分頁、這是第幾個。 */
  slots?: { count: number; at: number } };
/** Where a dragged panel goes: a place in the tree; its home corner (Refactor.84); or floating free at a place (Refactor.88).
 * 拖著的面板放到哪：版面樹裡某處；它的家那一角（R.84）；或自由浮動在某處（R.88）。 */
type Target = Drop | { kind: 'corner' } | { kind: 'float'; place: tree.FloatPlace; box: tree.Box } | { kind: 'join'; frame: string; index: number };
type Hint = { drop: Target; mark: Mark; refused?: Message } | null;
const across = (box: DOMRect, edge: 'top' | 'bottom'): Mark => ({ kind: 'across', left: box.left, top: edge === 'top' ? box.top : box.bottom, width: box.width });
const along = (box: DOMRect, side: Side): Mark => ({ kind: 'along', left: side === 'left' ? box.left : box.right, top: box.top, height: box.height, side });
const noRoom = tr('layout.noRoom', 'Not enough room here for another pane.');
const newPane = tr('layout.dropPane', 'New pane here'), asTab = tr('layout.dropTab', 'Join as a tab');
const onOuter = { left: tr('layout.dropOuterLeft', 'Far left, full height'), right: tr('layout.dropOuterRight', 'Far right, full height'),
  top: tr('layout.dropOuterTop', 'Along the top, full width'), bottom: tr('layout.dropOuterBottom', 'Along the bottom, full width') };

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

/** The whole layout's outer edges (Refactor.87): a band as wide as a pane edge's least, the nearest edge; always there, ahead of
 * anything inside, its line the whole edge. 整個版面的外緣（R.87）：一條和分頁窗格的邊最小值一樣寬的帶、取最近的那條邊；永遠在、優先於裡面
 * 的一切，線畫滿整條邊。 */
function outerAt(x: number, y: number, zone: EdgeZone): Hint {
  const whole = document.querySelector('.workspace')?.getBoundingClientRect();
  if (!whole || x < whole.left || x > whole.right || y < whole.top || y > whole.bottom) return null;
  const near: [Edge, number][] = [['left', x - whole.left], ['right', whole.right - x], ['top', y - whole.top], ['bottom', whole.bottom - y]];
  const [edge, distance] = near.reduce((closest, item) => item[1] < closest[1] ? item : closest);
  if (distance >= zone.least) return null;
  const canvas = document.querySelector('[data-kind="canvas"]')!.getBoundingClientRect(), row = edge === 'left' || edge === 'right';
  const fits = row ? canvas.width - tree.SIDE_WIDTH >= tree.CANVAS_MIN_WIDTH : canvas.height - tree.PANE_HEIGHT >= tree.CANVAS_MIN_HEIGHT;
  return { drop: { kind: 'outer', edge }, mark: { ...(row ? along(whole, edge) : across(whole, edge)), label: onOuter[edge] }, refused: fits ? undefined : noRoom };
}

function hintAt(layout: Layout, panel: string, x: number, y: number, zone: EdgeZone, geometry: Geometry | null, leaving = false): Hint {
  const outer = outerAt(x, y, zone);
  if (outer) return outer;
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
    const away = tree.away(layout), others = pane.panels.filter(id => id !== panel && !away.includes(id));
    if (!others.length) return null;
    const count = others.length + 1, at = Math.max(0, Math.min(count - 1, Math.floor((x - box.left) / box.width * count)));
    const index = at < others.length ? pane.panels.indexOf(others[at]!) : pane.panels.length;
    return { drop: { kind: 'tab', pane: path, index }, mark: { kind: 'frame', left: box.left, top: box.top, width: box.width, height: box.height, slots: { count, at }, label: asTab } };
  }
  if (pane?.kind === 'canvas') {
    if (y - box.top < BAND || box.bottom - y < BAND) return beside(layout, path, y - box.top < BAND ? 'top' : 'bottom', box);
    // The left and right edges as a tab pane's (Refactor.88: the middle now floats; R.68.1 had them as wide as a side).
    // 左右邊緣和分頁窗格一樣算（R.88：中間現在是浮動；R.68.1 時和側欄一樣寬）。
    const edge = Math.max(zone.least, box.width * zone.share);
    for (const side of ['left', 'right'] as const) if ((side === 'left' ? x - box.left : box.right - x) < edge) return beside(layout, path, side, box);
    return floatHint(layout, panel, x, y, geometry, leaving);
  }
  return null;
}

/** Over the network's middle: a panel with a home floats in it (Refactor.84); any other floats free there, shown as a see-through
 * panel of the first size where it would land, snapped; where it would overlap or not fit, nothing is shown and nothing happens
 * (human 2026-10-12: only where it can go). 在網路區中間：有家的面板浮在它的家（R.84）；其他的在這裡自由浮動，用第一次的大小、吸附後的位置
 * 畫一個半透明的面板示意；會重疊或放不下就什麼都不顯示、放開也不會發生事（人類 10-12：拖得進來的地方才拖得進來）。 */
function floatHint(layout: Layout, panel: string, x: number, y: number, geometry: Geometry | null, leaving = false): Hint {
  const area = document.querySelector('.floating-area')?.getBoundingClientRect();
  // `leaving`: a tab dragged out of its floating frame floats alone (Refactor.90). leaving：從浮動框拖出來的分頁單獨浮動（R.90）。
  if (!area || !geometry || x < area.left || x > area.right || y < area.top || y > area.bottom || (layout.floating[panel] && !leaving)) return null;
  const { width, height, gap, title, rects } = geometry;
  if (layout.homes[panel]) {
    const rect = tree.floatRects(tree.popOut(layout, panel, layout.homes), width, height, gap, title)[panel];
    return rect ? { drop: { kind: 'corner' }, mark: { kind: 'frame', left: area.left + rect.x, top: area.top + rect.y, width: rect.width, height: rect.height,
      label: tr('layout.dropCorner', 'Float in this corner') } } : null;
  }
  const size = { width: Math.min(tree.FLOAT_WIDTH, width), height: Math.min(tree.FLOAT_HEIGHT, height) };
  if (size.width < tree.FLOAT_MIN_WIDTH || size.height < tree.FLOAT_MIN_HEIGHT) return null;
  const others = Object.values(rects), clamp = (value: number, high: number) => Math.max(0, Math.min(high, value));
  const box = tree.snap({ x: clamp(x - area.left - size.width / 2, width - size.width), y: clamp(y - area.top - title / 2, height - size.height), ...size },
    others, width, height, gap, SNAP, layout.apart);
  if (layout.apart && !others.every(other => tree.clear(box, other, gap))) return null;
  return { drop: { kind: 'float', place: tree.placeAt(box, width, height), box }, mark: { kind: 'ghost', left: area.left + box.x, top: area.top + box.y, width: box.width, height: box.height } };
}

/** Over a floating frame's title bar: join it as a tab, a line where it goes (Refactor.90, human 2026-10-12: only the title bar
 * joins, the rest of a panel is for overlapping). `except`: the frame being moved, under the pointer itself. 在浮動框的標題列上：加入成
 * 它的分頁，線畫在要插入的位置（R.90，人類 10-12：只有標題列合併，面板其他地方留給重疊）。except：正在搬的那個框，它自己就在游標下。 */
function joinHint(layout: Layout, panel: string, x: number, y: number, except?: string): Hint {
  if (layout.homes[panel]) return null;
  const head = document.elementsFromPoint(x, y).map(element => element.closest<HTMLElement>('.floating-head[data-frame]'))
    .find(found => found && found.dataset.frame !== except);
  if (!head) return null;
  const frame = head.dataset.frame!, tabs = [...head.querySelectorAll<HTMLElement>('[data-tab]')], box = head.getBoundingClientRect();
  if (!tabs.length) {
    const title = head.querySelector('.floating-title')!.getBoundingClientRect(), index = x < title.left + title.width / 2 ? 0 : 1;
    return { drop: { kind: 'join', frame, index }, mark: { kind: 'along', left: index ? title.right : title.left, top: box.top, height: box.height } };
  }
  const next = tabs.find(tab => { const b = tab.getBoundingClientRect(); return x < b.left + b.width / 2; });
  return { drop: { kind: 'join', frame, index: next ? tree.tabsOf(layout, frame).indexOf(next.dataset.tab!) : tabs.length },
    mark: { kind: 'along', left: next ? next.getBoundingClientRect().left : tabs.at(-1)!.getBoundingClientRect().right, top: box.top, height: box.height } };
}

/** Moving a panel by its tab or a floating panel's title (legacy inspector.js:2296): a drag starts after 6px; the panel's name
 * follows the pointer; the mark shows where it would go, red with the reason where it cannot; Esc or a drop elsewhere changes
 * nothing. A free panel over the floating area moves itself instead (Refactor.88). 拖分頁或浮動面板的標題搬面板（舊產品）：移動 6px
 * 才開始；面板名跟著游標；提示畫出會放在哪，放不下時是紅的並說原因；Esc 或放在別處什麼都不變。自由浮動的面板在浮動範圍上時改成自己移動（R.88）。 */
function PanelDrag({ layout, panels, start, geometry }: { layout: Layout; panels: Record<string, PanelView>; start: MutableRefObject<Drag>;
  geometry: MutableRefObject<Geometry | null> }) {
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
  start.current = (event, panel, part = 'frame') => {
    if (event.button !== 0) return;
    const x0 = event.clientX, y0 = event.clientY, pointer = event.pointerId, controller = new AbortController();
    const options = { capture: true, signal: controller.signal };
    // The theme's edge zone, read once per drag, not on every move. 主題的邊緣範圍，每次拖曳讀一次，不是每次移動都讀。
    let moving = false, hint: Hint = null;
    const zone = edgeZone();
    // A free panel moves itself while over the floating area, as a solid thing (human 2026-10-12); what it moves among is read once,
    // here. 自由浮動的面板在浮動範圍上時自己移動、像實體（人類 10-12）；周圍有什麼在這裡讀一次。
    const frame = part === 'frame' && now.current.floating[panel] === 'free';
    const shape = geometry.current, own = frame ? shape?.rects[panel] : undefined;
    const space = own ? document.querySelector('.floating-area')?.getBoundingClientRect() : undefined;
    const was = now.current.floats[panel], others = Object.entries(shape?.rects ?? {}).filter(([id]) => id !== panel).map(([, rect]) => rect);
    let box: tree.Box | undefined = own;
    const finish = (accept: boolean) => {
      controller.abort(); document.documentElement.classList.remove('moving-panel'); setDrag(null);
      if (!moving) return;
      // The click that ends a drag is not a tab click. 結束拖曳的那一下不算點分頁。
      const swallow = (click: Event) => { click.preventDefault(); click.stopImmediatePropagation(); };
      addEventListener('click', swallow, { capture: true, once: true }); setTimeout(() => removeEventListener('click', swallow, true), 0);
      // Esc puts a moved panel back. Esc 讓移動過的面板回到原處。
      if (!accept) { if (own && was) now.current.placeFloats({ [panel]: was }); return; }
      // Let go over the floating area: where it was moved to, kept with the panels it now sits with. 在浮動範圍上放開：留在移到的地方，
      // 和現在貼著的面板一起記。
      if (!hint || hint.refused) { if (own && shape && box && box !== own) settle(now.current, { ...shape.rects, [panel]: box }, shape, panel); return; }
      const drop = hint.drop;
      if (drop.kind === 'join') { if (frame) now.current.mergeFloat(panel, drop.frame, drop.index); else now.current.joinFloat(panel, drop.frame, drop.index); }
      else if (drop.kind === 'corner') now.current.toggleFloat(panel);
      else if (drop.kind === 'float') {
        now.current.floatOut(panel, drop.place);
        if (shape) settle(now.current, { ...shape.rects, [panel]: drop.box }, shape, panel, tree.floatOut(now.current, panel, drop.place));
      } else if (frame && tree.tabsOf(now.current, panel).length > 1) now.current.dockFrame(panel, drop);
      else now.current.move(panel, drop);
    };
    addEventListener('pointermove', move => {
      if (move.pointerId !== pointer) return;
      if (!(move.buttons & 1)) { finish(false); return; }
      // A finger wobbles more than a mouse: a little further before a press becomes a drag. 手指比滑鼠抖：多一點距離才算拖曳。
      if (!moving && Math.hypot(move.clientX - x0, move.clientY - y0) < (event.pointerType === 'touch' ? 10 : 6)) return;
      move.preventDefault(); move.stopPropagation();
      if (!moving) { moving = true; document.documentElement.classList.add('moving-panel'); }
      // Over a floating frame's title bar: join it (Refactor.90). 在浮動框的標題列上：加入它（R.90）。
      const join = joinHint(now.current, panel, move.clientX, move.clientY, frame ? panel : undefined);
      if (join) { hint = join; setDrag({ panel, x: move.clientX, y: move.clientY, hint }); return; }
      if (own && shape && space && box && move.clientX >= space.left && move.clientX <= space.right && move.clientY >= space.top && move.clientY <= space.bottom) {
        const to = { x: own.x + move.clientX - x0, y: own.y + move.clientY - y0 };
        const apart = now.current.apart;
        box = tree.snap(tree.slide(box, to, apart ? others : [], shape.width, shape.height, shape.gap), others, shape.width, shape.height, shape.gap, SNAP, apart);
        hint = null; setDrag(null);
        now.current.placeFloats({ [panel]: tree.placeAt(box, shape.width, shape.height, was) });
        return;
      }
      hint = hintAt(now.current, panel, move.clientX, move.clientY, zone, geometry.current, part === 'tab');
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
      {mark.kind === 'ghost' && <div className="floating-head"><span className="floating-title">{say(panels[drag.panel]?.title ?? drag.panel)}</span></div>}
      {(drag.hint!.refused ?? mark.label) && <span ref={label} className="drop-label">{say(drag.hint!.refused ?? mark.label!)}</span>}</div>}
    {/* The see-through panel carries the name itself. 半透明面板自己就寫著名字。 */}
    {mark?.kind !== 'ghost' && <div className="drag-label" style={{ left: drag.x + 14, top: drag.y + 10 }}>{say(panels[drag.panel]?.title ?? drag.panel)}</div>}
  </>, document.body);
}


/** The menu every panel has: the panel's own items, then Close panel apart (human 2026-10-11). No Pop out: a panel floats by being
 * dragged out (human 2026-10-12). 每個面板都有的選單：面板自己的項目，再隔開放關閉面板（人類 10-11）。沒有 Pop out：面板靠拖出來浮動
 * （人類 10-12）。 */
function panelMenu(layout: Layout, id: string, view: PanelView | undefined): () => readonly MenuItem[] {
  return () => {
    const own = view?.menu?.() ?? [];
    return [...own, { key: 'close', label: say(tr('layout.closePanel', 'Close panel')), divider: own.length > 0, select: () => layout.close(id) }];
  };
}

/** The floating panels (Refactor.84, 88; work/refactor/floating-free-scope-2026-10-12.md): over the network, between the toolbar
 * and the canvas controls, the floating gap off every edge (legacy inspector.js:2139); a panel with a home in its corner, the others
 * where they were put. Measured when the network, the toolbar or the canvas controls change size, not while anything moves. Below
 * the notices on the network's top. 浮動面板（R.84、88）：浮在網路區上，介於功能列與畫布控制項之間，每條邊留浮動間隙（照舊產品）；有家的
 * 在它的角，其他的在放下的地方。網路區、功能列或畫布控制項改變大小時才量，不是拖動時量。在網路區上緣的提示之下。 */
export function FloatingPanels({ layout, panels, host, geometry }: { layout: Layout; panels: Record<string, PanelView>; host: HTMLElement;
  geometry: MutableRefObject<Geometry | null> }) {
  const [area, setArea] = useState<{ left: number; top: number; width: number; height: number; gap: number; title: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const canvas = host.querySelector('.canvas'), bar = host.querySelector('.network-bar-slot'), controls = host.querySelector('.react-flow__controls');
      if (!canvas) return;
      const style = getComputedStyle(document.documentElement), gap = parseFloat(style.getPropertyValue('--float-gap')) || 8;
      const title = parseFloat(style.getPropertyValue('--bar-height')) || 28, origin = host.getBoundingClientRect(), box = canvas.getBoundingClientRect();
      const top = (bar ? bar.getBoundingClientRect().bottom : box.top) + gap, bottom = (controls ? controls.getBoundingClientRect().top : box.bottom) - gap;
      setArea({ left: box.left - origin.left + gap, top: top - origin.top, width: Math.max(0, box.width - 2 * gap), height: Math.max(0, bottom - top), gap, title });
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(host);
    for (const part of [host.querySelector('.network-bar-slot'), host.querySelector('.react-flow__controls')]) if (part) watch.observe(part);
    return () => watch.disconnect();
  }, [host, Object.keys(layout.floating).length > 0]);
  // A panel drawing its own frame is as tall as its content (the Parameter panel: legacy worked its height out for each tab, only
  // its width could be sized; human 2026-10-11): its height is measured, up to what its side leaves it. 自己畫外殼的面板和內容一樣高
  // （參數面板：舊產品每個分頁自動算高度、只能調寬；人類 10-11）：高度用量的，最多到它那一邊留給它的。
  const [measured, setMeasured] = useState<Record<string, number>>({}), drawn = useRef<Geometry | null>(null);
  // What a hand on an edge is about to size, shown before and while dragging (Refactor.88.1–88.2, human 2026-10-12): those panels
  // outlined; on a seam, its line too. 手在邊上時要調的是哪些，拖之前與拖的時候都顯示（R.88.1–88.2，人類 10-12）：那些面板加淡框；是縫的話
  // 再加縫的線。
  const [seam, setSeam] = useState<Sizing | null>(null);
  useLayoutEffect(() => { geometry.current = drawn.current; });
  // A closed free panel shown again (from the Layout menu or a button) where it was kept is taken: the nearest free spot, once (rule 1,
  // human 2026-10-12); only one that was closed, so not on the first drawing, not because the window changed, not a frame taken over
  // by its next panel (Refactor.91.2). 關掉的自由浮動面板再打開（從 Layout 選單或按鈕），記的位置被佔了：去最近的空位，只一次（第 1 題，
  // 人類 10-12）；只限原本關著的，所以第一次畫、視窗變化、框由下一個面板接手都不算（R.91.2）。
  const seen = useRef<ReadonlySet<string> | null>(null);
  useLayoutEffect(() => {
    const drawnNow = drawn.current;
    if (!drawnNow) return;
    const free = Object.keys(layout.floating).filter(id => layout.floating[id] === 'free'), closedBefore = seen.current;
    seen.current = new Set(layout.hidden);
    if (!closedBefore || !layout.apart) return;
    const places = Object.fromEntries(free.filter(id => closedBefore.has(id)).flatMap(id => {
      const others = Object.entries(drawnNow.rects).filter(([key]) => key !== id).map(([, rect]) => rect);
      const place = tree.callUp(layout.floats[id]!, others, drawnNow.width, drawnNow.height, drawnNow.gap, drawnNow.title);
      return place ? [[id, place] as const] : [];
    }));
    if (Object.keys(places).length) layout.placeFloats(places);
  });
  if (!area) return null;
  const own = Object.keys(layout.floating).filter(id => panels[id]?.frame === 'own');
  // Collapsed, its head is its own (a node card's head, taller than a panel title), so it counts as open at its measured height
  // (Refactor.86.1, human 2026-10-11: the collapsed Parameter panel had the wrong height). 收起時它的頭是自己的（節點卡的頭，比面板標題
  // 列高），所以照量到的高度、當成沒收起來算（R.86.1，人類 10-11：浮動參數面板收起時高度不對）。
  const sized = (height: (id: string) => number): LayoutData => ({ ...layout,
    floats: { ...layout.floats, ...Object.fromEntries(own.map(id => {
      const { collapsed: _, ...open } = layout.floats[id]!;
      return [id, { ...open, height: height(id) }];
    })) } });
  const caps = tree.floatRects(sized(() => 1e6), area.width, area.height, area.gap, area.title, layout.apart);
  const rects = tree.floatRects(sized(id => Math.min(measured[id] ?? caps[id]?.height ?? 0, caps[id]?.height ?? 0)), area.width, area.height, area.gap, area.title, layout.apart);
  const measure = (id: string, height: number) => setMeasured(old => old[id] === height ? old : { ...old, [id]: height });
  drawn.current = { width: area.width, height: area.height, gap: area.gap, title: area.title, rects };
  // The seam's line, the whole length of the panels on it, from where they are now (it follows the drag). 縫的線，畫滿縫上所有面板的長度，
  // 照它們現在的位置（拖的時候跟著走）。
  const line = seam?.line && rects[seam.id] && (() => {
    const axis = seam.edge.x ? 'x' : 'y', own = rects[seam.id]!, boxes = seam.ids.map(key => rects[key]).filter((box): box is tree.FloatRect => !!box);
    const at = axis === 'x' ? (seam.edge.x === 'end' ? own.x + own.width + area.gap / 2 : own.x - area.gap / 2)
      : (seam.edge.y === 'end' ? own.y + own.height + area.gap / 2 : own.y - area.gap / 2);
    const from = Math.min(...boxes.map(box => axis === 'x' ? box.y : box.x)), to = Math.max(...boxes.map(box => axis === 'x' ? box.y + box.height : box.x + box.width));
    return axis === 'x' ? { className: 'float-seam x', style: { left: at, top: from, height: to - from } } : { className: 'float-seam y', style: { top: at, left: from, width: to - from } };
  })();
  // On a seam its line is the one mark: the edge's own line goes (human 2026-10-12). 縫上只留縫的線：邊自己的線不畫（人類 10-12）。
  return <div className={'floating-area' + (line ? ' on-seam' : '')} style={{ left: area.left, top: area.top, width: area.width, height: area.height }}>
    {/* The first in line is drawn last, on top (Refactor.89.1). 排最前面的最後畫，在最上面（R.89.1）。 */}
    {Object.keys(layout.floating).reverse().map(id => rects[id] && <FloatingPanel key={id} id={id} layout={layout} view={panels[tree.activeOf(layout, id)]} panels={panels} rect={rects[id]!} area={area}
      rects={rects} cap={caps[id]?.height} measure={height => measure(id, height)} sizing={!!seam?.ids.includes(id)} showSizing={setSeam} />)}
    {line && <div className={line.className} style={line.style} />}
  </div>;
}

/** One floating panel: its title (the triangle, the name, its menu; dragged to move it, or into the layout), its content, and the
 * edges that size it. A free panel: every edge and corner (human 2026-10-12), stopping at other panels, a seam between two moving
 * both; a panel with a home: the edge facing the network (legacy inspector.js:2090). 一個浮動面板：標題（三角形、名字、選單；拖它移動或
 * 拖回版面）、內容，以及調大小的邊。自由浮動的：每條邊、每個角（人類 10-12），碰到別的面板就停，兩個之間的縫一起動；有家的：朝網路區的邊
 * （照舊產品）。 */
function FloatingPanel({ id, layout, view, panels, rect, area, rects, cap, measure, sizing, showSizing }: { id: string; layout: Layout; view: PanelView | undefined;
  panels: Record<string, PanelView>;
  rect: tree.FloatRect; area: { width: number; height: number; gap: number; title: number }; rects: Record<string, tree.FloatRect>; cap?: number;
  measure(height: number): void; sizing: boolean; showSizing(sizing: Sizing | null): void }) {
  const drag = useContext(DragContext), place = layout.floats[id]!, free = layout.floating[id] === 'free';
  const top = place.corner.startsWith('top'), left = place.corner.endsWith('left');
  const title = say(view?.title ?? id), own = view?.frame === 'own';
  // Collapsed: a panel with its own frame keeps its own head (see FloatingPanels). 收起：自己畫外殼的面板保留自己的頭（見 FloatingPanels）。
  const shut = own ? !!place.collapsed : rect.collapsed;
  const fold = <button type="button" className="icon-button pane-collapse" aria-expanded={!shut}
    aria-label={say(shut ? tr('layout.expandPane', 'Expand') : tr('layout.collapsePane', 'Collapse'))}
    title={say(shut ? tr('layout.expandPane', 'Expand') : tr('layout.collapsePane', 'Collapse'))}
    onClick={() => layout.setFloat(id, { collapsed: !place.collapsed })}><Icon name="chevronDown" /></button>;
  // A frame shows one of its tabs: its content, its menu (Refactor.90). 框顯示它的一個分頁：那個的內容、那個的選單（R.90）。
  const shown = free ? tree.activeOf(layout, id) : id, tabs = free ? tree.tabsOf(layout, id) : [id];
  const menu = <PanelMenu title={view?.title ?? tr('layout.panel', 'Panel')} items={panelMenu(layout, shown, view)} />;
  // The Parameter panel's cross: not closing, it stops floating, back to where it was (human 2026-10-11; for now it keeps only this,
  // its menu by right-click). 參數面板的叉叉：不是關閉，是取消浮動、回到原本的狀態（人類 10-11；目前只留它，選單用右鍵）。
  const unfloat = <button type="button" className="icon-button floating-close" aria-label={say(tr('layout.unfloat', 'Stop floating'))}
    title={say(tr('layout.unfloat', 'Stop floating'))} onClick={() => layout.toggleFloat(id)}><Icon name="close" /></button>;
  const [menuAt, openMenu, closeMenu] = useMenuAt();
  // Right-click on a tab: that tab's menu, as on a docked pane (Refactor.91.2). 在分頁上按右鍵：那個分頁的選單，同停靠窗格（R.91.2）。
  const target = menuAt?.dataset.tab ?? shown, targetView = target === shown ? view : panels[target];
  const popup = menuAt && <PanelMenuPopup title={targetView?.title ?? tr('layout.panel', 'Panel')} items={panelMenu(layout, target, targetView)} anchor={menuAt} onClose={closeMenu} />;
  // Sizing works from where every panel is when the drag starts (human 2026-10-12: only then). The panels that only stand in the way:
  // those with a home and collapsed ones. 調大小從開始拖的那一刻每個面板的位置算（人類 10-12：只在那時）。只是擋路的：有家的、收起的。
  const start = useRef<Record<string, tree.Box>>({});
  const fixed = () => Object.keys(rects).filter(key => key !== id && (layout.floating[key] !== 'free' || rects[key]!.collapsed));
  const size = (edge: tree.FloatEdge, dx: number, dy: number) => {
    const sized = tree.sizeFloats(start.current, id, edge, dx, dy, area.width, area.height, area.gap, free ? fixed() : Object.keys(rects).filter(key => key !== id), SNAP_SIZE, layout.apart);
    if (!free) { layout.setFloat(id, { ...(edge.x ? { width: sized[id]!.width } : {}), ...(edge.y ? { height: sized[id]!.height } : {}) }); return; }
    // Only the panels that changed, so the others keep their turn when room runs short. 只寫變了的面板，其他的在空間不夠時保持原本的先後。
    const changed = (key: string) => (['x', 'y', 'width', 'height'] as const).some(side => sized[key]![side] !== start.current[key]![side]);
    layout.placeFloats(Object.fromEntries(Object.keys(sized).filter(key => layout.floating[key] === 'free' && changed(key))
      .map(key => [key, tree.placeAt(sized[key]!, area.width, area.height, layout.floats[key])])));
  };
  const begin = () => { start.current = rects; };
  // Sizing ends: kept with the panels it now sits with (Refactor.88.5). 調完大小：和現在貼著的面板一起記（R.88.5）。
  const done = () => settle(layout, rects, area, id);
  // A hand on an edge: this panel is about to be sized, or, on a seam, every panel on it (Refactor.88.1–88.2). 手在邊上：這個面板要被
  // 調大小；是縫的話，縫上的每個面板（R.88.1–88.2）。
  const enter = (edge: tree.FloatEdge) => {
    const found = free && !(edge.x && edge.y) ? tree.seamOf(rects, id, edge, area.width, area.height, area.gap, fixed()) : { near: [id], far: [] };
    showSizing({ ids: [...found.near, ...found.far], id, edge, line: found.far.length > 0 });
  };
  const label = tr('layout.resizeFloat', 'Resize the panel');
  const edges: tree.FloatEdge[] = free ? [{ y: 'start' }, { y: 'end' }, { x: 'start' }, { x: 'end' }, { x: 'start', y: 'start' }, { x: 'end', y: 'start' }, { x: 'start', y: 'end' }, { x: 'end', y: 'end' }]
    : own ? [{ x: left ? 'end' : 'start' }] : [{ x: left ? 'end' : 'start' }, { y: top ? 'end' : 'start' }];
  const handles = !shut && edges.map(edge => <FloatHandle key={(edge.x ?? '') + (edge.y ?? '')} edge={edge} label={label} onStart={begin} onMove={(dx, dy) => size(edge, dx, dy)}
    onDone={done} onEnter={() => enter(edge)} onLeave={() => showSizing(null)} />);
  const frame = useRef<HTMLElement>(null);
  // Its height follows its content (measured when the content changes size, not while anything moves elsewhere).
  // 高度跟著內容（內容大小改變時量，不是別處在動時量）。
  useLayoutEffect(() => {
    const element = frame.current;
    if (!own || !element) return;
    const watch = new ResizeObserver(() => measure(Math.round(element.getBoundingClientRect().height)));
    watch.observe(element);
    return () => watch.disconnect();
  }, [own]);
  // A press anywhere on it brings it to the front (Refactor.89.1, human 2026-10-12). 在它上面任何地方按下就到最前面（R.89.1，人類 10-12）。
  const front = () => layout.raise(id);
  if (own) return <section ref={frame} onPointerDownCapture={front} className={'floating-panel own-frame' + (shut ? ' collapsed' : '') + (sizing ? ' sizing' : '')} aria-label={title}
    style={{ left: rect.x, top: top ? rect.y : undefined, bottom: top ? undefined : 0, width: rect.width, maxHeight: cap }}>
    <FloatingContext.Provider value={{ collapsed: shut, fold, controls: unfloat, drag: event => drag.current(event, id), openMenu }}>
      {view?.content}</FloatingContext.Provider>
    {popup}
    {handles}
  </section>;
  // Glass, as everything that floats (Refactor.89, human 2026-10-12: under the gear's glass setting). 玻璃，和所有浮著的一樣（R.89，人類 10-12：
  // 受齒輪的玻璃設定管）。
  return <section onPointerDownCapture={front} className={'floating-panel glass' + (rect.collapsed ? ' collapsed' : '') + (sizing ? ' sizing' : '')} aria-label={title}
    style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}>
    {/* Its title bar moves the whole frame (anywhere but a tab or a button); a free frame takes panels dropped on it as tabs
        (Refactor.90). 標題列搬整個框（分頁與按鈕以外的地方）；自由浮動的框接受放上來的面板成為分頁（R.90）。 */}
    <div className="floating-head" data-frame={free ? id : undefined} onContextMenu={openMenu}
      onPointerDown={event => { if (!(event.target as HTMLElement).closest('button')) drag.current(event, id, 'frame'); }}>
      {fold}
      {tabs.length > 1 ? <div className="floating-tabs" role="tablist">{tabs.map(tab => <button key={tab} type="button" role="tab" data-tab={tab}
        className="floating-tab" aria-selected={tab === shown} onContextMenu={event => { event.stopPropagation(); openMenu(event); }}
        onPointerDown={event => drag.current(event, tab, 'tab')} onClick={() => layout.show(tab)}>
        {say(panels[tab]?.title ?? tab)}</button>)}</div>
        : <span className="floating-title">{title}</span>}
      {menu}
    </div>
    {!rect.collapsed && <div className="panel-content">{view?.content}</div>}
    {popup}
    {handles}
  </section>;
}

/** A floating panel's edge or corner handle: drawn thin, grabbed wider; reports how far it was dragged on each axis.
 * 浮動面板的邊或角把手：畫得細、可抓範圍寬；回報兩個方向各拖了多遠。 */
function FloatHandle({ edge, label, onStart, onMove, onDone, onEnter, onLeave }: { edge: tree.FloatEdge; label: Message; onStart(): void;
  onMove(dx: number, dy: number): void; onDone(): void; onEnter(): void; onLeave(): void }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  // Let go: the outline stays while the hand is still on the handle. 放開：手還在把手上時淡框留著。
  const end = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragged = !!start.current;
    start.current = null;
    if (dragged) onDone();
    if (!event.currentTarget.matches(':hover')) onLeave();
  };
  const place = (edge.y === 'start' ? 'n' : edge.y === 'end' ? 's' : '') + (edge.x === 'start' ? 'w' : edge.x === 'end' ? 'e' : '');
  return <div className={'float-handle ' + place} role="separator" aria-label={say(label)}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
      start.current = { x: event.clientX, y: event.clientY }; onStart();
    }}
    onPointerMove={event => { if (start.current) onMove(event.clientX - start.current.x, event.clientY - start.current.y); }}
    onPointerEnter={onEnter} onPointerLeave={() => { if (!start.current) onLeave(); }} onPointerUp={end} onPointerCancel={end} />;
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
