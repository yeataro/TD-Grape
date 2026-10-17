// Core configuration (src/core-ts/config.ts): one number, many checks; tests pass their own values.
// 核心設定：一個數字、多個檢查點；測試傳自己的值，不改設定檔。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const producer = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'src/generated/grape_core.js'), 'utf8'), producer);
const { GrapeGraph: G, GrapeTopCompiler: C } = producer;
const bootstrap = JSON.parse(fs.readFileSync(path.join(root, 'src/generated/editor-bootstrap.json')));
const clone = value => JSON.parse(JSON.stringify(value));

test('a compiler created with its own configuration enforces it; the default one is unaffected', () => {
  const graph = clone(bootstrap.defaultDocument.graph);
  for (let i = 0; i < 4; i++) graph.stages.pixel.nodes.push({ id: 'f' + i, nodeType: 'sgrape.builtin.float',
    params: clone(G.registry.get('sgrape.builtin.float').catalog.definition.defaults), ui: { x: 0, y: 0 } });
  const config = { nodesPerNetwork: 4, edgesPerNetwork: 16, expandedNodes: 32, expandedEdges: 128, documentBytes: 512000, subgraphPortsPerSide: 16 };
  const small = G.createCompiler(G.registry, config);
  assert.equal(small.supports(graph), false, 'over the injected node limit');
  assert.throws(() => small.compile(graph, bootstrap.typeContract.glslCode), /outside the selected frontend compiler capability/);
  assert.equal(C.supports(graph), true, 'the default compiler keeps the default limits');
});

test('no core module repeats a limit number outside config.ts', () => {
  for (const file of ['top_compiler.ts', 'subgraph_compiler.ts', 'subgraph_operations.ts', 'subgraph_interface.ts', 'subgraphs.ts']) {
    const source = fs.readFileSync(path.join(root, 'src/core-ts', file), 'utf8');
    assert.doesNotMatch(source, /\b(256|1024|2048|8192|512000)\b|(?:>|>=)\s*(64|16)\b/, file);
  }
});

// Editing-time limit (capacity.ts): one gate at the end of every change; opening never refuses.
// 編輯時的上限：每次修改結束時的唯一關卡；開圖不擋，只擋變大。
const withFloats = count => {
  const graph = clone(bootstrap.defaultDocument.graph);
  for (let i = 0; i < count; i++) graph.stages.pixel.nodes.push({ id: 'f' + i, nodeType: 'sgrape.builtin.float',
    params: clone(G.registry.get('sgrape.builtin.float').catalog.definition.defaults), ui: { x: 0, y: 0 } });
  return graph;
};
const addFloat = (doc, id) => doc.change(c => c.networks.get('pixel').insert({ id, nodeType: 'sgrape.builtin.float', params: {}, ui: { x: 0, y: 0 } }));

test('an edit that grows a network past the limit is refused as a whole', () => {
  const doc = new G.GraphDocument(withFloats(256 - 2), G.registry); // default graph has 2 nodes: exactly at 256
  assert.equal(G.overLimit(doc.document, G.registry).length, 0);
  assert.throws(() => addFloat(doc, 'extra'), error => error.name === 'CapacityError' &&
    error.measures.some(m => m.key === 'nodesPerNetwork' && m.value === 257 && m.limit === 256));
  assert.equal(doc.document.stages.pixel.nodes.length, 256, 'document unchanged');
});

test('an over-limit graph still opens; shrinking is allowed, growing is not', () => {
  const doc = new G.GraphDocument(withFloats(300), G.registry);
  assert.ok(G.overLimit(doc.document, G.registry).some(m => m.key === 'nodesPerNetwork' && m.value === 302));
  const smaller = doc.change(c => { const net = c.networks.get('pixel'); net.removeAll([net.node('f0')]); });
  assert.equal(smaller.after.stages.pixel.nodes.length, 301);
  assert.throws(() => addFloat(doc, 'more'), error => error.name === 'CapacityError');
});

