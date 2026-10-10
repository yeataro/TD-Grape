import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode,
  type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { say, tr, type Message } from './text';
import { PANELS } from './panels';
import { readPreference, writePreference } from './preferences';
import { DropdownMenu, type MenuItem } from './DropdownMenu';
import * as tree from './layout_tree';
import type { Drop, LayoutData, Pane, Path, Side } from './layout_tree';

// The editor's layout on screen (Refactor.53, 68; work/in-place-refactor-design/layout-tree.md): the tree of panes
// (layout_tree.ts) drawn between the title bar and the foot bar, its handles, moving panels by their tabs, and the Layout
// menu. The layout is a personal preference: kept in this browser, never in the project or the graph. A panel is only
// content; panes and tabs are this file's (design-interview Q47 5a: the shell changes, the content does not). Content
// comes from whoever draws the layout (the view being edited, Q47 4), never from globals.
// 畫面上的版面：窗格樹（layout_tree.ts）畫在標題列與底列之間、把手、拖分頁搬面板、Layout 選單。版面是個人偏好，只存在
// 這個瀏覽器，不進專案或圖。面板只是內容；窗格與分頁歸這個檔管（Q47 5a：換殼不換內容）。內容由畫版面的畫面提供，不讀全域。

export type { Side } from './layout_tree';
/** What a tab pane shows for one panel. 一個面板在分頁窗格裡顯示什麼。 */
export type PanelView = { title: Message; content: ReactNode };

const defaults: tree.PanelDefaults = (Object.entries(PANELS) as [string, { side: Side; first?: true }][]).map(([id, row]) => [id, row.side, !!row.first]);
function stored(): LayoutData {
  try { return tree.readLayout(JSON.parse(readPreference('layout') ?? 'null'), defaults); }
  catch { return tree.defaultLayout(defaults); }
}

