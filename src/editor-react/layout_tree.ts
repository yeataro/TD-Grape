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
  /** Panels floating now, with where they were before (Refactor.84): a floating panel stays a member of its tab pane, which
   * skips it, so it can always go back (human 2026-10-11; legacy inspector.js:2232). 現在浮動的面板，記浮起來前在哪（R.84）：浮動的面板
   * 仍是原本分頁窗格的成員、那一格畫時跳過，所以一定回得去（人類 10-11；照舊產品）。 */
  floating: Record<string, 'docked' | 'closed'>;
  /** Where each panel floats, kept after it goes back so it floats there again (human 2026-10-11). 每個面板浮動的位置；回去後仍記著，
   * 下次浮動回到這裡（人類 10-11）。 */
  floats: Record<string, FloatPlace>;
};
/** The first version floats in the network's four corners (Refactor.84, human 2026-10-11); dragging picks the corner.
 * 第一版浮在網路區的四個角（R.84，人類 10-11）；拖曳決定去哪一角。 */
export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export const CORNERS: readonly Corner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
export type FloatPlace = { corner: Corner; width: number; height: number; collapsed?: true };
/** Panels that float in one corner only, which no other panel may take (human 2026-10-11: the Parameter panel stays top right).
 * Given by the panel table, not stored. 只浮在某一角的面板，那一角別人不能用（人類 10-11：參數面板留在右上角）。由面板表給，不存。 */
export type Homes = Readonly<Record<string, Corner>>;
/** Each panel's default side, in the default tab order; `first` is the tab shown first. 每個面板的預設側與分頁順序。 */
export type PanelDefaults = readonly (readonly [id: string, side: Side, first?: boolean])[];
/** Where a tab pane sits: indices from the root. 窗格的位置：從根往下的索引。 */
export type Path = readonly number[];

// Sizes in pixels (tentative, human 2026-10-09: to be tuned; a side at least 300, R.53; the canvas's minimum smaller, R.68.5).
// 像素尺寸（暫定，可調；一側至少 300；畫布最小值調小，R.68.5）。
export const SIDE_WIDTH = 380, SIDE_MIN = 300, SIDE_MAX = 900, PANE_HEIGHT = 240, PANE_MIN = 120, PANE_MIN_WIDTH = 160,
  CANVAS_MIN_WIDTH = 200, CANVAS_MIN_HEIGHT = 160;
// A floating panel's first size and its least (legacy: 320 wide, at least 280 x 160, inspector.js:1972, 2177).
// 浮動面板一開始的大小與最小值（舊產品：寬 320、至少 280 x 160）。
export const FLOAT_WIDTH = 320, FLOAT_HEIGHT = 360, FLOAT_MIN_WIDTH = 280, FLOAT_MIN_HEIGHT = 160;

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
/** The panels the tree does not draw: hidden ones and floating ones. 版面樹不畫的面板：隱藏的與浮動的。 */
export const away = (layout: LayoutData): string[] => [...layout.hidden, ...Object.keys(layout.floating)];
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
  && layout.root.children.some((child, index) => sideOf(layout.root, index) === side && shown(child, away(layout)));
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
      if (index !== centre && shown(child, away(layout)) && !(side && layout.closed[side])) rest -= split.sizes[index] ?? 0;
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
    hidden: [], closed: { left: false, right: false }, floating: {}, floats: {} };
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
        closed: { left: closed?.left === true, right: closed?.right === true }, floating: {}, floats: {} };
      // Floating panels (Refactor.84): read only what is well formed. 浮動面板（R.84）：只讀格式對的。
      const floats = value.floats as Record<string, Record<string, unknown>> | undefined, floating = value.floating as Record<string, unknown> | undefined;
      for (const [id, place] of Object.entries(floats && typeof floats === 'object' ? floats : {}))
        if (known.has(id) && place && CORNERS.includes(place.corner as Corner) && Number(place.width) > 0 && Number(place.height) > 0)
          layout.floats[id] = { corner: place.corner as Corner, width: Number(place.width), height: Number(place.height), ...(place.collapsed === true ? { collapsed: true as const } : {}) };
      for (const [id, from] of Object.entries(floating && typeof floating === 'object' ? floating : {}))
        if (layout.floats[id] && (from === 'docked' || from === 'closed')) layout.floating[id] = from;
    } else return fallback;
    // The shape this round allows; anything else is not ours to guess at. 這一輪允許的形狀；別的不猜。
    if (!wellFormed(layout.root)) return fallback;
    // Each known panel once. 認得的面板各一次。
    for (const found of tabPanes(layout.root)) found.pane.panels = found.pane.panels.filter(id => known.has(id) && !seen.has(id) && !!seen.add(id));
    const tidied = tidy(layout.root);
    if (!tidied) return fallback;
    layout.root = tidied;
    for (const [id, side] of panels) if (!tabPanes(layout.root).some(found => found.pane.panels.includes(id))) layout = addToSide(layout, id, side);
    // One panel per corner: a second one on the same corner goes back. 一角一個：同一角的第二個回去。
    const taken = new Set<Corner>();
    for (const id of Object.keys(layout.floating)) { const corner = layout.floats[id]!.corner; if (taken.has(corner)) delete layout.floating[id]; else taken.add(corner); }
    layout.hidden = layout.hidden.filter(id => !layout.floating[id]);
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
    hidden: [], closed: { left: left ? !left.open : false, right: right ? !right.open : true }, floating: {}, floats: {} };
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
  // A floating panel dropped where it already belongs lands there (Refactor.84). 浮動面板放回它原本所屬的位置：就地落地（R.84）。
  if (layout.floating[panel]) {
    const bare = { ...layout, floating: {} }, moved = movePanel(bare, panel, drop);
    return finish(copy(moved === bare ? layout : { ...moved, floating: layout.floating }), panel, null);
  }
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
/** A moved panel is shown, its tab chosen, and its side opened; one dragged in from floating lands (Refactor.84).
 * 搬過的面板：顯示、選中、打開所在的那一側；從浮動拖進來的落地（R.84）。 */
