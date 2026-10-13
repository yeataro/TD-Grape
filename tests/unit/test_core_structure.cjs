// Structure rules (src/core-ts/structure.ts, design-interview Q42): a stage output such as Color
// Output is exactly one at each stage's top level, never in a subgraph, never deleted or offered.
// 結構規則：Color Output 每個 stage 最外層剛好一個、子圖內不准有、不能刪、不在新增選單。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const producer = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'src/generated/grape_core.js'), 'utf8'), producer);
const { GrapeGraph: G } = producer;
const bootstrap = JSON.parse(fs.readFileSync(path.join(root, 'src/generated/editor-bootstrap.json')));
const clone = value => JSON.parse(JSON.stringify(value));
const OUT = 'sgrape.builtin.pixel_out';
const outputNode = id => ({ id, nodeType: OUT, params: {}, ui: { x: 0, y: 0 } });
const outputs = graph => graph.stages.pixel.nodes.filter(n => n.nodeType === OUT).length;
const open = graph => new G.GraphDocument(graph || clone(bootstrap.defaultDocument.graph), G.registry);
const pixel = c => c.networks.get('pixel');
const refused = (doc, edit, pattern) => {
  const before = clone(doc.snapshot());
  assert.throws(() => doc.change(edit), error => error.name === 'StructureError' && pattern.test(error.message));
  assert.deepEqual(clone(doc.snapshot()), before, 'a refused edit leaves the document unchanged');
};

test('the default graph has exactly one Color Output and no problems', () => {
  const graph = clone(bootstrap.defaultDocument.graph);
  assert.equal(outputs(graph), 1);
  assert.deepEqual(clone(G.structureProblems(graph, G.registry)), []);
});

test('deleting the only Color Output is refused as a whole, even inside a larger edit', () => {
  const doc = open(), id = doc.snapshot().stages.pixel.nodes.find(n => n.nodeType === OUT).id;
  refused(doc, c => pixel(c).removeAll([pixel(c).node(id)]), /pixel\) 0, expected 1/);
  refused(doc, c => { pixel(c).insert({ id: 'f', nodeType: 'sgrape.builtin.float', params: {}, ui: { x: 0, y: 0 } });
    pixel(c).removeAll([pixel(c).node(id)]); }, /expected 1/);
});

test('a second Color Output is refused', () => {
  refused(open(), c => pixel(c).insert(outputNode('second')), /pixel\) 2, expected 1/);
});

test('a Color Output inside a subgraph is refused', () => {
  const graph = clone(bootstrap.defaultDocument.graph);
  graph.subgraphs = [{ id: 'g', name: 'g', graph: { nodes: [], edges: [] } }];
  const doc = open(graph);
  refused(doc, c => c.networks.get('subgraph:g').insert(outputNode('inner')), /subgraph:g\) 1, expected 0/);
});

test('a graph already off the rule still opens and can be repaired, but not made worse', () => {
  const graph = clone(bootstrap.defaultDocument.graph);
  graph.stages.pixel.nodes.push(outputNode('second'));
  assert.equal(G.structureProblems(graph, G.registry).length, 1);
  const doc = open(graph);
  refused(doc, c => pixel(c).insert(outputNode('third')), /pixel\) 3/);
  const { after } = doc.change(c => pixel(c).removeAll([pixel(c).node('second')]));
  assert.equal(outputs(after), 1);
  assert.deepEqual(clone(G.structureProblems(after, G.registry)), []);
});

test('the core never offers or allows deleting a stage output; other nodes are unaffected', () => {
  assert.equal(G.offered(G.registry.get(OUT)), false);
  assert.equal(G.removable(G.registry.get(OUT)), false);
  assert.equal(G.offered(G.registry.get('sgrape.builtin.add')), true);
  assert.equal(G.removable(G.registry.get('sgrape.builtin.add')), true);
});

// Subgraph boundaries (basic design §3.3, amendment A8 §5 item 7, Refactor.109): exactly one Subgraph Input and one Subgraph
// Output inside every subgraph, never in a stage, never deleted or offered; a definition arriving without them is refused;
// one already missing a boundary still opens and can be repaired.
// 子圖邊界節點：每個子圖各剛好一個、stage 裡不准有、不能刪、不在新增選單；沒帶邊界的定義拒絕進來；已經缺的仍能開、能修。
const IN = 'sgrape.builtin.subgraph_input', OUT_B = 'sgrape.builtin.subgraph_output';
const boundary = (id, type) => ({ id, nodeType: type, params: {}, ui: { x: 0, y: 0 } });
const withSubgraph = () => new G.GraphDocument(open().change(c => { c.createSubgraph({ id: 'sg', name: 'Sub' }); }).after, G.registry);
const inside = c => c.networks.get('subgraph:sg');

test('a new subgraph has one Input and one Output; deleting either or adding a second is refused', () => {
  const doc = withSubgraph();
  assert.deepEqual(clone(G.structureProblems(doc.snapshot(), G.registry)), []);
  refused(doc, c => inside(c).removeAll([inside(c).node('input')]), /subgraphInputs \(subgraph:sg\) 0, expected 1/);
  refused(doc, c => inside(c).removeAll([inside(c).node('output')]), /subgraphOutputs \(subgraph:sg\) 0, expected 1/);
  refused(doc, c => inside(c).insert(boundary('in2', IN)), /subgraphInputs \(subgraph:sg\) 2, expected 1/);
  refused(doc, c => inside(c).insert(boundary('out2', OUT_B)), /subgraphOutputs \(subgraph:sg\) 2, expected 1/);
});

test('a boundary in a stage is refused (its module needs an owning subgraph) and reported in data; a definition arriving without boundaries is refused', () => {
  const doc = open(), before = clone(doc.snapshot());
  assert.throws(() => doc.change(c => pixel(c).insert(boundary('b', IN))));
  assert.deepEqual(clone(doc.snapshot()), before);
  const stray = clone(before); stray.stages.pixel.nodes.push(boundary('b', OUT_B));
  assert.deepEqual(clone(G.structureProblems(stray, G.registry)), [{ key: 'subgraphOutputs', network: 'pixel', value: 1, expected: 0 }]);
  refused(withSubgraph(), c => c.appendSubgraphs([{ id: 'bare', name: 'Bare', inputs: [], outputs: [], graph: { nodes: [], edges: [] } }]), /subgraphInputs \(subgraph:bare\) 0, expected 1/);
});

test('a subgraph already missing a boundary still opens and can be repaired', () => {
  const graph = withSubgraph().snapshot();
  graph.subgraphs[0].graph.nodes = graph.subgraphs[0].graph.nodes.filter(n => n.nodeType !== OUT_B); graph.subgraphs[0].graph.edges = [];
  assert.equal(G.structureProblems(graph, G.registry).length, 1);
  const { after } = open(graph).change(c => inside(c).insert(boundary('output', OUT_B)));
  assert.deepEqual(clone(G.structureProblems(after, G.registry)), []);
});

test('boundaries are never offered or deletable', () => {
  assert.equal(G.offered(G.registry.get(IN)), false); assert.equal(G.offered(G.registry.get(OUT_B)), false);
  assert.equal(G.removable(G.registry.get(IN)), false); assert.equal(G.removable(G.registry.get(OUT_B)), false);
});
