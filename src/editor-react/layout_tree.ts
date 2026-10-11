// The layout as data (Refactor.68; human 2026-10-10; work/in-place-refactor-design/layout-tree.md): a tree of panes
// between the title bar and the foot bar. A split pane cuts its area into a row (left to right) or a column (top to
// bottom); a tab pane holds panels shown as tabs; the canvas is one fixed pane. Panes are areas, panels are content
// (GLOSSARY). Pure functions on plain data, no screen: the screen (layout.tsx) measures and draws, this decides.
// 版面的資料：夾在標題列與底列之間的一棵窗格樹。分割窗格把一塊切成左右（row）或上下（column）；分頁窗格放以分頁顯示的面板；
// 畫布是固定的一格。窗格是區域、面板是內容。純函式、不碰畫面：畫面量尺寸與畫，這裡做決定。
//
// Sizes: in a split pane that holds the canvas, the canvas's part takes what is left and the others are pixels (a side's
// width, a pane's height above or below the canvas); in any other split pane they are shares of its length.
// 大小：含畫布的分割窗格裡，畫布那一格佔剩下的，其他記像素（側邊寬、畫布上下的高）；其他分割窗格裡記比例。
//
// The outermost pane is a row: what lies before the canvas's part is the left side, after it the right side (the side
// toggles read this). Any arrangement inside is allowed (R.68.4, human 2026-10-10: try everything first, then decide what to
// limit); which ones people can make is decided only by where things may be dropped (layout.tsx), never by the format.
// 最外層是左右分：畫布那一格之前是左側、之後是右側（左右開關照這個算）。裡面怎麼排都可以（R.68.4，人類 10-10：先都試過再決定
// 限制）；人能排出哪些，只由可放置的地方決定（layout.tsx），不由格式決定。

export type Direction = 'row' | 'column';
export type Side = 'left' | 'right';
export type Pane =
  | { kind: 'split'; direction: Direction; children: Pane[]; sizes: number[] }
  /** collapsed: only its tab bar shows (Refactor.80); only in a column split, where the others take the height.
   * collapsed：只剩分頁列（R.80）；只在上下分割裡，高度給其他格。 */
  | { kind: 'tabs'; panels: string[]; active: string; collapsed?: true }
  | { kind: 'canvas' };
export type LayoutData = {
  version: 2; titleBar: boolean; root: Pane;
  /** Panels taken off the screen from the Layout menu; they keep their place. Layout 選單關掉的面板，原位保留。 */
  hidden: string[];
  /** The left and right toggles: a closed side is kept, only not drawn. 左右開關：收起的一側保留、只是不畫。 */
  closed: Record<Side, boolean>;
};
/** Each panel's default side, in the default tab order; `first` is the tab shown first. 每個面板的預設側與分頁順序。 */
export type PanelDefaults = readonly (readonly [id: string, side: Side, first?: boolean])[];
/** Where a tab pane sits: indices from the root. 窗格的位置：從根往下的索引。 */
export type Path = readonly number[];

// Sizes in pixels (tentative, human 2026-10-09: to be tuned; a side at least 300, R.53; the canvas's minimum smaller, R.68.5).
// 像素尺寸（暫定，可調；一側至少 300；畫布最小值調小，R.68.5）。
export const SIDE_WIDTH = 380, SIDE_MIN = 300, SIDE_MAX = 900, PANE_HEIGHT = 240, PANE_MIN = 120, PANE_MIN_WIDTH = 160,
  CANVAS_MIN_WIDTH = 200, CANVAS_MIN_HEIGHT = 160;

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export const hasCanvas = (pane: Pane): boolean => pane.kind === 'canvas' || (pane.kind === 'split' && pane.children.some(hasCanvas));
export const at = (root: Pane, path: Path): Pane | undefined =>
  path.reduce<Pane | undefined>((pane, index) => pane?.kind === 'split' ? pane.children[index] : undefined, root);
/** Every tab pane with its path. 所有分頁窗格與位置。 */
export function tabPanes(root: Pane, path: number[] = []): { pane: Extract<Pane, { kind: 'tabs' }>; path: number[] }[] {
  if (root.kind === 'tabs') return [{ pane: root, path }];
  return root.kind === 'split' ? root.children.flatMap((child, index) => tabPanes(child, [...path, index])) : [];
}
export const paneOf = (root: Pane, panel: string) => tabPanes(root).find(found => found.pane.panels.includes(panel));
/** A tab pane is drawn when one of its panels is shown; a split pane when one of its children is. 有可見內容才畫。 */
export const shown = (pane: Pane, hidden: readonly string[]): boolean => pane.kind === 'canvas'
  || (pane.kind === 'tabs' ? pane.panels.some(id => !hidden.includes(id)) : pane.children.some(child => shown(child, hidden)));
