// The graph JSON laid out for reading (Refactor.102, src/editor-react/json_format.ts). 圖的 JSON 排成好讀的樣子（R.102）。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const loaded = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../src/editor-react/json_format.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(loaded, loaded.exports);
const { formatJson, layJson, changedLines } = loaded.exports;

test('short objects and arrays stay on one line', () => {
  assert.equal(formatJson({ x: 1, y: [1, 2], z: {}, w: [] }), '{ "x": 1, "y": [1, 2], "z": {}, "w": [] }');
});

test('a line over 60 characters opens, one item a line, two spaces deeper', () => {
  const value = { id: 'color', nodeType: 'sgrape.builtin.color', params: { value: [0.55, 0.28, 0.9, 1] } };
  assert.equal(formatJson(value), [
    '{',
    '  "id": "color",',
    '  "nodeType": "sgrape.builtin.color",',
    '  "params": { "value": [0.55, 0.28, 0.9, 1] }',
    '}'].join('\n'));
});

test('what is shown is what is saved: read back it is the same value, undefined fields left out', () => {
  const graph = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/top_compiler_legacy.json'), 'utf8'));
  // Compared with the saved form: JSON writes -0 as 0 (case 51 has one), and so does saving. 跟存下來的樣子比：JSON 把 -0 寫成 0（案例 51 有一個），存檔也一樣。
  assert.deepEqual(JSON.parse(formatJson(graph)), JSON.parse(JSON.stringify(graph)));
  assert.equal(formatJson({ a: 1, b: undefined }), '{ "a": 1 }');
  assert.equal(formatJson('text'), '"text"');
  assert.equal(formatJson(undefined), '');
});

// Live trace (Refactor.102.1): each line knows its node, a node's id and name lead to it, and what changed is told by place.
// 即時追蹤（R.102.1）：每一行知道自己屬於哪個節點，節點的 id 與名字帶回它，改了什麼照位置看。
const node = (id, x) => ({ id, nodeType: 'sgrape.builtin.color', params: { value: [0.55, 0.28, 0.9, 1] }, ui: { x, y: 2 }, name: id + '_1' });
const graph = (...nodes) => ({ format: 'grape-graph', stages: { pixel: { nodes, edges: [{ id: 'e1', from: ['a', 'out'], to: ['b', 'in'] }] } } });
const textOf = (lines, set) => [...set].map(index => lines[index].text.trim());

test('a canvas node owns its lines, and only its id and name lead to it', () => {
  const lines = layJson(graph(node('a', 1), node('b', 2)));
  const own = lines.filter(line => line.node === 'a').map(line => line.text.trim());
  assert.equal(own[0], '{'); assert.equal(own.at(-1), '},');
  assert.ok(own.includes('"nodeType": "sgrape.builtin.color",'));
  assert.deepEqual(lines.filter(line => line.link).map(line => [line.link, line.text.trim()]),
    [['a', '"id": "a",'], ['a', '"name": "a_1"'], ['b', '"id": "b",'], ['b', '"name": "b_1"']]);
  // The edge names nodes too, but it is not a node's own line. 線也寫了節點，但不是節點自己的行。
  assert.ok(lines.filter(line => line.text.includes('"from"')).every(line => line.node === undefined && line.link === undefined));
});

test('changed lines: a moved node lights its own place; removing or adding one does not light the rest', () => {
  const before = layJson(graph(node('a', 1), node('b', 2), node('c', 3)));
  const moved = layJson(graph(node('a', 1), node('b', 9), node('c', 3)));
  assert.deepEqual(textOf(moved, changedLines(before, moved)), ['"ui": { "x": 9, "y": 2 },']);
  const removed = layJson(graph(node('a', 1), node('c', 3)));
  assert.deepEqual(textOf(removed, changedLines(before, removed)), []);
  // Appended: only the new node, not the comma the one before it gained. 加在最後：只有新的節點，不算前一個多出來的逗號。
  const added = layJson(graph(node('a', 1), node('b', 2), node('c', 3), node('d', 4)));
  const lit = [...changedLines(before, added)];
  assert.ok(lit.length > 0 && lit.every(index => added[index].node === 'd'));
});
