import type { Value } from './core';
import type { HostClient } from './host';
import { FORMAT } from './host_sync';

// Uniform C (Refactor.46; uniform-c-live.md, design-interview Q53): Uniform values are sent to TD the
// moment they change — while dragging, on Enter, on a colour pick — so TD follows at once. The graph
// still changes only on release and is saved by the normal path. One request on the way at a time;
// a newer value replaces one not sent yet. Best effort: a value TD did not get is followed by the
// normal save. This is the one place that sends them: round D moves it to WebSocket (Q53).
// Uniform C：值一改就送到 TD（拖曳中、Enter、點顏色）；圖只在放開時改、照一般送出存。
// 一次只有一個請求在路上；還沒送的會被更新的值取代。送不到沒關係，一般送出會跟上。
// 只有這裡送即時值：D 那一輪把這裡換成 WebSocket。
export class LiveValues {
  private readonly session = crypto.randomUUID().replaceAll('-', '');
  private seq = 0;
  private readonly waiting = new Map<string, Value>();
  private busy = false;
  constructor(private readonly host: HostClient) {}
  send(id: string, value: Value) {
    this.waiting.set(id, value);
    void this.pump();
  }
  private async pump() {
    if (this.busy) return;
    this.busy = true;
    try {
      for (let next = this.waiting.entries().next(); !next.done; next = this.waiting.entries().next()) {
        const [id, value] = next.value;
        this.waiting.delete(id);
        try { await this.host.call('live', { format: FORMAT, id, value, session: this.session, seq: ++this.seq }); }
        catch { /* the normal save follows 一般送出會跟上 */ }
      }
    } finally { this.busy = false; }
  }
}
