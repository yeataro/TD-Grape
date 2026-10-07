// Structure rules (src/core-ts/structure.ts, design-interview Q42): a stage output such as Color
// Output is exactly one at each stage's top level, never in a subgraph, never deleted or offered.
// 結構規則：Color Output 每個 stage 最外層剛好一個、子圖內不准有、不能刪、不在新增選單。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const producer = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'src/editor/wire_planning.js'), 'utf8'), producer);
const { GrapeGraph: G } = producer;
const bootstrap = JSON.parse(fs.readFileSync(path.join(root, 'src/editor/editor-bootstrap.json')));
const clone = value => JSON.parse(JSON.stringify(value));
const OUT = 'sgrape.builtin.pixel_out';
const outputNode = id => ({ id, definitionUuid: OUT, params: {}, ui: { x: 0, y: 0 } });
const outputs = graph => graph.stages.pixel.nodes.filter(n => n.definitionUuid === OUT).length;
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
  const doc = open(), id = doc.snapshot().stages.pixel.nodes.find(n => n.definitionUuid === OUT).id;
  refused(doc, c => pixel(c).removeAll([pixel(c).node(id)]), /pixel\) 0, expected 1/);
  refused(doc, c => { pixel(c).insert({ id: 'f', definitionUuid: 'sgrape.builtin.float', params: {}, ui: { x: 0, y: 0 } });
    pixel(c).removeAll([pixel(c).node(id)]); }, /expected 1/);
});

test('a second Color Output is refused', () => {
  refused(open(), c => pixel(c).insert(outputNode('second')), /pixel\) 2, expected 1/);
});

test('a Color Output inside a subgraph is refused', () => {
  const graph = clone(bootstrap.defaultDocument.graph);
  graph.functions = [{ id: 'g', name: 'g', graph: { nodes: [], edges: [] } }];
  const doc = open(graph);
  refused(doc, c => c.networks.get('function:g').insert(outputNode('inner')), /function:g\) 1, expected 0/);
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
