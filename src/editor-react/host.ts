import { tr, TextError, type Message } from './text';
import type { LiveSocket } from './live_values';
import type { TdIdentity } from './td_identity';

// New-editor Grape OPs (design-interview Q40): the document is opaque text to TD.
// 新編輯器的 Grape OP：圖對 TD 是不透明文字。
export type HostState = { document: string; revision: number; runtimeRevision?: number; targetId?: string };
// One Uniform component as TD has it (Uniform D1; design-interview Q56, Q60): a value only for constant
// and bound ones (Grape deals with constant values); Expression, Export and the rest are only a state.
// 一個 Uniform 分量在 TD 的現況：只有固定值與 Bind 帶數值；Expression、Export 等只是狀態。
export type ComponentState = { mode: 'constant' | 'bind' | 'expression' | 'export' | 'other';
  value?: number; editable?: boolean; text?: string; source?: string };
/** By declaration ID, one entry per component. 依宣告 ID，每個分量一筆。 */
export type UniformStates = Readonly<Record<string, readonly ComponentState[]>>;
export type StateResponse = { state: HostState; format: string; target: string; shaderKind: string;
  frontendCompiler: { protocol: string; catalogHash: string; required: boolean }; uniforms?: UniformStates; td?: TdIdentity };
// A failed host call. `text` is set when the editor itself words the failure (Q34); TD's own
// replies stay as TD wrote them. 編輯器自己描述的失敗帶 text；TD 回的訊息照原樣。
export class HostError extends Error {
  readonly text?: Message;
  constructor(message: string | Message, readonly status = 0, readonly code = '', readonly layer = 'transport') {
    super(typeof message === 'string' ? message : message.source);
    if (typeof message !== 'string') this.text = message;
  }
}

// Same-origin requests keep the existing token, timeout and target boundaries.
// 只搬本輪會使用的 HTTP 行為；逾時不代表寫入沒有發生，交由 session 查核。
export class HostClient {
  readonly root: string;
  /** Opens the live WebSocket (Uniform D2); none outside a page (tests pass their own). 開即時 WebSocket。 */
  readonly live: (() => LiveSocket) | undefined;
  /** Told which TD answered, on every reply that says so (Refactor.52). 每個帶「哪個 TD」的回覆都通知。 */
  seen?: (td: TdIdentity) => void;
  constructor(readonly target: string, readonly token: string,
    private readonly request: typeof fetch = (...args) => fetch(...args), private readonly timeout = 20000,
    live?: () => LiveSocket) {
    if (!/^[a-f0-9]{32}$/.test(target)) throw new TextError(tr('open.badTarget', 'This address does not name a valid Grape OP. Open the editor from a Grape OP in TD.'));
    this.root = '/api/' + target + '/';
    this.live = live ?? (typeof WebSocket === 'function' && typeof location === 'object' && location.host
      ? () => new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + this.root + 'live') as unknown as LiveSocket
      : undefined);
  }
  /** Where a default image's preview is (Refactor.58): the shared ones by name, the same for every Grape OP;
   * the TOP chosen on this Grape OP's Samples ("custom") as a snapshot. 預設圖預覽的位址：公用的照名字、
   * 每個 Grape OP 都一樣；這個 Grape OP 在 Samples 上選的 TOP（custom）是快照。 */
  textureUrl(texture: string): string {
    return texture === 'custom' ? this.root + 'texture' : '/api/textures/' + encodeURIComponent(texture) + '.jpg';
  }
  async call<T>(action: 'state' | 'apply' | 'save' | 'identity', body?: unknown): Promise<T> {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await this.request(this.root + action, { method: body === undefined ? 'GET' : 'POST',
        signal: controller.signal, headers: { 'X-Sgrape-Token': this.token,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body) });
      const result = await response.json();
      if (result?.td) this.seen?.(result.td);
      if (!response.ok) throw new HostError(`[${action} / ${result.layer || 'host'} / ${result.code || response.status}] ${result.error || response.statusText}`,
        response.status, result.code, result.layer);
      return result as T;
    } catch (error) {
      if (error instanceof HostError) throw error;
      throw new HostError(tr('sync.transportFailed', 'The connection broke or the reply was incomplete; your local document is kept. {reason}',
        { reason: error instanceof Error ? error.message : String(error) }));
    } finally { clearTimeout(timer); }
  }
}