/** Which side of the canvas an outermost part is on, from the tree (human 2026-10-10: the toggles must not need to be told).
 * 最外層的某一格在畫布哪一側，從樹算出（人類：開關不必另外被告知）。 */
export function sideOf(root: Pane, index: number): Side | null {
  if (root.kind !== 'split' || root.direction !== 'row') return null;
  const centre = root.children.findIndex(hasCanvas);
  return index < centre ? 'left' : index > centre ? 'right' : null;
}
/** Whether a side has anything to show (its toggle is greyed out otherwise). 那一側有沒有東西（沒有就讓開關變灰）。 */
export const sideHasPanels = (layout: LayoutData, side: Side) => layout.root.kind === 'split'
  && layout.root.children.some((child, index) => sideOf(layout.root, index) === side && shown(child, layout.hidden));
/** Whether a side is on screen: it has panels and is not closed. 那一側在畫面上：有面板、沒收起。 */
export const sideOpen = (layout: LayoutData, side: Side) => sideHasPanels(layout, side) && !layout.closed[side];

/** How wide the canvas would be in a layout `width` wide, by the sizes kept: on its way down from the outermost row, every
 * part shown beside it in a row takes its pixels. 版面寬 width 時畫布會有多寬（照記下的大小）：從最外層往下，每個左右分割裡
 * 畫布旁顯示的格子各拿走它的像素。 */
export function canvasWidth(layout: LayoutData, width: number): number {
  let rest = width, pane = layout.root;
  while (pane.kind === 'split') {
    const centre = pane.children.findIndex(hasCanvas), split = pane;
    if (split.direction === 'row') split.children.forEach((child, index) => {
      const side = split === layout.root ? sideOf(split, index) : null;
      if (index !== centre && shown(child, layout.hidden) && !(side && layout.closed[side])) rest -= split.sizes[index] ?? 0;
    });
    pane = split.children[centre]!;
  }
  return rest;
}
/** The canvas always keeps its minimum (human 2026-10-10; it holds the side toggles). With both sides open and too little room,
 * one closes: the one that was already open when the other was just opened (legacy: on a narrow screen, opening the right
 * closes the left), else the right. With one side open there is nothing to close; it narrows on screen instead.
 * 畫布永遠保有最小寬度（人類 10-10；左右開關在它上面）。兩側都開、空間不夠時關掉一側：剛打開另一側時，關掉原本開著的那側（舊產品：
 * 窄畫面上開右邊會關掉左邊），否則關右側。只開一側時沒有可關的，改在畫面上變窄。 */
export function sideToClose(layout: LayoutData, width: number, opened: Side | null): Side | null {
  if (canvasWidth(layout, width) >= CANVAS_MIN_WIDTH || !sideOpen(layout, 'left') || !sideOpen(layout, 'right')) return null;
  return opened === 'right' ? 'left' : 'right';
}

/** Drop empty tab panes and empty splits, and put a split of one part in that part's place; the outermost row stays (the
 * sides are read from it). A tab pane is collapsed only while it is stacked in a column split (`stacked`); moved out of one,
 * it opens. 拿掉空的窗格與分割，只剩一格的分割換成那一格；最外層保留（左右側從它算）。分頁窗格只有疊在上下分割裡才能收起
 * （stacked）；離開上下分割就打開。 */
export function tidy(pane: Pane, outermost = true, stacked = false): Pane | null {
  if (pane.kind === 'canvas') return pane;
  if (pane.kind === 'tabs') {
    if (!pane.panels.length) return null;
    const active = pane.panels.includes(pane.active) ? pane.active : pane.panels[0]!;
    if (pane.collapsed && !stacked) { const { collapsed: _, ...open } = pane; return { ...open, active }; }
    return active === pane.active ? pane : { ...pane, active };
  }
  const children: Pane[] = [], sizes: number[] = [];
  pane.children.forEach((child, index) => { const kept = tidy(child, false, pane.direction === 'column'); if (kept) { children.push(kept); sizes.push(pane.sizes[index] ?? 1); } });
  if (!children.length) return null;
  // A split of one part gives way to that part, which now sits where the split sat. 只剩一格的分割讓給那一格，它坐到分割的位置。
  if (children.length === 1 && !outermost) return tidy(children[0]!, false, stacked);
  return { ...pane, children, sizes };
}
/** Whether the pane at `path` is stacked in a column split, so it can collapse to its tab bar (Refactor.80).
 * 這一格是否疊在上下分割裡，可以收成分頁列（R.80）。 */
