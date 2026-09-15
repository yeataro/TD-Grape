import assert from 'node:assert/strict';
import {test} from 'node:test';
import {frameSize, SettledPanelSize} from '../../src/remote_panel/panel-size.js';

function fixture() {
  let now = 0, next = 0;
  const jobs = new Map(), sent = [];
  const size = new SettledPanelSize(value => { sent.push(value); }, {
    schedule: (callback, delay) => { jobs.set(++next, {callback, at: now + delay}); return next; },
    cancel: id => jobs.delete(id),
  });
  const tick = ms => {
    now += ms;
    for (const [id, job] of [...jobs]) if (job.at <= now) { jobs.delete(id); job.callback(); }
  };
  return {size, sent, tick};
}

test('one even encoder size follows the final settled CSS viewport', () => {
  const {size, sent, tick} = fixture();
  size.setActive(true);
  size.resize(302, 200); tick(300);
  size.resize(403, 299); tick(349);
  assert.deepEqual(sent, []);
  tick(1);
  assert.deepEqual(sent, [{width: 404, height: 300}]);
  size.resize(403.2, 299.2); tick(1000);
  assert.equal(sent.length, 1);
});

test('a held divider never changes the encoder, even if motion pauses', () => {
  const {size, sent, tick} = fixture();
  size.setActive(true); size.hold(7);
  size.resize(600, 300); tick(10000);
  size.resize(400, 400); tick(10000);
  assert.deepEqual(sent, []);
  size.release(7); tick(349);
  assert.deepEqual(sent, []);
  tick(1);
  assert.deepEqual(sent, [{width: 400, height: 400}]);
});

test('all contacts must release, and cancellation/blur can finish the drag', () => {
  const {size, sent, tick} = fixture();
  size.setActive(true); size.hold(1); size.hold(2); size.resize(500, 240);
  size.release(1); tick(1000); assert.equal(sent.length, 0);
  size.releaseAll(); tick(350); assert.equal(sent.length, 1);
});

test('hidden, collapsed and disconnected panels cannot resize a shared source', () => {
  const {size, sent, tick} = fixture();
  size.resize(400, 240); tick(1000); assert.equal(sent.length, 0);
  size.setActive(true); size.pause(true); tick(1000); assert.equal(sent.length, 0);
  size.pause(false); size.resize(0, 0); tick(1000); assert.equal(sent.length, 0);
  size.resize(800, 400); size.setActive(false); tick(1000); assert.equal(sent.length, 0);
});

test('new connections send their current viewport, even if its size has not changed', () => {
  const {size, sent, tick} = fixture();
  size.resize(800, 400); size.setActive(true); tick(350);
  size.setActive(false); size.setActive(true); tick(350);
  assert.deepEqual(sent, [{width: 800, height: 400}, {width: 800, height: 400}]);
});

test('source metadata corrects a resize rejected with an old revision without a feedback loop', () => {
  const {size, sent, tick} = fixture();
  size.resize(800, 400); size.setActive(true); tick(350);
  size.acknowledge(960, 540); tick(350);
  assert.equal(sent.length, 2);
  size.acknowledge(800, 400); tick(1000);
  assert.equal(sent.length, 2);
});

test('unavailable transport does not mark the size delivered', () => {
  const {size, sent, tick} = fixture();
  const send = size.send; size.send = () => false;
  size.resize(800, 400); size.setActive(true); tick(350);
  size.send = send; size.resize(800, 400); tick(350);
  assert.equal(sent.length, 1);
});

test('sizes stay within encoder bounds and reject hidden or invalid rectangles', () => {
  for (const pair of [[0, 100], [100, 0], [-1, 100], [NaN, 100], [100, Infinity]])
    assert.equal(frameSize(...pair), null);
  assert.deepEqual(frameSize(3840, 2160), {width: 1920, height: 1080});
  assert.deepEqual(frameSize(20, 10), {width: 128, height: 64});
  for (const pair of [[300, 44], [10000, 1], [1, 10000], [305.25, 185.5]]) {
    const {width, height} = frameSize(...pair);
    assert.ok(width >= 64 && width <= 1920 && height >= 64 && height <= 1080);
    assert.equal(width % 2, 0); assert.equal(height % 2, 0);
  }
});

test('browser timer APIs keep their global receiver', () => {
  const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
  try {
    globalThis.setTimeout = function () { assert.ok(this == null || this === globalThis); return 1; };
    globalThis.clearTimeout = function () { assert.ok(this == null || this === globalThis); };
    const size = new SettledPanelSize(() => {});
    size.setActive(true); size.resize(400, 200); size.resize(500, 200); size.setActive(false);
  } finally { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; }
});
