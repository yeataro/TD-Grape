import type { Graph } from './core';
export type HostState = { graph: Graph; revision: number; targetId?: string };
export type StateResponse = { state: HostState; target: string; shaderKind: string;
  frontendCompiler: { protocol: string; catalogHash: string; required: boolean };
  savedStateIssue?: unknown; readOnlyReason?: string; upgradeReview?: unknown };
export class HostError extends Error {
  constructor(message: string, readonly status = 0, readonly code = '', readonly layer = 'transport') { super(message); }
}

// Same-origin requests keep the existing token, timeout and target boundaries.
// 只搬本輪會使用的 HTTP 行為；逾時不代表寫入沒有發生，交由 session 查核。
export class HostClient {
  readonly root: string;
  constructor(readonly target: string, readonly token: string,
    private readonly request: typeof fetch = (...args) => fetch(...args), private readonly timeout = 20000) {
    if (!/^[a-f0-9]{32}$/.test(target)) throw Error('缺少有效的 TOP Family UUID。請從 Family 入口開啟。');
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
      throw new HostError('連線中斷或回覆不完整；本地文件保留。' + (error instanceof Error ? error.message : String(error)));
    } finally { clearTimeout(timer); }
  }
}
