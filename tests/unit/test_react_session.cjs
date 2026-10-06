const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const producer = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'src/editor/wire_planning.js'), 'utf8'), producer);
global.GrapeGraph = producer.GrapeGraph; global.GrapeTopCompiler = producer.GrapeTopCompiler;
// Load the actual typed application, not a test reimplementation or a renderer mock.
// 測試真正 session／projection；只替換 HTTP 回覆，不複製交易與產碼邏輯。
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => name.startsWith('.')
    ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name), module, module.exports);
  return module.exports;
}
const { EditorSession } = load(path.join(root, 'src/editor-react/session.ts'));
const { HostClient } = load(path.join(root, 'src/editor-react/host.ts'));
const { needsHandleUpdate } = load(path.join(root, 'src/editor-react/geometry.ts'));
const bootstrap = JSON.parse(fs.readFileSync(path.join(root, 'src/editor/editor-bootstrap.json')));
const clone = value => JSON.parse(JSON.stringify(value));
const target = '1'.repeat(32);
const makeNode = (id, key) => ({ id, definitionUuid: 'sgrape.builtin.' + key,
  params: clone(GrapeGraph.registry.get('sgrape.builtin.' + key).catalog.definition.defaults), ui: { x: 10, y: 10 } });
function fixture() {
  const graph = clone(bootstrap.defaultDocument.graph);
  graph.stages.pixel.nodes.push(makeNode('a', 'float'), makeNode('b', 'float'), makeNode('sum', 'add'), makeNode('idle', 'float'));
  graph.privateMetadata = { keep: 'roundtrip' };
  return graph;
}
function open(t, request) {
  let remote = { graph: fixture(), revision: 4, targetId: target };
  const calls = [];
  const loaded = () => ({ state: clone(remote), shaderKind: 'top', target: '/test/family',
    frontendCompiler: { protocol: GrapeTopCompiler.protocol, catalogHash: bootstrap.catalogHash, required: true } });
  const fetcher = async (url, options) => {
    const action = url.split('/').at(-1), body = options.body && JSON.parse(options.body);
    calls.push({ action, body });
    const result = request ? await request(action, body, { get: loaded, set: state => { remote = state; } }) :
      action === 'state' ? loaded() : action === 'save' ? { saved: 'test.toe' } :
      { state: (remote = { graph: body.graph, revision: body.revision + 1, targetId: target }) };
    return new Response(JSON.stringify(result));
  };
  const session = new EditorSession(new HostClient(target, '', fetcher), bootstrap, loaded(), 60000);
  t.after(() => session.dispose());
  return { session, calls, loaded };
}
const setValue = (net, id, value) => {
  const node = net.node(id), command = node.definition.presentation(node.data, net.context).value.valueCommand;
  node.edit(command, { value });
};
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('one real transaction publishes one aggregate; untouched nodes/data/edges retain identity', t => {
  const { session } = open(t), before = session.snapshot();
  const seen = []; session.subscribe(() => seen.push(session.snapshot()));
  session.transact('batch', net => {
    setValue(net, 'a', 2); setValue(net, 'b', 3);
    net.connect(net.node('a').outputs[0], net.node('sum').port('input', 'a'), GrapeGraph.values.policy);
    net.connect(net.node('b').outputs[0], net.node('sum').port('input', 'b'), GrapeGraph.values.policy);
  });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].projection.edges.length, before.projection.edges.length + 2);
  assert.equal(seen[0].projection.nodes.find(n => n.id === 'sum').data.connected.length, 2);
  for (const id of ['idle', 'color', 'pixel_out']) {
    const previous = before.projection.nodes.find(n => n.id === id), current = seen[0].projection.nodes.find(n => n.id === id);
    assert.equal(current, previous); assert.equal(current.data, previous.data);
  }
  assert.equal(seen[0].projection.edges[0], before.projection.edges[0]);
});

