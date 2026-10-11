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
  /** Panels floating now. A panel with a home records where it was before (Refactor.84): it stays a member of its tab pane, which
   * skips it, so it can always go back (human 2026-10-11; legacy inspector.js:2232). Any other floats `free`: out of the tree
   * (Refactor.88, human 2026-10-12: no springing back). 現在浮動的面板。有家的記浮起來前在哪（R.84）：仍是原本分頁窗格的成員、那一格畫時
   * 跳過，所以一定回得去（人類 10-11；照舊產品）。其他的是 free：不在版面樹裡（R.88，人類 10-12：不彈回）。 */
  floating: Record<string, 'docked' | 'closed' | 'free'>;
  /** Where each panel floats, kept after it stops floating so it floats there again (human 2026-10-11). 每個面板浮動的位置；不浮動後
   * 仍記著，下次浮動回到這裡（人類 10-11）。 */
  floats: Record<string, FloatPlace>;
};
/** A corner of the floating area: a home panel's place (Refactor.84), or the corner a free panel follows (Refactor.88).
 * 浮動範圍的角：有家面板的位置（R.84），或自由浮動面板跟著走的角（R.88）。 */
export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export const CORNERS: readonly Corner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
/** `x`, `y`: a free panel's distance from its corner's two edges (Refactor.88). `tabs`, `active`: a floating frame holding several
 * panels as tabs, kept on the frame's key panel (Refactor.90). `with`: a panel closed out of a frame, the panels it was with, to go
 * back among them (Refactor.90, human 2026-10-12). x、y：自由浮動面板離它的角兩條邊多遠（R.88）。tabs、active：一個浮動框裝好幾個面板當
 * 分頁，記在框的鑰匙面板上（R.90）。with：從框裡關掉的面板，當時和哪些面板在一起，打開時回到它們那裡（R.90，人類 10-12）。 */
export type FloatPlace = { corner: Corner; width: number; height: number; collapsed?: true; x?: number; y?: number;
  tabs?: string[]; active?: string; with?: string[] };
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
      const offset = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
      const names = (value: unknown) => Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && known.has(id)) : [];
      for (const [id, place] of Object.entries(floats && typeof floats === 'object' ? floats : {}))
        if (known.has(id) && place && CORNERS.includes(place.corner as Corner) && Number(place.width) > 0 && Number(place.height) > 0)
          layout.floats[id] = { corner: place.corner as Corner, width: Number(place.width), height: Number(place.height), ...(place.collapsed === true ? { collapsed: true as const } : {}),
            ...(offset(place.x) && offset(place.y) ? { x: place.x as number, y: place.y as number } : {}),
            ...(names(place.tabs).length ? { tabs: names(place.tabs), ...(typeof place.active === 'string' ? { active: place.active } : {}) } : {}),
            ...(names(place.with).length ? { with: names(place.with) } : {}) };
      for (const [id, from] of Object.entries(floating && typeof floating === 'object' ? floating : {}))
        if (layout.floats[id] && (from === 'docked' || from === 'closed' || (from === 'free' && isFree(layout.floats[id])))) layout.floating[id] = from;
    } else return fallback;
    // The shape this round allows; anything else is not ours to guess at. 這一輪允許的形狀；別的不猜。
    if (!wellFormed(layout.root)) return fallback;
    // Each known panel once. 認得的面板各一次。
    for (const found of tabPanes(layout.root)) found.pane.panels = found.pane.panels.filter(id => known.has(id) && !seen.has(id) && !!seen.add(id));
    const tidied = tidy(layout.root);
    if (!tidied) return fallback;
    layout.root = tidied;
    // A free panel is not in the tree, floating or closed; in the tree it is not free. 自由浮動的面板不在版面樹裡（浮著或關著）；在樹裡就不是自由浮動。
    const inTree = (id: string) => tabPanes(layout.root).some(found => found.pane.panels.includes(id));
    for (const id of Object.keys(layout.floating)) if (layout.floating[id] === 'free' && inTree(id)) delete layout.floating[id];
    // A frame's tabs: known, out of the tree, nobody else's, the key among them; under two, no tabs. 框的分頁：認得、不在樹裡、不屬於別人、
    // 鑰匙在裡面；不到兩個就沒有分頁。
    const claimed = new Set(Object.keys(layout.floating).filter(id => layout.floating[id] === 'free'));
    for (const key of Object.keys(layout.floating)) {
      const place = layout.floats[key]!;
      if (layout.floating[key] !== 'free' || !place.tabs) continue;
      const tabs = place.tabs.filter(id => id === key || (!inTree(id) && !claimed.has(id) && !!claimed.add(id)));
      if (!tabs.includes(key)) tabs.unshift(key);
      const { tabs: _, active: __, ...bare } = place;
      layout.floats[key] = tabs.length > 1 ? { ...bare, tabs, active: place.active && tabs.includes(place.active) ? place.active : tabs[0]! } : bare;
    }
    const freeAway = (id: string) => claimed.has(id) || (layout.hidden.includes(id) && isFree(layout.floats[id]));
    for (const [id, side] of panels) if (!inTree(id) && !freeAway(id)) layout = addToSide(layout, id, side);
    // One panel per corner slot: a second one on the same corner goes back. 一個角落槽一個：同一角的第二個回去。
    const taken = new Set<Corner>();
    for (const id of Object.keys(layout.floating)) {
      if (layout.floating[id] === 'free') continue;
      const corner = layout.floats[id]!.corner; if (taken.has(corner)) delete layout.floating[id]; else taken.add(corner);
    }
    // Floating, or a tab of a frame: not closed. 浮著的、或是框裡的分頁：不算關閉。
    layout.hidden = layout.hidden.filter(id => !layout.floating[id] && !claimed.has(id));
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
 * pane or the canvas); outer: a new pane along one edge of the whole layout, full height or full width (Refactor.87).
 * 拖著的面板放到哪：tab＝放進某個分頁窗格的某個位置；beside＝在某一格（分頁窗格或畫布）的某條邊旁多一個分頁窗格；outer＝沿整個版面的
 * 某條外緣多一格，整個高度或整個寬度（R.87）。 */
export type Edge = 'top' | 'bottom' | 'left' | 'right';
export type Drop =
  | { kind: 'tab'; pane: Path; index: number }
  | { kind: 'beside'; pane: Path; edge: Edge }
  | { kind: 'outer'; edge: Edge };

