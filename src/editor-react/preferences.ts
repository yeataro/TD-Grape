// Personal preferences (AGENTS.md "新設定存哪裡": they follow the person, not the project; human 2026-10-09: one place
// for all of them, layout included). Kept in this browser, per origin (protocol + host + port), under one prefix; never in
// the graph or in TD. Storage can be blocked: reading then gives nothing and writing does nothing.
// Not here: unsent drafts and the connection token (sessionStorage in main.tsx), which are this tab's data, not preferences.
// 個人偏好：跟著人走、不跟著專案（人類：全部放一處，排版也是）。存在這個瀏覽器、依 origin 分開，同一個前綴；不進圖、不進 TD。
// 儲存被擋時讀不到、寫不進，不出錯。不在這裡的：未送出的草稿與連線 token（main.tsx 的 sessionStorage），那是這個分頁的資料、不是偏好。
const PREFIX = 'grape.';

// Where each one was kept before (Refactor.58.1); read once, moved under the prefix, so nobody loses a setting.
// 以前各自存在哪裡；讀到一次就搬到新名字，設定不會不見。
const formerNames: Record<string, string> = {
  language: 'sgrapeLanguage', layout: 'grape-react-layout', 'canvas.bodyDrag': 'grape-react-body-drag',
  'appearance.style': 'grape-react-style', 'appearance.mode': 'grape-react-mode',
  'appearance.size': 'grape-react-size', 'appearance.ports': 'grape-react-ports',
};
const before = (name: string) => formerNames[name] ?? (name.startsWith('fold.') ? 'grape-fold-' + name.slice(5) : undefined);
const isFormer = (key: string) => Object.values(formerNames).includes(key) || key.startsWith('grape-fold-');

// Names nothing reads any more, forgotten once so nobody mistakes them for live settings (human 2026-10-09: left to the
// agent). grape-react-theme was replaced by appearance.mode; sgrapeSourcesPanel by the layout; the two tune.* values by
// one selection green and the node outline (Refactor.58.3); tune.--wire-ghost by --wire-off, whose default is now the grey it
// was tuned to (Refactor.78).
// 已經沒有程式在讀的名字，刪一次，免得被誤當成還有作用的設定（人類：交給助手）。前者被明暗取代、次者被版面取代；
// 兩個 tune.* 被單一選取綠與節點外框線取代；tune.--wire-ghost 被 --wire-off 取代，預設已是當時調的灰（R.78）。
const retired = ['grape-react-theme', 'sgrapeSourcesPanel', 'grape.tune.--palette-select-yellow', 'grape.tune.--tint-node-divider', 'grape.tune.--wire-ghost',
  // Trial switches settled as always on (Refactor.78.3). 定案為一律開的試驗開關（R.78.3）。
  'grape.appearance.shadow.wireReadySolid', 'grape.appearance.shadow.wireReadyUnder', 'grape.appearance.shadow.wirePreview'];
if (typeof window !== 'undefined') try { retired.forEach(name => localStorage.removeItem(name)); } catch { /* storage may be blocked */ }

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

/** Forget every preference, under the prefix or a former name (Reset browser settings, Refactor.69; legacy app.js:954):
 * all or none — if one cannot be removed, the ones removed are put back and the error is passed on.
 * 忘掉所有偏好，含前綴下的與舊名字的（重設瀏覽器設定；照舊產品）：全部或都不——有一個刪不掉就把刪過的放回去，錯誤往外丟。 */
export function forgetPreferences() {
  const kept: [string, string][] = [];
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)!;
      if (key.startsWith(PREFIX) || isFormer(key)) kept.push([key, localStorage.getItem(key)!]);
    }
    for (const [key] of kept) localStorage.removeItem(key);
  } catch (error) {
    try { for (const [key, value] of kept) localStorage.setItem(key, value); } catch { /* storage may be blocked */ }
    throw error;
  }
}

/** Keep a preference; null forgets it. 記下偏好；null 表示忘掉。 */
export function writePreference(name: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(PREFIX + name); else localStorage.setItem(PREFIX + name, value);
  } catch { /* storage may be blocked */ }
}
