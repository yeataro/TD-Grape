// Spreading a multi-selection by its frame's handles (Refactor.97, src/editor-react/selection_spread.ts; legacy selection_ui.js:180-226).
// 用多選框的把手拉開、收攏選取（R.97；照舊產品）。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const loaded = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../src/editor-react/selection_spread.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(loaded, loaded.exports);
const { spreadPositions } = loaded.exports;
const box = (id, x, y, width = 100, height = 60) => ({ id, x, y, width, height });
const at = (result, id) => { const p = result.get(id); return [Math.round(p.x * 1000) / 1000, Math.round(p.y * 1000) / 1000]; };
const pair = [box('a', 0, 0), box('b', 200, 0)];

test('the dragged edge follows the pointer, the opposite edge stays, sizes stay', () => {
  const right = spreadPositions(pair, 'e', 100, 0);
  assert.deepEqual([at(right, 'a'), at(right, 'b')], [[0, 0], [300, 0]], 'right edge out by 100, left edge still at 0');
  const left = spreadPositions(pair, 'w', -100, 0);
  assert.deepEqual([at(left, 'a'), at(left, 'b')], [[-100, 0], [200, 0]], 'left edge out by 100, right edge still at 300');
});

test('an edge handle moves one axis, a corner both', () => {
  const nodes = [box('a', 0, 0), box('b', 200, 200)];
  const down = spreadPositions(nodes, 's', 50, 50);
  assert.deepEqual([at(down, 'a'), at(down, 'b')], [[0, 0], [200, 250]], 'only y');
  const corner = spreadPositions(nodes, 'se', 50, 50);
  assert.deepEqual([at(corner, 'a'), at(corner, 'b')], [[0, 0], [250, 250]]);
});

test('drawing together stops at a new overlap, keeping up to 8px of the gap', () => {
  const together = spreadPositions(pair, 'e', -200, 0);
  assert.deepEqual([at(together, 'a'), at(together, 'b')], [[0, 0], [108, 0]], 'stops with 8px between them');
  const close = [box('a', 0, 0), box('b', 104, 0)];
  assert.deepEqual(at(spreadPositions(close, 'e', -50, 0), 'b'), [104, 0], 'a 4px gap is kept as it is');
});

test('drawn together all the way, a smaller node stops against the longer one\'s edge, not its centre (Refactor.100.1)', () => {
  // Different rows, so they never overlap; heights 60 and 200, drawn together from the bottom. 不同排、不會重疊；高 60 與 200，從下面收攏。
  const nodes = [box('tall', 0, 0, 100, 200), box('short', 300, 400, 100, 60)];
  const result = spreadPositions(nodes, 's', 0, -2000);
  assert.deepEqual(at(result, 'tall'), [0, 0], 'the top edge stays');
  assert.equal(at(result, 'short')[1] + 60, 200, 'the short one ends flush with the tall one\'s bottom, as it was below');
  const same = spreadPositions([box('a', 0, 0), box('b', 300, 400)], 's', 0, -2000);
  assert.equal(at(same, 'b')[1], at(same, 'a')[1], 'two of one size end centred, as legacy');
});

test('an overlap already there does not lock the selection', () => {
  const stacked = [box('a', 0, 0), box('b', 50, 20)];
  assert.ok(at(spreadPositions(stacked, 'e', 100, 0), 'b')[0] > 50, 'spreads apart');
});

test('a node as wide as the selection does not make the others jump', () => {
  const nodes = [box('wide', 0, 0, 400), box('a', 20, 100), box('b', 200, 100)];
  const result = spreadPositions(nodes, 'e', 10, 0);
  assert.ok(at(result, 'b')[0] - 200 < 15, 'a small drag moves a little');
  assert.ok(at(result, 'b')[0] > 200, 'and does move');
});
