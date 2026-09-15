import assert from 'node:assert/strict';
import {test} from 'node:test';
import {TouchGestures} from '../../src/remote_panel/touch-gestures.js';

const p = (clientX, clientY = 50) => ({clientX, clientY});
function fixture(navigation = true) {
  const events = [];
  const touch = new TouchGestures(p => ({u: p.clientX / 100, v: 1 - p.clientY / 100}),
    (point, buttons, wheel) => events.push({...point, buttons, wheel}));
  touch.navigation = navigation;
  return {touch, events};
}

test('a tap sends one complete left click, after the finger lifts', () => {
  const {touch, events} = fixture(false);
  touch.down(1, p(30));
  touch.move(1, p(32)); touch.flush();
  assert.equal(events.length, 0);
  touch.up(1, p(32));
  assert.deepEqual(events.map(e => [e.u, e.buttons]), [[.3, 1], [.3, 0]]);
});

test('single drag retains its origin and releases even outside the panel', () => {
  const {touch, events} = fixture(false);
  touch.down(1, p(20)); touch.move(1, p(60)); touch.flush();
  touch.up(1, p(110));
  assert.deepEqual(events.map(e => [e.u, e.buttons]), [[.2, 1], [.6, 1], [1.1, 1], [1.1, 0]]);
});

test('two-finger pan uses a right drag without a preceding left click', () => {
  const {touch, events} = fixture();
  touch.down(1, p(30)); touch.down(2, p(70));
  touch.move(1, p(45)); touch.move(2, p(85)); touch.flush();
  touch.up(1, p(45));
  assert.deepEqual(events.map(e => e.buttons), [2, 2, 2, 0]);
  assert.equal(events[0].u, .5);
  assert.equal(events[1].u, .65);
  const length = events.length;
  touch.move(2, p(95)); touch.flush(); touch.up(2, p(95));
  assert.equal(events.length, length, 'remaining finger must not become a left drag');
});

test('pinch spreads dolly in, closing dollies out, then releases the middle button', () => {
  const {touch, events} = fixture();
  touch.down(1, p(30)); touch.down(2, p(70));
  touch.move(1, p(20)); touch.move(2, p(80)); touch.flush();
  touch.move(1, p(25)); touch.move(2, p(75)); touch.flush();
  touch.up(1, p(25)); touch.up(2, p(75));
  assert.deepEqual(events.map(e => e.buttons), [4, 4, 4, 4, 0]);
  assert.ok(events[1].v > events[0].v && events[2].v < events[1].v);
  assert.ok(events.every(e => e.wheel === 0 && e.u === .5));
});

test('two-finger taps do not open a native right-click menu', () => {
  const {touch, events} = fixture();
  touch.down(1, p(30)); touch.down(2, p(70));
  touch.up(1, p(30)); touch.up(2, p(70));
  assert.equal(events.length, 0);
});

test('adding a second finger releases an existing single drag', () => {
  const {touch, events} = fixture();
  touch.down(1, p(20)); touch.move(1, p(40)); touch.flush();
  touch.down(2, p(70));
  assert.deepEqual(events.map(e => e.buttons), [1, 1, 0]);
  touch.reset();
  assert.equal(events.length, 3);
});

test('Panel mode cancels multi-touch instead of pressing its controls', () => {
  const {touch, events} = fixture(false);
  touch.down(1, p(30)); touch.down(2, p(70));
  touch.move(1, p(10)); touch.move(2, p(95)); touch.flush();
  touch.up(1, p(10)); touch.up(2, p(95));
  assert.equal(events.length, 0);
});

test('third finger cancels navigation until all fingers lift', () => {
  const {touch, events} = fixture();
  touch.down(1, p(30)); touch.down(2, p(70));
  touch.move(1, p(40)); touch.move(2, p(80)); touch.flush();
  touch.down(3, p(90));
  assert.equal(events.at(-1).buttons, 0);
  const length = events.length;
  touch.up(3, p(90)); touch.move(1, p(50)); touch.flush();
  touch.up(1, p(50)); touch.up(2, p(80));
  assert.equal(events.length, length);
  touch.down(4, p(40)); touch.up(4, p(40));
  assert.deepEqual(events.slice(-2).map(e => e.buttons), [1, 0]);
});

test('pointer cancellation releases once; late capture loss does not click', () => {
  const {touch, events} = fixture();
  touch.down(1, p(30)); touch.move(1, p(45)); touch.flush();
  touch.cancel(1); touch.cancel(1); touch.up(1, p(45));
  assert.deepEqual(events.map(e => e.buttons), [1, 1, 0]);
});

test('focus loss, source change or disconnect reset discards queued gestures', () => {
  const {touch, events} = fixture();
  touch.down(1, p(30)); touch.move(1, p(45)); touch.flush();
  touch.move(1, p(70)); touch.reset(); touch.flush(); touch.up(1, p(70));
  assert.deepEqual(events.map(e => e.buttons), [1, 1, 0]);
  assert.equal(touch.contacts.size, 0);
  touch.down(2, p(30)); touch.reset(); touch.up(2, p(30));
  assert.equal(events.length, 3, 'pending tap must also be discarded');
});
