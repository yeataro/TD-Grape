// Personal preferences (AGENTS.md "新設定存哪裡": they follow the person, not the project; human 2026-10-09: one place
// for all of them, layout included). Kept in this browser, per origin (protocol + host + port), under one prefix; never in
// the graph or in TD. Storage can be blocked: reading then gives nothing and writing does nothing.
// Not here: unsent drafts and the connection token (sessionStorage in main.tsx), which are this tab's data, not preferences.
// 個人偏好：跟著人走、不跟著專案（人類：全部放一處，排版也是）。存在這個瀏覽器、依 origin 分開，同一個前綴；不進圖、不進 TD。
// 儲存被擋時讀不到、寫不進，不出錯。不在這裡的：未送出的草稿與連線 token（main.tsx 的 sessionStorage），那是這個分頁的資料、不是偏好。
const PREFIX = 'grape.';

// Where each one was kept before (Refactor.58.1); read once, moved under the prefix, so nobody loses a setting.
// 以前各自存在哪裡；讀到一次就搬到新名字，設定不會不見。
const before = (name: string) => ({
  language: 'sgrapeLanguage', layout: 'grape-react-layout', 'canvas.bodyDrag': 'grape-react-body-drag',
  'appearance.style': 'grape-react-style', 'appearance.mode': 'grape-react-mode',
  'appearance.size': 'grape-react-size', 'appearance.ports': 'grape-react-ports',
} as Record<string, string>)[name] ?? (name.startsWith('fold.') ? 'grape-fold-' + name.slice(5) : undefined);

/** A preference as stored, or null when there is none (or storage is blocked). 存著的偏好；沒有（或被擋）就是 null。 */
export function readPreference(name: string): string | null {
  try {
    const value = localStorage.getItem(PREFIX + name);
    if (value !== null) return value;
    const old = before(name), moved = old === undefined ? null : localStorage.getItem(old);
    if (moved !== null) { localStorage.setItem(PREFIX + name, moved); localStorage.removeItem(old!); }
    return moved;
  } catch { return null; }
}

/** One of the allowed values, else the fallback. 允許的值之一，否則用預設。 */
export function readChoice<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const value = readPreference(name) as T | null;
  return value !== null && allowed.includes(value) ? value : fallback;
}

/** Keep a preference; null forgets it. 記下偏好；null 表示忘掉。 */
export function writePreference(name: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(PREFIX + name); else localStorage.setItem(PREFIX + name, value);
  } catch { /* storage may be blocked */ }
}
