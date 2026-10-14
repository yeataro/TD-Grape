import { compiler, serializeDocument, type Graph, type Bootstrap } from './core';
import { GRAPE_ID, HostClient, HostError, type StateResponse, type UniformStates, type ShaderFailure, type LastKnownGood, type ProjectSaved } from './host';
import { tr, TextError, errorText, clockOf, type Message } from './text';
import type { Level } from './reports';

// Exchanging the authored document with the host (TD): open, deliver, recover, conflicts, save.
// It never edits the document and never compiles; the Editor hands it what to send (design-interview Q38 2-4).
// 與宿主（TD）交換作品：讀取、送出、離線重試、衝突、保存。不改作品、不產碼；送什麼由 Editor 交給它。
export type Compiled = ReturnType<typeof compiler.compile>;
// `key` is the code-generation fingerprint (compiler.key): equal keys mean the same program.
// errorAt: where the core says code generation failed, the node and its subgraph path (TECH-6). errorAt：核心說產碼在哪裡失敗。
// A place may name only the definition (R113-3: a definition-level problem has no node). 位置可以只指到定義（定義層的問題沒有節點）。
export type ErrorPlace = { node?: string; trail: readonly string[] };
export type Delivery = { graph: Graph; key: string; compiled?: Compiled; error?: string; errorAt?: ErrorPlace };
export type SyncPhase = 'ready' | 'sending' | 'error' | 'offline' | 'uncertain' | 'conflict';
// retryAt / retryMs: when the next automatic check runs and how long the wait is (Refactor.59.3: the countdown pie);
// checking: a check is on its way. retryAt／retryMs：下一次自動檢查的時間與等待長度（倒數圓餅）；checking：檢查中。
// stuck: the Shader in TD stopped at an earlier program after a failed apply, as TD last said (Refactor.63); gone once a
// program runs again. stuck：套用失敗後 TD 的 Shader 停在較早的程式（TD 最後說的）；程式再次換上就消失。
export type ShaderStuck = { failure: ShaderFailure; lastKnownGood?: LastKnownGood };
// saved: the project's last save as TD reports it (Refactor.73). saved：TD 回報的專案上次存檔。
// Why TD is away (Refactor.71, 75): `busy` and `unreachable` are what the editor sees; the others TD said before it went
// (closed, the service stopped or reloading, this Grape OP deleted), and `device` is this device having no network.
// TD 為什麼不在：busy、unreachable 是編輯器看到的；其他是 TD 走之前說的（關閉、服務停止或重新載入、Grape OP 被刪），device 是這台裝置沒網路。
export type Link = 'busy' | 'unreachable' | 'closed' | 'stopped' | 'reloading' | 'deleted' | 'device';
/** Causes TD or the browser said for sure; what the editor only sees afterwards does not replace them (Refactor.75).
 * TD 或瀏覽器確定說出的原因；之後編輯器只看到的症狀不會蓋掉它。 */
const said = (link?: Link) => !!link && link !== 'busy' && link !== 'unreachable';
export type SyncStatus = { revision: number; dirty: boolean; phase: SyncPhase; link?: Link;
  retryAt?: number; retryMs?: number; checking?: boolean; stuck?: ShaderStuck; saved?: ProjectSaved };
const stuckOf = (state: StateResponse['state']): ShaderStuck | undefined =>
  state.failure ? { failure: state.failure, ...(state.lastKnownGood ? { lastKnownGood: state.lastKnownGood } : {}) } : undefined;
// What to tell the person and how serious it is (design-interview Q35); sent once, with the
// status change it belongs to. 要告訴人的話與嚴重程度；只在發生的那一次隨狀態一起送出。
export type Said = { message: Message | string; level?: Level };
type Patch = Partial<SyncStatus> & Partial<Said>;
type Sent = { document: string; revision: number };
// shaderError: the GLSL did not compile in TD. The graph was still saved; TD keeps running the
// last good Shader (Refactor.34). 圖照樣存了，只是 GLSL 在 TD 編譯失敗、Shader 停在上次成功版。
// uniforms: each Uniform's components as TD has them now; notices: TD-Grape's messages for people,
// in the tr() shape (Uniform D1, Q58, Q60). uniforms：各分量的現況；notices：TD-Grape 給人看的訊息。
// shaderFailure: 'compile' or 'internal' (TD-Grape's own error), so the message says which (Refactor.63).
type Applied = { state: StateResponse['state']; shaderError?: string | null; shaderFailure?: 'compile' | 'internal' | null;
  uniforms?: UniformStates; notices?: Message[]; projectSaved?: ProjectSaved };