// No count of subgraph definitions (amendment 3 C9, Refactor.120): 65 are created, copied, pasted and compiled like any other number.
// 不限子圖定義份數：65 份照樣建立、複製、貼上、產碼。
test('65 subgraph definitions are created, copied, pasted and compiled', () => {
  const graph = clone(bootstrap.defaultDocument.graph);
  const made = new G.GraphDocument(graph, G.registry).change(c => {
    for (let i = 0; i < 65; i++) { c.createSubgraph({ id: 's' + i, title: 'S' + i }); c.networks.get('pixel').instantiateSubgraph('s' + i, 'i' + i, { x: i, y: 0 }); }
  }).after;
  assert.equal(made.subgraphs.length, 65);
  assert.equal(C.supports(made), true);
  assert.ok(C.compile(made, bootstrap.typeContract.glslCode).pixel.length > 0);
  const clip = clone(G.copyNodes(new G.GraphDocument(made, G.registry), made.stages.pixel.nodes.filter(n => n.id.startsWith('i')).map(n => n.id), 'other'));
  let n = 0;
  const pasted = new G.GraphDocument(clone(bootstrap.defaultDocument.graph), G.registry)
    .change(c => G.pasteClip(c, clip, { x: 0, y: 0 }, () => 'p' + ++n, () => 'g', 'pixel', () => 'd' + ++n, false)).after;
  assert.equal(pasted.subgraphs.length, 65);
});

// The graph text's size (Codex A3-3): measured as the host receives it, in UTF-8 bytes, at the end of every change, before
// anything is published. 圖文字的大小：照宿主收到的 UTF-8 位元組量，每次修改結束、發布之前檢查。
const commented = (graph, text) => { graph.stages.pixel.nodes.push({ id: 'note', nodeType: 'sgrape.builtin.float',
  params: clone(G.registry.get('sgrape.builtin.float').catalog.definition.defaults), ui: { x: 0, y: 0 }, comment: text }); return graph; };
test('an edit that makes the graph text larger than the host takes is refused, counted in UTF-8 bytes', () => {
  // 180,000 CJK characters are 540,000 bytes though only 180,000 characters. 18 萬個中文字是 54 萬位元組，雖然只有 18 萬個字元。
  const doc = new G.GraphDocument(clone(bootstrap.defaultDocument.graph), G.registry), was = clone(doc.snapshot());
  assert.throws(() => doc.change(c => c.networks.get('pixel').insert({ id: 'note', nodeType: 'sgrape.builtin.float',
    params: {}, ui: { x: 0, y: 0 }, comment: '中'.repeat(180000) })), e => e.name === 'CapacityError' && e.measures.some(m => m.key === 'documentBytes'));
  assert.deepEqual(clone(doc.snapshot()), was, 'nothing is published');
  // ASCII just over and just under the limit. ASCII 剛好超過與剛好不到。
  const base = G.documentBytes(clone(bootstrap.defaultDocument.graph));
  const under = commented(clone(bootstrap.defaultDocument.graph), ''), sizeWith = text => G.documentBytes(commented(clone(bootstrap.defaultDocument.graph), text));
  const room = 512000 - sizeWith('');
  assert.ok(base < 512000 && room > 0 && under);
  const insert = text => new G.GraphDocument(clone(bootstrap.defaultDocument.graph), G.registry).change(c => c.networks.get('pixel').insert({ id: 'note',
    nodeType: 'sgrape.builtin.float', params: clone(G.registry.get('sgrape.builtin.float').catalog.definition.defaults), ui: { x: 0, y: 0 }, comment: text }));
  assert.equal(G.documentBytes(insert('x'.repeat(room)).after), 512000, 'exactly at the limit passes');
  assert.throws(() => insert('x'.repeat(room + 1)), e => e.name === 'CapacityError');
});

test('a graph already over the byte limit opens, stays editable, and may shrink; it may not grow', () => {
  const big = commented(clone(bootstrap.defaultDocument.graph), 'x'.repeat(520000));
  assert.ok(G.overLimit(big, G.registry).some(m => m.key === 'documentBytes'), 'reported when opened');
  const doc = new G.GraphDocument(big, G.registry);
  const smaller = doc.change(c => c.networks.get('pixel').node('note').update({ comment: 'x'.repeat(510000) })).after;
  assert.ok(G.documentBytes(smaller) < G.documentBytes(big));
  assert.throws(() => doc.change(c => c.networks.get('pixel').node('note').update({ comment: 'x'.repeat(530000) })), e => e.name === 'CapacityError');
});
