import { compiler, serializeDocument, type Graph, type Bootstrap } from './core';
import { HostClient, HostError, type StateResponse } from './host';

// Exchanging the authored document with the host (TD): open, deliver, recover, conflicts, save.
// It never edits the document and never compiles; the Editor hands it what to send (design-interview Q38 2-4).
// 與宿主（TD）交換作品：讀取、送出、離線重試、衝突、保存。不改作品、不產碼；送什麼由 Editor 交給它。
export type Compiled = ReturnType<typeof compiler.compile>;
// `key` is the code-generation fingerprint (compiler.key): equal keys mean the same program.
export type Delivery = { graph: Graph; key: string; compiled?: Compiled; error?: string };
export type SyncPhase = 'ready' | 'sending' | 'error' | 'offline' | 'uncertain' | 'conflict';
export type SyncStatus = { revision: number; dirty: boolean; phase: SyncPhase; link?: 'busy' | 'unreachable'; message?: string };
type Sent = { document: string; revision: number };
export const FORMAT = 'grape-next-1';

// Two parts (design-interview Q38 2-2): the execution part (GLSL + bindings) is applied by TD as a
// pair; the document is opaque text TD stores as received. A failed code generation sends the
// document only, so the work is kept while TD keeps running the last known good Shader.
// 兩部分：執行用（GLSL＋綁定）由 TD 成對套用；圖是 TD 原樣保存的文字。產碼失敗時只送圖。
const applyRequest = (host: HostClient, bootstrap: Bootstrap, sent: Sent, compiled?: Compiled) => ({
  format: FORMAT, revision: sent.revision, targetId: host.target, catalogHash: bootstrap.catalogHash,
  document: sent.document, runtime: compiled ? JSON.stringify(compiled) : null });

// Opening reads TD's copy: TD is the only source before an editor document exists (Q28, Q38 2-4).
// 開圖讀 TD 的那一份：編輯器還沒有作品時，唯一的來源是 TD。
export function checkLoaded(host: HostClient, bootstrap: Bootstrap, loaded: StateResponse) {
  if (loaded.format !== FORMAT) throw Error('此 Grape OP 不是新編輯器的格式。');
  if (loaded.frontendCompiler?.protocol !== compiler.protocol || loaded.frontendCompiler.catalogHash !== bootstrap.catalogHash)
    throw Error('前端核心與 TD bootstrap 版本不一致；請重新載入同一建置。');
  if (loaded.state.targetId && loaded.state.targetId !== host.target) throw Error('Host target mismatch');
}

// Migration-period convenience: test graphs are disposable, so a graph this entry cannot
// open may be replaced by the default to restore the test environment. Normal compile and
// apply; a stale revision still conflicts.
// 遷移期便利行為：測試圖可丟棄，打不開時換成預設圖以恢復測試環境；照常產碼／套用，版本過期仍擋。
export async function resetToDefault(host: HostClient, bootstrap: Bootstrap) {
  const loaded = await host.call<StateResponse>('state');
  checkLoaded(host, bootstrap, { ...loaded, state: { ...loaded.state, targetId: undefined } });
  const sent = { document: serializeDocument(bootstrap.defaultDocument.graph), revision: loaded.state.revision };
  const compiled = compiler.compile(bootstrap.defaultDocument.graph, bootstrap.typeContract.glslCode);
  const result = await host.call<{ state: StateResponse['state'] }>('apply', applyRequest(host, bootstrap, sent, compiled));
  if (result.state?.revision !== sent.revision + 1 || result.state.document !== sent.document) throw new HostError('宿主回覆與送出快照不一致。');
}

const conflictMessage = 'TD 端的圖似乎有被修改，請選擇要使用的版本。';
const offlineMessage = {
  busy: 'TD 沒有回應（可能最小化）。修改保留在瀏覽器，TD 回來後自動送出。',
  unreachable: '連不到 TD（可能卡住、已關閉或網路中斷）。修改保留在瀏覽器，連上後自動送出。',
};
// What a failed host call means for the document (design-interview Q28, measured 2026-10-07):
// TD's queue answers manager_not_responding / manager_busy / manager_unavailable only when it
// made NO change; a transport failure or other 5xx may still have landed and must be checked.
// 依實測分類：TD 明確回覆「未處理」＝確定沒改；連線失敗或其他 5xx 可能已執行，須查版本、不重送。
type Failure = { phase: 'offline'; link: 'busy' | 'unreachable'; landed: boolean } | { phase: 'uncertain' | 'conflict' | 'error' };
function classify(error: unknown): Failure {
  if (!(error instanceof HostError)) return { phase: 'uncertain' };
  if (error.status === 409) return { phase: 'conflict' };
  if (error.status === 503 && ['manager_not_responding', 'manager_busy'].includes(error.code)) return { phase: 'offline', link: 'busy', landed: false };
  if (error.status === 503 && error.code === 'manager_unavailable') return { phase: 'offline', link: 'unreachable', landed: false };
  if (error.status === 0) return { phase: 'offline', link: 'unreachable', landed: true };
  return { phase: error.status >= 500 ? 'uncertain' : 'error' };
}

