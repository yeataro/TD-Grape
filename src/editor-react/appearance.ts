import { tr, type Message } from './text';

// The colour theme and the size of the editor (Refactor.54.1; floating-panels.md 32, 33; COLOR_SYSTEM.md). A personal
// preference of this browser, applied as attributes on the page root so only CSS changes (no React redraw of colours).
// Dark is the product default; TD inherits Dark and changes its palette; Light is a complete theme of its own.
// 顏色主題與大小：這個瀏覽器的個人偏好，以頁面根元素的屬性套用，只換 CSS。Dark 是預設；TD 繼承 Dark 只改調色盤；Light 獨立寫齊。
export type Theme = 'dark' | 'light' | 'td';
export type Size = 'standard' | 'comfortable';
export const themes: readonly { value: Theme; label: Message }[] = [
  { value: 'dark', label: tr('appearance.dark', 'Dark') }, { value: 'light', label: tr('appearance.light', 'Light') },
  { value: 'td', label: tr('appearance.td', 'TD') }];
export const sizes: readonly { value: Size; label: Message }[] = [
  { value: 'standard', label: tr('appearance.standard', 'Standard') }, { value: 'comfortable', label: tr('appearance.comfortable', 'Comfortable') }];

const read = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  try { const value = localStorage.getItem(key) as T | null; return value && allowed.includes(value) ? value : fallback; } catch { return fallback; }
};
let theme: Theme = typeof window === 'undefined' ? 'dark' : read('grape-react-theme', ['dark', 'light', 'td'], 'dark');
let size: Size = typeof window === 'undefined' ? 'standard' : read('grape-react-size', ['standard', 'comfortable'], 'standard');
const listeners = new Set<() => void>();
function apply() {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.size = size;
}
apply();
export const appearance = () => `${theme}/${size}`;
export const currentTheme = () => theme;
export const currentSize = () => size;
export const appearanceSubscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const store = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* storage may be blocked */ } };
export function setTheme(next: Theme) { if (next === theme) return; theme = next; store('grape-react-theme', next); apply(); listeners.forEach(listener => listener()); }
export function setSize(next: Size) { if (next === size) return; size = next; store('grape-react-size', next); apply(); listeners.forEach(listener => listener()); }
