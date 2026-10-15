import type { ReactNode } from 'react';

// Every icon of the editor in one place (Refactor.53; human 2026-10-09: "the tidier the better"). Drawn from
// the legacy editor's inline SVGs (legacy src/editor/index.html, selection_ui.js); all share one 24×24 stroke
// style. A screen only names an icon; changing an icon, or later moving to an icon library (a new dependency:
// ask first), touches this file only.
// 編輯器所有圖示集中在這裡，取自舊產品的 SVG；畫面只寫名稱。換圖示或改用圖示庫（新依賴，先問）只動這個檔。
const paths = {
  // Panel zones: the filled part shows which side. 面板區：填色的部分表示哪一側。
  leftPanel: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /><path className="icon-fill" d="M6 4h3v16H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z" /></>,
  rightPanel: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M15 4v16" /><path className="icon-fill" d="M15 4h3a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-3Z" /></>,
  titleBar: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 10h18" /><path className="icon-fill" d="M6 4h12a3 3 0 0 1 3 3v3H3V7a3 3 0 0 1 3-3Z" /></>,
  undo: <path d="M9 5 4 10l5 5M4 10h9a6 6 0 0 1 6 6v3" />,
  camera: <><path d="M4 8h3l2-2.5h6L17 8h3v11H4Z" /><circle cx="12" cy="13" r="3.5" /></>,
  redo: <path d="m15 5 5 5-5 5m5-5h-9a6 6 0 0 0-6 6v3" />,
  delete: <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />,
  fitSelection: <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5M8 8h8v8H8z" />,
  // The floating toolbar's (Refactor.92). Make subgraph: four corner arrows pointing in (human 2026-10-11). 浮動工具列的（R.92）。
  // 轉成子圖：四角箭頭往內（人類 10-11）。
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>,
  paste: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" /></>,
  collapseCards: <path d="m7 11 5-5 5 5M7 18l5-5 5 5" />,
  expandCards: <path d="m7 6 5 5 5-5M7 13l5 5 5-5" />,
  group: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18" /><rect x="7" y="12" width="4" height="4" /><rect x="13" y="12" width="4" height="4" /></>,
  subgraph: <path d="m3 3 6 6M9 4v5H4M21 3l-6 6M15 4v5h5M3 21l6-6M4 15h5v5M21 21l-6-6M20 15h-5v5" />,
  // A subgraph instance's kind, on its title (visual notes 2026-10-14, item 1; placeholders, human 2026-10-14): a Library subgraph is
  // "share" (three joined dots, as Material's share), a local one is "link" (two chain links, as Feather's link). Same stroke style.
  // 子圖實例的種類，放標題列（外觀意見第 1 條；先站位，人類 10-14）：資源庫子圖＝分享（三點相連，照 Material share），本地＝鏈結
  // （兩環相扣，照 Feather link）。同一套線條。
  subgraphLibrary: <><circle className="icon-solid" cx="18" cy="5" r="3.4" /><circle className="icon-solid" cx="6" cy="12" r="3.4" /><circle className="icon-solid" cx="18" cy="19" r="3.4" /><path d="m9 10.3 6-3.5M9 13.7l6 3.5" /></>,
  subgraphLocal: <path className="icon-bold" d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.1 1.1M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.1-1.1" />,
  arrange: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />,
  // The right-click menu's own (Refactor.93; legacy graph_ui.js:2923-2937). Home: the four corners with a small node (human
  // 2026-10-11); Focus graph: arrows pushing out inside a frame (D, human 2026-10-11; drawn here first, settled in its own round).
  // 右鍵選單自己的（R.93，取自舊產品）。Home：四角框加小節點（人類 10-11）；專注編輯：框裡箭頭往兩邊推（D，人類 10-11；先畫，在它那一輪定）。
  plus: <path d="M12 4v16M4 12h16" />,
  duplicate: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M11 14h6m-3-3v6" /></>,
  convertWires: <path d="M3 6h14m-4-3 4 3-4 3M3 18h14m-4-3 4 3-4 3" />,
  home: <><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5" /><rect x="8.5" y="9.5" width="7" height="5" rx="1.2" /></>,
  focus: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M10 12H6m2-2-2 2 2 2M14 12h4m-2-2 2 2-2 2" /></>,
  unfocus: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M6 12h4M8 10l2 2-2 2M18 12h-4m2-2-2 2 2 2" /></>,
  floatingPanel: <path d="M4 3h16v18H4zM4 8h16M8 12h8M8 16h5" />,
  arrowLeft: <path d="M20 12H4m6-6-6 6 6 6" />,
  arrowRight: <path d="M4 12h16m-6-6 6 6-6 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  // Groups (Refactor.98; legacy frames_ui.js:257, graph_ui.js:2937, selection_ui.js:431-433). 群組（R.98，取自舊產品）。
  pencil: <path d="m4 16-1 5 5-1L20 8l-4-4L4 16Zm10-10 4 4" />,
  /** Text appearance (Refactor.101). 文字外觀（R.101）。 */
  text: <path d="M6 5h12M12 5v14M9 19h6" />,
  joinGroup: <path d="M10 4H4v16h16v-6M21 3 10 14M10 7v7h7" />,
  leaveGroup: <path d="M10 4H4v16h16v-6M10 14 21 3M14 3h7v7" />,
  boxSelect: <rect x="4" y="4" width="16" height="16" rx="1" strokeDasharray="3 3" />,
  menu: <><circle cx="12" cy="5" r="1.6" className="icon-dot" /><circle cx="12" cy="12" r="1.6" className="icon-dot" /><circle cx="12" cy="19" r="1.6" className="icon-dot" /></>,
  fullscreen: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
  chevronDown: <path d="m7 10 5 5 5-5" />,
  // More tools, folded into a menu (legacy #graphmore, selection_ui.js:525). 收進選單的其他工具（舊產品 #graphmore）。
  more: <path d="M3 5h16M3 10h16M3 15h8m3 3 4 4 4-4" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  // A panel's own menu, three lines (Refactor.83.1, human 2026-10-11). 面板自己的選單，三條橫線（R.83.1，人類）。
  panelMenu: <path d="M5 7h14M5 12h14M5 17h14" />,
  // Snap as Blender's magnet (human 2026-10-09); the settings gear from the legacy foot bar. 磁鐵（Blender）、齒輪（舊產品）。
  snap: <path d="M5 4v7a7 7 0 0 0 14 0V4h-4v7a3 3 0 0 1-6 0V4Z M5 8h4m6 0h4" />,
  settings: <><path d="m9.5 3-.5 2-2 .9-1.8-.6-2 3.4 1.5 1.4v2.8l-1.5 1.4 2 3.4 1.8-.6 2 .9.5 2h4l.5-2 2-.9 1.8.6 2-3.4-1.5-1.4v-2.8l1.5-1.4-2-3.4-1.8.6-2-.9-.5-2Z" /><circle cx="11.5" cy="11.5" r="3" /></>,
  theme: <path d="M20.5 14A8.7 8.7 0 0 1 10 3.5 8.8 8.8 0 1 0 20.5 14Z" />,
  textSize: <path d="M3 17 6.5 8 10 17M4.3 14h4.4M12 19 17 5 22 19M14 14h6" />,
  // TD's error mark: a filled circle with a cross (Refactor.63.6.1, human 2026-10-10: as TD marks an OP in error).
  // TD 的錯誤標記：實心圓加叉（人類：照 TD 標出錯 OP 的樣子）。
  errorBadge: <><circle cx="12" cy="12" r="10" className="icon-badge" /><path d="m8 8 8 8M16 8l-8 8" /></>,
} satisfies Record<string, ReactNode>;
export type IconName = keyof typeof paths;

