import { compiler, serializeDocument, type Graph, type Bootstrap } from './core';
import { HostClient, HostError, type StateResponse, type UniformStates } from './host';
import { tr, TextError, errorText, type Message } from './text';
import type { Level } from './reports';

// Exchanging the authored document with the host (TD): open, deliver, recover, conflicts, save.
// It never edits the document and never compiles; the Editor hands it what to send (design-interview Q38 2-4).
// 與宿主（TD）交換作品：讀取、送出、離線重試、衝突、保存。不改作品、不產碼；送什麼由 Editor 交給它。
export type Compiled = ReturnType<typeof compiler.compile>;
// `key` is the code-generation fingerprint (compiler.key): equal keys mean the same program.
export type Delivery = { graph: Graph; key: string; compiled?: Compiled; error?: string };
export type SyncPhase = 'ready' | 'sending' | 'error' | 'offline' | 'uncertain' | 'conflict';
export type SyncStatus = { revision: number; dirty: boolean; phase: SyncPhase; link?: 'busy' | 'unreachable' };
// What to tell the person and how serious it is (design-interview Q35); sent once, with the
// status change it belongs to. 要告訴人的話與嚴重程度；只在發生的那一次隨狀態一起送出。
export type Said = { message: Message | string; level?: Level };
type Patch = Partial<SyncStatus> & Partial<Said>;
type Sent = { document: string; revision: number };
// shaderError: the GLSL did not compile in TD. The graph was still saved; TD keeps running the
// last good Shader (Refactor.34). 圖照樣存了，只是 GLSL 在 TD 編譯失敗、Shader 停在上次成功版。
// uniforms: each Uniform's components as TD has them now; notices: TD-Grape's messages for people,
// in the tr() shape (Uniform D1, Q58, Q60). uniforms：各分量的現況；notices：TD-Grape 給人看的訊息。
type Applied = { state: StateResponse['state']; shaderError?: string | null; uniforms?: UniformStates; notices?: Message[] };
export const FORMAT = 'grape-next-1';

// Two parts (design-interview Q38 2-2): the execution part (GLSL + bindings) is applied by TD as a
// pair; the document is opaque text TD stores as received. A failed code generation sends the
// document only, so the work is kept while TD keeps running the last known good Shader.
// 兩部分：執行用（GLSL＋綁定）由 TD 成對套用；圖是 TD 原樣保存的文字。產碼失敗時只送圖。
// editorVersion: the editor build that produced the GLSL; TD shows it as "Grape Editor Version"
// once that GLSL runs (design-interview Q45). 產生這份 GLSL 的編輯器版本，TD 換上時顯示在 Grape 頁。
const applyRequest = (host: HostClient, bootstrap: Bootstrap, sent: Sent, compiled: Compiled | undefined, editorVersion: string) => ({
  format: FORMAT, revision: sent.revision, targetId: host.target, catalogHash: bootstrap.catalogHash,
  document: sent.document, runtime: compiled ? JSON.stringify(compiled) : null, editorVersion });

// Opening reads TD's copy: TD is the only source before an editor document exists (Q28, Q38 2-4).
// 開圖讀 TD 的那一份：編輯器還沒有作品時，唯一的來源是 TD。
export function checkLoaded(host: HostClient, bootstrap: Bootstrap, loaded: StateResponse) {
  if (loaded.format !== FORMAT) throw new TextError(tr('open.notNewFormat', "This Grape OP is not in the new editor's format."));
  if (loaded.frontendCompiler?.protocol !== compiler.protocol || loaded.frontendCompiler.catalogHash !== bootstrap.catalogHash)
    throw new TextError(tr('open.buildMismatch', "The editor core and TD's bootstrap come from different builds; reload the same build."));
  if (loaded.state.targetId && loaded.state.targetId !== host.target)
    throw new TextError(tr('open.targetMismatch', 'TD answered for a different Grape OP than this editor.'));
}