export const stacked = (root: Pane, path: Path) => {
  const parent = path.length ? at(root, path.slice(0, -1)) : undefined;
  return parent?.kind === 'split' && parent.direction === 'column';
};
/** Collapse a stacked tab pane to its tab bar, or open it (Refactor.80). 把疊著的分頁窗格收成分頁列，或打開（R.80）。 */
export function setCollapsed(layout: LayoutData, path: Path, collapsed: boolean): LayoutData {
  const pane = at(layout.root, path);
  if (pane?.kind !== 'tabs' || !!pane.collapsed === collapsed || (collapsed && !stacked(layout.root, path))) return layout;
  const next = copy(layout), target = at(next.root, path) as Extract<Pane, { kind: 'tabs' }>;
  if (collapsed) target.collapsed = true; else delete target.collapsed;
  return next;
}

export function defaultLayout(panels: PanelDefaults): LayoutData {
  const side = (which: Side): Pane | null => {
    const ids = panels.filter(row => row[1] === which).map(row => row[0]);
    return ids.length ? { kind: 'tabs', panels: ids, active: panels.find(row => row[1] === which && row[2])?.[0] ?? ids[0]! } : null;
  };
  const left = side('left'), right = side('right');
  const children = [left, { kind: 'canvas' } as Pane, right].filter((pane): pane is Pane => !!pane);
  // Default as the legacy editor: the Parameter panel open on the right (Refactor.76; until then the right side started closed).
  // 預設照舊產品：參數面板在右邊、打開（R.76；之前右側一開始收著）。
  return { version: 2, titleBar: true, root: { kind: 'split', direction: 'row', children, sizes: children.map(pane => hasCanvas(pane) ? 1 : SIDE_WIDTH) },
    hidden: [], closed: { left: false, right: false } };
}

/** A stored layout, used only if it reads cleanly: unknown panels are dropped, new ones go to their default side, a R.53
 * layout (version 1) is carried over; anything unreadable gives the defaults (no damage, no loss).
 * 存的版面讀得懂才用：不認得的面板丟掉、新面板放到預設那一側、R.53 的版面（version 1）轉過來；讀不懂就回到預設。 */
export function readLayout(stored: unknown, panels: PanelDefaults): LayoutData {
  const fallback = defaultLayout(panels);
  try {
    const known = new Set(panels.map(row => row[0])), seen = new Set<string>();
    const value = stored as Record<string, unknown> | null;
    let layout: LayoutData;
    if (value?.version === 1) layout = fromVersion1(value, fallback);
    else if (value?.version === 2) {
      const pane = (raw: unknown): Pane | null => {
        const node = raw as Record<string, unknown>;
        if (node?.kind === 'canvas') return { kind: 'canvas' };
        if (node?.kind === 'tabs' && Array.isArray(node.panels))
          return { kind: 'tabs', panels: node.panels.filter((id): id is string => typeof id === 'string'), active: String(node.active),
            ...(node.collapsed === true ? { collapsed: true as const } : {}) };
        if (node?.kind === 'split' && (node.direction === 'row' || node.direction === 'column') && Array.isArray(node.children)) {
          const sizes = Array.isArray(node.sizes) ? node.sizes : [];
          return { kind: 'split', direction: node.direction, children: node.children.map(pane).filter((p): p is Pane => !!p),
            sizes: node.children.map((_, index) => Number(sizes[index]) > 0 ? Number(sizes[index]) : 1) };
        }
        return null;
      };
      const root = pane(value.root);
      const closed = value.closed as Record<string, unknown> | undefined;
      layout = { version: 2, titleBar: value.titleBar !== false, root: root ?? fallback.root,
        hidden: Array.isArray(value.hidden) ? value.hidden.filter((id): id is string => typeof id === 'string' && known.has(id)) : [],
        closed: { left: closed?.left === true, right: closed?.right === true } };
    } else return fallback;
    // The shape this round allows; anything else is not ours to guess at. 這一輪允許的形狀；別的不猜。
    if (!wellFormed(layout.root)) return fallback;
    // Each known panel once. 認得的面板各一次。
    for (const found of tabPanes(layout.root)) found.pane.panels = found.pane.panels.filter(id => known.has(id) && !seen.has(id) && !!seen.add(id));
    const tidied = tidy(layout.root);
    if (!tidied) return fallback;
    layout.root = tidied;
    for (const [id, side] of panels) if (!tabPanes(layout.root).some(found => found.pane.panels.includes(id))) layout = addToSide(layout, id, side);
    return layout;
  } catch { return fallback; }
}
const canvases = (pane: Pane): number => pane.kind === 'canvas' ? 1 : pane.kind === 'split' ? pane.children.reduce((sum, child) => sum + canvases(child), 0) : 0;
/** An outermost row with the canvas in it exactly once. 最外層左右分、畫布剛好一個。 */
const wellFormed = (root: Pane) => root.kind === 'split' && root.direction === 'row' && canvases(root) === 1;
function fromVersion1(value: Record<string, unknown>, fallback: LayoutData): LayoutData {
  type Zone = { open?: boolean; width?: number; groups?: { panels?: unknown[]; active?: unknown; size?: unknown }[] };
  const side = (raw: unknown): { pane: Pane; width: number; open: boolean } | null => {
    const zone = raw as Zone | undefined;
    const groups = (zone?.groups ?? []).map(group => ({ kind: 'tabs', panels: (group.panels ?? []).filter((id): id is string => typeof id === 'string'),
      active: String(group.active) }) as Pane);
    if (!groups.length) return null;
    const width = Math.min(SIDE_MAX, Math.max(SIDE_MIN, Number(zone?.width) || SIDE_WIDTH));
    const pane: Pane = groups.length === 1 ? groups[0]! : { kind: 'split', direction: 'column', children: groups,
      sizes: (zone?.groups ?? []).map(group => Number(group.size) > 0 ? Number(group.size) : 1) };
    return { pane, width, open: zone?.open !== false };
  };
  const left = side(value.left), right = side(value.right);
  const centre = fallback.root.kind === 'split' ? fallback.root.children.find(hasCanvas)! : fallback.root;
  const parts = [left && [left.pane, left.width], [centre, 1], right && [right.pane, right.width]].filter((part): part is [Pane, number] => !!part);
  return { version: 2, titleBar: value.titleBar !== false, root: { kind: 'split', direction: 'row', children: parts.map(part => part[0]), sizes: parts.map(part => part[1]) },
    hidden: [], closed: { left: left ? !left.open : false, right: right ? !right.open : true } };
}

