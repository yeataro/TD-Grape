import { tr, type Message } from './text';
import { readChoice, writePreference } from './preferences';

// The look of the editor (Refactor.54.1; floating-panels.md 32, 33; COLOR_SYSTEM.md), as the legacy appearance panel:
// a style (Grape, TD) and a mode (Dark, Light), plus a size (Standard, Comfortable). A personal preference of this
// browser, applied as attributes on the page root so only CSS changes. The colour theme file follows from style and
// mode: Grape gives dark.css or light.css; TD inherits Dark and has no light version yet.
// 編輯器的外觀，照舊產品的外觀面板：風格（Grape、TD）與明暗（Dark、Light），加上大小。這個瀏覽器的個人偏好，
// 以頁面根元素的屬性套用，只換 CSS。顏色主題檔由風格與明暗決定：Grape 用 dark.css／light.css；TD 繼承 Dark，還沒有淺色版。
export type Style = 'grape' | 'td';
export type Mode = 'dark' | 'light';
export type Size = 'standard' | 'comfortable';
/** Port styles under A/B test (Refactor.54.2, human 2026-10-09): A = outputs filled, inputs hollow; B = hollow until
 * wired, filled once wired. An appearance option (Q64), decided in the tuning phase.
 * 接孔樣式 A／B 測試：A＝輸出實心、輸入空心；B＝沒接空心、接了實心。外觀選項（Q64），調整期決定。 */
export type Ports = 'a' | 'b';
export const styles: readonly { value: Style; label: Message }[] = [
  { value: 'grape', label: tr('appearance.grape', 'Grape') }, { value: 'td', label: tr('appearance.td', 'TD') }];
export const modes: readonly { value: Mode; label: Message }[] = [
  { value: 'dark', label: tr('appearance.dark', 'Dark') }, { value: 'light', label: tr('appearance.light', 'Light') }];
export const sizes: readonly { value: Size; label: Message }[] = [
  { value: 'standard', label: tr('appearance.standard', 'Standard') }, { value: 'comfortable', label: tr('appearance.comfortable', 'Comfortable') }];
export const portStyles: readonly { value: Ports; label: Message }[] = [
  { value: 'a', label: tr('appearance.portsA', 'Ports A') }, { value: 'b', label: tr('appearance.portsB', 'Ports B') }];
/** Whether a style has this mode yet (TD is dark only for now). 這個風格有沒有這種明暗（TD 目前只有深色）。 */
export const hasMode = (style: Style, mode: Mode) => style !== 'td' || mode === 'dark';

