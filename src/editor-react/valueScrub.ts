// The slider behaviour of a value box, as the legacy editor (legacy inspector.js:139-230; value-input.md): pure
// numbers, no DOM, so they can be tested. The fill shows where the value sits in its decade; a left drag across the
// box's width moves through one decade (0 to 1, 1 to 10, 10 to 100...), so dragging never stops at 1 or 10.
// 數值框的 slider 行為，照舊產品：純數字、不碰畫面，可以測試。填色表示值在它那一個十進位段的位置；左鍵拖過整個框寬
// 走完一段（0～1、1～10、10～100…），所以拖曳不會卡在 1 或 10。

/** How full a value box looks, 0 to 1: 0–1 as it is; above 1 by its leading digit; negatives from the right.
 * 數值框填多少（0～1）：0～1 照比例；大於 1 看第一位數字；負數從右邊算。 */
export function fillFraction(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const magnitude = Math.abs(value);
  let fraction = magnitude;
  if (magnitude > 1) { const leading = Number(magnitude.toExponential().split('e')[0]); fraction = leading === 1 ? 1 : leading / 10; }
  return value < 0 ? 1 - fraction : fraction;
}

// A value unwrapped into continuous travel: 1 → 10, 10 → 19, 100 → 28 (integer band widths avoid drift at exact
// decimal boundaries). 把值攤成連續的行程：1→10、10→19、100→28。
const travelOf = (value: number) => {
  const magnitude = Math.abs(value);
  if (magnitude <= 1) return value * 10;
  const [digits, power] = magnitude.toExponential().split('e');
  const leading = Number(digits), decade = Number(power) + (leading === 1 ? 0 : 1), fraction = leading === 1 ? 1 : leading / 10;
  return Math.sign(value) * (9 * decade + fraction * 10);
};
const valueOf = (travel: number) => {
  const distance = Math.abs(travel), decade = distance <= 10 ? 0 : Math.min(309, Math.ceil((distance - 10) / 9));
  return { value: Number((Math.sign(travel) * (distance - 9 * decade)) + 'e' + (decade - 1)), decade };
};
const decimalPlaces = (value: number) => {
  const [digits, exponent = '0'] = String(value).toLowerCase().split('e');
  return Math.max(0, (digits!.split('.')[1]?.length ?? 0) - Number(exponent));
};

export type Scrub = {
  integer: boolean; width: number; lastX: number;
  base: number; delta: number; pixels: number; ticks: number; sensitivity: string; value: number;
  min?: number; max?: number;
};
/** Start a drag at x over a box `width` pixels wide. 在 x 開始拖，框寬 width。 */
export function startScrub(value: number, x: number, width: number, integer: boolean, limits: { min?: number; max?: number } = {}): Scrub {
  return { integer, width: Math.max(1, width), lastX: x, base: value, delta: 0, pixels: 0, ticks: 0, sensitivity: '', value, ...limits };
}
/** Move the drag to x; Shift is 10 times finer, Ctrl 10 times coarser, both 100 times finer; integers step every 10
 * pixels (Ctrl 1, Shift 100). Returns the new value. 拖到 x：Shift 細 10 倍、Ctrl 粗 10 倍、兩個一起細 100 倍；
 * 整數每 10px 一步（Ctrl 1px、Shift 100px）。回傳新的值。 */
export function moveScrub(state: Scrub, x: number, keys: { ctrl: boolean; shift: boolean }): number {
  const { integer } = state;
  const units = integer ? 10000 : keys.ctrl ? (keys.shift ? 1 : 1000) : keys.shift ? 10 : 100;
  const pixelsPerStep = integer ? (keys.ctrl ? 1 : keys.shift ? 100 : 10) : state.width / 1000, key = units + ':' + pixelsPerStep;
  // Completed steps are kept when the keys change, without carrying a partial coarse step into a finer one.
  // 換按鍵時保留走完的步數，但不把半步粗調帶進細調，避免突然跳動。
  if (key !== state.sensitivity) { state.pixels = 0; state.ticks = 0; state.sensitivity = key; }
  state.pixels += x - state.lastX; state.lastX = x;
  const travel = state.pixels / pixelsPerStep;
  const ticks = integer ? Math.trunc(travel) : Math.sign(travel) * Math.round(Math.abs(travel)), change = ticks - state.ticks;
  if (!change) return state.value;
  state.ticks = ticks; state.delta += change * units;
  const moved = integer ? { value: state.base + state.delta / 10000, decade: 0 } : valueOf(travelOf(state.base) + state.delta / 10000);
  const precision = Math.min(100, Math.max(integer ? 4 : 5 - moved.decade, decimalPlaces(state.base)));
  const candidate = state.delta === 0 ? state.base : Number(moved.value.toFixed(precision));
  if (Number.isNaN(candidate)) return state.value;
  let value = Number.isFinite(candidate) ? candidate : Math.sign(candidate) * Number.MAX_VALUE;
  if (state.min !== undefined) value = Math.max(state.min, value);
  if (state.max !== undefined) value = Math.min(state.max, value);
  // Hitting a limit restarts from it, so turning back moves at once. 碰到界限就從界限重新算，往回拖立刻有反應。
  if (value !== candidate) { state.base = value; state.delta = 0; state.pixels = 0; state.ticks = 0; }
  state.value = integer ? Math.round(value) : value;
  return state.value;
}

/** The right-click common values (legacy), with the value's default merged in when it has one, from high to low (human
 * 2026-10-09). 右鍵常用值（照舊產品），有預設值就併進來、剛好相同就標在那一項；由高到低排（人類）。 */
export function presetValues(integer: boolean, min: number | undefined, defaultValue: number | undefined): { value: number; isDefault: boolean }[] {
  const common = (integer ? [0, 1, -1] : [0, 1, 0.5, -0.5, -1]).filter(value => min === undefined || value >= min);
  const list = common.map(value => ({ value, isDefault: value === defaultValue }));
  if (defaultValue !== undefined && Number.isFinite(defaultValue) && !common.includes(defaultValue)) list.push({ value: defaultValue, isDefault: true });
  return list.sort((a, b) => b.value - a.value);
}
