import type { Value } from './core';
import type { ProjectSaved, UniformStates } from './host';

// Live Uniform values (Uniform C, D2; design-interview Q53, uniform-d.md B): a WebSocket to TD, both ways.
// - To TD: each Uniform's latest value, at most once per frame; while the socket is not open the value
//   is dropped — the normal save (HTTP) brings the graph value later.
// - From TD: `state` when the connection opens and when a mode changes; `values` bundles, one per TD
//   frame, tagged with TD's frame; a bundle older than the last one taken is dropped.
// - Reconnects by itself; whether it is connected is the editor's own business (not TD's).
// - Heartbeat (Refactor.71, human 2026-10-10: TD had been minimized long before the editor showed it): while the page is
//   seen, a `ping` every few seconds, one at a time; TD's own thread answers `pong` at the start of a frame, so a TD that is
//   minimized, busy or paused does not answer although the connection stays open (the protocol's own ping is answered by
//   the connection's thread and would not tell). No answer by the next beat: TD is not responding.
// 即時 Uniform 值：與 TD 之間的 WebSocket。送出：每個 Uniform 每格最多一次、只送最新；沒連上就丟掉（一般送出會跟上）。
// 收到：連上時與模式改變時的 state、每個 TD 影格一包的 values（比手上舊的就丟掉）。自己重連；連線狀態由編輯器自己判斷。
// 心跳（R.71，人類：TD 早就縮小了，編輯器很晚才顯示）：頁面看得見時每幾秒一個 ping、同時只有一個；由 TD 自己的執行緒在
// 每格開始時回 pong，所以 TD 縮小、忙、暫停時連線雖然還開著卻不會回（協定自己的 ping 由連線的執行緒回，測不出來）。
// 到下一拍還沒回：TD 沒處理。
export type LiveMessage =
  | { type: 'state'; frame: number; uniforms: UniformStates }
  | { type: 'values'; frame: number; values: Record<string, (number | null)[]> }
  // A Grape OP was rewired in TD (Refactor.60): ask what its inputs have now. TD 上重新接線：去問現在接了什麼。
  // `retake` false after an apply: ask again, no new snapshots (R.61.5). 套用後為 false：再問、不重拍。
  | { type: 'inputs'; frame: number; retake?: boolean }
  // The Grape OP broke in TD while this editor is open (Refactor.67, D3): TD-Grape's reason, said once.
  // 編輯器開著時 Grape OP 在 TD 壞了：TD-Grape 說明原因，說一次。
  | { type: 'refused'; frame: number; message: string }
  // The TD project was just saved (Refactor.71): `file` is its file name. TD 專案剛存檔；file 是檔名。
  | { type: 'saved'; frame: number; file: string; projectSaved?: ProjectSaved };
/** The part of a browser WebSocket used here (tests pass a fake). 這裡用到的 WebSocket 介面。 */
export type LiveSocket = {
  readonly readyState: number; send(text: string): void; close(): void;
  onopen: (() => void) | null; onclose: (() => void) | null; onerror: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
};
const OPEN = 1;
export const HEARTBEAT = 5000;
const seen = () => typeof document === 'undefined' || !document.hidden;

export class LiveValues {
  private socket?: LiveSocket;
  private seq = 0;
  private frame = -Infinity;
  private readonly waiting = new Map<string, Value>();
  private scheduled = false;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  private beatTimer?: ReturnType<typeof setTimeout>;
  private asked?: number; // the ping not answered yet 還沒回的 ping
  private beats = 0;
  connected = false;
  responding = true;
  /** `responding(false)` when TD stops answering the heartbeat, `true` once it answers again. TD 不回心跳時 false、又回了 true。 */
  constructor(private readonly open: (() => LiveSocket) | undefined, private readonly receive: (message: LiveMessage) => void,
    private readonly linked: (connected: boolean) => void, private readonly retry = 2000,
    private readonly nextFrame: (run: () => void) => void = run => typeof requestAnimationFrame === 'function'
      ? void requestAnimationFrame(() => run()) : void setTimeout(run, 16),
    private readonly answering: (responding: boolean) => void = () => {}, private readonly beat = HEARTBEAT) {
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.shown);
    this.connect();
  }
  // Seen again: ask at once, so coming back to the page tells right away. 又看得到了：馬上問，回到頁面就知道。
  private shown = () => { if (seen() && this.connected) { this.asked = undefined; this.heartbeat(); } };
  private heartbeat = () => {
    clearTimeout(this.beatTimer);
    const socket = this.socket;
    if (this.disposed || socket?.readyState !== OPEN) return;
    if (!seen()) { this.asked = undefined; return; } // not asked while unseen 看不到時不問
    if (this.asked !== undefined) this.answered(false); // the last one got no answer 上一個沒回
    else { this.asked = ++this.beats; socket.send(JSON.stringify({ type: 'ping', seq: this.asked })); }
    this.beatTimer = setTimeout(this.heartbeat, this.beat);
  };
  private answered(responding: boolean) {
    if (this.responding === responding) return;
    this.responding = responding;
    this.answering(responding);
  }
  private connect() {
    if (!this.open || this.disposed) return;
    let socket: LiveSocket;
    try { socket = this.open(); } catch { this.later(); return; }
    this.socket = socket;
    socket.onopen = () => {
      this.frame = -Infinity; this.connected = true; this.asked = undefined; this.responding = true;
      this.linked(true); this.heartbeat();
    };
    socket.onmessage = event => {
      let message: LiveMessage | { type: 'pong'; seq: number };
      try { message = JSON.parse(String(event.data)) as LiveMessage | { type: 'pong'; seq: number }; } catch { return; }
      if (message.type === 'pong') { if (message.seq === this.asked) { this.asked = undefined; this.answered(true); } return; }
      if (!['state', 'values', 'inputs', 'refused', 'saved'].includes(message.type)) return;
      if (message.type === 'values' && message.frame < this.frame) return; // older than what we have 比手上的舊
      this.frame = Math.max(this.frame, message.frame);
      this.receive(message);
    };
    socket.onerror = () => {};
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      this.waiting.clear();
      clearTimeout(this.beatTimer); this.asked = undefined;
      if (this.connected) { this.connected = false; this.linked(false); }
      this.later();
    };
  }
  private later() {
    if (!this.disposed) this.retryTimer = setTimeout(() => this.connect(), this.retry);
  }
  send(id: string, value: Value) {
    if (this.socket?.readyState !== OPEN) return; // not connected: dropped 沒連上：丟掉
    this.waiting.set(id, value);
    if (this.scheduled) return;
    this.scheduled = true;
    this.nextFrame(() => this.flush());
  }
  private flush() {
    this.scheduled = false;
    const socket = this.socket;
    if (socket?.readyState !== OPEN) { this.waiting.clear(); return; }
    for (const [id, value] of this.waiting) socket.send(JSON.stringify({ type: 'value', id, value, seq: ++this.seq }));
    this.waiting.clear();
  }
  dispose() {
    this.disposed = true;
    clearTimeout(this.retryTimer); clearTimeout(this.beatTimer);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.shown);
    const socket = this.socket;
    this.socket = undefined;
    socket?.close();
  }
}
