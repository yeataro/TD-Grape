import { tr, type Message } from './text';

// Which TD answered, and where a draft came from (Refactor.52; design-interview Q63). The editor never
// judges "is this the same TD": it only puts the facts side by side and people decide. The system itself
// checks only the Grape ID (drafts are kept per Grape ID).
// 哪個 TD 回的、草稿從哪裡來。編輯器不判斷「是不是同一個 TD」，只把資訊並排讓人決定；系統自己只看 Grape ID。

/** As TD reports it on every reply: the project file (with its incremental save number) and TD's build.
 * TD 每個回覆都帶：專案檔名（含增量存檔的版號）與 TD 版本。 */
export type TdIdentity = { file: string; build: string };
/** Kept with a draft: that TD, the page address (with its port) and when the draft was last written.
 * 跟著草稿存：當時的 TD、頁面網址（含 port）、最後寫入的時間。 */
export type DraftSource = Partial<TdIdentity> & { url: string; time: string };

export const sourceNow = (td: TdIdentity | null): DraftSource =>
  ({ ...td, url: location.origin + location.pathname, time: new Date().toISOString() });

export const fileLabel = (td: Partial<TdIdentity> | null | undefined): Message | string =>
  td?.file || tr('identity.unknownFile', 'unknown file');
export const buildLabel = (td: Partial<TdIdentity> | null | undefined): Message | string =>
  td?.build ? tr('identity.build', 'TD {build}', { build: td.build }) : tr('identity.unknownBuild', 'TD version unknown');
const timeLabel = (time: string) => {
  const date = new Date(time);
  return Number.isNaN(date.getTime()) ? time : date.toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** "file · TD build" for one TD. 一個 TD 的「檔名 · TD 版本」。 */
export const tdLine = (td: Partial<TdIdentity> | null | undefined): Message =>
  tr('identity.line', '{file} · {build}', { file: fileLabel(td), build: buildLabel(td) });
/** One line for a draft's source; drafts written before Refactor.52 have none. 草稿來源一行；R.52 之前的草稿沒有。 */
export const describeSource = (source: DraftSource | undefined): Message =>
  source ? tr('identity.draftFrom', 'Draft: {file} · {build} · {time} · {url}',
    { file: fileLabel(source), build: buildLabel(source), time: timeLabel(source.time), url: source.url })
    : tr('identity.draftUnknown', 'Draft: source unknown (written by an older editor)');
/** One line for the TD this page talks to now. 現在連到的 TD 一行。 */
export const describeNow = (td: TdIdentity | null): Message =>
  tr('identity.now', 'Connected now: {file} · {build} · {url}',
    { file: fileLabel(td), build: buildLabel(td), url: location.origin + location.pathname });