const browser = typeof window !== 'undefined';
// Personal preferences (preferences.ts). 個人偏好。
let style: Style = browser ? readChoice('appearance.style', ['grape', 'td'], 'grape') : 'grape';
let mode: Mode = browser ? readChoice('appearance.mode', ['dark', 'light'], 'dark') : 'dark';
let size: Size = browser ? readChoice('appearance.size', ['standard', 'comfortable'], 'standard') : 'standard';
let ports: Ports = browser ? readChoice('appearance.ports', ['a', 'b'], 'a') : 'a';
// Component tint (Refactor.59; Q67: one switch for legacy's rgbaComponentTint and vectorComponentTint, on by default).
// 分量染色（Q67：舊產品兩個開關合成一個，預設開）。
let componentTint = browser ? readChoice('appearance.componentTint', ['on', 'off'], 'on') === 'on' : true;
// Component letters in value boxes (Refactor.76.10, human 2026-10-11: one rule everywhere, always or never; legacy had both
// and no rule): off, the digits carry the component colour instead (under the tint switch) and boxes get narrower.
// 數值框裡的分量字母（R.76.10，人類：到處同一條規則，一律放或一律不放；舊產品兩種都有、沒有規則）：關掉時改由數字帶分量顏色
// （依分量染色開關），框也變窄。Off by default (R.76.11, human 2026-10-11). 預設不放（R.76.11，人類）。
let componentLetters = browser ? readChoice('appearance.componentLetters', ['on', 'off'], 'off') === 'on' : false;
// How the type conversion gradient blends (Refactor.77.4, human 2026-10-11, a trial with the gradient): evenly, eased by
// smoothstep, evenly through oklab (a straight line, no extra hue) or oklch (keeps lightness, turns through the hues between),
// or cut in two at the middle (Refactor.77.5: Q11's "split colours"). 轉型漸層怎麼混色（R.77.4，人類，和漸層一起試）：等速、smoothstep
// 緩動、在 oklab（直線混、不多出色相）或 oklch（保住亮度、會經過中間的色相）等速混、或從中間截斷（R.77.5：Q11 的「分色」）。
export type GradientBlend = 'linear' | 'smoothstep' | 'oklab' | 'oklch' | 'step';
export const gradientBlends: readonly GradientBlend[] = ['linear', 'smoothstep', 'oklab', 'oklch', 'step'];
let gradientBlend: GradientBlend = browser ? readChoice<GradientBlend>('appearance.wireGradientBlend', gradientBlends, 'linear') : 'linear';
// What a type conversion wire shows at its middle, and whether an input shows the conversion (Refactor.77.6, human 2026-10-11,
// trials): no label, the two type names in the wire's colours, or the hand icon; an input's type as is, or "float → vec4"
// as the legacy editor wrote it on the port (legacy graph_ui.js:1213). 轉型線中間顯示什麼、輸入接孔要不要寫出轉換（R.77.6，人類，試驗）：
// 不顯示、兩個型別名稱用線兩端的顏色、或手勢圖示；接孔照原樣，或像舊產品寫成「float → vec4」。
export type ConvertLabel = 'none' | 'text' | 'icon';
export const convertLabels: readonly ConvertLabel[] = ['none', 'text', 'icon'];
let convertLabel: ConvertLabel = browser ? readChoice<ConvertLabel>('appearance.convertLabel', convertLabels, 'text') : 'text';
export type ConvertPorts = 'plain' | 'conversion';
export const convertPortChoices: readonly ConvertPorts[] = ['plain', 'conversion'];
let convertPorts: ConvertPorts = browser ? readChoice<ConvertPorts>('appearance.convertPorts', convertPortChoices, 'plain') : 'plain';
// Effects that follow a system setting unless told otherwise (Refactor.75.21, 75.22; design-interview Q70; human 2026-10-11:
// follow the system, always on or always off): fades follow "reduce motion", the glass "reduce transparency".
// 跟隨系統設定、也可以指定的效果（R.75.21、75.22；Q70；人類：跟隨系統、一律開、一律關）：淡入跟「減少動態效果」，玻璃跟「減少透明度」。
export type Follow = 'system' | 'on' | 'off';
export const follows: readonly { value: Follow; label: Message }[] = [
  { value: 'system', label: tr('appearance.followSystem', 'Follow the system') }, { value: 'on', label: tr('appearance.alwaysOn', 'Always on') },
  { value: 'off', label: tr('appearance.alwaysOff', 'Always off') }];
const effects = { motion: browser ? readChoice<Follow>('appearance.motion', ['system', 'on', 'off'], 'system') : 'system' as Follow,
  glass: browser ? readChoice<Follow>('appearance.glass', ['system', 'on', 'off'], 'system') : 'system' as Follow };
export type Effect = keyof typeof effects;
// Trial switches for shadows (human 2026-10-09 A/B): layered small shadows, the canvas's inner shadow, shadows on source
// cards. Chosen ones stay and the switches go once decided. 陰影的試驗開關（人類 A/B）：層疊微陰影、畫布內陰影、來源卡片陰影；
// 決定後留下選中的、拿掉開關。
// Outer glows (human 2026-10-09; legacy's cool styles, without their moving glow): each in the thing's own colour.
// 外光暈（人類；舊產品 cool 風格，不含光暈動畫）：各用自己的顏色。
export type ShadowTrial = 'layers' | 'canvas' | 'cards' | 'glow' | 'selectGlow' | 'titleGlow' | 'titleBarGlow' | 'highlightGlow' | 'wireGlow' | 'portGlow' | 'logoGlow' | 'wireGradient';
const shadowDefaults: Record<ShadowTrial, boolean> = { layers: false, canvas: true, cards: false, glow: false,
  selectGlow: false, titleGlow: false, titleBarGlow: false, highlightGlow: false, wireGlow: false, portGlow: false, logoGlow: false,
  // A wire that converts types runs from one end's type colour to the other's (Refactor.77.1, trial). 轉型的線用兩端型別色漸變（R.77.1，試驗）。
  wireGradient: false };
