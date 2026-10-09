import { tr, type Message } from './text';

// Which TD answered, and where a draft came from (Refactor.52; design-interview Q63). The editor never
// judges "is this the same TD": it only puts the facts side by side and people decide. The system itself
// checks only the Grape ID (drafts are kept per Grape ID).
// 哪個 TD 回的、草稿從哪裡來。編輯器不判斷「是不是同一個 TD」，只把資訊並排讓人決定；系統自己只看 Grape ID。

/** As TD reports it on every reply: the project file (with its incremental save number) and TD's build.
 * TD 每個回覆都帶：專案檔名（含增量存檔的版號）與 TD 版本。 */
export type TdIdentity = { file: string; build: string; folder?: string; version?: string };
/** Kept with a draft: that TD, the page address (with its port) and when the draft was last written.
 * 跟著草稿存：當時的 TD、頁面網址（含 port）、最後寫入的時間。 */
export type DraftSource = Partial<TdIdentity> & { url: string; time: string };

export const sourceNow = (td: TdIdentity | null): DraftSource =>
  ({ ...td, url: location.origin + location.pathname, time: new Date().toISOString() });

export const fileLabel = (td: Partial<TdIdentity> | null | undefined): Message | string =>
  td?.file || tr('identity.unknownFile', 'unknown file');
export const buildLabel = (td: Partial<TdIdentity> | null | undefined): Message | string =>
  td?.build ? tr('identity.build', 'TD {build}', { build: td.build }) : tr('identity.unknownBuild', 'TD version unknown');
/** Everything about the TD on the other end, for the file name's tooltip (Refactor.59.7; human 2026-10-10: as detailed as
 * wanted): TD's own title line, the address, and the TD-Grape builds on both sides.
 * 檔名提示用的完整資訊（人類：多詳細都可以）：TD 自己的標題列寫法、連線位址、兩邊的 TD-Grape 版本。 */
export const detailLabel = (td: Partial<TdIdentity> | null | undefined, page: string): Message | string =>
  tr('identity.detail', 'TouchDesigner {build}: {path}\nat {host}\nTD-Grape in TD: {served}\nThis page: {page}', {
    build: td?.build ?? '?', path: td?.folder ? td.folder + '/' + (td.file ?? '') : (td?.file ?? '?'),
    host: location.host, served: td?.version ?? '?', page });
/** The browser tab's title (Refactor.59.7): the Grape OP first, as narrow tabs cut from the right; then file : path, TD's
 * build, the product last (human 2026-10-10). For the editor connected to TD only; the internet version decides its own.
 * 分頁標題：Grape OP 名字在最前（分頁窄時從右邊截斷）；再來是檔名：路徑、TD build，產品名最後（人類）。只給連著 TD 的編輯器用。 */
export const tabTitle = (path: string, td: Partial<TdIdentity> | null | undefined) => {
  if (!path) return 'TD-Grape';
  const name = path.split('/').pop() || path;
  return [name, td?.file ? td.file + ' : ' + path : path].join(' - ') + (td?.build ? '  [ TD Build ' + td.build + ' ]' : '') + ' - TD-Grape';
};
const timeLabel = (time: string) => {
  const date = new Date(time);
  return Number.isNaN(date.getTime()) ? time : date.toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Rows for the side-by-side comparisons, one cell per column, shown with controls.tsx AlignedRows so the columns line
// up (Refactor.54.2). 並排比對用的列，每欄一格，用 AlignedRows 排成對齊的表格。
type Cells = (Message | string)[];
// The address is shown as host:port: the rest names the Grape ID, the same on both rows by construction (drafts are kept
// per Grape ID); the port is what tells two TDs apart. 網址只顯示 主機:port；後段是 Grape ID，兩列必然相同；分辨 TD 看 port。
const hostOf = (url: string) => { try { return new URL(url).host; } catch { return url; } };
/** A TD as label, file, build. 一個 TD：標籤、檔名、版本。 */
export const tdRow = (label: Message, td: Partial<TdIdentity> | null | undefined): Cells => [label, fileLabel(td), buildLabel(td)];
/** A draft's source: label, file, build, time, address; drafts written before Refactor.52 have none.
 * 草稿來源：標籤、檔名、版本、時間、網址；R.52 之前的草稿沒有。 */
export const draftRow = (source: DraftSource | undefined): Cells => source
  ? [tr('identity.draftLabel', 'Draft'), fileLabel(source), buildLabel(source), timeLabel(source.time), hostOf(source.url)]
  : [tr('identity.draftLabel', 'Draft'), tr('identity.draftUnknown', 'source unknown (written by an older editor)')];
/** The TD this page talks to now, in the same columns as a draft. 現在連到的 TD，欄位與草稿相同。 */
export const nowRow = (td: TdIdentity | null): Cells =>
  [tr('identity.nowLabel', 'Connected now'), fileLabel(td), buildLabel(td), '', location.host];