export type Layout = LayoutData & {
  toggleTitleBar(): void; toggleSide(side: Side): void;
  /** Whether a side has panels to show (its toggle is greyed out otherwise). 那一側有沒有面板可顯示。 */
  hasPanels(side: Side): boolean;
  /** Bring a panel forward: shown, its tab chosen, its side opened. 把面板叫到前面：顯示、選中、打開所在那一側。 */
  show(id: string): void; togglePanel(id: string): void; reset(): void;
  activate(path: Path, id: string): void; resize(path: Path, sizes: number[]): void; move(id: string, drop: Drop): void;
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
    hasPanels: side => tree.sideHasPanels(data, side),
    show: id => setData(old => tree.showPanel(old, id)),
    togglePanel: id => setData(old => old.hidden.includes(id) ? tree.showPanel(old, id) : tree.hidePanel(old, id)),
    reset: () => setData(old => ({ ...tree.defaultLayout(defaults), titleBar: old.titleBar })),
    activate: (path, id) => setData(old => tree.activate(old, path, id)),
    resize: (path, sizes) => setData(old => tree.resize(old, path, sizes)),
    move: (id, drop) => setData(old => tree.movePanel(old, id, drop)),
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
type Context = { layout: Layout; panels: Record<string, PanelView>; canvas: ReactNode };

/** The whole layout: the tree, and the marks shown while a panel is moved. 整個版面：窗格樹，以及搬面板時的提示。 */
export function LayoutView({ layout, panels, canvas }: Context) {
  const drag = useRef<Drag>(() => {});
  return <DragContext.Provider value={drag}>
    <PaneView pane={layout.root} path={[]} context={{ layout, panels, canvas }} />
    <PanelDrag layout={layout} panels={panels} start={drag} />
  </DragContext.Provider>;
}

function PaneView({ pane, path, context }: { pane: Pane; path: number[]; context: Context }): ReactNode {
  if (pane.kind === 'canvas') return context.canvas;
  if (pane.kind === 'tabs') return <TabPaneView pane={pane} path={path} context={context} />;
  return <SplitPaneView pane={pane} path={path} context={context} />;
}

// A part keeps its identity while its neighbours change: the canvas always, a pane by the panels it holds.
// 一格在旁邊變動時保持身分：畫布永遠是同一個，窗格以它放的面板認。
const keyOf = (pane: Pane) => tree.hasCanvas(pane) ? 'canvas'
  : 'p:' + tree.tabPanes(pane).flatMap(found => found.pane.panels).join(',');

function SplitPaneView({ pane, path, context }: { pane: Extract<Pane, { kind: 'split' }>; path: number[]; context: Context }) {
  const { layout } = context, root = !path.length, element = useRef<HTMLDivElement>(null);
  const holdsCanvas = tree.hasCanvas(pane), centre = pane.children.findIndex(tree.hasCanvas), row = pane.direction === 'row';
  const closed = (index: number) => { const side = root ? tree.sideOf(layout.root, index) : null; return !!side && layout.closed[side]; };
  const visible = pane.children.map((child, index) => ({ child, index })).filter(({ child, index }) => tree.shown(child, layout.hidden) && !closed(index));
  const begin = useRef({ sizes: [] as number[], limit: 0, total: 0 });
  const length = () => (row ? element.current?.clientWidth : element.current?.clientHeight) || 1;
  // Next to the canvas, a part is pixels: it stays between its minimum and what leaves the canvas its own; elsewhere parts
  // share the length and none goes below a pane's minimum. 畫布旁的一格是像素：不小於最小值、也要留給畫布它的最小值；其他地方平分長度。
  const startPixels = (index: number) => {
    const others = visible.filter(part => part.index !== index && part.index !== centre).reduce((sum, part) => sum + (pane.sizes[part.index] ?? 0), 0);
    begin.current = { sizes: [...pane.sizes], total: 0,
      limit: Math.min(row ? tree.SIDE_MAX : Infinity, length() - others - (row ? tree.CANVAS_MIN_WIDTH : tree.CANVAS_MIN_HEIGHT)) };
  };
  const movePixels = (index: number, delta: number) => {
    const sizes = [...begin.current.sizes], minimum = row ? tree.SIDE_MIN : tree.PANE_MIN;
    sizes[index] = Math.round(Math.max(minimum, Math.min(Math.max(minimum, begin.current.limit), begin.current.sizes[index]! + delta)));
    layout.resize(path, sizes);
  };
  const startShare = () => {
    const total = visible.reduce((sum, part) => sum + (pane.sizes[part.index] ?? 1), 0);
    begin.current = { sizes: [...pane.sizes], total, limit: tree.PANE_MIN / length() * total };
  };
  const moveShare = (before: number, after: number, delta: number) => {
    const { sizes: start, total, limit } = begin.current, next = [...start];
    const share = delta / length() * total, a = start[before]!, b = start[after]!;
    const moved = Math.max(limit - a, Math.min(b - limit, share));
    next[before] = a + moved; next[after] = b - moved; layout.resize(path, next);
  };
  const axis = row ? 'x' : 'y';
  const label = row ? tr('layout.resizeZone', 'Resize the panel zone') : tr('layout.resizeGroups', 'Resize the panels above and below');
  return <div ref={element} className={'split split-' + pane.direction + (root ? ' workspace' : '')}>
    {visible.map(({ child, index }, n) => {
      const before = visible[n - 1], after = visible[n + 1];
      // In a split with the canvas, a handle belongs to the pixel part, on its edge towards the canvas; elsewhere it sits
      // between two parts on the later one's leading edge (R.53). 含畫布時，把手屬於像素那一格、在朝畫布的邊上；其他在兩格之間、後一格的前緣。
      const lead = before && (holdsCanvas ? index > centre && <ResizeHandle axis={axis} label={label}
          onStart={() => startPixels(index)} onMove={delta => movePixels(index, -delta)} />
        : <ResizeHandle axis={axis} label={label} onStart={startShare} onMove={delta => moveShare(before.index, index, delta)} />);
      const trail = after && holdsCanvas && index < centre && <ResizeHandle axis={axis} edge="trail" label={label}
        onStart={() => startPixels(index)} onMove={delta => movePixels(index, delta)} />;
      const flex: CSSProperties = holdsCanvas ? { flex: index === centre ? '1 1 0' : `0 0 ${pane.sizes[index]}px` } : { flex: `${pane.sizes[index] ?? 1} 1 0` };
      const side = root ? tree.sideOf(layout.root, index) : null;
      const zone = side ? 'panel-zone panel-zone-' + side : holdsCanvas && index !== centre ? 'panel-zone panel-zone-' + (index < centre ? 'top' : 'bottom') : 'pane-slot';
      return <div key={keyOf(child)} className={zone} style={flex} data-pane={[...path, index].join('.')} data-kind={child.kind}>
        {lead}<PaneView pane={child} path={[...path, index]} context={context} />{trail}
      </div>;
    })}
  </div>;
}

function TabPaneView({ pane, path, context }: { pane: Extract<Pane, { kind: 'tabs' }>; path: number[]; context: Context }) {
  const drag = useContext(DragContext), { layout, panels } = context;
  const ids = pane.panels.filter(id => !layout.hidden.includes(id)), active = ids.includes(pane.active) ? pane.active : ids[0]!;
  return <section className="tab-pane" aria-label={say(panels[active]?.title ?? '')}>
    {/* A tab is also the handle that moves its panel (legacy: drag the panel title). 分頁也是搬面板的把手（舊產品：拖面板標題）。 */}
    <div className="panel-tabs" role="tablist">{ids.map(id => <button key={id} role="tab" aria-selected={id === active} data-panel={id}
      className="panel-tab" onPointerDown={event => drag.current(event, id)} onClick={() => layout.activate(path, id)}>{say(panels[id]?.title ?? id)}</button>)}</div>
    <div className="panel-content" role="tabpanel">{panels[active]?.content}</div>
  </section>;
}

// Where a panel would go, worked out from what is under the pointer (legacy inspector.js:2314; human 2026-10-10, Resolume
// Wire): on a tab bar, between two tabs (a line); on a tab pane, its middle joins it as a tab (corner marks), at the place
// chosen by where the pointer is across the pane (a row of slots in the middle, one per tab it will have; R.68.1, Wire), and
// its upper or lower part makes a new pane on that edge (a line on the edge, so the lower part of one pane and the upper part
// of the next mean the same boundary — the "between" target is easy to hit); on the canvas, its top or bottom band makes a
// pane above or below it, its left or right part — as wide as the side it would make (R.68.1, human: the edge was too hard
// to hit) — puts the panel on that side when nothing shows there. Nothing else is a target.
// 放到哪，由游標下方是什麼決定（舊產品；人類 10-10，Resolume Wire）：分頁列上＝兩個分頁之間（直線）；分頁窗格中間＝合併成分頁
// （角框），位置看游標在窗格寬度的哪一段（中央一排格子，放下後有幾個分頁就幾格；R.68.1，Wire），上段或下段＝在那條邊切出新的一格
// （邊上一條線，所以上一格的下段和下一格的上段是同一個交界，「中間」好觸發）；畫布的上下帶＝在畫布上方或下方切一格，左右兩塊——
// 和放下後那一側一樣寬（R.68.1，人類：邊緣太難放）——＝那一側沒東西顯示時放到那一側。其他地方都不是目標。
// A line is drawn centred on the edge it marks, its width the theme's (--drop-line). 線畫在它標的那條邊的正中，粗細由主題決定。
const EDGE = .3, BAND = 56;
type Mark = { kind: 'across' | 'along' | 'frame'; left: number; top: number; width?: number; height?: number;
  /** What dropping here does, written beside the mark (R.68.2, human 2026-10-10); a side line says which side it is on.
   * 放下會發生什麼，寫在提示旁（人類 10-10）；側邊的線標明是哪一側。 */
  label?: Message; side?: Side;
  /** Joining as a tab: how many tabs the pane will have, and which one this is. 合併成分頁：會有幾個分頁、這是第幾個。 */
  slots?: { count: number; at: number } };
type Hint = { drop: Drop; mark: Mark; refused?: Message } | null;
const across = (box: DOMRect, y: number): Mark => ({ kind: 'across', left: box.left, top: y, width: box.width });
const along = (box: { top: number; height: number }, x: number): Mark => ({ kind: 'along', left: x, top: box.top, height: box.height });
const noRoom = tr('layout.noRoom', 'Not enough room here for another pane.');
const newPane = tr('layout.dropPane', 'New pane here'), asTab = tr('layout.dropTab', 'Join as a tab');
const onSide = { left: tr('layout.dropLeft', 'Put on the left side'), right: tr('layout.dropRight', 'Put on the right side') };
const tabOnSide = { left: tr('layout.dropLeftTab', 'Join the left side as a tab'), right: tr('layout.dropRightTab', 'Join the right side as a tab') };

function hintAt(layout: Layout, panel: string, x: number, y: number): Hint {
  const under = document.elementFromPoint(x, y) as HTMLElement | null, slot = under?.closest<HTMLElement>('[data-pane]');
  if (!under || !slot) return null;
  const path = slot.dataset.pane!.split('.').map(Number), pane = tree.at(layout.root, path), box = slot.getBoundingClientRect();
  const source = tree.paneOf(layout.root, panel), own = !!source && source.path.join('.') === path.join('.');
  const canvas = document.querySelector('[data-kind="canvas"]')?.getBoundingClientRect();
  if (pane?.kind === 'tabs') {
    const bar = under.closest<HTMLElement>('.panel-tabs');
    if (bar && slot.contains(bar)) {
      const tabs = [...bar.querySelectorAll<HTMLElement>('[data-panel]')];
      const next = tabs.find(tab => { const b = tab.getBoundingClientRect(); return x < b.left + b.width / 2; });
      const index = next ? pane.panels.indexOf(next.dataset.panel!) : pane.panels.length, strip = bar.getBoundingClientRect();
      const at = next ? next.getBoundingClientRect().left : tabs.at(-1)!.getBoundingClientRect().right;
      return { drop: { kind: 'tab', pane: path, index }, mark: along(strip, at) };
    }
    const ratio = (y - box.top) / box.height;
    if (ratio < EDGE || ratio > 1 - EDGE) {
      if (own && source!.pane.panels.length === 1) return null;
      const edge = ratio < EDGE ? 'top' : 'bottom', parent = tree.at(layout.root, path.slice(0, -1));
      // Beside the canvas a new pane takes pixels from the canvas; elsewhere it halves the pane it is dropped on.
      // 在畫布旁，新的一格從畫布拿像素；其他地方平分被放上的那一格。
      const fits = parent?.kind === 'split' && parent.direction === 'column' && tree.hasCanvas(parent)
        ? !canvas || canvas.height - tree.PANE_HEIGHT >= tree.CANVAS_MIN_HEIGHT : box.height / 2 >= tree.PANE_MIN;
      return { drop: { kind: 'beside', pane: path, edge }, mark: { ...across(box, edge === 'top' ? box.top : box.bottom), label: newPane }, refused: fits ? undefined : noRoom };
    }
    // The tabs it will sit among (hidden ones keep their places but are not counted); the pointer's part of the width picks
    // the place. 會和哪些分頁並排（隱藏的保留位置、不算）；游標在寬度的哪一段決定位置。
    const others = pane.panels.filter(id => id !== panel && !layout.hidden.includes(id));
    if (!others.length) return null;
    const count = others.length + 1, at = Math.max(0, Math.min(count - 1, Math.floor((x - box.left) / box.width * count)));
    const index = at < others.length ? pane.panels.indexOf(others[at]!) : pane.panels.length;
    return { drop: { kind: 'tab', pane: path, index }, mark: { kind: 'frame', left: box.left, top: box.top, width: box.width, height: box.height, slots: { count, at }, label: asTab } };
  }
  if (pane?.kind === 'canvas') {
    if (y - box.top < BAND || box.bottom - y < BAND) {
      const edge = y - box.top < BAND ? 'top' : 'bottom', fits = box.height - tree.PANE_HEIGHT >= tree.CANVAS_MIN_HEIGHT;
      return { drop: { kind: 'beside', pane: path, edge }, mark: { ...across(box, edge === 'top' ? box.top : box.bottom), label: newPane }, refused: fits ? undefined : noRoom };
    }
    for (const side of ['left', 'right'] as const) {
      if (layout.hasPanels(side) && !layout.closed[side]) continue;
      // What the side will take: its width when it is there but closed, a new side's width otherwise; the part of the canvas
      // that means "that side" is as wide, but leaves the middle free. 那一側會佔的寬；畫布上代表那一側的範圍一樣寬，但留下中間。
      const root = layout.root, there = root.kind === 'split' ? root.children.findIndex((_, index) => tree.sideOf(root, index) === side) : -1;
      const width = root.kind === 'split' && there >= 0 ? root.sizes[there]! : tree.SIDE_WIDTH, reach = Math.min(width, box.width * .4);
      if (side === 'left' ? x - box.left >= reach : box.right - x >= reach) continue;
      return { drop: { kind: 'side', side }, mark: { ...along(box, side === 'left' ? box.left : box.right), label: there >= 0 ? tabOnSide[side] : onSide[side], side },
        refused: box.width - width >= tree.CANVAS_MIN_WIDTH ? undefined : noRoom };
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
  start.current = (event, panel) => {
    if (event.button !== 0) return;
    const x0 = event.clientX, y0 = event.clientY, pointer = event.pointerId, controller = new AbortController();
    const options = { capture: true, signal: controller.signal };
    let moving = false, hint: Hint = null;
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
      if (!moving && Math.hypot(move.clientX - x0, move.clientY - y0) < 6) return;
      move.preventDefault(); move.stopPropagation();
      if (!moving) { moving = true; document.documentElement.classList.add('moving-panel'); }
      hint = hintAt(now.current, panel, move.clientX, move.clientY);
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
    {mark && <div className={'drop-mark ' + mark.kind + (mark.side ? ' ' + mark.side : '') + (drag.hint!.refused ? ' refused' : '')}
      style={{ left: mark.left, top: mark.top, width: mark.width, height: mark.height }}>
      {mark.kind === 'frame' && ['tl', 'tr', 'bl', 'br'].map(corner => <span key={corner} className={'drop-corner ' + corner} />)}
      {mark.slots && <span className="drop-slots">{Array.from({ length: mark.slots.count }, (_, index) =>
        <span key={index} className={'drop-slot' + (index === mark.slots!.at ? ' at' : '')} />)}</span>}
      {(drag.hint!.refused ?? mark.label) && <span className="drop-label">{say(drag.hint!.refused ?? mark.label!)}</span>}</div>}
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
