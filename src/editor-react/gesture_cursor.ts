// A gesture's cursor over the whole page (Refactor.106): while panning, scrubbing a value or dragging to add, one transparent layer
// above everything carries the cursor, so starting and ending a gesture restyles one element. The old page-wide rules
// (`:root.X *` with !important) restyled every element of the page on each start and end (perf audit 2026-10-13, B3).
// The gestures keep their own listeners: they capture the pointer or listen on the window, so events still reach them; the layer is
// only there to be under the pointer. Anything that asks what lies under the pointer (elementFromPoint) must let go first.
// While an element holds the pointer captured, Chrome is expected to draw that element's cursor, not the cursor of what is under the
// pointer (read from Blink's mouse event targeting, not yet tried here; the value box's sideways drag already relies on it with
// input.number.scrubbing): such a gesture names its element and it gets the cursor too.
// 手勢的游標蓋滿整頁（R.106）：平移、拖數值、拖曳新增時，最上面一層透明層帶著游標，手勢開始與結束只改一個元素的樣式。舊的整頁規則
// （`:root.X *` 加 !important）每次開始、結束都重算整頁每個元素（10-13 效能排查 B3）。手勢自己的監聽不變：它們捕捉指標或聽 window，
// 事件照樣送到；這一層只是待在指標底下。要問「指標下是什麼」（elementFromPoint）的，先拿掉這一層。
// 有元素捕捉著指標時，Chrome 預期畫的是那個元素的游標，不是指標下東西的游標（讀 Blink 的滑鼠事件目標得知，尚未在這裡實測；數值框橫向拖曳
// 已經靠 input.number.scrubbing 這樣運作）：這種手勢把它的元素交進來，那個元素也拿到游標。

export type GestureCursor = 'move' | 'ew-resize' | 'copy';

const held = new Map<GestureCursor, () => void>();

/** Show `kind` everywhere until the returned function is called; `captor`: the element holding the pointer captured, if any.
 * Holding the same kind again replaces the first (one layer a kind). The cursors themselves are in style.css's cursor rules.
 * 在整頁顯示這個游標，直到呼叫回傳的函式；captor：捕捉著指標的元素（有的話）。同一種再拿一次就換掉前一個（每種一層）。游標本身寫在
 * style.css 的游標規則。 */
export function holdCursor(kind: GestureCursor, captor?: Element | null): () => void {
  held.get(kind)?.();
  const layer = document.createElement('div');
  layer.className = 'gesture-cursor';
  layer.dataset.cursor = kind;
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  captor?.setAttribute('data-gesture-cursor', kind);
  const release = () => {
    layer.remove();
    if (captor?.getAttribute('data-gesture-cursor') === kind) captor.removeAttribute('data-gesture-cursor');
    if (held.get(kind) === release) held.delete(kind);
  };
  held.set(kind, release);
  return release;
}
