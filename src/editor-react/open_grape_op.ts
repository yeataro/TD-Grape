import { UnsupportedGraphError, type Bootstrap } from './core';
import { HostError, type HostClient, type StateResponse } from './host';
import { Editor } from './editor';
import { resetToDefault } from './host_sync';
import { tr, errorText, type Message } from './text';

/** How opening a Grape OP ended (Codex boundary review R10, Refactor.122). 開一個 Grape OP 的結果。 */
export type Opening =
  | { kind: 'opened'; loaded: StateResponse; session: Editor }
  /** TD has no such Grape OP. TD 沒有這個 Grape OP。 */
  | { kind: 'missing' }
  /** Refused, with why; `reset` replaces the graph with the default one when that is offered (a graph this entry cannot open);
   * `loaded` is what TD said when it was the session that refused (who answered stays shown). 被拒與原因；有 reset 時可換成預設圖；
   * 是工作階段拒絕時附上 TD 的回覆（照樣顯示是誰回話）。 */
  | { kind: 'refused'; message: Message; reset?: () => Promise<void>; loaded?: StateResponse }
  /** The page moved on before it finished; nothing was built. 還沒開好使用者就離開了；什麼都沒建。 */
  | { kind: 'left' };

/** Open a Grape OP: ask TD for its state, then build the editing session (Refactor.122; Codex boundary review R10). Both steps end in
 * the same answer and never throw: a session that refuses what TD sent (another build, a graph this entry cannot open, a newer
 * version) is a refusal with its reason, as a failed request is — before, a refusal while building was lost and the page stayed on
 * "Opening…". A session that refuses closes what it had opened before the refusal comes out (editor.ts; Codex R122 review), so a refused
 * one leaves nothing to close.
 * `stillWanted` is asked once TD has answered; `make` builds the session (tests give their own).
 * 開一個 Grape OP：先向 TD 要狀態，再建立編輯工作階段。兩步得到同一種答案、不丟例外：工作階段拒絕 TD 給的東西（另一個建置、這個入口打不開的圖、
 * 較新版本）時，和請求失敗一樣是附原因的拒絕——以前建立時的拒絕會被吞掉，畫面停在「正在開啟」。被拒的工作階段在交出拒絕前
 * 先關掉自己開的（editor.ts；Codex R.122 審查），所以被拒時沒有東西要關。stillWanted 在 TD 回覆後問一次；make 建立工作階段（測試自己給）。 */
export async function openGrapeOp(host: HostClient, bootstrap: Bootstrap, version: string, stillWanted: () => boolean,
  make: (loaded: StateResponse) => Editor = loaded => new Editor(host, bootstrap, loaded, undefined, undefined, undefined, version)): Promise<Opening> {
  let loaded: StateResponse;
  try {
    loaded = await host.call<StateResponse>('state');
  } catch (error) {
    if (!stillWanted()) return { kind: 'left' };
    if (error instanceof HostError && error.status === 404) return { kind: 'missing' };
    return refused(error);
  }
  if (!stillWanted()) return { kind: 'left' };
  try {
    return { kind: 'opened', loaded, session: make(loaded) };
  } catch (error) {
    return { ...refused(error), loaded };
  }
  function refused(error: unknown): Opening & { kind: 'refused' } {
    return { kind: 'refused', message: tr('picker.cannotOpen', 'This Grape OP cannot be opened here: {reason}', { reason: errorText(error) }),
      ...(error instanceof UnsupportedGraphError ? { reset: async () => { await resetToDefault(host, bootstrap, version); } } : {}) };
  }
}

/** "Apply, then switch" (Codex R13 and R122-2, Refactor.122.1; legacy app.js:740): once TD has answered, switch only if this very choice
 * is still the open one and nothing is left to send. A choice is a new object each time the user picks a Grape OP, so Cancel followed by
 * the same Grape OP again is a new choice that waits for its own confirmation — comparing destinations could not tell them apart.
 * 「套用後切換」：TD 回覆後，這一次的選擇仍是開著的那個、且沒有要送的，才切。每次選 Grape OP 都是新物件，所以取消後再選同一個是新的選擇、
 * 要等它自己的確認——只比目的地分不出來。 */
export async function switchAfterApply<T>(choice: T, flush: () => Promise<unknown>, open: () => T | null, settled: () => boolean,
  go: (choice: T) => void): Promise<void> {
  await flush();
  if (open() === choice && settled()) go(choice);
}