/** After an apply: the editor never saves the TD project, so it says how far the file is behind (Refactor.73, human
 * 2026-10-10: short). 套用後：編輯器從不自己存 TD 專案，所以說出檔案落後多少（R.73，人類：精簡）。 */
export function appliedMessage(revision: number, saved?: ProjectSaved): Message {
  if (saved?.revision != null && saved.time != null)
    return tr('sync.appliedBehind', 'Applied; last saved r{saved} ({time}), {behind} not saved',
      { saved: saved.revision, time: clockOf(saved.time), behind: revision - saved.revision });
  if (saved?.time != null) return tr('sync.appliedSavedAt', 'Applied; the project still needs saving (last saved {time})', { time: clockOf(saved.time) });
  return tr('sync.applied', 'Applied to TD; the project still needs saving');
}
/** What a save says, whoever asked for it (Refactor.71, 73): the file and the revision it holds. 存檔說的話（不論誰要求）：檔名與存了哪一版。 */
export function savedMessage(file: string | null, status: Pick<SyncStatus, 'dirty' | 'saved'>): Message {
  if (status.dirty) return tr('save.donePending', 'TD project saved; new changes are still waiting to be applied.');
  const revision = status.saved?.revision;
  if (file && revision != null) return tr('save.doneAt', 'TD project saved: {file} (r{revision})', { file, revision });
  return file ? tr('save.done', 'TD project saved: {file}', { file }) : tr('save.doneUnnamed', 'TD project saved');
}
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
  const sent = { document: serializeDocument({ ...bootstrap.defaultDocument.graph, savedBy: editorVersion }), revision: loaded.state.revision };
  const compiled = compiler.compile(bootstrap.defaultDocument.graph, bootstrap.typeContract.glslCode);
  const result = await host.call<{ state: StateResponse['state'] }>('apply', applyRequest(host, bootstrap, sent, compiled, editorVersion));
  if (result.state?.revision !== sent.revision + 1 || result.state.document !== sent.document) throw new HostError(replyMismatch);
}

/** A document's text without `savedBy`: what decides whether two documents differ (Refactor.66). 去掉 savedBy 的內容。 */
const bodyOf = (text: string) => { try { const { savedBy: _, ...rest } = JSON.parse(text) as Graph; return JSON.stringify(rest); } catch { return text; } };
const replyMismatch = tr('sync.replyMismatch', "TD's reply does not match what was sent.");
export const conflictMessage = tr('sync.conflict', 'The graph in TD seems to have been changed. Choose which version to use.');
// The two things the editor can tell apart (Refactor.71): TD is running but its own thread does not handle anything, or TD
// cannot be reached at all; why, only TD could say. 編輯器分得出的兩種：TD 還開著但自己的執行緒沒在處理、或完全連不到；
// 為什麼，只有 TD 自己說得出來。
const offlineMessage: Record<Link, Message> = {
  busy: tr('sync.offlineBusy', 'TD is running but not handling requests. Your changes stay in the browser and are sent when TD is back.'),
  unreachable: tr('sync.offlineUnreachable', 'Cannot reach TD (it may be closed or crashed, or the network is down). Your changes stay in the browser and are sent once connected.'),
  closed: tr('sync.offlineClosed', 'TD was closed. Your changes stay in the browser; after opening TD again, open the editor from the Grape OP.'),
  stopped: tr('sync.offlineStopped', "TD's editor service was stopped. Your changes stay in the browser and are sent once the service is on again."),
  reloading: tr('sync.offlineReloading', "TD's editor service is reloading; it reconnects by itself shortly."),
  deleted: tr('sync.offlineDeleted', 'This Grape OP was deleted in TD. Your changes stay in the browser; keep them with Download draft.'),
  device: tr('sync.offlineDevice', 'This device has no network. Your changes stay in the browser and are sent once the network is back.'),
};
// The page and TD-Grape in TD come from different builds (usually TD-Grape was updated). Not a conflict: no
// version choice helps; reloading keeps unsent changes as a draft (Refactor.52). 不是衝突：重新整理即可，修改留成草稿。
const hostChanged = tr('sync.hostChanged', 'This page and TD-Grape in TD come from different builds (TD-Grape was probably updated). Reload this page; unsent changes are kept as a draft.');
// What a failed host call means for the document (design-interview Q28, measured 2026-10-07):
// TD's queue answers manager_not_responding / manager_busy / manager_unavailable only when it
// made NO change; a transport failure or other 5xx may still have landed and must be checked.
// 依實測分類：TD 明確回覆「未處理」＝確定沒改；連線失敗或其他 5xx 可能已執行，須查版本、不重送。
type Failure = { phase: 'offline'; link: 'busy' | 'unreachable'; landed: boolean } | { phase: 'uncertain' | 'conflict' | 'error' }
  | { phase: 'changed' };