test('bulk delete and history each publish once, without dangling intermediate endpoints', t => {
  const { session } = open(t);
  const before = clone(session.graph());
  let calls = 0; session.subscribe(() => {
    calls++;
    const view = session.snapshot().projection, ids = new Set(view.nodes.map(n => n.id));
    assert.ok(view.edges.every(e => ids.has(e.source) && ids.has(e.target)));
  });
  session.remove({ nodes: session.snapshot().projection.nodes.filter(n => ['color', 'a'].includes(n.id)), edges: [] });
  assert.equal(calls, 1);
  session.history(false); assert.equal(calls, 2); assert.deepEqual(clone(session.graph()), before);
  session.history(true); assert.equal(calls, 3); assert.equal(session.graph().stages.pixel.edges.length, 0);
});

test('no-op and failed candidate never publish a new document projection or consume redo', t => {
  const { session } = open(t);
  session.transact('change', net => setValue(net, 'a', 6)); session.history(false);
  const before = session.snapshot(), graph = clone(session.graph()); let changed = 0;
  session.subscribe(() => { if (session.snapshot().projection !== before.projection) changed++; });
  session.transact('noop', () => {});
  session.transact('fail', net => {
    setValue(net, 'a', 99);
    net.connect(net.node('sum').outputs[0], net.node('sum').inputs[0], GrapeGraph.values.policy);
  });
  assert.equal(changed, 0); assert.equal(session.snapshot().redo, true);
  assert.deepEqual(clone(session.graph()), graph);
});

test('RF selection, measurement and dragging never enter serialization or write per frame', t => {
  const { session, calls } = open(t), before = clone(session.graph());
  const data = session.snapshot().projection.nodes.find(n => n.id === 'a').data;
  session.nodeChanges([{ type: 'select', id: 'a', selected: true }, { type: 'dimensions', id: 'a', dimensions: { width: 250, height: 90 } },
    { type: 'position', id: 'a', position: { x: 55, y: 60 }, dragging: true }]);
  assert.deepEqual(clone(session.graph()), before); assert.equal(calls.length, 0);
  session.nodeChanges([{ type: 'position', id: 'a', position: { x: 60, y: 60 }, dragging: false }]);
  assert.equal(session.snapshot().version, 1);
  assert.equal(session.snapshot().projection.nodes.find(n => n.id === 'a').data, data);
  assert.equal(session.graph().stages.pixel.nodes.find(n => n.id === 'a').ui.x, 60);
  assert.ok(!JSON.stringify(session.graph()).includes('measured'));
});

test('late apply acknowledges its snapshot then sends latest edits, never overwriting local state', async t => {
  const gate = deferred(); let count = 0;
  const { session, calls } = open(t, async (action, body, remote) => {
    if (action === 'state') return remote.get();
    if (++count === 1) await gate.promise;
    const state = { graph: body.graph, revision: body.revision + 1, targetId: target }; remote.set(state); return { state };
  });
  session.transact('first', net => setValue(net, 'a', 2));
  const pending = session.flush();
  session.transact('second', net => setValue(net, 'a', 8));
  gate.resolve(); await pending;
  assert.equal(calls.length, 2); assert.equal(calls[1].body.revision, 5);
  assert.equal(session.graph().stages.pixel.nodes.find(n => n.id === 'a').params.value, 8);
  assert.equal(session.snapshot().dirty, false);
  for (const { body } of calls) {
    assert.deepEqual(JSON.parse(body.frontendArtifact.snapshot), body.graph);
    assert.deepEqual(clone(GrapeTopCompiler.compile(body.graph, bootstrap.typeContract.glslCode)), body.frontendArtifact.compiled);
    assert.equal(body.frontendArtifact.catalogHash, bootstrap.catalogHash);
  }
});

