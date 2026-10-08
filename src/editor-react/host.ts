import { tr, TextError, type Message } from './text';

// New-editor Grape OPs (design-interview Q40): the document is opaque text to TD.
// 新編輯器的 Grape OP：圖對 TD 是不透明文字。
export type HostState = { document: string; revision: number; runtimeRevision?: number; targetId?: string };
export type StateResponse = { state: HostState; format: string; target: string; shaderKind: string;
  frontendCompiler: { protocol: string; catalogHash: string; required: boolean } };
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
  constructor(readonly target: string, readonly token: string,
    private readonly request: typeof fetch = (...args) => fetch(...args), private readonly timeout = 20000) {
    if (!/^[a-f0-9]{32}$/.test(target)) throw new TextError(tr('open.badTarget', 'This address does not name a valid Grape OP. Open the editor from a Grape OP in TD.'));
    this.root = '/api/' + target + '/';
  }
  async call<T>(action: 'state' | 'apply' | 'save', body?: unknown): Promise<T> {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await this.request(this.root + action, { method: body === undefined ? 'GET' : 'POST',
        signal: controller.signal, headers: { 'X-Sgrape-Token': this.token,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body) });
      const result = await response.json();
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
