// Headless adapter checks; these do not claim real-browser or phone touch coverage.
import assert from 'node:assert/strict';
import {test} from 'node:test';

let pendingFrame, frameId = 0;
globalThis.requestAnimationFrame = callback => { pendingFrame = callback; return ++frameId; };
globalThis.cancelAnimationFrame = () => { pendingFrame = null; };
globalThis.document = {hasFocus: () => true, hidden: false};
globalThis.customElements = {get: () => true};
globalThis.HTMLElement = class {
  constructor() { this.style = {}; }
  attachShadow() {
    const listeners = {}, captures = new Set();
    this.shadowRoot = {activeElement: null, querySelector: selector => selector === 'video' ? this.testVideo : {hidden: false}};
    this.testVideo = {
      listeners, captures, style: {}, videoWidth: 960, videoHeight: 540,
      addEventListener: (type, listener) => { listeners[type] = listener; },
      getBoundingClientRect: () => ({left: 100, top: 50, width: 400, height: 400}),
      focus: () => { this.shadowRoot.activeElement = this.testVideo; listeners.focus(); },
      play: async () => {},
      setPointerCapture: id => captures.add(id), hasPointerCapture: id => captures.has(id),
      releasePointerCapture: id => {
        captures.delete(id);
        listeners.lostpointercapture({type: 'lostpointercapture', pointerType: 'touch', pointerId: id});
      },
    };
  }
  toggleAttribute() {}
  dispatchEvent() {}
};
const {TDRemotePanel} = await import('../../src/remote_panel/remote-panel.js');
function fixture() {
  pendingFrame = null;
  const panel = new TDRemotePanel(), events = [];
  panel.revision = 7;
  panel.channel = {readyState: 'open', send: message => events.push(JSON.parse(message))};
  const pointer = (type, id, x = 300, y = 250, pointerType = 'touch', buttons = 0) => {
    const event = {type, pointerId: id, pointerType, buttons, clientX: x, clientY: y,
      preventDefault() { this.prevented = true; }, cancelable: true};
    panel.testVideo.listeners[type](event);
    return event;
  };
  const frame = () => { const callback = pendingFrame; pendingFrame = null; callback?.(); };
  return {panel, events, pointer, frame};
}

test('touch adapter focuses, captures, letterboxes and sends the active source revision', () => {
  const {panel, events, pointer} = fixture();
  assert.ok(pointer('pointerdown', 1).prevented);
  assert.ok(panel.video.captures.has(1));
  pointer('pointerup', 1);
  assert.deepEqual(events, [
    {type: 'mouse', revision: 7, u: .5, v: .5, buttons: 1, wheel: 0},
    {type: 'mouse', revision: 7, u: .5, v: .5, buttons: 0, wheel: 0},
  ]);
  assert.equal(panel.video.captures.size, 0);
  assert.equal(panel.shadowRoot.activeElement, panel.video);
});

test('touches in letterbox bars or before connection cannot operate the target', () => {
  const {panel, events, pointer} = fixture();
  pointer('pointerdown', 1, 300, 70); pointer('pointerup', 1, 300, 70);
  panel.channel.readyState = 'closed';
  pointer('pointerdown', 2); pointer('pointerup', 2);
  assert.equal(panel.touch.contacts.size, 0);
  assert.equal(events.length, 0);
});

test('queued touch movement is cancelled on blur and capture is released once', () => {
  const {panel, events, pointer, frame} = fixture();
  pointer('pointerdown', 1); pointer('pointermove', 1, 330); frame();
  pointer('pointermove', 1, 350); panel.onBlur(); frame();
  pointer('pointerup', 1, 350);
  assert.deepEqual(events.map(e => e.buttons), [1, 1, 0]);
  assert.equal(panel.video.captures.size, 0);
  assert.equal(panel.touch.contacts.size, 0);
});

test('both fingers are coalesced into one native pan before a frame is sent', () => {
  const {panel, events, pointer, frame} = fixture();
  panel.touch.navigation = true;
  pointer('pointerdown', 1, 250); pointer('pointerdown', 2, 350);
  pointer('pointermove', 1, 280); pointer('pointermove', 2, 380); frame();
  assert.deepEqual(events.map(e => e.buttons), [2, 2]);
  pointer('pointerup', 1, 280); pointer('pointerup', 2, 380);
  assert.equal(events.at(-1).buttons, 0);
});

test('mouse input retains the original path, and cannot interrupt active touch', () => {
  const {events, pointer} = fixture();
  pointer('pointerdown', 1, 300, 250, 'mouse', 1);
  pointer('pointermove', 1, 320, 250, 'mouse', 1);
  pointer('pointerup', 1, 320, 250, 'mouse', 0);
  assert.deepEqual(events.map(e => e.buttons), [1, 1, 0]);
  pointer('pointerdown', 2);
  pointer('pointermove', 1, 360, 250, 'mouse', 0);
  assert.equal(events.length, 3);
  pointer('pointerup', 2);
  assert.equal(events.length, 5);
});