test('undo during apply is delivered after the acknowledgement and keeps graph metadata', async t => {
  const gate = deferred(); let count = 0;
  const { session, calls } = open(t, async (_action, body) => {
    if (++count === 1) await gate.promise;
    return { state: { graph: body.graph, revision: body.revision + 1 } };
  });
  const before = clone(session.graph()); session.transact('edit', net => setValue(net, 'a', 20));
  const pending = session.flush(); session.history(false); gate.resolve(); await pending;
  assert.equal(calls.length, 2); assert.deepEqual(clone(session.graph()), before);
  assert.equal(session.snapshot().dirty, false); assert.equal(session.snapshot().redo, true);
});

test('lost response blocks replay; read-only check can confirm the previously accepted snapshot', async t => {
  const { session, calls } = open(t, async (action, body, remote) => {
    if (action === 'state') return remote.get();
    remote.set({ graph: body.graph, revision: body.revision + 1, targetId: target });
    throw Error('response lost');
  });
  session.transact('edit', net => setValue(net, 'a', 7)); await session.flush();
  assert.equal(session.snapshot().phase, 'uncertain'); assert.equal(session.snapshot().dirty, true);
  await session.flush(); assert.equal(calls.length, 1);
  await session.check(); assert.equal(calls.length, 2); assert.equal(calls[1].action, 'state');
  assert.equal(session.snapshot().dirty, false); assert.equal(session.snapshot().revision, 5);
});

test('external conflicting state is never adopted over the local document', async t => {
  const { session } = open(t, async (action, body, remote) => {
    if (action === 'state') { const next = remote.get(); next.state.revision += 3; return next; }
    throw Error('disconnect');
  });
  session.transact('edit', net => setValue(net, 'a', 9)); await session.flush();
  const before = clone(session.graph()); await session.check();
  assert.equal(session.snapshot().phase, 'conflict'); assert.deepEqual(clone(session.graph()), before);
});

test('invalid shader stays editable and does not write or save TD', async t => {
  const { session, calls } = open(t);
  session.remove({ nodes: session.snapshot().projection.nodes.filter(n => n.id === 'pixel_out'), edges: [] });
  await session.save(); assert.equal(calls.length, 0); assert.equal(session.snapshot().dirty, true);
  session.history(false); await session.flush(); assert.equal(session.snapshot().dirty, false);
});

test('wrong producer and out-of-slice graphs reject without changing the host', t => {
  const { session, calls, loaded } = open(t), state = loaded();
  state.frontendCompiler.catalogHash = 'other';
  assert.throws(() => new EditorSession(session.host, bootstrap, state), /版本不一致/);
  const unsupported = loaded(); unsupported.state.graph.functions = [{ id: 'unknown' }];
  assert.throws(() => new EditorSession(session.host, bootstrap, unsupported), /常數 TOP[\s\S]*子圖 1 個/);
  // Leftover Uniform from the legacy entry: the message names both the declaration and the node.
  const uniform = loaded(), pixel = uniform.state.graph.stages.pixel;
  uniform.state.graph.declarations = [{ id: 'u1', kind: 'uniform', name: 'uValue', type: 'float', value: 0 }];
  pixel.nodes = [...pixel.nodes, { id: 'nu', definitionUuid: 'sgrape.builtin.uniform', params: { declarationId: 'u1' } }];
  assert.throws(() => new EditorSession(session.host, bootstrap, uniform), /Uniform 宣告「uValue」[\s\S]*uniform 節點（nu）/);
  assert.equal(calls.length, 0);
});

test('explicit geometry notification is limited to internal handle changes; size is RF-owned', () => {
  const before = { width: 250, height: 180, handles: [{ id: 'source:a', x: 250, y: 70, width: 10, height: 10 }] };
  assert.equal(needsHandleUpdate(undefined, before), false);
  assert.equal(needsHandleUpdate(before, clone(before)), false);
  assert.equal(needsHandleUpdate(before, { ...before, height: 220 }), false);
  assert.equal(needsHandleUpdate(before, { ...before, handles: [{ id: 'source:a', x: 250, y: 80 }] }), true);
  assert.equal(needsHandleUpdate(before, { ...before, handles: [] }), true);
  assert.equal(needsHandleUpdate(before, { ...before, handles: [{ ...before.handles[0], width: 14 }] }), true);
});