/** Move a panel; the result is tidied. A drop that changes nothing returns the layout as it was.
 * 移動面板，結果整理過。沒有改變的放置原樣回傳。 */
export function movePanel(layout: LayoutData, panel: string, drop: Drop): LayoutData {
  const source = paneOf(layout.root, panel), framed = !source && !!frameOf(layout, panel);
  if (!source && !framed) return layout;
  // A floating panel with a home dropped where it already belongs lands there (Refactor.84). 有家的浮動面板放回它原本所屬的位置：就地落地（R.84）。
  if (layout.floating[panel] && layout.floating[panel] !== 'free') {
    const bare = { ...layout, floating: {} }, moved = movePanel(bare, panel, drop);
    return finish(copy(moved === bare ? layout : { ...moved, floating: layout.floating }), panel, null);
  }
  // A free panel leaves its frame first, the others float on (Refactor.90). 自由浮動的面板先離開它的框，其他的繼續浮著（R.90）。
  if (framed) layout = detach(layout, panel);
  if (drop.kind === 'outer') return toOuter(layout, panel, drop.edge);
  const next = copy(layout), target = at(next.root, drop.pane);
  if (!target) return layout;
  // A free panel comes in from outside the tree (Refactor.88). 自由浮動的面板從版面樹外面進來（R.88）。
  const from = source ? at(next.root, source.path) as Extract<Pane, { kind: 'tabs' }> : null;
  if (drop.kind === 'tab') {
    if (target.kind !== 'tabs') return layout;
    let index = Math.max(0, Math.min(drop.index, target.panels.length));
    if (from && target === from) {
      const old = from.panels.indexOf(panel);
      if (old < index) index--;
      if (old === index) return layout;
    }
    from?.panels.splice(from.panels.indexOf(panel), 1);
    target.panels.splice(index, 0, panel); target.active = panel;
  } else {
    if (from && target === from && from.panels.length === 1) return layout;
    from?.panels.splice(from.panels.indexOf(panel), 1);
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
/** A new pane along one edge of the whole layout (Refactor.87, human 2026-10-12: the far-left full-height place had no way in).
 * The outermost row stays the root, so its sides still read from it: left or right, the pane is its first or last part, full
 * height; top or bottom, everything else is wrapped in a column with the pane above or below it, full width. Nothing changes
 * when the panel is already alone there. 沿整個版面某條外緣多一格（R.87，人類 10-12：最左邊整個高度的位置進不去）。最外層的左右分割
 * 仍是根，兩側照舊從它讀：左或右，新的一格是它的第一或最後一格、整個高度；上或下，其餘全部包進一個上下分割、新的一格在上或下、整個寬度。
 * 面板已經單獨在那裡時不變。 */
function toOuter(layout: LayoutData, panel: string, edge: Edge): LayoutData {
  const next = remove(layout, panel), root = next.root as Extract<Pane, { kind: 'split' }>;
  const fresh: Pane = { kind: 'tabs', panels: [panel], active: panel }, first = edge === 'left' || edge === 'top';
  if (edge === 'left' || edge === 'right') {
    root.children.splice(first ? 0 : root.children.length, 0, fresh); root.sizes.splice(first ? 0 : root.sizes.length, 0, SIDE_WIDTH);
  } else {
    // Into the column that already spans the whole width, or a new one round everything. 放進已經橫跨全寬的上下分割，或新包一個。
    const only = root.children.length === 1 ? root.children[0]! : null;
    const column = only?.kind === 'split' && only.direction === 'column' ? only
      : { kind: 'split' as const, direction: 'column' as const, children: [only ?? { ...root }], sizes: [1] };
    column.children.splice(first ? 0 : column.children.length, 0, fresh); column.sizes.splice(first ? 0 : column.sizes.length, 0, PANE_HEIGHT);
    next.root = { kind: 'split', direction: 'row', children: [column], sizes: [1] };
  }
  next.root = tidy(next.root) ?? layout.root;
  const placed = paneOf(next.root, panel)!;
  if (JSON.stringify(next.root) === JSON.stringify(layout.root) && !layout.floating[panel]) return layout;
  return finish(next, panel, edge === 'left' || edge === 'right' ? sideOf(next.root, placed.path[0]!) : null);
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
 * 2026-10-11, floating-panels question 9); a free panel that was closed floats again where it floated last (Refactor.88, rule 6).
 * 把面板叫到前面：顯示、選中、打開所在的那一側；浮動的留在原地、展開（人類 10-11，第 9 題）；關掉的自由浮動面板回到上次浮動的位置
 * （R.88，規格第 6 條）。 */
export function showPanel(layout: LayoutData, panel: string): LayoutData {
  // In a floating frame: its tab chosen, the frame opened (Refactor.90). 在浮動框裡：選中它的分頁、打開那個框（R.90）。
  const frame = frameOf(layout, panel);
  if (frame) {
    const { collapsed: _, ...open } = layout.floats[frame]!;
    return { ...layout, floats: { ...layout.floats, [frame]: open.tabs ? { ...open, active: panel } : open } };
  }
  if (layout.floating[panel]) return setFloat(layout, panel, { collapsed: false });
  const place = layout.floats[panel];
  if (!paneOf(layout.root, panel) && isFree(place)) {
    const { collapsed: _, with: among, ...open } = place!;
    // Closed out of a frame that still floats: back among them (human 2026-10-12, question 4). 從還在浮的框裡關掉的：回到它們那裡（人類 10-12，第 4 題）。
    const back = among?.map(id => frameOf(layout, id)).find((key): key is string => !!key);
    const shown = { ...layout, hidden: layout.hidden.filter(id => id !== panel), floats: { ...layout.floats, [panel]: open } };
    if (back) return joinFloat(shown, panel, back, tabsOf(shown, back).length);
    return { ...shown, floating: { ...layout.floating, [panel]: 'free' } };
  }
  return finish(copy(layout), panel, null);
}
/** A button that calls a panel up (the toolbar's GLSL, Refactor.86.4; human 2026-10-11: pressed again while the panel is in
 * view, it does what that panel's collapse triangle does there): floating, it folds or opens; docked in view and stacked, its
 * pane collapses to its tab bar; docked in view with no triangle, it stays as it is; out of view, it is brought forward.
 * 叫出面板的按鈕（功能列的 GLSL，R.86.4；人類 10-11：面板看得到時再按一次，等於按它當下的收合三角形）：浮動的收起或打開；停靠、看得到、
 * 上下疊著的，那一格收成分頁列；停靠、看得到、沒有三角形的，維持原樣；看不到的，叫到前面。 */
export function showOrFold(layout: LayoutData, panel: string): LayoutData {
  // In a floating frame: shown, it folds or opens the frame; behind another tab, it is brought forward (Refactor.90).
  // 在浮動框裡：正顯示著就收起或打開那個框；在別的分頁後面就叫到前面（R.90）。
  const frame = frameOf(layout, panel);
  if (frame) return activeOf(layout, frame) === panel ? setFloat(layout, frame, { collapsed: !layout.floats[frame]?.collapsed }) : showPanel(layout, panel);
  if (layout.floating[panel]) return setFloat(layout, panel, { collapsed: !layout.floats[panel]?.collapsed });
  const placed = paneOf(layout.root, panel), side = placed && layout.root.kind === 'split' ? sideOf(layout.root, placed.path[0]!) : null;
  const inView = placed && !layout.hidden.includes(panel) && placed.pane.active === panel && !placed.pane.collapsed && !(side && layout.closed[side]);
  if (!inView) return showPanel(layout, panel);
  return stacked(layout.root, placed.path) ? setCollapsed(layout, placed.path, true) : layout;
}
/** Close a panel: it is hidden, and no longer floats (human 2026-10-11: closing is closing); a free panel keeps where it floated,
 * to float there when shown again. 關閉面板：藏起來，也不再浮動（人類：關閉就是關閉）；自由浮動的記著浮動的位置，再顯示時回到那裡。 */
export function hidePanel(layout: LayoutData, panel: string): LayoutData {
  // One tab of a frame: only it closes, remembering whom it was with (human 2026-10-12, questions 3, 4). 框裡的一個分頁：只關它，記住和誰在一起
  // （人類 10-12，第 3、4 題）。
  const frame = frameOf(layout, panel), others = frame ? tabsOf(layout, frame).filter(id => id !== panel) : [];
  if (others.length) {
    const next = detach(layout, panel);
    return { ...next, hidden: [...next.hidden.filter(id => id !== panel), panel], floats: { ...next.floats, [panel]: { ...next.floats[panel]!, with: others } } };
  }
  const { [panel]: _, ...floating } = layout.floating;
  return layout.hidden.includes(panel) && !layout.floating[panel] ? layout : { ...layout, floating, hidden: [...layout.hidden.filter(id => id !== panel), panel] };
}

// Floating, two kinds (Refactor.88, human 2026-10-12: floating is by dragging, it does not spring back; the Parameter panel stays
// as it was). A panel with a home (the panel table's `corner`: the Parameter panel) floats in that corner and goes back to where it
// was (P, R.84–86). Any other panel floats free: it leaves the tree, sits where it was dropped, and is docked again only by
// dragging it into the layout. 浮動分兩種（R.88，人類 10-12：浮動靠拖拉、不彈回；參數面板維持原樣）。有家的面板（面板表的 corner：
// 參數面板）浮在那一角、可以回到原本的地方（P，R.84–86）。其他面板自由浮動：離開版面樹、放在哪就在哪，只有拖進版面才再停靠。

/** Whether a place is a free panel's: it has how far from its corner's two edges. 這個位置是不是自由浮動面板的：有離它的角兩條邊多遠。 */
export const isFree = (place: FloatPlace | undefined): boolean => place?.x !== undefined && place.y !== undefined;
/** Float a panel in its home corner (P, Refactor.84): it keeps whether it was in the tree or closed, to go back to. Only a panel with
 * a home; the others float by dragging. 讓有家的面板浮在它的角（P，R.84）：記住浮起來前在版面裡還是關著，回去時用。只給有家的面板；
 * 其他的靠拖拉浮動。 */
export function popOut(layout: LayoutData, panel: string, homes: Homes): LayoutData {
  const corner = homes[panel];
  if (!corner || layout.floating[panel] || !paneOf(layout.root, panel)) return layout;
  const last = layout.floats[panel];
  return { ...layout, hidden: layout.hidden.filter(id => id !== panel), floating: { ...layout.floating, [panel]: layout.hidden.includes(panel) ? 'closed' : 'docked' },
    // Its last size, open: it was just called up. 上次的大小、打開：剛被叫出來。
    floats: { ...layout.floats, [panel]: { width: last?.width ?? FLOAT_WIDTH, height: last?.height ?? FLOAT_HEIGHT, corner } } };
}
/** Stop floating and go back to where it was before: its tab pane, or closed (human 2026-10-11). 不再浮動、回到浮起來前：
 * 所屬的分頁窗格，或關閉（人類 10-11）。 */
export function backToA(layout: LayoutData, panel: string): LayoutData {
  const from = layout.floating[panel];
  if (!from || from === 'free') return layout;
  const { [panel]: _, ...floating } = layout.floating, next = copy({ ...layout, floating });
  if (from === 'closed') return { ...next, hidden: [...next.hidden.filter(id => id !== panel), panel] };
  // Back as its pane's shown tab, the sides left as they are: it goes back to how things were, it does not open a side
  // (Refactor.86: P sent it back and opened the right side, which closed the left). 回到它那一格、成為顯示中的分頁，兩側照舊：
  // 是回到原本的樣子，不打開任何一側（R.86：按 P 送回去時打開了右側、左側因此收起）。
  const placed = paneOf(next.root, panel);
  if (placed) { placed.pane.active = panel; delete placed.pane.collapsed; }
  return next;
}
/** Float or go back, for a panel with a home (P; human 2026-10-11). 有家的面板浮動或回去（P；人類 10-11）。 */
export const toggleFloat = (layout: LayoutData, panel: string, homes: Homes) =>
  layout.floating[panel] ? backToA(layout, panel) : popOut(layout, panel, homes);
/** A layout kept before R.88 (floating in corners) or before a home was given: a panel with a home floats in its home; any other
 * panel floating in a corner floats free, from that corner. 舊版面（R.88 之前浮在角落，或家是後來才定的）：有家的浮在自己的家；其他浮在
 * 角落的改成自由浮動，從那個角開始。 */
export function keepHomes(layout: LayoutData, homes: Homes): LayoutData {
  let next = layout;
  // A panel with a home is nobody's tab: back to its side. 有家的面板不當別人的分頁：回到它那一側。
  for (const [id, home] of Object.entries(homes)) if (frameOf(next, id) && next.floating[id] !== 'free')
    next = addToSide(detach(next, id), id, home.endsWith('left') ? 'left' : 'right');
  for (const id of Object.keys(layout.floating)) {
    const place = next.floats[id]!, home = homes[id], free = layout.floating[id] === 'free';
    // A panel with a home stored free: back to its side, it floats only at home. 有家的卻存成自由浮動：回到它那一側，它只浮在家。
    if (home && free) { const { [id]: _, ...rest } = next.floating; next = addToSide({ ...next, floating: rest }, id, home.endsWith('left') ? 'left' : 'right'); }
    // A panel with a home in another corner: home. 有家的在別的角：回家。
    else if (home && place.corner !== home) next = { ...next, floats: { ...next.floats, [id]: { ...place, corner: home } } };
    // Any other panel in a corner (before R.88): free, from that corner. 其他在角落的（R.88 之前）：自由浮動，從那個角開始。
    else if (!home && !free) next = floatOut(next, id, { ...place, x: 0, y: 0 });
  }
  return next;
}
/** Float a panel free where it was dropped (Refactor.88): out of the tree, at `place`. 讓面板自由浮動在放下的地方（R.88）：離開版面樹、
 * 放在 place。 */
export function floatOut(layout: LayoutData, panel: string, place: FloatPlace): LayoutData {
  const next = frameOf(layout, panel) ? detach(layout, panel) : remove(layout, panel);
  return { ...next, hidden: next.hidden.filter(id => id !== panel), floating: { ...next.floating, [panel]: 'free' }, floats: { ...next.floats, [panel]: place } };
}
/** A floating panel clicked: first in line, so it is drawn on top and wins when room runs short (Refactor.89.1, human 2026-10-12).
 * 點到的浮動面板：排到最前面，畫在最上面、空間不夠時以它為準（R.89.1，人類 10-12）。 */
export function raise(layout: LayoutData, panel: string): LayoutData {
  if (!layout.floating[panel] || Object.keys(layout.floating)[0] === panel) return layout;
  const { [panel]: own, ...rest } = layout.floating;
  return { ...layout, floating: { [panel]: own!, ...rest } };
}
/** Floating frames with tabs (Refactor.90, human 2026-10-12; work/refactor/floating-tabs-scope-2026-10-12.md): a free panel's
 * frame may hold others as tabs; the frame is kept on its key panel (`floating`, `floats`), the others only in its `tabs`.
 * 有分頁的浮動框（R.90，人類 10-12）：自由浮動面板的框可以把別的面板當分頁；框記在鑰匙面板上（floating、floats），其他的只在它的 tabs 裡。 */
export const tabsOf = (layout: LayoutData, key: string): string[] => layout.floats[key]?.tabs ?? [key];
/** The tab a frame shows. 框顯示的分頁。 */
export const activeOf = (layout: LayoutData, key: string): string => {
  const place = layout.floats[key];
  return place?.tabs ? (place.active && place.tabs.includes(place.active) ? place.active : place.tabs[0]!) : key;
};
/** The floating frame a free panel is in: its own, or the one holding it as a tab. 自由浮動面板所在的框：它自己的，或把它當分頁的。 */
export function frameOf(layout: LayoutData, panel: string): string | undefined {
  if (layout.floating[panel] === 'free') return panel;
  return Object.keys(layout.floating).find(key => layout.floating[key] === 'free' && layout.floats[key]?.tabs?.includes(panel));
}
/** A panel leaves its floating frame; the others float on, under the next panel when the key leaves, in the same turn. It keeps the
 * frame's place, to float there again. 面板離開它的浮動框；其他的繼續浮著，鑰匙離開時由下一個接手、先後不變。它記著框的位置，再浮動時回到那裡。 */
function detach(layout: LayoutData, panel: string): LayoutData {
  const frame = frameOf(layout, panel);
  if (!frame) return layout;
  const { tabs: _, active: __, with: ___, ...place } = layout.floats[frame]!, tabs = tabsOf(layout, frame), rest = tabs.filter(id => id !== panel);
  const shown = activeOf(layout, frame) === panel ? rest[Math.max(0, tabs.indexOf(panel) - 1)] : activeOf(layout, frame);
  const kept: FloatPlace = { ...place, ...(rest.length > 1 ? { tabs: rest, active: shown } : {}) };
  if (!rest.length) { const { [frame]: ____, ...floating } = layout.floating; return { ...layout, floating }; }
  if (frame !== panel) return { ...layout, floats: { ...layout.floats, [frame]: kept, [panel]: place } };
  const key = rest[0]!, floating = Object.fromEntries(Object.entries(layout.floating).map(([id, from]) => [id === frame ? key : id, from]));
  return { ...layout, floating, floats: { ...layout.floats, [frame]: place, [key]: kept } };
}
/** A panel joins a floating frame as a tab at `index` (dropped on its title bar; human 2026-10-12, question 1): from the tree, from
 * another frame, or closed; moved within the frame if already there. Not a panel with a home. 面板在 index 加入浮動框成為分頁（放在它的
 * 標題列上；人類 10-12，第 1 題）：從版面樹、別的框或關著的；已經在框裡就是換位置。有家的面板不行。 */
export function joinFloat(layout: LayoutData, panel: string, frame: string, index: number, homes: Homes = {}): LayoutData {
  if (layout.floating[frame] !== 'free' || homes[panel] || (layout.floating[panel] && layout.floating[panel] !== 'free')) return layout;
  const tabs = tabsOf(layout, frame);
  if (frameOf(layout, panel) === frame) {
    const old = tabs.indexOf(panel), at = clamp(index > old ? index - 1 : index, 0, tabs.length - 1);
    if (old === at) return showPanel(layout, panel);
    const moved = tabs.filter(id => id !== panel); moved.splice(at, 0, panel);
    return { ...layout, floats: { ...layout.floats, [frame]: { ...layout.floats[frame]!, tabs: moved, active: panel } } };
  }
  const next = frameOf(layout, panel) ? detach(layout, panel) : paneOf(layout.root, panel) ? remove(layout, panel) : layout;
  const joined = tabsOf(next, frame).filter(id => id !== panel); joined.splice(clamp(index, 0, joined.length), 0, panel);
  const { collapsed: _, ...open } = next.floats[frame]!;
  return { ...next, hidden: next.hidden.filter(id => id !== panel), floats: { ...next.floats, [frame]: { ...open, tabs: joined, active: panel } } };
}
/** A whole frame dropped on another's title bar: all its tabs join, in order, the one it showed shown. 整個框放在另一個框的標題列上：
 * 它的分頁全部依序加入，原本顯示的那個顯示出來。 */
export function mergeFloat(layout: LayoutData, from: string, frame: string, index: number): LayoutData {
  if (from === frame || layout.floating[from] !== 'free') return layout;
  const tabs = tabsOf(layout, from), shown = activeOf(layout, from);
  const next = tabs.reduce((sofar, panel, at) => joinFloat(sofar, panel, frame, index + at), layout);
  return showPanel(next, shown);
}
/** A whole frame docked: its panels in one tab pane where it is dropped, the one it showed shown. 整個框停靠：它的面板放進放下處的同一個
 * 分頁窗格，原本顯示的那個顯示出來。 */
export function dockFrame(layout: LayoutData, frame: string, drop: Drop): LayoutData {
  const [first, ...rest] = tabsOf(layout, frame), shown = activeOf(layout, frame);
  let next = movePanel(layout, first!, drop);
  // The others right after the first, in their order (Refactor.91.2: not at the pane's end, apart from it). 其他的依序緊接在第一個後面
  // （R.91.2：不是丟到那一格最後、和它分開）。
  rest.forEach((panel, at) => {
    const pane = paneOf(next.root, first!);
    if (pane) next = movePanel(next, panel, { kind: 'tab', pane: pane.path, index: pane.pane.panels.indexOf(first!) + 1 + at });
  });
  const placed = paneOf(next.root, shown);
  return placed ? activate(next, placed.path, shown) : next;
}
/** Keep where free panels now are (moved or sized together); the ones just placed go first, so where they were put wins when
 * room runs short (floatRects). 記下自由浮動面板現在的位置（一起移動或調大小）；剛放的排最前面，空間不夠時（floatRects）以它們放的
 * 位置為準。 */
export function placeFloats(layout: LayoutData, places: Readonly<Record<string, FloatPlace>>): LayoutData {
  const ids = Object.keys(places).filter(id => layout.floating[id] === 'free');
  if (!ids.length) return layout;
  const floating = Object.fromEntries([...ids.map(id => [id, 'free'] as const), ...Object.entries(layout.floating).filter(([id]) => !ids.includes(id))]);
  return { ...layout, floating, floats: { ...layout.floats, ...Object.fromEntries(ids.map(id => [id, places[id]!])) } };
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

// Geometry of free panels, in the floating area (the network between its toolbar and canvas controls, gaps taken off). Whether
// panels keep clear of each other is a switch, `apart` (Refactor.89.1, human 2026-10-12: "forbid overlap" in the gear, off by
// default); snapping works either way (human: the shared handles are what snapping is for). 自由浮動面板的幾何，在浮動範圍裡
// （網路區功能列到畫布控制項之間，已扣間隙）。面板要不要彼此避開是一個開關 apart（R.89.1，人類 10-12：齒輪裡的「禁止重疊」，預設關）；
// 吸附兩種情況都照用（人類：有吸附共同把手才有用）。
export type Box = { x: number; y: number; width: number; height: number };
export type FloatRect = Box & { collapsed: boolean };
const near = 0.5;
/** Whether two boxes keep `gap` apart. 兩個框是否至少隔 gap。 */
export const clear = (a: Box, b: Box, gap: number) => a.x + a.width + gap <= b.x + near || b.x + b.width + gap <= a.x + near
  || a.y + a.height + gap <= b.y + near || b.y + b.height + gap <= a.y + near;
type Axis = 'x' | 'y';
const along = (box: Box, axis: Axis): [number, number] => axis === 'x' ? [box.x, box.width] : [box.y, box.height];
const other = (axis: Axis): Axis => axis === 'x' ? 'y' : 'x';
/** Whether two boxes face each other across `axis`: their spans on the other axis come closer than `reach`. 兩個框在 axis 方向上
 * 是否相對：另一個方向的範圍距離小於 reach。 */
const facing = (a: Box, b: Box, axis: Axis, reach: number) => {
  const [as, al] = along(a, other(axis)), [bs, bl] = along(b, other(axis));
  return as < bs + bl + reach - near && bs < as + al + reach - near;
};
const put = (box: Box, axis: Axis, start: number, size?: number): Box => axis === 'x'
  ? { ...box, x: start, width: size ?? box.width } : { ...box, y: start, height: size ?? box.height };
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** The corner nearest a box's middle. 離框的中心最近的角。 */
const nearestCorner = (box: Box, width: number, height: number) =>
  `${box.y + box.height / 2 < height / 2 ? 'top' : 'bottom'}-${box.x + box.width / 2 < width / 2 ? 'left' : 'right'}` as Corner;
/** Where a free panel is kept, from where it is drawn: its corner (the nearest, or its group's) and how far from that corner's two
 * edges, so it follows that corner when the area changes size (human 2026-10-11, question 13). Collapsed, it keeps its open height.
 * 從畫的位置算出要記的位置：它的角（最近的，或它那一組的）、離那個角兩條邊多遠，所以範圍變大變小時跟著那個角走（人類 10-11，第 13 題）。
 * 收起時保留打開的高度。 */
export function placeAt(box: Box, width: number, height: number, was?: FloatPlace, corner?: Corner): FloatPlace {
  const at = corner ?? nearestCorner(box, width, height), top = at.startsWith('top'), left = at.endsWith('left');
  return { corner: at, width: Math.round(box.width),
    height: Math.round(was?.collapsed ? was.height : box.height), x: Math.round(left ? box.x : width - box.x - box.width),
    y: Math.round(top ? box.y : height - box.y - box.height), ...(was?.collapsed ? { collapsed: true as const } : {}),
    ...(was?.tabs ? { tabs: was.tabs, ...(was.active ? { active: was.active } : {}) } : {}) };
}
/** Where a free panel wants to be drawn: its place in an area this size. What runs out of the area is cut off, the side it follows
 * kept (human 2026-10-11, question 13: too big, it shrinks first), never under its least. 自由浮動面板想畫在哪：記的位置放進這個大小的
 * 範圍。超出範圍的部分切掉、保留它跟著的那一邊（人類 10-11，第 13 題：放不下先縮小），不小於最小值。 */
export function boxOf(place: FloatPlace, width: number, height: number, title: number): FloatRect {
  const collapsed = !!place.collapsed || height < FLOAT_MIN_HEIGHT, top = place.corner.startsWith('top'), left = place.corner.endsWith('left');
  const fit = (start: number, size: number, room: number, least: number, first: boolean): [number, number] => {
    let from = Math.max(0, start), to = Math.min(room, start + size);
    const need = Math.min(least, size, room);
    if (to - from < need) { if (first) { from = clamp(start, 0, room - need); to = from + need; } else { to = clamp(start + size, need, room); from = to - need; } }
    return [from, to - from];
  };
  const h = collapsed ? title : place.height;
  const [x, w] = fit(left ? place.x ?? 0 : width - (place.x ?? 0) - place.width, place.width, width, FLOAT_MIN_WIDTH, left);
  const [y, hh] = fit(top ? place.y ?? 0 : height - (place.y ?? 0) - h, h, height, collapsed ? h : FLOAT_MIN_HEIGHT, top);
  return { x, y, width: w, height: hh, collapsed };
}
/** A panel crowded by others when drawn (a smaller window, a panel grown): it gives way from the side that is hit, down to its least;
 * what still does not fit overlaps for now, and comes back when there is room (human 2026-10-12: the window rule, no jumping).
 * 畫的時候被別的面板擠到（視窗變小、有面板變大）：從被撞到的那一邊讓開，最小到它的最小值；還是放不下就暫時重疊，有空間時恢復
 * （人類 10-12：視窗的規則，不跳位）。 */
export function giveWay(box: Box, others: readonly Box[], gap: number, least: { width: number; height: number }): Box {
  let given = box;
  for (const o of others) {
    if (clear(given, o, gap)) continue;
    const ways = (['x', 'y'] as const).map(axis => {
      const [s, l] = along(given, axis), [os, ol] = along(o, axis), min = axis === 'x' ? least.width : least.height;
      // The other is past its middle: give way at its end; else at its start. 對方在中間之後：從後緣讓；否則從前緣讓。
      const atEnd = s + l / 2 <= os + ol / 2, from = atEnd ? s : Math.max(s, os + ol + gap), to = atEnd ? Math.min(s + l, os - gap) : s + l;
      return { fits: to - from >= min, share: (to - from) / l, box: to - from >= min ? put(given, axis, from, to - from) : put(given, axis, atEnd ? s : s + l - min, min) };
    });
    given = (ways.filter(way => way.fits).sort((a, b) => b.share - a.share)[0] ?? ways[0]!).box;
  }
  return given;
}
/** Called up again (a closed panel shown, rule 1, human 2026-10-12): where it was kept is taken, so the nearest free spot, then at its
 * least; none: where it was kept (it gives way when drawn). 再被叫出來（關掉的面板打開，第 1 題，人類 10-12）：記的位置被佔了，就去最近的
 * 空位，再不行用最小尺寸找；都沒有就留在記的位置（畫的時候讓開）。 */
export function callUp(place: FloatPlace, others: readonly Box[], width: number, height: number, gap: number, title: number): FloatPlace | null {
  const want = boxOf(place, width, height, title);
  if (others.every(o => clear(want, o, gap))) return null;
  const least = { ...want, width: Math.min(want.width, FLOAT_MIN_WIDTH), height: want.collapsed ? want.height : Math.min(want.height, FLOAT_MIN_HEIGHT) };
  const spot = freeSpot(want, others, width, height, gap) ?? freeSpot(least, others, width, height, gap);
  return spot ? placeAt(spot, width, height, place) : null;
}
/** Panels sitting together: `gap` apart and overlapping along that edge, joined in chains (Refactor.88.5). 貼在一起的面板：隔 gap、沿著
 * 那條邊有重疊的一段，連成一串（R.88.5）。 */
export function groupsOf(rects: Readonly<Record<string, Box>>, gap: number): string[][] {
  const ids = Object.keys(rects), owner = new Map(ids.map(id => [id, id]));
  const root = (id: string): string => owner.get(id) === id ? id : root(owner.get(id)!);
  const touching = (a: Box, b: Box) => (['x', 'y'] as const).some(axis => {
    const [as, al] = along(a, axis), [bs, bl] = along(b, axis);
    return (Math.abs(as + al + gap - bs) < near || Math.abs(bs + bl + gap - as) < near) && facing(a, b, axis, 0);
  });
  ids.forEach((a, index) => ids.slice(index + 1).forEach(b => { if (touching(rects[a]!, rects[b]!)) owner.set(root(b), root(a)); }));
  const groups = new Map<string, string[]>();
  for (const id of ids) groups.set(root(id), [...groups.get(root(id)) ?? [], id]);
  return [...groups.values()];
}
/** Free panels kept by group (Refactor.88.5, human 2026-10-12): panels sitting together follow one corner, the nearest to the group's
 * middle, or the corner of a panel with a home in it, so a smaller or larger window moves them together. Worked out when a move or a
 * sizing ends, never while the window changes. 自由浮動面板依組記位置（R.88.5，人類 10-12）：貼在一起的面板跟著同一個角——離整組中心最近的，
 * 或組裡有家的面板的角——所以視窗變大變小時一起走。在移動或調大小結束時算，視窗變化時不算。 */
export function anchored(rects: Readonly<Record<string, Box>>, layout: LayoutData, width: number, height: number, gap: number): Record<string, FloatPlace> {
  const places: Record<string, FloatPlace> = {};
  for (const group of groupsOf(rects, gap)) {
    const home = group.find(id => layout.floating[id] && layout.floating[id] !== 'free'), boxes = group.map(id => rects[id]!);
    const left = Math.min(...boxes.map(box => box.x)), top = Math.min(...boxes.map(box => box.y));
    const whole = { x: left, y: top, width: Math.max(...boxes.map(box => box.x + box.width)) - left, height: Math.max(...boxes.map(box => box.y + box.height)) - top };
    const corner = home ? layout.floats[home]!.corner : nearestCorner(whole, width, height);
    for (const id of group) if (layout.floating[id] === 'free') places[id] = placeAt(rects[id]!, width, height, layout.floats[id], corner);
  }
  return Object.fromEntries(Object.keys(layout.floating).filter(id => places[id]).map(id => [id, places[id]!]));
}
/** The nearest place for a box that keeps clear of the others, inside the area; none when it does not fit anywhere. 離某個框最近、
 * 和其他框保持距離、在範圍內的位置；哪裡都放不下時沒有。 */
export function freeSpot(box: Box, others: readonly Box[], width: number, height: number, gap: number): Box | null {
  const spots = (axis: Axis, room: number) => {
    const [start, size] = along(box, axis);
    return [start, 0, room - size, ...others.flatMap(o => { const [s, l] = along(o, axis); return [s + l + gap, s - gap - size]; })]
      .filter(at => at >= -near && at <= room - size + near);
  };
  let best: Box | null = null, distance = Infinity;
  for (const x of spots('x', width)) for (const y of spots('y', height)) {
    const spot = { ...box, x, y }, far = Math.hypot(x - box.x, y - box.y);
    if (far < distance && others.every(o => clear(spot, o, gap))) { best = spot; distance = far; }
  }
  return best;
}
/** Where each floating panel is drawn in an area `width` x `height`. A panel with a home: in its corner, its own size, at most the
 * area. Free panels, the most recently placed first: where they are kept, cut to the area; crowded by one drawn before, they give
 * way, down to their least, else overlap for now (Refactor.88.5, human 2026-10-12: the window rule; no jumping). What is kept does not
 * change, so they come back when there is room again (question 13). Too low for a panel: its title only.
 * 每個浮動面板畫在 width x height 範圍的哪裡。有家的：在它的角、自己的大小、不超過範圍。自由浮動的，最近放的先：在記的位置、超出範圍的切掉；
 * 被先畫的擠到就讓開，最小到最小值，再不行暫時重疊（R.88.5，人類 10-12：視窗的規則，不跳位）。記的值不改，所以有空間時會回來（第 13 題）。
 * 範圍太矮：只有標題。 */
export function floatRects(layout: LayoutData, width: number, height: number, gap: number, title: number, apart = true): Record<string, FloatRect> {
  const rects: Record<string, FloatRect> = {}, ids = Object.keys(layout.floating).filter(id => layout.floats[id]);
  for (const id of ids.filter(each => layout.floating[each] !== 'free')) {
    const place = layout.floats[id]!, collapsed = !!place.collapsed || height < FLOAT_MIN_HEIGHT;
    const w = Math.max(0, Math.min(place.width, width)), h = Math.max(0, Math.min(collapsed ? title : place.height, height));
    rects[id] = { x: place.corner.endsWith('left') ? 0 : width - w, y: place.corner.startsWith('top') ? 0 : height - h, width: w, height: h, collapsed };
  }
  const placed: Box[] = Object.values(rects);
  for (const id of ids.filter(each => layout.floating[each] === 'free')) {
    const want = boxOf(layout.floats[id]!, width, height, title);
    // Overlapping allowed: where it is kept. 可以重疊：就在記的位置。
    const box = !apart ? want : giveWay(want, placed, gap, { width: Math.min(FLOAT_MIN_WIDTH, width), height: want.collapsed ? want.height : Math.min(FLOAT_MIN_HEIGHT, height) });
    rects[id] = { x: box.x, y: box.y, width: box.width, height: box.height, collapsed: want.collapsed }; placed.push(box);
  }
  return rects;
}
/** Moving a free panel (human 2026-10-12: like a solid thing): from where it is toward `to`, one axis then the other; it stops at
 * the area's edge and `gap` short of another panel, and slides along it; it never passes through. 移動自由浮動面板（人類 10-12：像實體）：
 * 從現在的位置往 to 移，先一個方向再另一個；碰到範圍的邊、或離別的面板 gap 時停下，可以沿著它滑；不會穿過去。 */
export function slide(from: Box, to: { x: number; y: number }, others: readonly Box[], width: number, height: number, gap: number): Box {
  let box = from;
  for (const axis of ['x', 'y'] as const) {
    const [start, size] = along(box, axis), room = axis === 'x' ? width : height;
    let next = clamp(axis === 'x' ? to.x : to.y, 0, room - size);
    for (const o of others) {
      if (!facing(box, o, axis, gap)) continue;
      const [s, l] = along(o, axis);
      if (start + size + gap <= s + near && next + size + gap > s) next = s - gap - size;
      if (s + l + gap <= start + near && next < s + l + gap) next = s + l + gap;
    }
    box = put(box, axis, next);
  }
  return box;
}
/** Snapping (Q47 5: near an edge it snaps, leaving the gap): within `reach` of the area's edge, or of a panel beside it, it lines up
 * there, `gap` apart, if that is clear. 吸附（Q47 第 5 點：靠近邊緣就吸過去、留間隙）：離範圍的邊、或旁邊的面板 reach 以內時對齊過去、
 * 隔 gap，前提是那裡沒有別的面板。 */
export function snap(box: Box, others: readonly Box[], width: number, height: number, gap: number, reach: number, apart = true): Box {
  let snapped = box;
  for (const axis of ['x', 'y'] as const) {
    const [start, size] = along(snapped, axis), room = axis === 'x' ? width : height;
    const lines = [0, room - size, ...others.filter(o => facing(snapped, o, axis, reach)).flatMap(o => { const [s, l] = along(o, axis); return [s + l + gap, s - gap - size]; })];
    const best = lines.filter(at => Math.abs(at - start) <= reach && at >= -near && at <= room - size + near)
      .sort((a, b) => Math.abs(a - start) - Math.abs(b - start)).find(at => !apart || others.every(o => clear(put(snapped, axis, at), o, gap)));
    if (best !== undefined) snapped = put(snapped, axis, best);
  }
  return snapped;
}

export type FloatEdge = { x?: 'start' | 'end'; y?: 'start' | 'end' };
/** The panels on the seam at one edge of `id` (one axis only): `near`, ending on its line with `id`; `far`, starting `gap` after
 * it; joined by overlap. No `far`: not a seam, the edge moves alone. Worked out when a hand reaches the edge (Refactor.88.1: shown
 * before dragging) or starts dragging it. 某個面板某條邊（只一個方向）的縫上有哪些面板：near＝和它一起結束在那條線上的；far＝隔 gap 開始的；
 * 彼此有重疊就連在一起。沒有 far：不是縫，那條邊自己動。在手碰到那條邊（R.88.1：拖之前就顯示）或開始拖時算。 */
export function seamOf(rects: Readonly<Record<string, Box>>, id: string, edge: FloatEdge, width: number, height: number, gap: number,
  fixed: readonly string[] = []): { near: string[]; far: string[] } {
  const axis: Axis = edge.x ? 'x' : 'y', side = edge[axis]!, room = axis === 'x' ? width : height;
  const flip = (box: Box) => { const [s, l] = along(box, axis); return put(box, axis, side === 'end' ? s : room - s - l); };
  const mirrored = Object.fromEntries(Object.entries(rects).map(([key, box]) => [key, flip(box)]));
  const end = (key: string) => { const [s, l] = along(mirrored[key]!, axis); return s + l; }, start = (key: string) => along(mirrored[key]!, axis)[0];
  const overlapping = (a: string, b: string) => facing(mirrored[a]!, mirrored[b]!, axis, 0);
  // Panels ending on the line and panels starting `gap` after it, joined by overlap. 結束在線上的與隔 gap 開始的，有重疊就連在一起。
  const nearSet = new Set([id]), far = new Set<string>(), free = Object.keys(mirrored).filter(key => !fixed.includes(key));
  for (let grew = true; grew;) {
    grew = false;
    for (const key of free) {
      if (nearSet.has(key) || far.has(key)) continue;
      if ([...nearSet].some(n => Math.abs(start(key) - end(n) - gap) < near && overlapping(key, n))) { far.add(key); grew = true; }
      else if ([...far].some(f => Math.abs(end(key) + gap - start(f)) < near && overlapping(key, f))) { nearSet.add(key); grew = true; }
    }
  }
  return { near: [...nearSet], far: [...far] };
}
/** Sizing free panels by an edge or a corner of `id` (human 2026-10-12). An edge moves until the area's edge, the panel's least, or
 * `gap` short of another panel; it does not push. Where it is a seam (panels sit `gap` across it, overlapping), the seam is a divider:
 * every panel on it moves with it, one side growing as the other shrinks, each down to its least, until a panel is dragged away.
 * Worked out from where they are when the drag starts (human: only then, no cost otherwise). `fixed`: panels that are only in the
 * way (the Parameter panel, collapsed ones). 用 id 的某條邊或某個角調自由浮動面板的大小（人類 10-12）。邊移動到範圍的邊、面板的最小值、
 * 或離別的面板 gap 為止；不推。那條邊是縫時（對面隔 gap 有面板、彼此有重疊）就是分隔線：縫上的面板一起動，一邊變大一邊變小，各自到最小值，
 * 直到有面板被拖開。從開始拖的那一刻的位置算（人類：只在那時算，平常不耗成本）。fixed：只是擋路的面板（參數面板、收起的）。 */
export function sizeFloats(rects: Readonly<Record<string, Box>>, id: string, edge: FloatEdge, dx: number, dy: number, width: number, height: number,
  gap: number, fixed: readonly string[] = [], reach = 0, apart = true): Record<string, Box> {
  let boxes: Record<string, Box> = { ...rects };
  for (const axis of ['x', 'y'] as const) {
    const side = edge[axis];
    if (!side) continue;
    const d = axis === 'x' ? dx : dy, room = axis === 'x' ? width : height, least = axis === 'x' ? FLOAT_MIN_WIDTH : FLOAT_MIN_HEIGHT;
    // Worked out on the end side: a start edge is the end edge of the area mirrored. 都當成後緣來算：前緣就是把範圍鏡射後的後緣。
    const flip = (box: Box) => { const [s, l] = along(box, axis); return put(box, axis, side === 'end' ? s : room - s - l); };
    const mirrored = Object.fromEntries(Object.entries(boxes).map(([key, box]) => [key, flip(box)]));
    const end = (key: string) => { const [s, l] = along(mirrored[key]!, axis); return s + l; }, start = (key: string) => along(mirrored[key]!, axis)[0];
    // Only one panel at corners. 角只動一個面板。
    const seam = edge[other(axis)] ? { near: [id], far: [] } : seamOf(boxes, id, { [axis]: side }, width, height, gap, fixed);
    const near_ = new Set(seam.near), far = new Set(seam.far);
    const group = new Set([...near_, ...far]), others = Object.keys(mirrored).filter(key => !group.has(key));
    const length = (key: string) => along(mirrored[key]!, axis)[1];
    // Overlapping allowed: other panels are not in the way. 可以重疊：別的面板不擋路。
    const blocking = apart ? others : [];
    // How far the line may go: each side down to its least; the near side not past the area or another panel, the far side not
    // into another panel behind it. 線能走多遠：兩邊各自到最小值；近的一邊不超出範圍或碰到別的面板，遠的一邊不往後碰到別的面板。
    let high = Math.min(...[...near_].map(n => Math.min(room, ...blocking.filter(o => facing(mirrored[n]!, mirrored[o]!, axis, gap) && start(o) + near >= end(n) + gap)
      .map(o => start(o) - gap)) - end(n)), ...[...far].map(f => length(f) - least));
    let low = Math.max(...[...near_].map(n => least - length(n)), ...[...far].map(f => Math.max(0, ...blocking.filter(o => facing(mirrored[f]!, mirrored[o]!, axis, gap) && end(o) <= start(f) - gap + near)
      .map(o => end(o) + gap)) - start(f)));
    if (high < low) { high = 0; low = 0; }
    let move = clamp(d * (side === 'end' ? 1 : -1), low, high);
    // Within `reach` of the edge line of a panel not moving with it, on this axis, the edge (or the seam) lines up there, if it may
    // go there (Refactor.88.2, human 2026-10-12: it can take another's width or height, just that line; 88.3: a seam too).
    // 離不跟著動的面板在這個方向的邊線 reach 以內，邊（或縫）就對齊過去，前提是走得到（R.88.2，人類 10-12：可以對齊別人的寬或高，就那條線；
    // 88.3：縫也一樣）。
    if (reach) {
      const at = end(id) + move, lines = others.flatMap(o => [start(o), end(o)]);
      const line = lines.filter(each => Math.abs(each - at) <= reach && each - end(id) >= low && each - end(id) <= high)
        .sort((a, b) => Math.abs(a - at) - Math.abs(b - at))[0];
      if (line !== undefined) move = line - end(id);
    }
    const sized = { ...mirrored };
    for (const n of near_) { const [s, l] = along(sized[n]!, axis); sized[n] = put(sized[n]!, axis, s, l + move); }
    for (const f of far) { const [s, l] = along(sized[f]!, axis); sized[f] = put(sized[f]!, axis, s + move, l - move); }
    boxes = Object.fromEntries(Object.entries(sized).map(([key, box]) => [key, flip(box)]));
  }
  return boxes;
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