function finish(layout: LayoutData, panel: string, side: Side | null): LayoutData {
  if (layout.floating[panel]) { const { [panel]: _, ...rest } = layout.floating; layout = { ...layout, floating: rest }; }
  const placed = paneOf(layout.root, panel);
  // Moved, shown or added: it is seen, so its pane opens (Refactor.80). 搬過、顯示或加入的面板要看得到，所在的窗格打開（R.80）。
  if (placed) { placed.pane.active = panel; delete placed.pane.collapsed; }
  const opened = side ?? (placed && layout.root.kind === 'split' ? sideOf(layout.root, placed.path[0]!) : null);
  return { ...layout, hidden: layout.hidden.filter(id => id !== panel), closed: opened ? { ...layout.closed, [opened]: false } : layout.closed };
}

/** Bring a panel forward: shown, its tab chosen, its side opened; a floating one stays where it floats and opens (human
 * 2026-10-11, floating-panels question 9). 把面板叫到前面：顯示、選中、打開所在的那一側；浮動的留在原地、展開（人類 10-11，第 9 題）。 */
export const showPanel = (layout: LayoutData, panel: string) => layout.floating[panel]
  ? setFloat(layout, panel, { collapsed: false }) : finish(copy(layout), panel, null);
/** Close a panel: it is hidden, and no longer floats (human 2026-10-11: closing is closing). 關閉面板：藏起來，也不再浮動（人類：關閉就是關閉）。 */
export function hidePanel(layout: LayoutData, panel: string): LayoutData {
  const { [panel]: _, ...floating } = layout.floating;
  return layout.hidden.includes(panel) && !layout.floating[panel] ? layout : { ...layout, floating, hidden: [...layout.hidden.filter(id => id !== panel), panel] };
}

/** Which panel floats in a corner. 哪個面板浮在這一角。 */
export const occupant = (layout: LayoutData, corner: Corner) => Object.keys(layout.floating).find(id => layout.floats[id]?.corner === corner);
/** Float a panel (Pop out, Refactor.84): to the corner it floated in last, else the first free one of `corners` (nearest first,
 * from where it sits), else the first, whose panel goes back. It keeps whether it was in the tree or closed, to go back to.
 * 讓面板浮動（Pop out，R.84）：去它上次浮的那一角，否則 corners（由近到遠）裡第一個空的，都滿就去第一個、那一角的面板回去。記住浮起來前
 * 在版面裡還是關著，回去時用。 */