const shadows = Object.fromEntries((Object.keys(shadowDefaults) as ShadowTrial[]).map(key => [key,
  browser ? readChoice('appearance.shadow.' + key, ['on', 'off'], shadowDefaults[key] ? 'on' : 'off') === 'on' : shadowDefaults[key]])) as Record<ShadowTrial, boolean>;
const listeners = new Set<() => void>();
function apply() {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = style === 'td' ? 'td' : mode;
  document.documentElement.dataset.size = size;
  document.documentElement.dataset.ports = ports;
  document.documentElement.dataset.componentTint = componentTint ? 'on' : 'off';
  document.documentElement.dataset.componentLetters = componentLetters ? 'on' : 'off';
  document.documentElement.dataset.motion = effects.motion;
  document.documentElement.dataset.glass = effects.glass;
  for (const [key, on] of Object.entries(shadows)) document.documentElement.dataset['shadow' + key[0]!.toUpperCase() + key.slice(1)] = on ? 'on' : 'off';
}
apply();
const changed = () => { apply(); listeners.forEach(listener => listener()); };
export const appearanceSubscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const appearance = () => `${style}/${mode}/${size}/${ports}/${Number(componentTint)}${Number(componentLetters)}${gradientBlend}${convertLabel}${convertPorts}/${effects.motion}/${effects.glass}/${Object.values(shadows).map(Number).join('')}`;
export const componentTintOn = () => componentTint;
export function setComponentTint(on: boolean) {
  if (on !== componentTint) { componentTint = on; writePreference('appearance.componentTint', on ? 'on' : 'off'); changed(); }
}
export const componentLettersOn = () => componentLetters;
export const currentGradientBlend = () => gradientBlend;
export const currentConvertLabel = () => convertLabel;
export function setConvertLabel(next: ConvertLabel) {
  if (next !== convertLabel) { convertLabel = next; writePreference('appearance.convertLabel', next); changed(); }
}
export const currentConvertPorts = () => convertPorts;
export function setConvertPorts(next: ConvertPorts) {
  if (next !== convertPorts) { convertPorts = next; writePreference('appearance.convertPorts', next); changed(); }
}
export function setGradientBlend(next: GradientBlend) {
  if (next !== gradientBlend) { gradientBlend = next; writePreference('appearance.wireGradientBlend', next); changed(); }
}
export function setComponentLetters(on: boolean) {
  if (on !== componentLetters) { componentLetters = on; writePreference('appearance.componentLetters', on ? 'on' : 'off'); changed(); }
}
export const effectOf = (effect: Effect) => effects[effect];
/** Whether animation effects are on now, by the same rule as the CSS (`data-motion`): always on, always off, or the system's
 * "reduce motion" (Refactor.102.2: for motion made in code, such as a panel's scroll). 動畫效果現在開著沒有，和 CSS（data-motion）同一條
 * 規則：一律開、一律關，或看系統的「減少動態效果」（R.102.2：給程式做的動態用，例如面板的捲動）。 */
export const motionOn = () => effects.motion === 'on' || (effects.motion === 'system'
  && !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches));
export function setEffect(effect: Effect, next: Follow) {
  if (effects[effect] !== next) { effects[effect] = next; writePreference('appearance.' + effect, next); changed(); }
}
export const shadowOn = (key: ShadowTrial) => shadows[key];
export function setShadow(key: ShadowTrial, on: boolean) {
  if (shadows[key] !== on) { shadows[key] = on; writePreference('appearance.shadow.' + key, on ? 'on' : 'off'); changed(); }
}
export const currentPorts = () => ports;
export const currentStyle = () => style;
export const currentMode = () => hasMode(style, mode) ? mode : 'dark';
export const currentSize = () => size;
/** The colour theme in use, for React Flow's colorMode. 目前用的顏色主題（給 React Flow 的 colorMode）。 */
export const currentTheme = () => document.documentElement.dataset.theme ?? 'dark';
export function setStyle(next: Style) { if (next !== style) { style = next; writePreference('appearance.style', next); changed(); } }
export function setMode(next: Mode) { if (next !== mode) { mode = next; writePreference('appearance.mode', next); changed(); } }
export function setSize(next: Size) { if (next !== size) { size = next; writePreference('appearance.size', next); changed(); } }
export function setPorts(next: Ports) { if (next !== ports) { ports = next; writePreference('appearance.ports', next); changed(); } }