function classify(error: unknown): Failure {
  if (!(error instanceof HostError)) return { phase: 'uncertain' };
  if (error.code === 'build_changed') return { phase: 'changed' };
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
  private confirmed = ""; // document text TD has acknowledged
  private confirmedBody = ''; // the same without savedBy, for telling whether anything is left to send
  // Which editor saved the graph is written as it is sent (Refactor.66); whether something is left to send ignores it, so
  // opening a graph another version saved is not an edit. 送出時寫上是哪一版存的；判斷有沒有東西要送時不看它，打開別版存的圖不算修改。
  private stamp = (graph: Graph) => serializeDocument({ ...graph, savedBy: this.editorVersion });
  private confirm(text: string) { this.confirmed = text; this.confirmedBody = bodyOf(text); }
  private runtimeKey: string | null; // fingerprint of the program TD runs; null when unknown
  private failedKey: string | null = null; // fingerprint of a program TD could not compile
  private uncertain?: Sent;
  // A cause TD said while a send was on its way; the send's own failure only sees "unreachable" (audit since R.67).
  // 送出途中 TD 說的原因；送出自己失敗時只看得到「連不到」。
  private told?: Link;
  blocked = false;
  status: SyncStatus;
  /** What TD reported along with a reply (Uniform D1). 回覆裡 TD 一起帶回的現況與訊息。 */
  onTd?: (uniforms: UniformStates | undefined, notices: readonly Message[]) => void;
  constructor(readonly host: HostClient, readonly bootstrap: Bootstrap, loaded: StateResponse,
    private readonly source: () => Delivery, private readonly report: (status: SyncStatus, said?: Said) => void,
    private readonly delay = 0, private readonly retry = 5000, private readonly editorVersion = 'unknown') {
    this.confirm(loaded.state.document);
    this.runtimeKey = loaded.state.runtimeRevision === loaded.state.revision ? source().key : null;
    this.status = { revision: loaded.state.revision, dirty: false, phase: 'ready', stuck: stuckOf(loaded.state), saved: loaded.projectSaved };
  }
  get busy() { return !!this.pending; }
  private set({ message, level, ...patch }: Patch) {
    this.status = { ...this.status, ...patch };
    if (!this.disposed) this.report(this.status, message ? { message, level } : undefined);
  }
  private dirtyNow = () => bodyOf(serializeDocument(this.source().graph)) !== this.confirmedBody;

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
      const { graph, key, compiled } = this.source(), sent = { document: this.stamp(graph), revision: this.status.revision };
      // Same fingerprint as the running program: send the document only, so TD skips GPU work
      // (layout-only edits, design-interview Q31/Q38). 指紋與 TD 正在跑的相同：只送圖，TD 不做 GPU 驗證。
      // A program TD already failed to compile is not sent again until it changes.
      // TD 已編譯失敗的程式，沒改之前不再送。
      // While the Shader is stuck, the running program is sent too: TD compiles nothing (same program) but records it as
      // running again and forgets the failure (Refactor.63.2; otherwise going back to it left the notice up).
      // Shader 卡住時，正在跑的程式也照送：TD 不重新編譯，只記成正在跑並清掉失敗（否則回到它時提示不會消失）。
      const runtime = compiled && key !== this.failedKey && (key !== this.runtimeKey || this.status.stuck) ? compiled : undefined;
      this.set({ phase: 'sending', level: 'info', message: compiled ? tr('sync.sending', 'Applying to TD…')
        : tr('sync.sendingGraphOnly', 'Code generation failed; saving only the graph to TD. TD keeps running the last good Shader…') });
      try {
        const result = await this.host.call<Applied>('apply', applyRequest(this.host, this.bootstrap, sent, runtime, this.editorVersion));
        if (this.disposed) return;
        if (result.state?.revision !== sent.revision + 1 || result.state.document !== sent.document) throw new HostError(replyMismatch);
        this.confirm(sent.document); this.told = undefined;
        const saved = result.projectSaved ?? this.status.saved;
        let message = appliedMessage(result.state.revision, saved), level: Level = 'info';
        if (runtime && result.shaderError) {
          this.failedKey = key; level = 'error';
          // The summary first: the status line shows one line, the whole TD log on hover (Refactor.38).
          // 摘要放第一行：狀態列只顯示一行，滑鼠移上去看完整的 TD 紀錄。
          message = result.shaderFailure === 'internal'
            ? tr('sync.internalErrorInTd', 'TD-Grape ran into an internal error while applying the Shader. The graph is saved; TD keeps running the last good Shader.\n{log}',
              { log: result.shaderError })
            : tr('sync.glslFailedInTd', 'GLSL failed to compile in TD. The graph is saved; TD keeps running the last good Shader.\n{log}',
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
        this.set({ revision: result.state.revision, dirty: this.dirtyNow(), phase: 'ready', message, level, stuck: stuckOf(result.state), saved });
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
    if (failure.phase === 'changed') {
      this.blocked = true; this.set({ phase: 'error', link: undefined, message: hostChanged, level: 'error' }); return;
    }
    this.blocked = failure.phase !== 'error';
    if (sent && (failure.phase === 'uncertain' || (failure.phase === 'offline' && failure.landed))) this.uncertain = sent;
    const reason = errorText(error), link = this.told ?? (failure.phase === 'offline' ? failure.link : 'unreachable');
    this.told = undefined;
    this.set(failure.phase === 'offline' ? { phase: 'offline', link, message: offlineMessage[link], level: 'warning' }
      : { phase: failure.phase, link: undefined, level: failure.phase === 'error' ? 'error' : 'warning',
        message: failure.phase === 'conflict' ? conflictMessage
          : failure.phase === 'uncertain' ? tr('sync.uncertain', 'Delivery result unknown; automatic sending stopped while checking the version with TD. {reason}', { reason })
          : tr('sync.rejected', 'TD-Grape refused: {reason}', { reason }) });
    this.recover();
  }
  /** The live connection noticed before anything was sent (Refactor.71): it closed (`unreachable`) or TD stopped answering the
   * heartbeat (`busy`). Only from "in sync" or "away"; a send on its way, a conflict or an unsure result keep their own path.
   * 即時連線在送出之前就發現了：斷了（unreachable）或 TD 不回心跳（busy）。只從「已同步」或「不在」進來；送出中、衝突、
   * 結果不確定各走自己的路。 */
  lost(link: Link) {
    if (this.pending && said(link)) this.told = link;
    if (this.disposed || this.pending || !['ready', 'offline'].includes(this.status.phase)) return;
    if (this.status.phase === 'offline' && (this.status.link === link || (said(this.status.link) && !said(link)))) return;
    this.blocked = true;
    this.set({ phase: 'offline', link, message: offlineMessage[link], level: 'warning' });
    this.recover();
  }
  /** The live connection is back, or TD answers again: check now instead of waiting for the countdown. 連線回來或 TD 又回應：
   * 馬上檢查，不等倒數。 */
  found() {
    if (this.status.phase === 'offline') void this.checkNow();
  }
  // Only while disconnected or unsure, only when the page is visible, never overlapping.
  // 只在未連線或結果不明期間、頁面可見時重試，且不重疊；平常不輪詢，TD 端不增加工作。
  private recover() {
    clearTimeout(this.recovery);
    if (this.disposed || !['offline', 'uncertain'].includes(this.status.phase)) {
      if (this.status.retryAt !== undefined) this.set({ retryAt: undefined });
      return;
    }
    this.set({ retryAt: Date.now() + this.retry, retryMs: this.retry });
    this.recovery = setTimeout(() => {
      if (typeof document === 'undefined' || !document.hidden) void this.checkNow(); else this.recover();
    }, this.retry);
  }
  /** Check at once, then wait again (Refactor.59.3: pressing the countdown starts it over; human 2026-10-09).
   * Never two at a time. 馬上檢查，然後重新等待（按倒數圓餅＝從頭開始）；不會同時兩個。 */
  checkNow = async () => {
    if (this.status.checking) return;
    clearTimeout(this.recovery);
    this.set({ checking: true, retryAt: undefined });
    try { await this.check(); } finally { if (!this.disposed) { this.set({ checking: false }); this.recover(); } }
  };
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
      if (failure.phase === 'changed') { this.blocked = true; this.set({ phase: 'error', link: undefined, message: hostChanged, level: 'error' }); return; }
      // A cause TD said stays until TD is back; checking again only confirms it is still away (Refactor.75).
      // TD 說過的原因一直保留到它回來；再檢查只是確認還不在。
      if (said(this.status.link) && this.status.phase === 'offline') return;
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
    if (sent && state.revision === sent.revision + 1 && state.document === sent.document) this.confirm(sent.document);
    else if (state.revision !== this.status.revision || state.document !== this.confirmed) {
      this.blocked = true; this.set({ phase: 'conflict', link: undefined, message: conflictMessage, level: 'warning' }); return;
    }
    this.blocked = false; this.uncertain = undefined;
    const dirty = this.dirtyNow();
    this.set({ revision: state.revision, dirty, phase: 'ready', link: undefined, stuck: stuckOf(state), saved: result.projectSaved ?? this.status.saved,
      level: 'info', message: dirty ? tr('sync.reconnectedSending', 'Reconnected; sending your changes.') : tr('sync.reconnected', 'Reconnected.') });
    if (dirty) await this.flush();
  };
  // The graph was upgraded as it was read (Refactor.65): it is not what TD stores, and its program is not known to be the one
  // TD runs (an upgraded wire can change it), so the program goes too and TD compares. 讀圖時升級過：和 TD 存的不同，程式也
  // 不能當成 TD 正在跑的那份（升級的線可能改了它），所以程式照送，由 TD 比對。
  upgraded() {
    this.runtimeKey = null;
    this.changed();
  }
  // Conflict choice "TD 端": the Editor adopted TD's document; nothing is left to send.
  // 衝突時選「TD 端」：Editor 已採用 TD 的版本，與 TD 相同、不需送出。
  adopt(state: StateResponse['state']) {
    clearTimeout(this.timer);
    this.confirm(state.document); this.blocked = false; this.uncertain = undefined; this.failedKey = null;
    this.runtimeKey = state.runtimeRevision === state.revision ? this.source().key : null;
    this.set({ revision: state.revision, dirty: false, phase: 'ready', link: undefined, stuck: stuckOf(state) });
  }
  // Conflict choice "編輯端" (Q7/Q28): rebase the draft on TD's latest revision and send it
  // through the normal path; a further change before delivery still returns a conflict.
  // 衝突時選「編輯端」：以最新 revision 為基準重送草稿，照常產碼／驗證；期間再變仍擋。
  overwrite = async () => {
    const result = await this.read();
    this.confirm(result.state.document); this.blocked = false; this.uncertain = undefined;
    this.runtimeKey = null; this.failedKey = null; // TD's program was written elsewhere; send ours
    const dirty = this.dirtyNow();
    this.set({ revision: result.state.revision, dirty, phase: 'ready', stuck: stuckOf(result.state),
      level: 'info', message: dirty ? tr('sync.overwriting', "Overwriting TD with the editor's draft…")
        : tr('sync.draftMatchesTd', "The draft matches TD's graph; in sync.") });
    await this.flush();
  };
  save = async () => {
    await this.flush();
    if (this.status.dirty || this.blocked) throw new TextError(tr('save.pending', 'Some changes have not been applied yet; resolve the errors first.'));
    const result = await this.host.call<{ saved: boolean | string; projectSaved?: ProjectSaved }>('save', {});
    if (!result.saved) throw new TextError(tr('save.notConfirmed', "TD did not confirm that the project was saved; the applied graph is only in TD's memory."));
    if (result.projectSaved) this.savedInTd(result.projectSaved);
  };
  // "Also give this Grape OP a new Grape ID" (Refactor.52, Q63): only once everything is in TD, so the
  // new ID never leaves changes behind. Returns the new ID; switching to it is the shell's.
  // 換新 Grape ID：所有修改都已在 TD 才換，不會留下沒送到的修改。回傳新 ID；換過去由外殼做。
  renew = async () => {
    if (this.pending || this.blocked || this.status.dirty)
      throw new TextError(tr('identity.renewPending', 'The Grape ID was not changed: some changes are not in TD yet.'));
    const result = await this.host.call<{ targetId?: string }>('identity', {});
    if (!GRAPE_ID.test(result.targetId ?? '')) throw new HostError(replyMismatch);
    return result.targetId!;
  };
  /** TD says the project was saved (Refactor.73). TD 說專案存檔了。 */
  savedInTd(saved: ProjectSaved) { if (!this.disposed) this.set({ saved }); }
  dispose() { this.disposed = true; clearTimeout(this.timer); clearTimeout(this.recovery); }
}