export function popOut(layout: LayoutData, panel: string, corners: readonly Corner[] = CORNERS, homes: Homes = {}): LayoutData {
  if (layout.floating[panel] || !paneOf(layout.root, panel)) return layout;
  const last = layout.floats[panel], kept = (each: Corner) => Object.entries(homes).some(([id, home]) => home === each && id !== panel);
  const order = homes[panel] ? [homes[panel]!] : [...(last ? [last.corner] : []), ...corners, ...CORNERS].filter(each => !kept(each));
  const corner = order.find(each => !occupant(layout, each)) ?? order[0]!, other = occupant(layout, corner);
  const next = other ? backToA(layout, other) : layout;
  return { ...next, hidden: next.hidden.filter(id => id !== panel), floating: { ...next.floating, [panel]: next.hidden.includes(panel) ? 'closed' : 'docked' },
    // Its last size, open: it was just called up. 上次的大小、打開：剛被叫出來。
    floats: { ...next.floats, [panel]: { width: last?.width ?? FLOAT_WIDTH, height: last?.height ?? FLOAT_HEIGHT, corner } } };
}
/** Stop floating and go back to where it was before: its tab pane, or closed (human 2026-10-11). 不再浮動、回到浮起來前：
 * 所屬的分頁窗格，或關閉（人類 10-11）。 */
export function backToA(layout: LayoutData, panel: string): LayoutData {
  const from = layout.floating[panel];
  if (!from) return layout;
  const { [panel]: _, ...floating } = layout.floating, next = copy({ ...layout, floating });
  if (from === 'closed') return { ...next, hidden: [...next.hidden.filter(id => id !== panel), panel] };
  // Back as its pane's shown tab, the sides left as they are: it goes back to how things were, it does not open a side
  // (Refactor.86: P sent it back and opened the right side, which closed the left). 回到它那一格、成為顯示中的分頁，兩側照舊：
  // 是回到原本的樣子，不打開任何一側（R.86：按 P 送回去時打開了右側、左側因此收起）。
  const placed = paneOf(next.root, panel);
  if (placed) { placed.pane.active = panel; delete placed.pane.collapsed; }
  return next;
}
/** Float or go back: the A/B switch any button may call (human 2026-10-11). 浮動或回去：任何按鈕都能叫的 A／B 切換（人類 10-11）。 */
export const toggleFloat = (layout: LayoutData, panel: string, corners?: readonly Corner[], homes: Homes = {}) =>
  layout.floating[panel] ? backToA(layout, panel) : popOut(layout, panel, corners, homes);
/** Put floating panels where homes allow (a layout kept before a home was given): a panel with a home goes there, any other panel
 * in someone's home goes back. 讓浮動面板符合各自的家（家是後來才定的舊版面）：有家的回家，佔了別人家的回去。 */
export function keepHomes(layout: LayoutData, homes: Homes): LayoutData {
  let next = layout;
  for (const id of Object.keys(layout.floating)) {
    const place = next.floats[id];
    if (!place || !next.floating[id] || mayFloatIn(id, place.corner, homes)) continue;
    next = homes[id] ? { ...next, floats: { ...next.floats, [id]: { ...place, corner: homes[id]! } } } : backToA(next, id);
  }
  for (const [id, home] of Object.entries(homes)) {
    const other = Object.keys(next.floating).find(each => each !== id && next.floats[each]?.corner === home);
    if (other) next = backToA(next, other);
  }
  return next;
}
/** Whether a floating panel may go to a corner: not away from its home, not into another panel's home. 浮動面板能不能去某一角：
 * 有家的不離家，別人的家不能進。 */
export const mayFloatIn = (panel: string, corner: Corner, homes: Homes = {}) =>
  homes[panel] ? homes[panel] === corner : !Object.values(homes).includes(corner);
/** Move a floating panel to a corner; a panel already there takes its old corner (human 2026-10-11: swap).
 * 把浮動面板移到某一角；那一角已有面板就換到它原本的角（人類 10-11：互換）。 */
