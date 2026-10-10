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
// This round the tree keeps one shape, ensured by where things may be dropped: the outermost row is
// [left side?, centre, right side?], the centre is a column [above…, canvas, below…]. Allowing more shapes later
// only adds places to drop, never a new format. A split pane holding the canvas is never flattened, so the canvas
// keeps its place in the tree (and on screen) whatever moves around it.
// 這一輪的樹只有一種長法，由可放置的地方保證：最外層左右分〔左側、中間、右側〕，中間上下分〔上方…、畫布、下方…〕。以後開放
// 更多排法只是多加放置的地方，不是新格式。含畫布的分割窗格永不攤平，所以畫布在樹裡（和畫面上）的位置不因周圍移動而變。

export type Direction = 'row' | 'column';
export type Side = 'left' | 'right';
export type Pane =
  | { kind: 'split'; direction: Direction; children: Pane[]; sizes: number[] }
  | { kind: 'tabs'; panels: string[]; active: string }
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

// Sizes in pixels (tentative, human 2026-10-09: to be tuned; a side at least 300, R.53). 像素尺寸（暫定，可調）。
export const SIDE_WIDTH = 380, SIDE_MIN = 300, SIDE_MAX = 900, PANE_HEIGHT = 240, PANE_MIN = 120, CANVAS_MIN_WIDTH = 320, CANVAS_MIN_HEIGHT = 200;

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

/** Drop empty tab panes, empty splits, and splits of one (unless they hold the canvas). 拿掉空的窗格與只剩一格的分割。 */
export function tidy(pane: Pane): Pane | null {
  if (pane.kind === 'canvas') return pane;
  if (pane.kind === 'tabs') {
    if (!pane.panels.length) return null;
    return pane.panels.includes(pane.active) ? pane : { ...pane, active: pane.panels[0]! };
  }
  const children: Pane[] = [], sizes: number[] = [];
  pane.children.forEach((child, index) => { const kept = tidy(child); if (kept) { children.push(kept); sizes.push(pane.sizes[index] ?? 1); } });
  if (!children.length) return null;
  if (children.length === 1 && !hasCanvas(children[0]!)) return children[0]!;
  return { ...pane, children, sizes };
}

