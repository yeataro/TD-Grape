// Core configuration (src/core-ts/config.ts): one number, many checks; tests pass their own values.
// 核心設定：一個數字、多個檢查點；測試傳自己的值，不改設定檔。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const producer = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'src/generated/wire_planning.js'), 'utf8'), producer);
const { GrapeGraph: G, GrapeTopCompiler: C } = producer;
const bootstrap = JSON.parse(fs.readFileSync(path.join(root, 'src/generated/editor-bootstrap.json')));
const clone = value => JSON.parse(JSON.stringify(value));

test('a compiler created with its own configuration enforces it; the default one is unaffected', () => {
  const graph = clone(bootstrap.defaultDocument.graph);
  for (let i = 0; i < 4; i++) graph.stages.pixel.nodes.push({ id: 'f' + i, nodeType: 'sgrape.builtin.float',
    params: clone(G.registry.get('sgrape.builtin.float').catalog.definition.defaults), ui: { x: 0, y: 0 } });
  const config = { nodesPerNetwork: 4, edgesPerNetwork: 16, expandedNodes: 32, expandedEdges: 128, documentBytes: 512000, subgraphDefinitions: 64 };
  const small = G.createCompiler(G.registry, config);
  assert.equal(small.supports(graph), false, 'over the injected node limit');
  assert.throws(() => small.compile(graph, bootstrap.typeContract.glslCode), /outside the selected frontend compiler capability/);
  assert.equal(C.supports(graph), true, 'the default compiler keeps the default limits');
});

test('no core module repeats a limit number outside config.ts', () => {
  for (const file of ['top_compiler.ts', 'subgraph_compiler.ts', 'subgraph_operations.ts']) {
    const source = fs.readFileSync(path.join(root, 'src/core-ts', file), 'utf8');
    assert.doesNotMatch(source, /\b(256|1024|2048|8192|512000)\b|(?:>|>=)\s*64\b/, file);
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
