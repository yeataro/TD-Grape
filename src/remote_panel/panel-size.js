// Emit one bounded encoder size after layout settles, never during a held drag.
export function frameSize(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const scale = Math.min(1920 / width, 1080 / height, Math.max(1, 64 / width, 64 / height));
  return {width: Math.max(64, Math.min(1920, Math.round(width * scale / 2) * 2)),
    height: Math.max(64, Math.min(1080, Math.round(height * scale / 2) * 2))};
}

export class SettledPanelSize {
  constructor(send, {delay = 350, schedule = (callback, ms) => setTimeout(callback, ms), cancel = id => clearTimeout(id)} = {}) {
    this.send = send; this.delay = delay; this.schedule = schedule; this.cancel = cancel;
    this.held = new Set(); this.active = false; this.paused = false;
    this.pending = this.sent = null; this.timer = null;
  }
  stopTimer() { if (this.timer !== null) this.cancel(this.timer); this.timer = null; }
  queue() {
    this.stopTimer();
    if (!this.active || this.paused || this.held.size || !this.pending) return;
    if (this.sent?.width === this.pending.width && this.sent?.height === this.pending.height) return;
    this.timer = this.schedule(() => {
      this.timer = null;
      if (!this.active || this.paused || this.held.size || !this.pending) return;
      if (this.send(this.pending) !== false) this.sent = this.pending;
    }, this.delay);
  }
  resize(width, height) { this.pending = frameSize(width, height); this.queue(); }
  acknowledge(width, height) { this.sent = {width, height}; this.queue(); }
  setActive(active) {
    this.active = active; this.sent = null;
    if (!active) this.held.clear();
    this.queue();
  }
  pause(paused) { this.paused = paused; this.queue(); }
  hold(id) { this.held.add(id); this.stopTimer(); }
  release(id) { this.held.delete(id); this.queue(); }
  releaseAll() { this.held.clear(); this.queue(); }
}