export class HostSync {
  private timer?: ReturnType<typeof setTimeout>;
  private recovery?: ReturnType<typeof setTimeout>;
  private pending?: Promise<void>;
  private disposed = false;
  private confirmed: string; // document text TD has acknowledged
  private runtimeKey: string | null; // fingerprint of the program TD runs; null when unknown
  private uncertain?: Sent;
  blocked = false;
  status: SyncStatus;
  constructor(readonly host: HostClient, readonly bootstrap: Bootstrap, loaded: StateResponse,
    private readonly source: () => Delivery, private readonly report: (status: SyncStatus) => void,
    private readonly delay = 0, private readonly retry = 5000) {
    this.confirmed = loaded.state.document;
    this.runtimeKey = loaded.state.runtimeRevision === loaded.state.revision ? source().key : null;
    this.status = { revision: loaded.state.revision, dirty: false, phase: 'ready' };
  }
  get busy() { return !!this.pending; }
  private set(patch: Partial<SyncStatus>) { this.status = { ...this.status, ...patch }; if (!this.disposed) this.report(this.status); }
  private dirtyNow = () => serializeDocument(this.source().graph) !== this.confirmed;

  // The Editor has a newer document. Sending is serialized; a late acknowledgement only advances
  // the revision and the newest document is sent next (latest wins, design-interview Q38 2-1-a).
  // Editor 有新版本：一次只送一份，回覆只推進版本號，接著送最新的那一份。
  changed() {
    this.status = { ...this.status, dirty: true };
    clearTimeout(this.timer);
    if (!this.disposed && !this.blocked) this.timer = setTimeout(() => { void this.flush(); }, this.delay);
  }
  flush = (): Promise<void> => {
    clearTimeout(this.timer);
    if (this.pending) return this.pending;
    if (this.disposed || this.blocked || !this.status.dirty) return Promise.resolve();
    this.pending = this.deliver().finally(() => { this.pending = undefined; });
    return this.pending;
  };
  private async deliver() {
    while (this.status.dirty && !this.disposed && !this.blocked) {
      const { graph, key, compiled } = this.source(), sent = { document: serializeDocument(graph), revision: this.status.revision };
      // Same fingerprint as the running program: send the document only, so TD skips GPU work
      // (layout-only edits, design-interview Q31/Q38). 指紋與 TD 正在跑的相同：只送圖，TD 不做 GPU 驗證。
      const runtime = compiled && key !== this.runtimeKey ? compiled : undefined;
      this.set({ phase: 'sending', message: compiled ? '正在套用至 TD…' : '產碼失敗；只把圖存到 TD，TD 繼續執行上次成功的 Shader…' });
      try {
        const result = await this.host.call<{ state: StateResponse['state'] }>('apply',
          applyRequest(this.host, this.bootstrap, sent, runtime));
        if (this.disposed) return;
        if (result.state?.revision !== sent.revision + 1 || result.state.document !== sent.document) throw new HostError('宿主回覆與送出快照不一致。');
        this.confirmed = sent.document;
        if (runtime) this.runtimeKey = key;
        this.set({ revision: result.state.revision, dirty: this.dirtyNow(), phase: 'ready',
          message: compiled ? '已套用 TD；專案尚需保存' : '圖已存到 TD；產碼失敗，TD 仍執行上次成功的 Shader' });
      } catch (error) {
        if (this.disposed) return;
        this.fail(classify(error), error, sent);
        return;
      }
    }
  }
  // Editing never waits for this: sending stops, the document stays editable (Q28).
  // 編輯不等 TD：只停止送出，文件照常可編輯；未連線／結果不明時才排程重試。
  private fail(failure: Failure, error: unknown, sent?: Sent) {
    this.blocked = failure.phase !== 'error';
    if (sent && (failure.phase === 'uncertain' || (failure.phase === 'offline' && failure.landed))) this.uncertain = sent;
    this.set(failure.phase === 'offline' ? { phase: 'offline', link: failure.link, message: offlineMessage[failure.link] }
      : { phase: failure.phase, link: undefined, message: failure.phase === 'conflict' ? conflictMessage
        : failure.phase === 'uncertain' ? '交付結果不明，已停止自動送出；正在向 TD 確認版本。' + String(error) : 'TD 拒絕套用：' + String(error) });
    this.recover();
  }
  // Only while disconnected or unsure, only when the page is visible, never overlapping.
  // 只在未連線或結果不明期間、頁面可見時重試，且不重疊；平常不輪詢，TD 端不增加工作。
  private recover() {
    clearTimeout(this.recovery);
    if (this.disposed || !['offline', 'uncertain'].includes(this.status.phase)) return;
    this.recovery = setTimeout(async () => {
      if (typeof document === 'undefined' || !document.hidden) await this.check();
      this.recover();
    }, this.retry);
  }
  // Reads TD's current copy and refuses a different build; never writes.
  // 只讀 TD 目前的那一份；建置不一致即拒絕。
  read = async () => {
    const result = await this.host.call<StateResponse>('state');
    if (result.frontendCompiler.catalogHash !== this.bootstrap.catalogHash) throw Error('宿主版本已變更，請下載草稿後重新開啟。');
    return result;
  };
  // Read-only: never resends a write by itself. A matching TD document resumes delivery (Q6).
  // 只讀 TD 狀態；確認 TD 未被他處修改後才續送未送出的修改。
  check = async () => {
    if (this.pending) return;
    let result: StateResponse;
    try { result = await this.host.call<StateResponse>('state'); }
    catch (error) {
      if (this.disposed) return;
      const failure = classify(error);
      if (failure.phase === 'offline') this.set({ phase: 'offline', link: failure.link, message: offlineMessage[failure.link] });
      else this.set({ message: error instanceof Error ? error.message : String(error) });
      return;
    }
    if (this.disposed) return;
    if (result.frontendCompiler.catalogHash !== this.bootstrap.catalogHash) {
      this.blocked = true; this.set({ phase: 'error', link: undefined, message: '宿主版本已變更，請下載草稿後重新開啟。' }); return;
    }
    const state = result.state, sent = this.uncertain;
    if (sent && state.revision === sent.revision + 1 && state.document === sent.document) this.confirmed = sent.document;
    else if (state.revision !== this.status.revision || state.document !== this.confirmed) {
      this.blocked = true; this.set({ phase: 'conflict', link: undefined, message: conflictMessage }); return;
    }
    this.blocked = false; this.uncertain = undefined;
    const dirty = this.dirtyNow();
    this.set({ revision: state.revision, dirty, phase: 'ready', link: undefined,
      message: dirty ? '已恢復連線，正在送出修改。' : '已恢復連線。' });
    if (dirty) await this.flush();
  };
  // Conflict choice "TD 端": the Editor adopted TD's document; nothing is left to send.
  // 衝突時選「TD 端」：Editor 已採用 TD 的版本，與 TD 相同、不需送出。
  adopt(state: StateResponse['state']) {
    clearTimeout(this.timer);
    this.confirmed = state.document; this.blocked = false; this.uncertain = undefined;
    this.runtimeKey = state.runtimeRevision === state.revision ? this.source().key : null;
    this.set({ revision: state.revision, dirty: false, phase: 'ready', link: undefined });
  }
  // Conflict choice "編輯端" (Q7/Q28): rebase the draft on TD's latest revision and send it
  // through the normal path; a further change before delivery still returns a conflict.
  // 衝突時選「編輯端」：以最新 revision 為基準重送草稿，照常產碼／驗證；期間再變仍擋。
  overwrite = async () => {
    const result = await this.read();
    this.confirmed = result.state.document; this.blocked = false; this.uncertain = undefined;
    this.runtimeKey = null; // TD's program was written elsewhere; send ours
    const dirty = this.dirtyNow();
    this.set({ revision: result.state.revision, dirty, phase: 'ready',
      message: dirty ? '以編輯器草稿覆寫 TD…' : '草稿與 TD 文件相同，已同步。' });
    await this.flush();
  };
  save = async () => {
    await this.flush();
    if (this.status.dirty || this.blocked) throw Error('尚有未成功套用的修改；請先處理錯誤。');
    const result = await this.host.call<{ saved: boolean | string }>('save', {});
    if (!result.saved) throw Error('TD 未確認專案保存成功；已套用的圖仍在宿主記憶體中。');
    return 'TD 專案已保存' + (typeof result.saved === 'string' ? '：' + result.saved : '') +
      (this.status.dirty ? '（仍有新修改待套用）' : '');
  };
  dispose() { this.disposed = true; clearTimeout(this.timer); clearTimeout(this.recovery); }
}