test('value change over 101 wires preserves every unrelated card and wire; record separated costs', t => {
  const { session } = open(t);
  const graph = { schemaVersion: 1, target: 'top', declarations: [], functions: [], stages: { pixel: { nodes: [], edges: [] } } };
  const net = graph.stages.pixel;
  net.nodes.push({ ...makeNode('start', 'float'), ui: { x: 0, y: 0 } });
  for (let i = 0; i < 100; i++) {
    net.nodes.push({ ...makeNode('sum_' + i, 'add'), ui: { x: (i % 10 + 1) * 270, y: Math.floor(i / 10) * 220 } });
    net.edges.push({ id: 'e' + i, from: [i ? 'sum_' + (i - 1) : 'start', 'out'], to: ['sum_' + i, 'a'] });
  }
  net.nodes.push({ ...makeNode('output', 'pixel_out'), ui: { x: 3000, y: 1980 } });
  net.edges.push({ id: 'e100', from: ['sum_99', 'out'], to: ['output', 'color'] });
  session.restoreDraft(graph);
  const rows = [], projectionModule = load(path.join(root, 'src/editor-react/projection.ts'));
  const project = projectionModule.project, change = GrapeGraph.GraphDocument.prototype.change;
  let coreMs = 0, projectionMs = 0;
  projectionModule.project = (...args) => { const t = performance.now(); const result = project(...args); projectionMs = performance.now() - t; return result; };
  GrapeGraph.GraphDocument.prototype.change = function (...args) { const t = performance.now(); const result = change.apply(this, args); coreMs = performance.now() - t; return result; };
  try {
    for (let i = 0; i < 35; i++) {
      const before = session.snapshot().projection;
      const begin = performance.now(); session.transact('benchmark', net => setValue(net, 'start', i + .5)); const totalMs = performance.now() - begin;
      const after = session.snapshot().projection;
      assert.equal(after.edges, before.edges);
      assert.ok(after.nodes.slice(1).every((node, index) => node === before.nodes[index + 1]));
      const start = performance.now(); GrapeTopCompiler.compile(session.graph(), bootstrap.typeContract.glslCode); const compileMs = performance.now() - start;
      if (i >= 5) rows.push({ totalMs, coreMs, projectionMs, compileMs });
    }
  } finally { projectionModule.project = project; GrapeGraph.GraphDocument.prototype.change = change; }
  if (process.env.REACT_PERF_REPORT) fs.writeFileSync(process.env.REACT_PERF_REPORT, JSON.stringify({ nodes: 102, edges: 101, graph, rows }, null, 2));
  const p95 = key => rows.map(row => row[key]).sort((a, b) => a - b)[28];
  t.diagnostic(JSON.stringify({ p95: Object.fromEntries(['totalMs', 'coreMs', 'projectionMs', 'compileMs'].map(key => [key, p95(key)])) }));
});

test('zero-distance drag still publishes runtime completion but records no document transaction', t => {
  const { session } = open(t); let publishes = 0; session.subscribe(() => publishes++);
  session.nodeChanges([{ type: 'position', id: 'a', position: { x: 10, y: 10 }, dragging: false }]);
  assert.equal(publishes, 1); assert.equal(session.snapshot().version, 0); assert.equal(session.snapshot().undo, false);
});

test('invalid restored draft remains rejected without replacing the current document', t => {
  const { session } = open(t), before = clone(session.graph()), graph = clone(before);
  graph.declarations.push({ id: 'u', kind: 'uniform', name: 'u', type: 'float', value: 1 });
  assert.equal(session.restoreDraft(graph), false); assert.deepEqual(clone(session.graph()), before);
});


test('a false save response never claims the TD project was saved', async t => {
  const { session } = open(t, async () => ({ saved: false }));
  await session.save(); assert.match(session.snapshot().message, /未確認專案保存成功/);
});
