// The editor's keyboard shortcuts, in one table (Refactor.95; human 2026-10-12: "shortcuts are many now: make sure one thing
// keeps them"). The keys a command answers to and the text shown for them (menus, tooltips) are both read here, so a key is
// written once. Where a command applies (on the network, not while typing) stays with the code that runs it. Keys a widget uses
// while it is being operated (Esc, Enter, arrows in a menu, a field, the value ladder, a drag) are that widget's, not commands.
// Legacy kept such a table for its text only (shortcuts_ui.js:3-39); the keys there are legacy's.
// 編輯器的快捷鍵，一張表（R.95；人類 10-12：「快捷鍵多起來了，要確認快捷鍵是被同一個東西維護的」）。指令按哪個鍵、提示怎麼寫（選單、
// 滑鼠提示）都從這裡讀，一個鍵只寫一次。在哪裡生效（網路區、不在打字時）留在執行它的程式。元件操作中自己用的鍵（選單、欄位、數值梯尺、
// 拖曳裡的 Esc、Enter、方向鍵）屬於那個元件，不是指令。舊產品也有這張表，但只用來顯示文字（shortcuts_ui.js:3-39）；鍵照舊產品。

/** Each command's section and keys. Sections (human 2026-10-12: perhaps three kinds — the interface, canvas editing, core
 * capabilities): `ui` only changes what is shown and where (framing, Focus graph, menus, panels), never the graph; `edit` changes
 * the graph by editing on the canvas (Undo and Redo too: they step through those edits); `core` hands the work to a core
 * transformation (selection to subgraph; later e.g. applying to TD). `Mod` is Ctrl, or Cmd on a Mac; parts are joined by `+`; a
 * command may have several keys. A command not built yet keeps its keys here (legacy's), so its greyed entry already shows them.
 * 每個指令的分類與鍵。分類（人類 10-12：大概分三類——UI 相關、畫布編輯、核心能力）：ui 只改變看到什麼、在哪裡（對準、專注編輯、選單、
 * 面板），不改圖；edit 在畫布上直接改圖（復原、重做也是：它們走的是這些編輯）；core 交給核心做一次轉換（選取轉為子圖；之後例如套用到 TD）。
 * Mod 是 Ctrl（Mac 是 Cmd）；用 + 連接；一個指令可以有好幾個鍵。還沒做的指令也在這裡（鍵照舊產品），灰色的項目已經能顯示。 */
export const SHORTCUTS = {
  undo: { section: 'edit', keys: ['Mod+Z'] },
  redo: { section: 'edit', keys: ['Mod+Shift+Z'] },
  add: { section: 'edit', keys: ['Tab'] },
  /** Copy and paste arrive as the browser's own copy and paste events, which follow these keys (copy_paste.ts). 複製、貼上由瀏覽器
   * 自己的複製、貼上事件送來，按的就是這兩個鍵（copy_paste.ts）。 */
  copy: { section: 'edit', keys: ['Mod+C'] },
  paste: { section: 'edit', keys: ['Mod+V'] },
  duplicate: { section: 'edit', keys: ['Mod+D'] },
  delete: { section: 'edit', keys: ['Delete', 'Backspace'] },
  group: { section: 'edit', keys: ['Mod+G'] },
  subgraph: { section: 'core', keys: ['Mod+Shift+G'] },
  home: { section: 'ui', keys: ['H'] },
  frame: { section: 'ui', keys: ['F'] },
  focusGraph: { section: 'ui', keys: ['Mod+Enter'] },
  /** Leaves Focus graph (human 2026-10-11). 離開專注編輯（人類 10-11）。 */
  leaveFocus: { section: 'ui', keys: ['Escape'] },
  menu: { section: 'ui', keys: ['Shift+F10', 'ContextMenu'] },
  floatingParameter: { section: 'ui', keys: ['P'] },
  linkLines: { section: 'ui', keys: ['X'] },
} as const satisfies Record<string, { section: 'ui' | 'edit' | 'core'; keys: readonly string[] }>;
export type Shortcut = keyof typeof SHORTCUTS;

const mac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Whether a key press is this command: exactly its modifiers (Mod is Ctrl or Cmd, not both), letters in either case.
 * 這次按鍵是不是這個指令：修飾鍵完全相同（Mod 是 Ctrl 或 Cmd、不能兩個都按），字母不分大小寫。 */
export function matches(id: Shortcut, event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }): boolean {
  return SHORTCUTS[id].keys.some(combo => {
    const parts = combo.split('+'), key = parts.pop()!, mod = parts.includes('Mod');
    return event.key.toLowerCase() === key.toLowerCase()
      && (mod ? event.ctrlKey !== event.metaKey : !event.ctrlKey && !event.metaKey)
      && event.altKey === parts.includes('Alt') && event.shiftKey === parts.includes('Shift');
  });
}

/** The keys as they are written for people: parts joined by a full-width plus, alternatives by " / " (legacy shortcuts_ui.js:40-43).
 * 給人看的寫法：用全形加號連接，幾個鍵之間用「 / 」（照舊產品）。 */
export function shortcutText(id: Shortcut): string {
  const word = (part: string) => part === 'Mod' ? (mac() ? 'Cmd' : 'Ctrl') : part === 'Escape' ? 'Esc' : part === 'ContextMenu' ? 'Menu' : part;
  return SHORTCUTS[id].keys.map(combo => combo.split('+').map(word).join('＋')).join(' / ');
}

/** A tooltip with its shortcut after it (legacy decorateShortcutButton: label, an ideographic space, the keys). 滑鼠提示後面接快捷鍵
 * （照舊產品：說明、全形空格、按鍵）。 */
export const withShortcut = (text: string, ...ids: Shortcut[]) => [text, ...ids.map(shortcutText)].join('　');

/** The keys React Flow listens to itself (its delete key). React Flow 自己聽的鍵（刪除鍵）。 */
export const reactFlowKeys = (id: Shortcut) => [...SHORTCUTS[id].keys];
