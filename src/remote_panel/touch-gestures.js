// Touch translation only. The existing control channel still receives mouse events.
// Coordinates stay in CSS pixels until mapPoint applies the video's letterboxing.
export class TouchGestures {
  constructor(mapPoint, sendMouse) {
    this.mapPoint = mapPoint;
    this.sendMouse = sendMouse;
    this.contacts = new Map();
    this.phase = 'idle';
    this.buttons = 0;
    this.navigation = false;
  }

  down(id, position) {
    if (this.contacts.has(id)) return;
    this.contacts.set(id, {...position});
    if (this.contacts.size === 1 && this.phase === 'idle') {
      this.start = {...position};
      this.phase = 'tap';
    } else if (this.contacts.size === 2 && this.phase !== 'blocked') {
      this.releaseButton();
      this.phase = this.navigation ? 'two' : 'blocked';
      this.baseline = this.geometry();
    } else {
      this.releaseButton();
      this.phase = 'blocked';
    }
  }

  move(id, position) {
    if (this.contacts.has(id)) this.contacts.set(id, {...position});
  }

  flush() {
    if (this.phase === 'tap' || this.phase === 'drag') {
      const point = this.contacts.values().next().value;
      if (!point) return;
      if (this.phase === 'tap') {
        if (Math.hypot(point.clientX - this.start.clientX, point.clientY - this.start.clientY) < 6) return;
        // Defer the press until a drag or tap is known, so adding a second finger
        // doesn't first click a control or rotate the viewer.
        this.emit(this.start, 1);
        this.phase = 'drag';
      }
      this.emit(point, 1);
    } else if (['two', 'pan', 'pinch'].includes(this.phase)) {
      const current = this.geometry();
      if (this.phase === 'two') {
        const movement = Math.hypot(current.clientX - this.baseline.clientX, current.clientY - this.baseline.clientY);
        const spread = Math.abs(current.distance - this.baseline.distance);
        if (movement < 6 && spread < 10) return;
        // Lock to one gesture until lift: pinch jitter must not also pan the camera.
        this.phase = spread > movement * 1.5 ? 'pinch' : 'pan';
        if (this.phase === 'pan') this.emit(this.baseline, 2); // TD geometry viewer: right drag.
        else this.emit(this.baseline, 4); // Middle drag controls the target's native camera dolly.
      }
      if (this.phase === 'pan') this.emit(current, 2);
      else {
        const anchor = this.mapPoint(this.baseline);
        if (!anchor) return;
        const dolly = Math.log(current.distance / this.baseline.distance) * .35;
        // Keep the virtual cursor horizontal position fixed: a pinch must not
        // also turn the camera in TD's Camera navigation mode.
        this.emitPoint({u: anchor.u, v: Math.max(-1, Math.min(2, anchor.v + dolly))}, 4);
      }
    }
  }

  up(id, position) {
    if (!this.contacts.has(id)) return;
    this.move(id, position);
    this.flush();
    if (this.phase === 'tap') this.emit(this.start, 1);
    this.releaseButton();
    this.contacts.delete(id);
    // A remaining finger cannot turn a navigation gesture into a new left drag.
    this.phase = this.contacts.size ? 'blocked' : 'idle';
  }

  cancel(id) {
    if (!this.contacts.has(id)) return;
    this.releaseButton();
    this.contacts.delete(id);
    this.phase = this.contacts.size ? 'blocked' : 'idle';
  }

  reset() {
    this.releaseButton();
    this.contacts.clear();
    this.phase = 'idle';
  }

  geometry() {
    const [a, b] = this.contacts.values();
    return {clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2,
      distance: Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY))};
  }

  emit(position, buttons) {
    const point = this.mapPoint(position);
    if (!point) return;
    this.emitPoint(point, buttons);
  }

  emitPoint(point, buttons) {
    this.lastPoint = point;
    this.buttons = buttons;
    this.sendMouse(point, buttons, 0);
  }

  releaseButton() {
    if (this.buttons) this.sendMouse(this.lastPoint, 0, 0);
    this.buttons = 0;
  }
}