export function moveFloat(layout: LayoutData, panel: string, corner: Corner, homes: Homes = {}): LayoutData {
  const place = layout.floats[panel];
  if (!layout.floating[panel] || !place || place.corner === corner || !mayFloatIn(panel, corner, homes)) return layout;
  const other = occupant(layout, corner), floats = { ...layout.floats, [panel]: { ...place, corner } };
  if (other) floats[other] = { ...floats[other]!, corner: place.corner };
  return { ...layout, floats };
}
/** Change a floating panel's size or collapse. 改浮動面板的大小或收合。 */
export function setFloat(layout: LayoutData, panel: string, patch: { width?: number; height?: number; collapsed?: boolean }): LayoutData {
  const place = layout.floats[panel];
  if (!place) return layout;
  const { collapsed: _, ...open } = place;
  const next: FloatPlace = { ...open, ...(patch.width !== undefined ? { width: Math.max(FLOAT_MIN_WIDTH, Math.round(patch.width)) } : {}),
    ...(patch.height !== undefined ? { height: Math.max(FLOAT_MIN_HEIGHT, Math.round(patch.height)) } : {}),
    ...((patch.collapsed ?? place.collapsed) ? { collapsed: true as const } : {}) };
  return { ...layout, floats: { ...layout.floats, [panel]: next } };
}

/** The panel a floating panel pushes: the one above or below it on its side (`height`), or across its row (`width`).
 * 浮動面板會推到的那一個：同一邊上下的（height），或同一列對面的（width）。 */
const neighbour = (layout: LayoutData, corner: Corner, axis: 'width' | 'height') => {
  const [row, side] = corner.split('-') as ['top' | 'bottom', 'left' | 'right'];
  return occupant(layout, (axis === 'height' ? `${row === 'top' ? 'bottom' : 'top'}-${side}` : `${row}-${side === 'left' ? 'right' : 'left'}`) as Corner);
};
/** The least a floating panel is pushed to along an axis: its minimum; where two minimums do not fit, as little as leaves the other
 * its minimum, but never under the floor, so one of them can still have a usable size (Refactor.84: a narrow network); collapsed,
 * its title. 浮動面板在某個方向被推到的最小值：它的最小值；兩個最小值放不下時，讓另一個能有最小值、但不低於底線，好讓其中一個仍有可用的大小
 * （R.84：窄的網路區）；收起時是標題高。 */
const FLOOR = { width: 140, height: 80 } as const;
const leastOf = (place: FloatPlace | undefined, axis: 'width' | 'height', room: number, gap: number, title: number) => {
  if (axis === 'height' && place?.collapsed) return title;
  const least = axis === 'width' ? FLOAT_MIN_WIDTH : FLOAT_MIN_HEIGHT;
  return Math.min(least, Math.max(FLOOR[axis], room - gap - least));
};
/** Size a floating panel in an area `room` long on that axis. Panels push, they do not stick (human 2026-10-11): growing into the
 * one above or below (height) or across the row (width) pushes it smaller, down to its least, and stops there; shrinking leaves a
 * space; one pushed smaller stays so (it does not grow back when the other shrinks again). 在 room 長的範圍裡改浮動面板的大小。面板互相
 * 推擠、不黏在一起（人類 10-11）：長到碰到上下（高）或同一列對面（寬）的另一個時把它推小、最小到它的最小值就停；變小就留出空隙；被推小的
 * 維持那樣（另一個再變小時不會長回去）。 */
export function pushFloat(layout: LayoutData, panel: string, axis: 'width' | 'height', size: number, room: number, gap: number, title: number): LayoutData {
  const place = layout.floats[panel];
  if (!place) return layout;
  const other = neighbour(layout, place.corner, axis), partner = other ? layout.floats[other] : undefined;
  const least = (each: FloatPlace) => leastOf(each, axis, room, gap, title);
  const own = Math.round(Math.max(least(place), Math.min(size, room - (partner ? gap + least(partner) : 0))));
  const floats = { ...layout.floats, [panel]: { ...place, [axis]: own } };
  if (other && partner && !(axis === 'height' && partner.collapsed) && partner[axis] > room - gap - own)
    floats[other] = { ...partner, [axis]: Math.round(Math.max(least(partner), room - gap - own)) };
  return { ...layout, floats };
}

