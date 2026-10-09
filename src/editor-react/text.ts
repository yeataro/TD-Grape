import zhHant from './locales/zh-Hant.json';
import { tr, isMessage, type Message, type TextParam } from '../core-ts/text';

// Showing text (design-interview Q34): a message is translated only when it is shown, so stored
// state keeps data, not words. A missing or empty translation shows the English original; a code
// is never shown. Chinese and English for now; more languages later (human 2026-10-09).
// 顯示文字：顯示那一刻才翻譯，狀態裡存的是資料；缺翻譯顯示英文原文，永遠不顯示代號。
export { tr, isMessage, type Message };
export type Language = 'en' | 'zh-Hant';
const catalogs: Record<Language, Record<string, string>> = { en: {}, 'zh-Hant': zhHant };
const separators: Record<Language, string> = { en: ', ', 'zh-Hant': '、' };

// The setting a person chose (shared key with the legacy editor), else the browser's language when
// supported, else English (Q34, human 2026-10-09). A language menu comes with the settings panel.
// 使用者選過的語言優先；沒選過就跟著瀏覽器（有支援才用）；否則英文。語言選單之後跟設定面板一起做。
export function chooseLanguage(stored: string | null | undefined, browser: readonly string[]): Language {
  if (stored === 'en' || stored === 'zh-Hant') return stored;
  for (const tag of browser) {
    const lower = tag.toLowerCase();
    if (lower.startsWith('en')) return 'en';
    if (lower.startsWith('zh') && !/^zh-(cn|sg|hans)/.test(lower)) return 'zh-Hant';
  }
  return 'en';
}

export function localize(message: Message | string, language: Language): string {
  if (typeof message === 'string') return message;
  const wording = catalogs[language][message.code] || message.source;
  return wording.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value: TextParam | undefined = message.params?.[name];
    if (value === undefined) return whole;
    if (Array.isArray(value)) return value.map(item => localize(item, language)).join(separators[language]);
    return isMessage(value) ? localize(value, language) : String(value);
  });
}

function storedLanguage(): Language {
  let stored: string | null = null;
  try { stored = localStorage.getItem('sgrapeLanguage'); } catch { /* storage may be blocked */ }
  return chooseLanguage(stored, typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]);
}
// The language can change while editing, in place, as the legacy editor (legacy app.js:68–72; Refactor.54: the
// R.53 menu reloaded the page and lost the Undo history). Text is worded when shown, so a re-render is enough.
// 語言可以在編輯中當場切換（照舊產品；R.53 的選單重新整理頁面，Undo 歷史因此不見）。文字在顯示時才翻，重畫即可。
let current: Language = typeof window === 'undefined' ? 'en' : storedLanguage();
// The page says its language from the start, so the font that follows it (theme/sizes.css) is right at once.
// 頁面一開始就標出語言，讓跟著語言的字型（sizes.css）一開始就對。
if (typeof document !== 'undefined') document.documentElement.lang = current;
const languageListeners = new Set<() => void>();
export const language = () => current;
export const languageSubscribe = (listener: () => void) => { languageListeners.add(listener); return () => { languageListeners.delete(listener); }; };
export function setLanguage(next: Language) {
  if (next === current) return;
  current = next;
  try { localStorage.setItem('sgrapeLanguage', next); } catch { /* storage may be blocked */ }
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  languageListeners.forEach(listener => listener());
}
export const say = (message: Message | string) => localize(message, current);

// Data that carries its own English (Q34 修訂 4): the code is derived here, where the text is used.
// 自帶英文的資料：代號在使用處推導。
export const tdValueHint = (entry: { id: string; hint: string }): Message => ({ code: 'tdValue.' + entry.id, source: entry.hint });
// An error that carries a message for people. 帶著「給人看的訊息」的錯誤。
export class TextError extends Error {
  constructor(readonly text: Message) { super(localize(text, 'en')); }
}
// What to show for any error: its message when it has one, else its English text as is.
// 任何錯誤要顯示什麼：有訊息就用訊息，否則原樣顯示。
export const errorText = (error: unknown): Message | string => {
  const text = (error as { text?: unknown } | null)?.text;
  return isMessage(text) ? text : error instanceof Error ? error.message : String(error);
};
