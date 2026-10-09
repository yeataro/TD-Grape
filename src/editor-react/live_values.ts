import type { Value } from './core';
import type { UniformStates } from './host';

// Live Uniform values (Uniform C, D2; design-interview Q53, uniform-d.md B): a WebSocket to TD, both ways.
// - To TD: each Uniform's latest value, at most once per frame; while the socket is not open the value
//   is dropped — the normal save (HTTP) brings the graph value later.
// - From TD: `state` when the connection opens and when a mode changes; `values` bundles, one per TD
//   frame, tagged with TD's frame; a bundle older than the last one taken is dropped.
// - Reconnects by itself; whether it is connected is the editor's own business (not TD's).
// 即時 Uniform 值：與 TD 之間的 WebSocket。送出：每個 Uniform 每格最多一次、只送最新；沒連上就丟掉（一般送出會跟上）。
// 收到：連上時與模式改變時的 state、每個 TD 影格一包的 values（比手上舊的就丟掉）。自己重連；連線狀態由編輯器自己判斷。
export type LiveMessage =
  | { type: 'state'; frame: number; uniforms: UniformStates }
  | { type: 'values'; frame: number; values: Record<string, (number | null)[]> }
  // A Grape OP was rewired in TD (Refactor.60): ask what its inputs have now. TD 上重新接線：去問現在接了什麼。
  | { type: 'inputs'; frame: number };
/** The part of a browser WebSocket used here (tests pass a fake). 這裡用到的 WebSocket 介面。 */
export type LiveSocket = {
  readonly readyState: number; send(text: string): void; close(): void;
  onopen: (() => void) | null; onclose: (() => void) | null; onerror: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
};
const OPEN = 1;

export class LiveValues {
  private socket?: LiveSocket;
  private seq = 0;
  private frame = -Infinity;
  private readonly waiting = new Map<string, Value>();
  private scheduled = false;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  connected = false;
  constructor(private readonly open: (() => LiveSocket) | undefined, private readonly receive: (message: LiveMessage) => void,
    private readonly linked: (connected: boolean) => void, private readonly retry = 2000,
    private readonly nextFrame: (run: () => void) => void = run => typeof requestAnimationFrame === 'function'
      ? void requestAnimationFrame(() => run()) : void setTimeout(run, 16)) {
    this.connect();
  }
  private connect() {
    if (!this.open || this.disposed) return;
    let socket: LiveSocket;
    try { socket = this.open(); } catch { this.later(); return; }
    this.socket = socket;
    socket.onopen = () => { this.frame = -Infinity; this.connected = true; this.linked(true); };
    socket.onmessage = event => {
      let message: LiveMessage;
      try { message = JSON.parse(String(event.data)) as LiveMessage; } catch { return; }
      if (message.type !== 'state' && message.type !== 'values' && message.type !== 'inputs') return;
      if (message.type === 'values' && message.frame < this.frame) return; // older than what we have 比手上的舊
      this.frame = Math.max(this.frame, message.frame);
      this.receive(message);
    };
    socket.onerror = () => {};
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      this.waiting.clear();
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
    clearTimeout(this.retryTimer);
    const socket = this.socket;
    this.socket = undefined;
    socket?.close();
  }
}