// Migration-period convenience: test graphs are disposable, so a graph this entry cannot
// open may be replaced by the default to restore the test environment. Normal compile and
// apply; a stale revision still conflicts.
// 遷移期便利行為：測試圖可丟棄，打不開時換成預設圖以恢復測試環境；照常產碼／套用，版本過期仍擋。
export async function resetToDefault(host: HostClient, bootstrap: Bootstrap, editorVersion: string) {
  const loaded = await host.call<StateResponse>('state');
  checkLoaded(host, bootstrap, { ...loaded, state: { ...loaded.state, targetId: undefined } });
  const sent = { document: serializeDocument(bootstrap.defaultDocument.graph), revision: loaded.state.revision };
  const compiled = compiler.compile(bootstrap.defaultDocument.graph, bootstrap.typeContract.glslCode);
  const result = await host.call<{ state: StateResponse['state'] }>('apply', applyRequest(host, bootstrap, sent, compiled, editorVersion));
  if (result.state?.revision !== sent.revision + 1 || result.state.document !== sent.document) throw new HostError(replyMismatch);
}

const replyMismatch = tr('sync.replyMismatch', "TD's reply does not match what was sent.");
export const conflictMessage = tr('sync.conflict', 'The graph in TD seems to have been changed. Choose which version to use.');
const offlineMessage = {
  busy: tr('sync.offlineBusy', 'TD is not responding (it may be minimized). Your changes stay in the browser and are sent when TD is back.'),
  unreachable: tr('sync.offlineUnreachable', 'Cannot reach TD (it may be stuck or closed, or the network is down). Your changes stay in the browser and are sent once connected.'),
};
const hostChanged = tr('sync.hostChanged', "TD's build has changed; download your draft and reopen the editor.");
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
  private failedKey: string | null = null; // fingerprint of a program TD could not compile
  private uncertain?: Sent;
  blocked = false;
  status: SyncStatus;
  /** What TD reported along with a reply (Uniform D1). 回覆裡 TD 一起帶回的現況與訊息。 */
  onTd?: (uniforms: UniformStates | undefined, notices: readonly Message[]) => void;
  constructor(readonly host: HostClient, readonly bootstrap: Bootstrap, loaded: StateResponse,
    private readonly source: () => Delivery, private readonly report: (status: SyncStatus, said?: Said) => void,
    private readonly delay = 0, private readonly retry = 5000, private readonly editorVersion = 'unknown') {
    this.confirmed = loaded.state.document;
    this.runtimeKey = loaded.state.runtimeRevision === loaded.state.revision ? source().key : null;
    this.status = { revision: loaded.state.revision, dirty: false, phase: 'ready' };
  }
  get busy() { return !!this.pending; }
  private set({ message, level, ...patch }: Patch) {
    this.status = { ...this.status, ...patch };
    if (!this.disposed) this.report(this.status, message ? { message, level } : undefined);
  }
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
      // A program TD already failed to compile is not sent again until it changes.
      // TD 已編譯失敗的程式，沒改之前不再送。
      const runtime = compiled && key !== this.runtimeKey && key !== this.failedKey ? compiled : undefined;
      this.set({ phase: 'sending', level: 'info', message: compiled ? tr('sync.sending', 'Applying to TD…')
        : tr('sync.sendingGraphOnly', 'Code generation failed; saving only the graph to TD. TD keeps running the last good Shader…') });
      try {
        const result = await this.host.call<Applied>('apply', applyRequest(this.host, this.bootstrap, sent, runtime, this.editorVersion));
        if (this.disposed) return;
        if (result.state?.revision !== sent.revision + 1 || result.state.document !== sent.document) throw new HostError(replyMismatch);
        this.confirmed = sent.document;
        let message = tr('sync.applied', 'Applied to TD; the project still needs saving'), level: Level = 'info';
        if (runtime && result.shaderError) {
          this.failedKey = key; level = 'error';
          // The summary first: the status line shows one line, the whole TD log on hover (Refactor.38).
          // 摘要放第一行：狀態列只顯示一行，滑鼠移上去看完整的 TD 紀錄。
          message = tr('sync.glslFailedInTd', 'GLSL failed to compile in TD. The graph is saved; TD keeps running the last good Shader.\n{log}',
            { log: result.shaderError });
        } else if (runtime) {
          this.runtimeKey = key; this.failedKey = null;
        } else if (!compiled) {
          level = 'warning';
          message = tr('sync.savedCodegenFailed', 'Graph saved to TD; code generation failed, so TD still runs the last good Shader');
        } else if (key === this.failedKey) {
          level = 'warning';
          message = tr('sync.savedKnownFailure', 'Graph saved to TD; this program failed to compile in TD before, so TD still runs the last good Shader.');
        }
        this.set({ revision: result.state.revision, dirty: this.dirtyNow(), phase: 'ready', message, level });
        this.onTd?.(result.uniforms, result.notices ?? []);
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
    const reason = errorText(error);
    this.set(failure.phase === 'offline' ? { phase: 'offline', link: failure.link, message: offlineMessage[failure.link], level: 'warning' }
      : { phase: failure.phase, link: undefined, level: failure.phase === 'error' ? 'error' : 'warning',
        message: failure.phase === 'conflict' ? conflictMessage
          : failure.phase === 'uncertain' ? tr('sync.uncertain', 'Delivery result unknown; automatic sending stopped while checking the version with TD. {reason}', { reason })
          : tr('sync.rejected', 'TD-Grape refused: {reason}', { reason }) });
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
    if (result.frontendCompiler.catalogHash !== this.bootstrap.catalogHash) throw new TextError(hostChanged);
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
      if (failure.phase === 'offline') this.set({ phase: 'offline', link: failure.link, message: offlineMessage[failure.link], level: 'warning' });
      else this.set({ level: 'warning', message: tr('sync.checkFailed', 'Could not check TD: {reason}', { reason: errorText(error) }) });
      return;
    }
    if (this.disposed) return;
    if (result.frontendCompiler.catalogHash !== this.bootstrap.catalogHash) {
      this.blocked = true; this.set({ phase: 'error', link: undefined, message: hostChanged, level: 'error' }); return;
    }
    this.onTd?.(result.uniforms, []);
    const state = result.state, sent = this.uncertain;
    if (sent && state.revision === sent.revision + 1 && state.document === sent.document) this.confirmed = sent.document;
    else if (state.revision !== this.status.revision || state.document !== this.confirmed) {
      this.blocked = true; this.set({ phase: 'conflict', link: undefined, message: conflictMessage, level: 'warning' }); return;
    }
    this.blocked = false; this.uncertain = undefined;
    const dirty = this.dirtyNow();
    this.set({ revision: state.revision, dirty, phase: 'ready', link: undefined,
      level: 'info', message: dirty ? tr('sync.reconnectedSending', 'Reconnected; sending your changes.') : tr('sync.reconnected', 'Reconnected.') });
    if (dirty) await this.flush();
  };
  // Conflict choice "TD 端": the Editor adopted TD's document; nothing is left to send.
  // 衝突時選「TD 端」：Editor 已採用 TD 的版本，與 TD 相同、不需送出。
  adopt(state: StateResponse['state']) {
    clearTimeout(this.timer);
    this.confirmed = state.document; this.blocked = false; this.uncertain = undefined; this.failedKey = null;
    this.runtimeKey = state.runtimeRevision === state.revision ? this.source().key : null;
    this.set({ revision: state.revision, dirty: false, phase: 'ready', link: undefined });
  }
  // Conflict choice "編輯端" (Q7/Q28): rebase the draft on TD's latest revision and send it
  // through the normal path; a further change before delivery still returns a conflict.
  // 衝突時選「編輯端」：以最新 revision 為基準重送草稿，照常產碼／驗證；期間再變仍擋。
  overwrite = async () => {
    const result = await this.read();
    this.confirmed = result.state.document; this.blocked = false; this.uncertain = undefined;
    this.runtimeKey = null; this.failedKey = null; // TD's program was written elsewhere; send ours
    const dirty = this.dirtyNow();
    this.set({ revision: result.state.revision, dirty, phase: 'ready',
      level: 'info', message: dirty ? tr('sync.overwriting', "Overwriting TD with the editor's draft…")
        : tr('sync.draftMatchesTd', "The draft matches TD's graph; in sync.") });
    await this.flush();
  };
  save = async () => {
    await this.flush();
    if (this.status.dirty || this.blocked) throw new TextError(tr('save.pending', 'Some changes have not been applied yet; resolve the errors first.'));
    const result = await this.host.call<{ saved: boolean | string }>('save', {});
    if (!result.saved) throw new TextError(tr('save.notConfirmed', "TD did not confirm that the project was saved; the applied graph is only in TD's memory."));
    if (this.status.dirty) return tr('save.donePending', 'TD project saved; new changes are still waiting to be applied.');
    return typeof result.saved === 'string' ? tr('save.done', 'TD project saved: {file}', { file: result.saved }) : tr('save.doneUnnamed', 'TD project saved');
  };
  dispose() { this.disposed = true; clearTimeout(this.timer); clearTimeout(this.recovery); }
}