/** One icon, sized by the surrounding CSS (`.icon`). 一個圖示，大小由外面的 CSS 決定。 */
export const Icon = ({ name }: { name: IconName }) =>
  <svg className={'icon icon-' + name} viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[name]}</svg>;

/** The TD-Grape mark (three grapes), the same drawing as static/favicon.svg and the legacy header. A logo is artwork,
 * not a theme colour: it keeps its own colours in every theme (the one exception to COLOR_SYSTEM.md's rule).
 * TD-Grape 的三顆葡萄，與 favicon.svg、舊產品標題列同一份圖。標誌是圖，不是主題色：每個主題都不變（顏色規則唯一的例外）。 */
// Waiting animations of the mark (Refactor.59.6; human 2026-10-10: one small shared piece, called wherever something waits).
// `wave` (the circles light in turn) is the chosen one; the others stay as options, all compared in workspace
// work/refactor/loading-animations.html — keep that page in step whenever this piece changes or gains a feature (human 2026-10-10).
// Motion only in style.css. 標誌的等待動畫（人類：一個共用的小元件，哪裡在等就放哪裡）。
// wave（輪流亮）是選定的；其他留作選項，九種在 workspace 的預覽頁比較；這個元件改了或加功能，預覽頁要同步（人類）。動作只寫在 style.css。
export const loadingStyles = ['wave', 'spin', 'orbit', 'breathe', 'fade', 'hop', 'gather', 'glow', 'trace'] as const;
export type LoadingStyle = typeof loadingStyles[number];
/** `loading`: animate while something waits — `true` is `wave`, or name one of `loadingStyles`.
 * `label`: what is being waited for, for assistive tech (a still mark stays hidden from it).
 * loading：等待時動起來，true＝wave，或指定一種；label：在等什麼，給輔助工具（不動的標誌對它隱藏）。 */
export const BrandMark = ({ loading, label }: { loading?: boolean | LoadingStyle; label?: string } = {}) => {
  const style = loading === true ? 'wave' : loading || undefined;
  return <svg className={'brand-mark' + (style ? ' loading loading-' + style : '')} viewBox="0 0 64 64" focusable="false"
    {...(style ? { role: 'img', 'aria-label': label, 'aria-busy': true } : { 'aria-hidden': true })}>
    <g><circle cx="20" cy="23" r="11" fill="#bfa5f4" /><circle cx="44" cy="23" r="11" fill="#a98be2" /><circle cx="32" cy="44" r="11" fill="#b499ef" /></g></svg>;
};
