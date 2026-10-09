import { tr, TextError } from './text';

// The one source of "which Grape OPs this project has" (Refactor.51; design-interview Q32: TD finds them by
// tag on demand, /api/shaders). Nothing else lists Grape OPs. 「專案有哪些 Grape OP」的唯一來源；TD 現場用 tag 找。
export type GrapeOpRow = { id: string; path: string; kind: string };

export async function listGrapeOps(token: string, request: typeof fetch = (...args) => fetch(...args)): Promise<GrapeOpRow[]> {
  const response = await request('/api/shaders', { headers: { 'X-Sgrape-Token': token } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new TextError(tr('picker.listFailed', 'Could not list the Grape OPs: {reason}',
    { reason: String(data.error || response.statusText) }));
  return (Array.isArray(data.shaders) ? data.shaders : [])
    .filter((row: GrapeOpRow) => /^[a-f0-9]{32}$/.test(row?.id) && typeof row.path === 'string')
    .map((row: GrapeOpRow) => ({ id: row.id, path: row.path, kind: String(row.kind || 'top') }));
}
