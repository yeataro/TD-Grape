import { tr, TextError } from './text';
import type { TdIdentity } from './td_identity';

// The one source of "which Grape OPs this project has" (Refactor.51; design-interview Q32: TD finds them by
// tag on demand, /api/shaders). Nothing else lists Grape OPs. 「專案有哪些 Grape OP」的唯一來源；TD 現場用 tag 找。
export type GrapeOpRow = { id: string; path: string; kind: string };

// The reply also says which TD answered (Refactor.52), so the shell can show it with no graph open.
// 回覆也帶「哪個 TD 回的」，沒有開圖時外殼也能顯示。
export async function listGrapeOps(token: string, request: typeof fetch = (...args) => fetch(...args)): Promise<{ rows: GrapeOpRow[]; td?: TdIdentity }> {
  const response = await request('/api/shaders', { headers: { 'X-Sgrape-Token': token } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new TextError(tr('picker.listFailed', 'Could not list the Grape OPs: {reason}',
    { reason: String(data.error || response.statusText) }));
  return { td: data.td, rows: (Array.isArray(data.shaders) ? data.shaders : [])
    .filter((row: GrapeOpRow) => /^[a-f0-9]{32}$/.test(row?.id) && typeof row.path === 'string')
    .map((row: GrapeOpRow) => ({ id: row.id, path: row.path, kind: String(row.kind || 'top') })) };
}
