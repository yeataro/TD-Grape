// Core configuration (src/core-ts/config.ts): one number, many checks; tests pass their own values.
// 核心設定：一個數字、多個檢查點；測試傳自己的值，不改設定檔。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const producer = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'src/editor/wire_planning.js'), 'utf8'), producer);
const { GrapeGraph: G, GrapeTopCompiler: C } = producer;
const bootstrap = JSON.parse(fs.readFileSync(path.join(root, 'src/editor/editor-bootstrap.json')));
const clone = value => JSON.parse(JSON.stringify(value));

test('a compiler created with its own configuration enforces it; the default one is unaffected', () => {
  const graph = clone(bootstrap.defaultDocument.graph);
  for (let i = 0; i < 4; i++) graph.stages.pixel.nodes.push({ id: 'f' + i, definitionUuid: 'sgrape.builtin.float',
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