export type FloatRect = { x: number; y: number; width: number; height: number; collapsed: boolean };
/** Where each floating panel is drawn in an area `width` x `height` (the network between its toolbar and canvas controls, gaps
 * taken off). Width: its own, at most the area, at most half (less the gap) when the facing corner on its row is taken. Height:
 * its own (pushFloat keeps a side's two apart); when the area is smaller than they need (a smaller window), the top one leaves
 * the lower one its least and the lower one takes what is left, without changing what is kept. Collapsed, or no room: the title
 * only (`title` tall). 每個浮動面板畫在 width x height 的範圍裡哪裡（網路區功能列到畫布控制項之間，已扣間隙）。寬：自己的，不超過範圍；
 * 同一列對面那一角有面板時最多一半（扣間隙）。高：自己的（pushFloat 讓同一邊兩個不重疊）；範圍比需要的小時（視窗變小），上面的留給下面
 * 的最小值、下面的拿剩下的，不改記下的值。收起或放不下：只有標題（title 高）。 */
export function floatRects(layout: LayoutData, width: number, height: number, gap: number, title: number): Record<string, FloatRect> {
  const rects: Record<string, FloatRect> = {}, at = (corner: Corner) => occupant(layout, corner);
  for (const side of ['left', 'right'] as const) {
    const top = at(`top-${side}` as Corner), bottom = at(`bottom-${side}` as Corner);
    // Width: its own; across a row the left one leaves the right one its least, the right one takes at most what is left.
    // 寬：自己的；同一列時左邊的留給右邊的最小值，右邊的最多拿剩下的。
    const wide = (id: string, row: 'top' | 'bottom') => {
      const left = at(`${row}-left` as Corner), right = at(`${row}-right` as Corner), own = layout.floats[id]!.width;
      const least = (each: string) => leastOf(layout.floats[each], 'width', width, gap, title);
      if (!left || !right) return Math.max(0, Math.min(own, width));
      const leftWidth = Math.max(Math.min(least(left), width), Math.min(layout.floats[left]!.width, width - gap - least(right)));
      return Math.max(0, id === left ? leftWidth : Math.min(own, width - gap - leftWidth));
    };
    const both = !!top && !!bottom;
    const folded = (id: string) => !!layout.floats[id]?.collapsed || height < (both ? 2 * FLOAT_MIN_HEIGHT + gap : FLOAT_MIN_HEIGHT);
    const least = (id: string) => folded(id) ? title : FLOAT_MIN_HEIGHT;
    let topHeight = 0;
    if (top) {
      const room = bottom ? height - gap - least(bottom) : height;
      topHeight = folded(top) ? Math.min(title, height) : Math.max(Math.min(layout.floats[top]!.height, room), Math.min(least(top), room));
      const w = wide(top, 'top');
      rects[top] = { x: side === 'left' ? 0 : width - w, y: 0, width: w, height: topHeight, collapsed: folded(top) };
    }
    if (bottom) {
      const room = top ? height - gap - topHeight : height;
      const h = folded(bottom) ? Math.min(title, height) : Math.min(layout.floats[bottom]!.height, room);
      const w = wide(bottom, 'bottom');
      rects[bottom] = { x: side === 'left' ? 0 : width - w, y: height - h, width: w, height: h, collapsed: folded(bottom) };
    }
  }
  return rects;
}
/** The corner nearest a point in the area. 範圍裡離某一點最近的角。 */
export const cornerAt = (x: number, y: number, width: number, height: number): Corner =>
  `${y < height / 2 ? 'top' : 'bottom'}-${x < width / 2 ? 'left' : 'right'}` as Corner;
/** Corners from nearest to farthest for a box (where a panel sits), to float it near there (human 2026-10-11: from where it was).
 * 依某個框（面板所在處）由近到遠排好的四個角，讓它在附近浮動（人類 10-11：依原本的位置）。 */
export function cornersNear(box: { x: number; y: number; width: number; height: number }, width: number, height: number): Corner[] {
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const point: Record<Corner, [number, number]> = { 'top-left': [0, 0], 'top-right': [width, 0], 'bottom-left': [0, height], 'bottom-right': [width, height] };
  return [...CORNERS].sort((a, b) => Math.hypot(cx - point[a][0], cy - point[a][1]) - Math.hypot(cx - point[b][0], cy - point[b][1]));
}
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
