// The graph JSON laid out for reading (Refactor.102, src/editor-react/json_format.ts). 圖的 JSON 排成好讀的樣子（R.102）。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const loaded = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../src/editor-react/json_format.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(loaded, loaded.exports);
const { formatJson, layJson, changedLines, removedLines, keepSameLines, linesByOwner } = loaded.exports;
const plain = value => JSON.parse(JSON.stringify(value));

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
  assert.deepEqual(lines.filter(line => line.node && line.links).map(line => [line.links, line.text.trim()]),
    [[[{ node: 'a' }], '"id": "a",'], [[{ node: 'a' }], '"name": "a_1"'], [[{ node: 'b' }], '"id": "b",'], [[{ node: 'b' }], '"name": "b_1"']]);
  // A wire's line is its own, not a node's; its id leads to the wire, its from and to to their nodes, the ports to nothing
  // (Refactor.103). 接線那一行屬於接線、不屬於節點；id 帶到接線，from、to 帶到兩端的節點，接孔名不帶（R.103）。
  const wire = lines.filter(line => line.edge === 'e1');
  assert.ok(wire.length && wire.every(line => line.node === undefined));
  assert.deepEqual(plain(wire.flatMap(line => line.links ?? [])), [{ edge: 'e1' }, { node: 'a' }, null, { node: 'b' }, null]);
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

// Deep clean (2026-10-12): every line has its own place — an id "3" is not the fourth item, and no key runs into another.
// 深度清潔（10-12）：每一行有自己的位置——id「3」不是第四項，任何鍵都不會撞在一起。
test('places never repeat', () => {
  const lines = layJson({ list: [{ id: '3', value: 'a long enough text to open this object' }, 'y', { w: 'another long text to open it too' },
    { value: 'x and enough words to open this one as well' }], 'a\u0000b': { '{': 1, c: 'more than sixty characters in all, so that it opens' } });
  const places = lines.map(line => line.place);
  assert.equal(new Set(places).size, places.length);
});

// Gone lines stand where they were (Refactor.103.2). 不見的行放回原本的位置（R.103.2）。
test('removed lines: each with where it stood', () => {
  const before = layJson(graph(node('a', 1), node('b', 2), node('c', 3))), after = layJson(graph(node('a', 1), node('c', 3)));
  const gone = removedLines(before, after);
  assert.ok(gone.length > 0 && gone.every(item => item.line.node === 'b'));
  const firstC = after.findIndex(line => line.node === 'c');
  assert.ok(gone.every(item => item.at === firstC), 'all of b goes back right before c');
  assert.deepEqual(removedLines(after, after), []);
});

// Scaling (Refactor.106 H): the 248-node graph of the scaling benchmark (tests/browser/benchmark_scaling.cjs fixture(), copied here, not
// imported). Laying it out gives the same text as before the bottom-up lengths (line count and hash taken from the old layJson), and
// quickly. 規模（R.106 H）：量測腳本的 248 節點圖（照抄 benchmark_scaling.cjs 的 fixture()，不 import）。排出來的文字和改成由下往上算長度
// 之前一樣（行數與雜湊取自舊的 layJson），而且很快。
const crypto = require('node:crypto');
const CLUSTER = ['n14ad3a26b739', 'nd9052a8cfd8c', 'ndacfca70715a4188b4654c397a55c38a', 'ndf1a0d36e8bb43e78c2399e136288865',
  'nc75a3b96a9654918bff5ef13479a7c14', 'n722439006d09', 'nedfb0f9e6dd5', 'n718d19ab3cc3', 'ne852d6bf9732'];
function fixture() {
  const graph = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/scaling_base_graph.json'), 'utf8'));
  const pixel = graph.stages.pixel, byId = new Map(pixel.nodes.map(n => [n.id, n])), inside = new Set(CLUSTER);
  const inner = pixel.edges.filter(e => inside.has(e.from[0]) && inside.has(e.to[0]));
  const idOf = (base, k) => 'n' + crypto.createHash('md5').update(base + ':' + k).digest('hex');
  for (let k = 1; k <= 24; k++) {
    for (const id of CLUSTER) {
      const n = JSON.parse(JSON.stringify(byId.get(id)));
      n.id = idOf(id, k); n.name = (n.name ?? 'Node') + '_c' + k; n.ui.x += k * 48; n.ui.y += 2400 + k * 48;
      pixel.nodes.push(n);
    }
    for (const e of inner) pixel.edges.push({ id: 'e' + crypto.createHash('md5').update(e.id + ':' + k).digest('hex'),
      from: [idOf(e.from[0], k), e.from[1]], to: [idOf(e.to[0], k), e.to[1]] });
  }
  return graph;
}

test('a 248-node graph lays out as before, in well under a second (Refactor.106 H)', () => {
  const graph = fixture();
  assert.equal(graph.stages.pixel.nodes.length, 248);
  const started = performance.now(), lines = layJson(graph), took = performance.now() - started;
  assert.equal(lines.length, 4703);
  assert.equal(crypto.createHash('sha256').update(lines.map(line => line.text).join('\n')).digest('hex'),
    '967c39ebfe9ecedc1c64332d91bb5f659d471fe5888d2e3bfb2614456fe14d71');
  assert.ok(took < 500, 'laid out in ' + took.toFixed(0) + 'ms');
});

// A line re-draws only when it changed (Refactor.106 H): the lines of an edit that are the same keep their objects, and each owner's
// lines are found by id. 一行只在改到時重畫：修改後相同的行沿用原本的物件，每個所屬的行照 id 找得到。
test('the same lines keep their objects; lines by owner', () => {
  const before = layJson(graph(node('a', 1), node('b', 2), node('c', 3)));
  const after = keepSameLines(before, layJson(graph(node('a', 1), node('b', 9), node('c', 3))));
  const fresh = after.filter((line, index) => !before.includes(line)).map(line => line.text.trim());
  assert.deepEqual(fresh, ['"ui": { "x": 9, "y": 2 },']);
  assert.equal(formatJson(graph(node('a', 1), node('b', 9), node('c', 3))), after.map(line => line.text).join('\n'));
  const owners = linesByOwner(after);
  assert.deepEqual(owners.node.get('b'), after.flatMap((line, index) => line.node === 'b' ? [index] : []));
  assert.deepEqual(owners.edge.get('e1').map(index => after[index].edge), owners.edge.get('e1').map(() => 'e1'));
  assert.equal(owners.declaration.size, 0);
});
