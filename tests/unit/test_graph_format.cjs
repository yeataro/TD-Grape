// Graph format rules (design-interview Q44): format identification, unknown data survives,
// and the developer conversion follows the old -> new mapping table (docs/architecture/GRAPH_FORMAT.md).
// 圖格式規則：格式識別、未知資料保留、開發用轉換工具照對照表。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { GraphDocument, registry, formatProblem, values } = require('../../src/generated/wire_planning.js');
const { convertOldGraph } = require('../../tools/dev/old_graph.cjs');
const root = path.resolve(__dirname, '../..');
const bootstrap = JSON.parse(fs.readFileSync(path.join(root, 'src/generated/editor-bootstrap.json')));
const plain = value => JSON.parse(JSON.stringify(value));
const fresh = () => plain(bootstrap.defaultDocument.graph);

test('the default graph is a current grape-graph; foreign, newer and malformed documents are named', () => {
  const graph = fresh();
  assert.equal(graph.format, 'grape-graph'); assert.equal(graph.version, 1); assert.equal(formatProblem(graph), null);
  assert.equal(formatProblem({ ...graph, format: undefined, schemaVersion: 1 }).code, 'not-grape-graph');
  assert.equal(formatProblem({ ...graph, version: 2 }).code, 'newer-version');
  const missingId = fresh(); delete missingId.stages.pixel.edges[0].id;
  assert.equal(formatProblem(missingId).code, 'invalid');
  const oldNode = fresh(); oldNode.stages.pixel.nodes[0] = { ...oldNode.stages.pixel.nodes[0], nodeType: undefined, definitionUuid: 'sgrape.builtin.color' };
  assert.equal(formatProblem(oldNode).code, 'invalid');
});

test('unknown fields and extensions are kept as authored through edits (Ghost rule)', () => {
  const graph = fresh();
  graph.extensions = { 'acme.tools': { mood: 'blue' } }; graph.futureField = [1, 2];
  graph.stages.pixel.nodes[0].extensions = { 'acme.tools': { pinned: true } };
  graph.stages.pixel.nodes[0].laterField = 'kept';
  graph.stages.pixel.edges[0].ui = { style: 'link' };
  const step = new GraphDocument(graph, registry).change(g => g.networks.get('pixel').node('color').update({ comment: 'tint' }));
  assert.deepEqual(plain(step.after.extensions), { 'acme.tools': { mood: 'blue' } });
  assert.deepEqual(plain(step.after.futureField), [1, 2]);
  const node = step.after.stages.pixel.nodes.find(n => n.id === 'color');
  assert.deepEqual(plain(node.extensions), { 'acme.tools': { pinned: true } });
  assert.equal(node.laterField, 'kept'); assert.equal(node.comment, 'tint');
  assert.deepEqual(plain(step.after.stages.pixel.edges[0].ui), { style: 'link' });
});

test('new connections get random ids and no sequence field is written', () => {
  const graph = fresh();
  graph.stages.pixel.nodes.push({ id: 'f', nodeType: 'sgrape.builtin.float', params: { value: 1 }, ui: { x: 0, y: 0 } });
  const step = new GraphDocument(graph, registry).change(g => {
    const n = g.networks.get('pixel');
    n.connect(n.node('f').outputs[0], n.node('pixel_out').port('input', 'color'), values.policy);
  });
  const edge = step.after.stages.pixel.edges[0];
  assert.match(edge.id, /^e[0-9a-f]{32}$/);
  assert.equal('edgeSequence' in step.after.stages.pixel, false);
});

test('conversion follows the mapping table', () => {
  const old = {
    schemaVersion: 1, target: 'top', declarations: [{ id: 'u', kind: 'uniform', name: 'uA', type: 'float', value: 0, sourceMissing: true, nativeSequence: 'vec' }],
    functions: [{ id: 'g', name: 'G', scope: 'library', source: { id: 'lib', version: 'v1' }, stages: ['pixel'], inputs: [], outputs: [], graph: { nodes: [], edges: [] } }],
    typeDefinitions: [{ id: 'shape' }], topInputs: [],
    stages: { pixel: { edgeSequence: 3, nodes: [
      { id: 'a', definitionUuid: 'sgrape.builtin.float', revisionHash: 'abc', name: 'Gain', params: {}, ui: { x: 1, y: 2, label: 'Gain', comment: 'note' } },
      { id: 'b', definitionUuid: 'sgrape.builtin.vector_split', params: {}, ui: { typeMode: 'locked', componentNames: 'xyzw', label: 'Other' } },
      { id: 'c', definitionUuid: 'sgrape.builtin.vector_split', params: {}, ui: { typeMode: 'auto' } }],
      edges: [{ id: 'edge_2', from: ['a', 'out'], to: ['b', 'value'] }, { from: ['a', 'out'], to: ['c', 'value'], ui: { style: 'link' } }] } } };
  const { graph, pending } = convertOldGraph(old);
  assert.equal(formatProblem(graph), null);
  assert.deepEqual(Object.keys(graph).slice(0, 2), ['format', 'version']);
  assert.equal('schemaVersion' in graph || 'functions' in graph || 'typeDefinitions' in graph || 'topInputs' in graph, false);
  assert.deepEqual(graph.structDefinitions, [{ id: 'shape' }]);
  assert.deepEqual(graph.subgraphs[0].origin, { id: 'lib', version: 'v1' }); assert.equal('source' in graph.subgraphs[0], false);
  assert.deepEqual(graph.declarations[0], { id: 'u', kind: 'uniform', name: 'uA', type: 'float', value: 0 });
  const [a, b, c] = graph.stages.pixel.nodes;
  assert.deepEqual(a, { id: 'a', nodeType: 'sgrape.builtin.float', name: 'Gain', params: {}, ui: { x: 1, y: 2 }, comment: 'note' });
  assert.deepEqual(b.ui, { componentNames: 'xyzw' }); assert.equal(b.comment, 'Other');
  assert.equal(c.ui.typeMode, 'auto'); assert.ok(pending.some(p => p.includes('typeMode')));
  assert.equal('edgeSequence' in graph.stages.pixel, false);
  assert.equal(graph.stages.pixel.edges[0].id, 'edge_2'); assert.match(graph.stages.pixel.edges[1].id, /^e[0-9a-f]{32}$/);
  assert.deepEqual(graph.stages.pixel.edges[1].ui, { style: 'link' });
  assert.throws(() => convertOldGraph({ ...old, topInputs: [{ id: 't' }] }), /texture-input round/);
  assert.throws(() => convertOldGraph(graph), /Not an old/);
});
