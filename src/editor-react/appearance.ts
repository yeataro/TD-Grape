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
// Trial switches for shadows (human 2026-10-09 A/B): layered small shadows, the canvas's inner shadow, shadows on source
// cards. Chosen ones stay and the switches go once decided. 陰影的試驗開關（人類 A/B）：層疊微陰影、畫布內陰影、來源卡片陰影；
// 決定後留下選中的、拿掉開關。
// Outer glows (human 2026-10-09; legacy's cool styles, without their moving glow): each in the thing's own colour.
// 外光暈（人類；舊產品 cool 風格，不含光暈動畫）：各用自己的顏色。
export type ShadowTrial = 'layers' | 'canvas' | 'cards' | 'glow' | 'selectGlow' | 'titleGlow' | 'titleBarGlow' | 'highlightGlow' | 'wireGlow' | 'portGlow' | 'logoGlow';
const shadowDefaults: Record<ShadowTrial, boolean> = { layers: false, canvas: true, cards: false, glow: false,
  selectGlow: false, titleGlow: false, titleBarGlow: false, highlightGlow: false, wireGlow: false, portGlow: false, logoGlow: false };
const shadows = Object.fromEntries((Object.keys(shadowDefaults) as ShadowTrial[]).map(key => [key,
  browser ? readChoice('appearance.shadow.' + key, ['on', 'off'], shadowDefaults[key] ? 'on' : 'off') === 'on' : shadowDefaults[key]])) as Record<ShadowTrial, boolean>;
const listeners = new Set<() => void>();
function apply() {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = style === 'td' ? 'td' : mode;
  document.documentElement.dataset.size = size;
  document.documentElement.dataset.ports = ports;
  document.documentElement.dataset.componentTint = componentTint ? 'on' : 'off';
  for (const [key, on] of Object.entries(shadows)) document.documentElement.dataset['shadow' + key[0]!.toUpperCase() + key.slice(1)] = on ? 'on' : 'off';
}
apply();
const changed = () => { apply(); listeners.forEach(listener => listener()); };
export const appearanceSubscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const appearance = () => `${style}/${mode}/${size}/${ports}/${Number(componentTint)}/${Object.values(shadows).map(Number).join('')}`;
export const componentTintOn = () => componentTint;
export function setComponentTint(on: boolean) {
  if (on !== componentTint) { componentTint = on; writePreference('appearance.componentTint', on ? 'on' : 'off'); changed(); }
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
