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
  redo: <path d="m15 5 5 5-5 5m5-5h-9a6 6 0 0 0-6 6v3" />,
  delete: <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />,
  fitSelection: <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5M8 8h8v8H8z" />,
  boxSelect: <rect x="4" y="4" width="16" height="16" rx="1" strokeDasharray="3 3" />,
  menu: <><circle cx="12" cy="5" r="1.6" className="icon-dot" /><circle cx="12" cy="12" r="1.6" className="icon-dot" /><circle cx="12" cy="19" r="1.6" className="icon-dot" /></>,
  fullscreen: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
  chevronDown: <path d="m7 10 5 5 5-5" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  // Snap as Blender's magnet (human 2026-10-09); the settings gear from the legacy foot bar. 磁鐵（Blender）、齒輪（舊產品）。
  snap: <path d="M5 4v7a7 7 0 0 0 14 0V4h-4v7a3 3 0 0 1-6 0V4Z M5 8h4m6 0h4" />,
  settings: <><path d="m9.5 3-.5 2-2 .9-1.8-.6-2 3.4 1.5 1.4v2.8l-1.5 1.4 2 3.4 1.8-.6 2 .9.5 2h4l.5-2 2-.9 1.8.6 2-3.4-1.5-1.4v-2.8l1.5-1.4-2-3.4-1.8.6-2-.9-.5-2Z" /><circle cx="11.5" cy="11.5" r="3" /></>,
  theme: <path d="M20.5 14A8.7 8.7 0 0 1 10 3.5 8.8 8.8 0 1 0 20.5 14Z" />,
  textSize: <path d="M3 17 6.5 8 10 17M4.3 14h4.4M12 19 17 5 22 19M14 14h6" />,
} satisfies Record<string, ReactNode>;
export type IconName = keyof typeof paths;

/** One icon, sized by the surrounding CSS (`.icon`). 一個圖示，大小由外面的 CSS 決定。 */
export const Icon = ({ name }: { name: IconName }) =>
  <svg className={'icon icon-' + name} viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[name]}</svg>;

/** The TD-Grape mark (three grapes), the same drawing as static/favicon.svg and the legacy header. A logo is artwork,
 * not a theme colour: it keeps its own colours in every theme (the one exception to COLOR_SYSTEM.md's rule).
 * TD-Grape 的三顆葡萄，與 favicon.svg、舊產品標題列同一份圖。標誌是圖，不是主題色：每個主題都不變（顏色規則唯一的例外）。 */
export const BrandMark = () => <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <circle cx="20" cy="23" r="11" fill="#bfa5f4" /><circle cx="44" cy="23" r="11" fill="#a98be2" /><circle cx="32" cy="44" r="11" fill="#b499ef" /></svg>;