/** Put a panel on a side: as the last tab of the side's first tab pane (human 2026-10-10: joining a side, a tab by
 * default, not a new pane; R.53 put new panels there too), or the side itself when it has nothing.
 * 把面板放到某一側：成為那一側第一個分頁窗格的最後一個分頁（人類 10-10：加入一側預設是分頁、不是切新格；R.53 新面板也放那裡）；
 * 那一側沒有東西就建立它。 */
export function addToSide(layout: LayoutData, panel: string, side: Side): LayoutData {
  const next = copy(layout), root = next.root as Extract<Pane, { kind: 'split' }>;
  const centre = root.children.findIndex(hasCanvas);
  const index = side === 'left' ? centre - 1 : centre + 1, existing = sideOf(root, index) === side ? root.children[index] : undefined;
  const first = existing && tabPanes(existing)[0]?.pane;
  if (first) { first.panels.push(panel); first.active = panel; return next; }
  root.children.splice(side === 'left' ? centre : centre + 1, 0, { kind: 'tabs', panels: [panel], active: panel });
  root.sizes.splice(side === 'left' ? centre : centre + 1, 0, SIDE_WIDTH);
  return next;
}

/** Where a dragged panel goes. tab: into a tab pane at a tab position; beside: a new tab pane on one edge of a pane (a tab
 * pane or the canvas); side: a tab on that side (made, or opened, if needed; see addToSide).
 * 拖著的面板放到哪：tab＝放進某個分頁窗格的某個位置；beside＝在某一格（分頁窗格或畫布）的某條邊旁多一個分頁窗格；side＝那一側的分頁（見 addToSide）。 */
export type Edge = 'top' | 'bottom' | 'left' | 'right';
export type Drop =
  | { kind: 'tab'; pane: Path; index: number }
  | { kind: 'beside'; pane: Path; edge: Edge }
  | { kind: 'side'; side: Side };

/** Move a panel; the result is tidied. A drop that changes nothing returns the layout as it was.
 * 移動面板，結果整理過。沒有改變的放置原樣回傳。 */
