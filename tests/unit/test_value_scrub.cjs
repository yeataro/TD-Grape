// The value box's slider behaviour (Refactor.55, value-input.md), as the legacy editor. 數值框的 slider 行為，照舊產品。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const file = path.resolve(__dirname, '../../src/editor-react/valueScrub.ts');
const loaded = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(loaded, loaded.exports);
const { fillFraction, startScrub, moveScrub, presetValues } = loaded.exports;
const drag = (state, steps, keys = { ctrl: false, shift: false }) => { let value; for (const x of steps) value = moveScrub(state, x, keys); return value; };

test('the fill shows where the value sits in its decade', () => {
  assert.equal(fillFraction(0.608), 0.608);
  assert.equal(fillFraction(1), 1);
  assert.equal(fillFraction(5), 0.5);
  assert.equal(fillFraction(50), 0.5);
  assert.equal(fillFraction(10), 1);
  assert.equal(fillFraction(-0.25), 0.75);
  assert.equal(fillFraction(NaN), 0);
});

test('dragging across the box moves through one decade and carries on past 1', () => {
  const state = startScrub(0, 0, 100, false);
  assert.equal(drag(state, [50, 100]), 1);
  assert.equal(drag(state, [190]), 10); // 1 → 10 is nine tenths of the width
  assert.equal(drag(state, [100]), 1);  // and back
});

test('Shift is finer, Ctrl coarser', () => {
  assert.equal(drag(startScrub(0, 0, 100, false), [100], { ctrl: false, shift: true }), 0.1);
  assert.equal(drag(startScrub(0, 0, 100, false), [10], { ctrl: true, shift: false }), 1);
});

test('integers step every 10 pixels (Ctrl every pixel)', () => {
  assert.equal(drag(startScrub(3, 0, 100, true), [25]), 5);
  assert.equal(drag(startScrub(3, 0, 100, true), [4], { ctrl: true, shift: false }), 7);
});

test('a limit stops the drag and turning back moves at once', () => {
  const state = startScrub(0.5, 0, 100, false, { min: 0 });
  assert.equal(drag(state, [-200]), 0);
  assert.equal(drag(state, [-190]), 0.1);
});

test('common values with the default merged in', () => {
  assert.deepEqual(presetValues(false, undefined, 0).map(item => [item.value, item.isDefault]),
    [[0, true], [1, false], [0.5, false], [-0.5, false], [-1, false]]);
  assert.deepEqual(presetValues(false, undefined, 2).map(item => item.value), [2, 0, 1, 0.5, -0.5, -1]);
  assert.deepEqual(presetValues(true, 0, undefined).map(item => item.value), [0, 1]);
});