export function defaultLayout(panels: PanelDefaults): LayoutData {
  const side = (which: Side): Pane | null => {
    const ids = panels.filter(row => row[1] === which).map(row => row[0]);
    return ids.length ? { kind: 'tabs', panels: ids, active: panels.find(row => row[1] === which && row[2])?.[0] ?? ids[0]! } : null;
  };
  const left = side('left'), right = side('right');
  const children = [left, { kind: 'split', direction: 'column', children: [{ kind: 'canvas' }], sizes: [1] } as Pane, right].filter((pane): pane is Pane => !!pane);
  // Default as the legacy editor and R.53: the right side closed until the Parameter panel lives there.
  // 預設照舊產品與 R.53：右側收著，等參數面板住進去。
  return { version: 2, titleBar: true, root: { kind: 'split', direction: 'row', children, sizes: children.map(pane => hasCanvas(pane) ? 1 : SIDE_WIDTH) },
    hidden: [], closed: { left: false, right: true } };
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
          return { kind: 'tabs', panels: node.panels.filter((id): id is string => typeof id === 'string'), active: String(node.active) };
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
function wellFormed(root: Pane): boolean {
  if (root.kind !== 'split' || root.direction !== 'row') return false;
  const centres = root.children.filter(hasCanvas);
  if (centres.length !== 1) return false;
  const centre = centres[0]!;
  return centre.kind === 'split' && centre.direction === 'column' && centre.children.filter(child => child.kind === 'canvas').length === 1
    && centre.children.every(child => child.kind === 'canvas' || !hasCanvas(child));
}
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

/** Put a panel at the end of a side: a new tab pane below what is there, or the side itself when it has nothing.
 * 把面板放到某一側最下面：在現有的下面多一個分頁窗格；那一側沒有東西就建立它。 */
export function addToSide(layout: LayoutData, panel: string, side: Side): LayoutData {
  const next = copy(layout), root = next.root as Extract<Pane, { kind: 'split' }>;
  const fresh: Pane = { kind: 'tabs', panels: [panel], active: panel };
  const centre = root.children.findIndex(hasCanvas);
  const index = side === 'left' ? centre - 1 : centre + 1, existing = sideOf(root, index) === side ? root.children[index] : undefined;
  if (!existing) {
    root.children.splice(side === 'left' ? centre : centre + 1, 0, fresh);
    root.sizes.splice(side === 'left' ? centre : centre + 1, 0, SIDE_WIDTH);
  } else if (existing.kind === 'split' && existing.direction === 'column') {
    existing.children.push(fresh); existing.sizes.push(average(existing.sizes));
  } else root.children[index] = { kind: 'split', direction: 'column', children: [existing, fresh], sizes: [1, 1] };
  return next;
}
const average = (sizes: readonly number[]) => sizes.length ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 1;

/** Where a dragged panel goes. tab: into a tab pane at a tab position; beside: a new tab pane above or below a pane (a tab
 * pane or the canvas); side: the end of a side (made, or opened, if needed).
 * 拖著的面板放到哪：tab＝放進某個分頁窗格的某個位置；beside＝在某一格（分頁窗格或畫布）上方或下方多一個分頁窗格；side＝某一側最下面。 */
export type Drop =
  | { kind: 'tab'; pane: Path; index: number }
  | { kind: 'beside'; pane: Path; edge: 'top' | 'bottom' }
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
    const parent = at(next.root, drop.pane.slice(0, -1)) as Extract<Pane, { kind: 'split' }> | undefined, place = drop.pane[drop.pane.length - 1]!;
    if (parent?.direction === 'column') {
      // Into the column it is in: beside the canvas in pixels, between tab panes by sharing the target's part.
      // 放進所在的上下分割：在畫布旁記像素；在分頁窗格之間平分目標那一格。
      const by = hasCanvas(parent) ? PANE_HEIGHT : (parent.sizes[place] ?? 1) / 2;
      if (!hasCanvas(parent)) parent.sizes[place] = by;
      const index = drop.edge === 'top' ? place : place + 1;
      parent.children.splice(index, 0, fresh); parent.sizes.splice(index, 0, by);
    } else {
      // A tab pane that is a whole side: it becomes a column of two. 整個一側的分頁窗格：變成上下兩格。
      const pair = drop.edge === 'top' ? [fresh, target] : [target, fresh];
      replace(next, drop.pane, { kind: 'split', direction: 'column', children: pair, sizes: [1, 1] });
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
  if (placed) placed.pane.active = panel;
  const opened = side ?? (placed && layout.root.kind === 'split' ? sideOf(layout.root, placed.path[0]!) : null);
  return { ...layout, hidden: layout.hidden.filter(id => id !== panel), closed: opened ? { ...layout.closed, [opened]: false } : layout.closed };
}

/** Bring a panel forward: shown, its tab chosen, its side opened. 把面板叫到前面：顯示、選中、打開所在的那一側。 */
export const showPanel = (layout: LayoutData, panel: string) => finish(copy(layout), panel, null);
export const hidePanel = (layout: LayoutData, panel: string): LayoutData =>
  layout.hidden.includes(panel) ? layout : { ...layout, hidden: [...layout.hidden, panel] };
export function activate(layout: LayoutData, path: Path, panel: string): LayoutData {
  const next = copy(layout), pane = at(next.root, path);
  if (pane?.kind === 'tabs' && pane.panels.includes(panel)) pane.active = panel;
  return next;
}
export function resize(layout: LayoutData, path: Path, sizes: readonly number[]): LayoutData {
  const next = copy(layout), pane = at(next.root, path);
  if (pane?.kind === 'split') pane.sizes = pane.children.map((_, index) => sizes[index] ?? pane.sizes[index] ?? 1);
  return next;
}