export function movePanel(layout: LayoutData, panel: string, drop: Drop): LayoutData {
  const source = paneOf(layout.root, panel);
  if (!source) return layout;
  if (drop.kind === 'side') return finish(addToSide(remove(layout, panel), panel, drop.side), panel, drop.side);
  const next = copy(layout), target = at(next.root, drop.pane);
  if (!target) return layout;
  const from = at(next.root, source.path) as Extract<Pane, { kind: 'tabs' }>;
  if (drop.kind === 'tab') {
    if (target.kind !== 'tabs') return layout;
    let index = Math.max(0, Math.min(drop.index, target.panels.length));
    if (target === from) {
      const old = from.panels.indexOf(panel);
      if (old < index) index--;
      if (old === index) return layout;
    }
    from.panels.splice(from.panels.indexOf(panel), 1);
    target.panels.splice(index, 0, panel); target.active = panel;
  } else {
    if (target === from && from.panels.length === 1) return layout;
    from.panels.splice(from.panels.indexOf(panel), 1);
    const fresh: Pane = { kind: 'tabs', panels: [panel], active: panel };
    const direction: Direction = drop.edge === 'top' || drop.edge === 'bottom' ? 'column' : 'row', before = drop.edge === 'top' || drop.edge === 'left';
    const pixels = direction === 'row' ? SIDE_WIDTH : PANE_HEIGHT;
    const parent = at(next.root, drop.pane.slice(0, -1)) as Extract<Pane, { kind: 'split' }> | undefined, place = drop.pane[drop.pane.length - 1]!;
    if (parent?.kind === 'split' && parent.direction === direction) {
      // Into the split it is in, the same way: next to the canvas in pixels, elsewhere by sharing the target's part.
      // 放進所在、方向相同的分割：在畫布旁記像素；其他地方平分目標那一格。
      const by = hasCanvas(parent) ? pixels : (parent.sizes[place] ?? 1) / 2;
      if (!hasCanvas(parent)) parent.sizes[place] = by;
      const index = before ? place : place + 1;
      parent.children.splice(index, 0, fresh); parent.sizes.splice(index, 0, by);
    } else {
      // Otherwise the target becomes a split of two in that direction (the canvas keeps the rest, the new pane its pixels).
      // 否則目標變成那個方向的兩格（是畫布的話，畫布佔剩下的、新的一格記像素）。
      const pair = before ? [fresh, target] : [target, fresh];
      replace(next, drop.pane, { kind: 'split', direction, children: pair, sizes: pair.map(pane => hasCanvas(target) ? (pane === fresh ? pixels : 1) : 1) });
    }
  }
  next.root = tidy(next.root) ?? layout.root;
  return finish(next, panel, null);
}
const remove = (layout: LayoutData, panel: string): LayoutData => {
  const next = copy(layout);
  for (const found of tabPanes(next.root)) found.pane.panels = found.pane.panels.filter(id => id !== panel);
  next.root = tidy(next.root) ?? layout.root;
  return next;
};
function replace(layout: LayoutData, path: Path, pane: Pane) {
  if (!path.length) { layout.root = pane; return; }
  (at(layout.root, path.slice(0, -1)) as Extract<Pane, { kind: 'split' }>).children[path[path.length - 1]!] = pane;
}
/** A moved panel is shown, its tab chosen, and its side opened. 搬過的面板：顯示、選中、打開所在的那一側。 */
function finish(layout: LayoutData, panel: string, side: Side | null): LayoutData {
  const placed = paneOf(layout.root, panel);
  // Moved, shown or added: it is seen, so its pane opens (Refactor.80). 搬過、顯示或加入的面板要看得到，所在的窗格打開（R.80）。
  if (placed) { placed.pane.active = panel; delete placed.pane.collapsed; }
  const opened = side ?? (placed && layout.root.kind === 'split' ? sideOf(layout.root, placed.path[0]!) : null);
  return { ...layout, hidden: layout.hidden.filter(id => id !== panel), closed: opened ? { ...layout.closed, [opened]: false } : layout.closed };
}

/** Bring a panel forward: shown, its tab chosen, its side opened. 把面板叫到前面：顯示、選中、打開所在的那一側。 */
export const showPanel = (layout: LayoutData, panel: string) => finish(copy(layout), panel, null);
export const hidePanel = (layout: LayoutData, panel: string): LayoutData =>
  layout.hidden.includes(panel) ? layout : { ...layout, hidden: [...layout.hidden, panel] };
/** Show a tab; a collapsed pane opens (its tab clicked, Refactor.80). 顯示某個分頁；收起的窗格打開（點它的分頁，R.80）。 */
export function activate(layout: LayoutData, path: Path, panel: string): LayoutData {
  const next = copy(layout), pane = at(next.root, path);
  if (pane?.kind === 'tabs' && pane.panels.includes(panel)) { pane.active = panel; delete pane.collapsed; }
  return next;
}
export function resize(layout: LayoutData, path: Path, sizes: readonly number[]): LayoutData {
  const next = copy(layout), pane = at(next.root, path);
  if (pane?.kind === 'split') pane.sizes = pane.children.map((_, index) => sizes[index] ?? pane.sizes[index] ?? 1);
  return next;
}
