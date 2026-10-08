/** Text meant for people (design-interview Q34): a code, the original wording in English, and
 * parameters. `tr()` only packs these as data and never translates, so the core can use it where
 * no browser or language setting exists; the screen localizes a message when it shows it.
 *
 * Rules: write the code and the original as complete literals (never build them from pieces), so
 * tools/dev/locales.cjs can find every message; dynamic parts go in parameters, `{name}` in the
 * original. Codes are `area.item` (at most three parts) and never change meaning once used.
 *
 * 給人看的文字：代號＋英文原文＋參數。tr() 只打包、不翻譯（核心也能用）；畫面顯示時才翻。
 * 代號與原文一律完整寫出、不拼接；變動的部分放參數。
 */
export type TextParam = string | number | Message | readonly Message[];
export type Message = Readonly<{ code: string; source: string; params?: Readonly<Record<string, TextParam>> }>;

export const tr = (code: string, source: string, params?: Record<string, TextParam>): Message =>
  Object.freeze(params ? { code, source, params: Object.freeze({ ...params }) } : { code, source });

export const isMessage = (value: unknown): value is Message =>
  !!value && typeof value === 'object' && typeof (value as Message).code === 'string' && typeof (value as Message).source === 'string';
