// The sync state's own record (Refactor.70.1, human 2026-10-10): the state shows only "now", and the message history mixes
// in everything else, so the state keeps a short record of its own — when TD was lost and found again, and what was applied.
// Trouble starting and ending is always kept; routine applies in a row are one line whose range grows, so the last 50 lines
// cover a long stretch. Pure: the editor hands in each change. 同步狀態自己的紀錄（人類 10-10）：狀態只顯示「現在」，訊息歷史
// 又混著別的事，所以狀態留一份短紀錄——什麼時候失去 TD、什麼時候又連上、套用了哪幾版。異常的開始與結束一定記；連續的例行套用合成一行、
// 範圍往後延，所以最近 50 行能涵蓋很長一段時間。純函式：編輯器把每次改變交進來。
import type { Message } from './text';
import type { Link } from './host_sync';

export type SyncRecordKind = 'opened' | 'applied' | 'offline' | 'uncertain' | 'conflict' | 'error' | 'recovered';
/** One line: when, what, which revision; an `applied` line covers `from`…`revision` until `until`; trouble keeps its reason.
 * 一行：何時、什麼事、哪一版；applied 涵蓋 from…revision 到 until；異常留下原因。 */
// link: why TD was away, as the light says it (Refactor.75). link：TD 為什麼不在，同燈號的說法。
export type SyncRecord = { kind: SyncRecordKind; time: number; revision: number; from?: number; until?: number; reason?: Message | string; link?: Link };
type Sync = { phase: string; revision: number; link?: Link };
export const SYNC_RECORDS = 50;
const trouble = ['offline', 'uncertain', 'conflict', 'error'];

/** The record after one change of the sync state (`before` null: the graph was just opened); the same array when nothing
 * worth a line happened. 同步狀態改變一次後的紀錄（before 為 null：剛打開圖）；沒有值得記的事就回傳同一個陣列。 */
export function recordSync(records: readonly SyncRecord[], before: Sync | null, after: Sync, reason: Message | string | undefined, now: number): readonly SyncRecord[] {
  if (!before) return [{ kind: 'opened', time: now, revision: after.revision }];
  const lines = [...records], wasBad = trouble.includes(before.phase), isBad = trouble.includes(after.phase);
  // A new line when trouble starts, and when TD says a different reason while still away (Refactor.75).
  // 異常開始時一行；還不在、但 TD 說了不同原因時也一行。
  const newCause = after.phase === 'offline' && before.phase === 'offline' && after.link !== before.link;
  if (isBad && (before.phase !== after.phase || newCause)) lines.push({ kind: after.phase as SyncRecordKind, time: now, revision: after.revision,
    ...(reason === undefined ? {} : { reason }), ...(after.phase === 'offline' && after.link ? { link: after.link } : {}) });
  else if (wasBad && !isBad) lines.push({ kind: 'recovered', time: now, revision: after.revision });
  if (!isBad && after.revision > before.revision) {
    const last = lines[lines.length - 1];
    if (last?.kind === 'applied') lines[lines.length - 1] = { ...last, revision: after.revision, until: now };
    else lines.push({ kind: 'applied', time: now, from: after.revision, revision: after.revision });
  }
  return lines.length === records.length && lines.every((line, index) => line === records[index]) ? records : lines.slice(-SYNC_RECORDS);
}
