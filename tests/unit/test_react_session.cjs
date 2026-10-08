const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const producer = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'src/generated/grape_core.js'), 'utf8'), producer);
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
  new Function('require', 'module', 'exports', code)(name => name.endsWith('.json')
    ? (data => ({ default: data, ...data }))(JSON.parse(fs.readFileSync(path.resolve(path.dirname(file), name), 'utf8'))) // as the bundler gives it
    : name.startsWith('.') ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name), module, module.exports);
  return module.exports;
}
const { Editor: EditorSession, spareHandle } = load(path.join(root, 'src/editor-react/editor.ts'));
const { resetToDefault } = load(path.join(root, 'src/editor-react/host_sync.ts'));
const { UnsupportedGraphError } = load(path.join(root, 'src/editor-react/core.ts'));
const { HostClient } = load(path.join(root, 'src/editor-react/host.ts'));
const { needsHandleUpdate } = load(path.join(root, 'src/editor-react/geometry.ts'));
// Messages are data worded at display time (Q34); tests read them the way a zh-Hant page shows them.
const { localize, errorText, chooseLanguage, tr } = load(path.join(root, 'src/editor-react/text.ts'));
const zh = message => localize(message, 'zh-Hant');
const bootstrap = JSON.parse(fs.readFileSync(path.join(root, 'src/generated/editor-bootstrap.json')));
const clone = value => JSON.parse(JSON.stringify(value));
const target = '1'.repeat(32);
const makeNode = (id, key) => ({ id, nodeType: 'sgrape.builtin.' + key,
  params: clone(GrapeGraph.registry.get('sgrape.builtin.' + key).catalog.definition.defaults), ui: { x: 10, y: 10 } });
function fixture() {
  const graph = clone(bootstrap.defaultDocument.graph);
  graph.stages.pixel.nodes.push(makeNode('a', 'float'), makeNode('b', 'float'), makeNode('sum', 'add'), makeNode('idle', 'float'));
  graph.privateMetadata = { keep: 'roundtrip' };
  return graph;
}
// New-editor protocol (design-interview Q38, Q40): TD holds the document as opaque text.
const doc = state => JSON.parse(state.document);
const withDoc = (state, edit) => { const graph = doc(state); edit(graph); state.document = JSON.stringify(graph); return state; };
function open(t, request, retry = 60000, generator) {
  let remote = { document: JSON.stringify(fixture()), revision: 4, targetId: target };
  const calls = [];
  const loaded = () => ({ state: clone(remote), format: 'grape-next-1', shaderKind: 'top', target: '/test/family',
    frontendCompiler: { protocol: GrapeTopCompiler.protocol, catalogHash: bootstrap.catalogHash, required: true } });
  const fetcher = async (url, options) => {
    const action = url.split('?')[0].split('/').at(-1), body = options.body && JSON.parse(options.body);
    calls.push({ action, body });
    const result = request ? await request(action, body, { get: loaded, set: state => { remote = state; } }) :
      action === 'state' ? loaded() : action === 'save' ? { saved: 'test.toe' } : action === 'live' ? { ok: true, applied: true } :
      { state: (remote = { document: body.document, revision: body.revision + 1, targetId: target }) };
    return result instanceof Response ? result : new Response(JSON.stringify(result));
  };
  const session = new EditorSession(new HostClient(target, '', fetcher), bootstrap, loaded(), 60000, retry, generator, '9.9.9 Test');
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
    const state = { document: body.document, revision: body.revision + 1, targetId: target }; remote.set(state); return { state };
  });
  session.transact('first', net => setValue(net, 'a', 2));
  const pending = session.flush();
  session.transact('second', net => setValue(net, 'a', 8));
  gate.resolve(); await pending;
  assert.equal(calls.length, 2); assert.equal(calls[1].body.revision, 5);
  assert.equal(session.graph().stages.pixel.nodes.find(n => n.id === 'a').params.value, 8);
  assert.equal(session.snapshot().dirty, false);
  for (const { body } of calls) {
    assert.equal(body.format, 'grape-next-1');
    assert.equal(body.editorVersion, '9.9.9 Test');
    assert.deepEqual(clone(GrapeTopCompiler.compile(JSON.parse(body.document), bootstrap.typeContract.glslCode)), JSON.parse(body.runtime));
    assert.equal(body.catalogHash, bootstrap.catalogHash);
  }
});

test('undo during apply is delivered after the acknowledgement and keeps graph metadata', async t => {
  const gate = deferred(); let count = 0;
  const { session, calls } = open(t, async (_action, body) => {
    if (++count === 1) await gate.promise;
    return { state: { document: body.document, revision: body.revision + 1 } };
  });
  const before = clone(session.graph()); session.transact('edit', net => setValue(net, 'a', 20));
  const pending = session.flush(); session.history(false); gate.resolve(); await pending;
  assert.equal(calls.length, 2); assert.deepEqual(clone(session.graph()), before);
  assert.equal(session.snapshot().dirty, false); assert.equal(session.snapshot().redo, true);
});

test('lost response blocks replay; read-only check can confirm the previously accepted snapshot', async t => {
  const { session, calls } = open(t, async (action, body, remote) => {
    if (action === 'state') return remote.get();
    remote.set({ document: body.document, revision: body.revision + 1, targetId: target });
    throw Error('response lost');
  });
  session.transact('edit', net => setValue(net, 'a', 7)); await session.flush();
  // A transport failure reads as "can't reach TD", but the write may have landed: no replay.
  assert.equal(session.snapshot().phase, 'offline'); assert.equal(session.snapshot().link, 'unreachable');
  assert.equal(session.snapshot().dirty, true);
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

// Host that enforces baseRevision like host_api (409 on a stale revision).
const strictHost = beforeApply => async (action, body, remote) => {
  if (action === 'state') return remote.get();
  beforeApply?.(remote);
  if (body.revision !== remote.get().state.revision) return new Response(JSON.stringify({ error: 'Conflict: stale revision' }), { status: 409 });
  const state = { document: body.document, revision: body.revision + 1, targetId: target }; remote.set(state); return { state };
};
const otherEntryEdits = remote => {
  const { state } = remote.get(); withDoc(state, graph => { graph.stages.pixel.nodes.find(n => n.id === 'b').params.value = 5; });
  remote.set({ ...state, revision: state.revision + 1 });
};

test('migration convenience: overwrite rebases the draft on the latest TD revision only after a conflict', async t => {
  let external = true;
  const { session, calls, loaded } = open(t, strictHost(remote => { if (external) { external = false; otherEntryEdits(remote); } }));
  await session.overwrite(); assert.equal(calls.length, 0);
  session.transact('edit', net => setValue(net, 'a', 9)); await session.flush();
  assert.equal(session.snapshot().phase, 'conflict'); assert.equal(session.snapshot().dirty, true);
  const draft = clone(session.graph());
  await session.overwrite();
  assert.deepEqual(calls.map(c => c.action), ['apply', 'state', 'apply']); assert.equal(calls[2].body.revision, 5);
  assert.deepEqual(doc(loaded().state), draft); assert.equal(loaded().state.revision, 6);
  assert.equal(session.snapshot().phase, 'ready'); assert.equal(session.snapshot().dirty, false); assert.equal(session.snapshot().revision, 6);
});

test('migration convenience: an unopenable test graph can be reset to the default through normal apply', async t => {
  const { session, calls, loaded } = open(t, strictHost());
  const unsupported = loaded(); withDoc(unsupported.state, graph => graph.stages.pixel.nodes.push({ id: 'x', nodeType: 'sgrape.function.input', params: {} }));
  assert.throws(() => new EditorSession(session.host, bootstrap, unsupported), error => error instanceof UnsupportedGraphError);
  await resetToDefault(session.host, bootstrap, '9.9.9 Test');
  assert.deepEqual(calls.map(c => c.action), ['state', 'apply']); assert.equal(calls[1].body.revision, 4);
  assert.deepEqual(JSON.parse(calls[1].body.runtime), clone(GrapeTopCompiler.compile(bootstrap.defaultDocument.graph, bootstrap.typeContract.glslCode)));
  assert.deepEqual(doc(loaded().state), bootstrap.defaultDocument.graph); assert.equal(loaded().state.revision, 5);
});

test('migration convenience: reset still conflicts on a stale revision and leaves TD unchanged', async t => {
  const { session, loaded } = open(t, strictHost(otherEntryEdits));
  await assert.rejects(resetToDefault(session.host, bootstrap, '9.9.9 Test'), /Conflict/);
  assert.notDeepEqual(doc(loaded().state), bootstrap.defaultDocument.graph);
});

test('migration convenience: overwrite still conflicts if TD changes again before delivery', async t => {
  const { session, loaded } = open(t, strictHost(otherEntryEdits));
  session.transact('edit', net => setValue(net, 'a', 9)); await session.flush();
  const draft = clone(session.graph()), remote = clone(loaded().state);
  await session.overwrite();
  assert.equal(session.snapshot().phase, 'conflict'); assert.deepEqual(clone(session.graph()), draft);
  assert.notDeepEqual(doc(loaded().state), draft); assert.equal(loaded().state.revision, remote.revision + 1);
});

// Code generation failed (design-interview Q38 2-5): the document is still saved to TD so no work is
// lost; the execution part is not sent, so TD keeps running the last known good Shader.
// Code generation cannot be made to fail through the UI any more (Color Output is protected), so
// these tests give the editor a generator that fails on request. 產碼失敗改由測試傳入會失敗的產碼器模擬。
const flaky = () => { const g = { fail: false, key: graph => GrapeTopCompiler.key(graph),
  compile: (...args) => { if (g.fail) throw Error('forced failure'); return GrapeTopCompiler.compile(...args); } }; return g; };
test('failed code generation still saves the document; TD keeps the last known good Shader', async t => {
  const generator = flaky(), { session, calls } = open(t, undefined, 60000, generator);
  generator.fail = true; session.transact('value', net => setValue(net, 'a', 7));
  await session.flush();
  assert.equal(calls.length, 1); assert.equal(calls[0].body.runtime, null);
  assert.deepEqual(JSON.parse(calls[0].body.document), clone(session.graph()));
  assert.equal(session.snapshot().dirty, false); assert.match(zh(session.snapshot().message), /產碼失敗/);
  generator.fail = false; session.history(false); await session.flush();
  assert.equal(calls.length, 2); assert.notEqual(calls[1].body.runtime, null);
});

// GLSL that does not compile in TD (Refactor.34): TD still saves the graph and keeps the last good
// Shader; the editor counts the edit as delivered, says what happened, and does not resend the same
// failing program. TD 編譯失敗：圖照存、Shader 停在上次成功版；編輯器如實顯示、不重送同一個失敗的程式。
test('GLSL that fails in TD: the graph is delivered, the failing program is not resent until it changes', async t => {
  let failing = true;
  const { session, calls } = open(t, async (action, body, remote) => {
    if (action === 'state') return remote.get();
    const state = { document: body.document, revision: body.revision + 1, targetId: target }; remote.set(state);
    return { state, shaderError: body.runtime && failing ? 'ERROR: 0:12: syntax error' : null };
  });
  session.transact('value', net => setValue(net, 'a', 3)); await session.flush();
  assert.notEqual(calls.at(-1).body.runtime, null);
  assert.equal(session.snapshot().dirty, false); assert.equal(session.snapshot().revision, 5);
  // The summary is the first line (the status line shows it); TD's log follows. 摘要在第一行，TD 紀錄在後。
  assert.match(zh(session.snapshot().message), /^GLSL 在 TD 編譯失敗。圖已存到 TD[^\n]*\nERROR: 0:12: syntax error$/);
  assert.equal(session.snapshot().level, 'error');
  const failed = session.log.entries().at(-1);
  assert.deepEqual([failed.level, failed.source, failed.message.code], ['error', 'sync', 'sync.glslFailedInTd']);
  assert.doesNotMatch(zh(session.snapshot().message), /拒絕/);
  session.nodeChanges([{ type: 'position', id: 'a', position: { x: 300, y: 90 }, dragging: false }]); await session.flush();
  assert.equal(calls.at(-1).body.runtime, null, 'same failing program: graph only');
  assert.match(zh(session.snapshot().message), /先前在 TD 編譯失敗/);
  failing = false;
  session.transact('value', net => setValue(net, 'a', 4)); await session.flush();
  assert.notEqual(calls.at(-1).body.runtime, null, 'a changed program is sent again');
  assert.equal(zh(session.snapshot().message), '已套用 TD；專案尚需保存');
  session.nodeChanges([{ type: 'position', id: 'a', position: { x: 320, y: 90 }, dragging: false }]); await session.flush();
  assert.equal(calls.at(-1).body.runtime, null, 'now running: layout only again');
});

test('a host refusal names TD-Grape, not TD', async t => {
  const { session } = open(t, async action => action === 'state' ? undefined
    : new Response(JSON.stringify({ error: 'target mismatch' }), { status: 422 }));
  session.transact('value', net => setValue(net, 'a', 3)); await session.flush();
  assert.equal(session.snapshot().phase, 'error');
  assert.match(zh(session.snapshot().message), /^TD-Grape 拒絕：/);
});

test('wrong producer and out-of-slice graphs reject without changing the host', t => {
  const { session, calls, loaded } = open(t), state = loaded();
  state.frontendCompiler.catalogHash = 'other';
  assert.throws(() => new EditorSession(session.host, bootstrap, state), error => /版本不一致/.test(zh(errorText(error))));
  const unsupported = loaded(); withDoc(unsupported.state, graph => { graph.subgraphs = [{ id: 'unknown', graph: { nodes: [], edges: [] } }]; });
  assert.throws(() => new EditorSession(session.host, bootstrap, unsupported), error => /此入口目前支援[\s\S]*子圖 1 個/.test(zh(errorText(error))));
  // A known node this entry has not taken over: the message names it. 本入口還沒接管的節點：訊息指出是哪一個。
  const known = loaded(); withDoc(known.state, graph => {
    graph.stages.pixel.nodes = [...graph.stages.pixel.nodes, { id: 'nu', nodeType: 'sgrape.function.input', params: {} }];
  });
  assert.throws(() => new EditorSession(session.host, bootstrap, known), error => /function\.input 節點（nu）/.test(zh(errorText(error))));
  // Format (Q44): an old document offers the reset; a newer one never does, so nothing is written back.
  const old = loaded(); withDoc(old.state, graph => { delete graph.format; graph.schemaVersion = 1; });
  assert.throws(() => new EditorSession(session.host, bootstrap, old), error => error instanceof UnsupportedGraphError && /不是新格式/.test(zh(errorText(error))));
  const newer = loaded(); withDoc(newer.state, graph => { graph.version = 2; });
  assert.throws(() => new EditorSession(session.host, bootstrap, newer), error => !(error instanceof UnsupportedGraphError) && /較新版的 Grape/.test(zh(errorText(error))));
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
  const graph = { format:'grape-graph',version:1, target: 'top', declarations: [], subgraphs: [], stages: { pixel: { nodes: [], edges: [] } } };
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
  graph.declarations.push({ id: 'u', kind: 'uniform', name: 'u', type: 'mat3', value: 1 });
  assert.equal(session.restoreDraft(graph), false); assert.deepEqual(clone(session.graph()), before);
});


test('a false save response never claims the TD project was saved', async t => {
  const { session } = open(t, async () => ({ saved: false }));
  await session.save(); assert.match(zh(session.snapshot().message), /未確認專案保存成功/);
});

// Module-declared spare input (Math). The module owns command, key, type and limit.
const withMath = (t, params = {}) => {
  const ctx = open(t);
  ctx.session.transact('math', net => net.insert({ id: 'm', nodeType: 'sgrape.builtin.math', params, ui: { x: 0, y: 0 } }));
  return ctx;
};
const toSpare = source => ({ source, sourceHandle: 'out', target: 'm', targetHandle: spareHandle });
const mathNode = session => session.graph().stages.pixel.nodes.find(n => n.id === 'm');

test('wire onto a spare input adds the port and the edge as one Undo step', t => {
  const { session } = withMath(t), before = clone(session.graph());
  assert.equal(session.valid(toSpare('a')), true);
  assert.deepEqual(clone(session.graph()), before, 'validity check must not change the document');
  session.connect(toSpare('a'));
  assert.equal(mathNode(session).params.inputCount, 4);
  assert.ok(session.graph().stages.pixel.edges.some(e => e.from[0] === 'a' && e.to[0] === 'm' && e.to[1] === 'input3'));
  assert.equal(session.snapshot().projection.nodes.find(n => n.id === 'm').data.view.spare.key, 'input4');
  session.history(false); assert.deepEqual(clone(session.graph()), before);
});

test('pulling a connected input removes its wire as one Undo step; an empty input is a no-op', t => {
  const { session } = open(t);
  session.transact('wire', net => net.connect(net.node('a').outputs[0], net.node('sum').port('input', 'a'), GrapeGraph.values.policy));
  const wired = clone(session.graph()), into = () => session.graph().stages.pixel.edges.filter(e => e.to[0] === 'sum' && e.to[1] === 'a');
  session.disconnectInput('sum', 'b'); assert.deepEqual(clone(session.graph()), wired, 'empty input changes nothing');
  session.disconnectInput('sum', 'a'); assert.equal(into().length, 0);
  session.history(false); assert.deepEqual(clone(session.graph()), wired);
});

test('spare input refuses incompatible types and the module limit without editing', t => {
  const { session } = withMath(t), before = clone(session.graph());
  const colorOut = session.snapshot().projection.nodes.find(n => n.id === 'color').data.outputs[0].key;
  const wrongType = { source: 'color', sourceHandle: colorOut, target: 'm', targetHandle: spareHandle };
  assert.equal(session.valid(wrongType), false);
  session.connect(wrongType); assert.deepEqual(clone(session.graph()), before);
  const full = withMath(t, { inputCount: 32 }).session;
  assert.equal(full.valid(toSpare('a')), false);
});

test('React layer has no node-specific branch for spare inputs', () => {
  const dir = path.join(root, 'src/editor-react');
  const source = fs.readdirSync(dir).filter(f => /\.tsx?$/.test(f)).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
    .replace(/export const supportedDefinitions = \[[\s\S]*?\]\.map/, ''); // the slice coverage list names keys by design
  assert.doesNotMatch(source, /['"]math['"]|builtin\.math|nodeType\s*===?\s*['"]/);
});

// TD away (design-interview Q28; responses as measured on live TD 2026-10-07).
const notResponding = () => new Response(JSON.stringify({ code: 'manager_not_responding', error: 'TD did not process this request.' }), { status: 503 });
const until = async (ok, ms = 2000) => { const end = Date.now() + ms; while (!ok()) { if (Date.now() > end) throw Error('timed out'); await new Promise(r => setTimeout(r, 5)); } };
const valueOf = (session, id) => session.graph().stages.pixel.nodes.find(n => n.id === id).params.value;

test('TD not responding: editing continues, nothing replays, recovery resends automatically', async t => {
  let down = true; const applies = [];
  const { session, loaded } = open(t, async (action, body, remote) => {
    if (down) return notResponding();
    if (action === 'state') return remote.get();
    applies.push(body); const state = { document: body.document, revision: body.revision + 1, targetId: target }; remote.set(state); return { state };
  }, 20);
  session.transact('edit', net => setValue(net, 'a', 5)); await session.flush();
  assert.equal(session.snapshot().phase, 'offline'); assert.equal(session.snapshot().link, 'busy');
  assert.match(zh(session.snapshot().message), /TD 沒有回應（可能最小化）/);
  session.transact('more', net => setValue(net, 'b', 6));
  assert.equal(valueOf(session, 'b'), 6, 'editing is not blocked while TD is away');
  await session.flush(); assert.equal(applies.length, 0, 'no write while offline');
  down = false;
  await until(() => session.snapshot().phase === 'ready' && !session.snapshot().dirty);
  assert.equal(applies.length, 1); assert.equal(applies[0].revision, 4);
  assert.equal(loaded().state.revision, 5);
  assert.deepEqual(doc(loaded().state), clone(session.graph()));
});

test('TD changed while away: conflict; TD side is adopted and one Undo recalls the editor version', async t => {
  let down = true, changed = false;
  const { session, loaded } = open(t, async (action, body, remote) => {
    if (down) return notResponding();
    if (action === 'state') { if (!changed) { changed = true; otherEntryEdits(remote); } return remote.get(); }
    if (body.revision !== remote.get().state.revision) return new Response(JSON.stringify({ error: 'Conflict: stale revision' }), { status: 409 });
    const state = { document: body.document, revision: body.revision + 1, targetId: target }; remote.set(state); return { state };
  }, 20);
  session.transact('edit', net => setValue(net, 'a', 5)); await session.flush();
  const draft = clone(session.graph());
  down = false;
  await until(() => session.snapshot().phase === 'conflict');
  assert.match(zh(session.snapshot().message), /似乎有被修改/);
  assert.deepEqual(clone(session.graph()), draft, 'conflict never replaces the editor document');
  await session.useRemote();
  assert.deepEqual(clone(session.graph()), doc(loaded().state));
  assert.equal(session.snapshot().phase, 'ready'); assert.equal(session.snapshot().dirty, false);
  assert.equal(session.snapshot().revision, 5);
  session.history(false);
  assert.deepEqual(clone(session.graph()), draft, 'one Undo recalls the editor version');
  await session.flush();
  assert.deepEqual(doc(loaded().state), draft); assert.equal(loaded().state.revision, 6);
});

// Every node the React entry offers: add it, reach Color Output through a short chain of other
// offered nodes when its type needs one (vector -> length, bool vector -> any -> If), and compile
// with the same frontend compiler used for TD delivery.
test('every offered node can be added, wired to the output and compiled', t => {
  const { supportedDefinitions } = load(path.join(root, 'src/editor-react/core.ts'));
  const chains = [[], ['length'], ['length:vec2'], ['if'], ['any', 'if'], ['length', 'if']]; // key:type = card's type selector
  const attempt = (uuid, output, chain) => {
    const { session } = open(t), ids = ['x', ...chain.map((_, i) => 'c' + i)];
    session.transact('add', net => [[uuid], ...chain.map(k => k.split(':'))].forEach(([d, type], i) =>
      net.insert({ id: ids[i], nodeType: i ? 'sgrape.builtin.' + d : d, params: type ? { type } : {}, ui: { x: 0, y: 0 } })));
    const view = id => session.snapshot().projection.nodes.find(n => n.id === id).data;
    let from = { source: 'x', sourceHandle: output };
    for (const id of [...ids.slice(1), 'pixel_out']) {
      const port = view(id).inputs.find(p => session.valid({ ...from, target: id, targetHandle: p.key }));
      if (!port) return null;
      session.connect({ ...from, target: id, targetHandle: port.key });
      if (id !== 'pixel_out') from = { source: id, sourceHandle: view(id).outputs[0].key };
    }
    return session.graph();
  };
  const failures = [];
  // The reference node needs a declaration; its own test below covers it. 引用宣告節點需要宣告，另有測試。
  for (const uuid of supportedDefinitions.filter(u => !u.endsWith('.pixel_out') && !u.endsWith('.declaration') && !u.endsWith('.td_value'))) {
    const { session } = open(t);
    session.transact('add', net => net.insert({ id: 'x', nodeType: uuid, params: {}, ui: { x: 0, y: 0 } }));
    const outputs = session.snapshot().projection.nodes.find(n => n.id === 'x').data.outputs.map(p => p.key);
    let graph = null;
    for (const output of outputs) { for (const chain of chains) if ((graph = attempt(uuid, output, chain))) break; if (graph) break; }
    if (!graph) { failures.push(uuid + ': no route to Color Output'); continue; }
    try {
      const compiled = GrapeTopCompiler.compile(graph, bootstrap.typeContract.glslCode);
      if (!/sg_n_x(?![A-Za-z0-9])/.test(compiled.pixel)) failures.push(uuid + ': not emitted');
    } catch (error) { failures.push(uuid + ': ' + error.message); }
  }
  assert.deepEqual(failures, []);
});

// Retired value definitions open old graphs but are never offered for new nodes (legacy creator).
test('add menu offers every supported node except retired float/vec2/vec3/vec4 and Color Output', () => {
  const { supportedDefinitions, creatableDefinitions, fromSourcesPanel } = load(path.join(root, 'src/editor-react/core.ts'));
  const retired = ['float', 'vec2', 'vec3', 'vec4'].map(k => 'sgrape.builtin.' + k);
  assert.ok(retired.every(uuid => supportedDefinitions.includes(uuid) && !creatableDefinitions.includes(uuid)));
  // Stage outputs are never offered (Q42); the reference node is made from the Sources panel (Q45).
  const fixed = ['sgrape.builtin.pixel_out', ...fromSourcesPanel];
  assert.ok(fixed.every(uuid => supportedDefinitions.includes(uuid) && !creatableDefinitions.includes(uuid)));
  assert.deepEqual(creatableDefinitions, supportedDefinitions.filter(uuid => !retired.includes(uuid) && !fixed.includes(uuid)));
  for (const key of ['vector', 'scalar', 'combine', 'replace', 'swizzle', 'convert']) assert.ok(creatableDefinitions.includes('sgrape.builtin.' + key), key);
});

// A legacy fixed entry (Vector locked to vec2) opens; changing its type is refused by the core.
test('legacy fixed-type Vector opens and keeps its locked type', t => {
  const { session } = open(t);
  session.transact('add', net => net.insert({ id: 'fv', nodeType: 'sgrape.builtin.vector', name: 'Vec2',
    params: { type: 'vec2', fixedType: 'vec2', components: [0, 0, 0, 0] }, ui: { x: 0, y: 0 } }));
  const before = clone(session.graph());
  assert.ok(before.stages.pixel.nodes.some(n => n.id === 'fv'));
  session.configure('fv', 'vec3');
  assert.deepEqual(clone(session.graph()), before, 'locked type is not changed');
  assert.match(zh(session.snapshot().message), /Fixed node type|Invalid manual type/);
});

// Path rebuild A1 (design-interview Q38): code generation follows each finished edit, not delivery.
// 產碼跟著每次修改完成，不再等送出；TD 不在時 GLSL 與錯誤照樣更新。
test('GLSL is generated on open and after every edit, before anything is sent', t => {
  const { session, calls } = open(t);
  assert.equal(session.snapshot().glsl, GrapeTopCompiler.compile(session.graph(), bootstrap.typeContract.glslCode).pixel);
  session.transact('wire', net => net.connect(net.node('a').outputs[0], net.node('sum').port('input', 'a'), GrapeGraph.values.policy));
  assert.equal(calls.length, 0, 'nothing sent yet');
  assert.equal(session.snapshot().glsl, GrapeTopCompiler.compile(session.graph(), bootstrap.typeContract.glslCode).pixel);
});

test('TD away: GLSL and code generation errors still update while sending is stopped', async t => {
  const { session } = open(t, async () => notResponding(), 60000);
  session.transact('edit', net => setValue(net, 'a', 5)); await session.flush();
  assert.equal(session.snapshot().phase, 'offline');
  const before = session.snapshot().glsl;
  session.remove({ nodes: session.snapshot().projection.nodes.filter(n => n.id === 'color'), edges: [] }); // feeds the output
  assert.notEqual(session.snapshot().glsl, before, 'GLSL follows the edit while TD is away');
  assert.equal(session.snapshot().glsl, GrapeTopCompiler.compile(session.graph(), bootstrap.typeContract.glslCode).pixel);
});

test('a code generation failure is reported at edit time; the last good GLSL stays visible', t => {
  const generator = flaky(), { session, calls } = open(t, undefined, 60000, generator), good = session.snapshot().glsl;
  generator.fail = true; session.transact('value', net => setValue(net, 'a', 7));
  assert.match(zh(session.snapshot().message), /產碼失敗/);
  assert.equal(session.snapshot().glsl, good);
  assert.equal(calls.length, 0);
});

// Path rebuild A3 (design-interview Q38 2-1, Q31): the code-generation fingerprint decides.
// 產碼指紋決定：純版面不產碼、TD 不做 GPU；註記只更新這裡的 GLSL；程式改變才送執行用部分。
test('moving a node sends the document only; a value edit sends the program', async t => {
  const { session, calls } = open(t, undefined, 60000);
  session.transact('value', net => setValue(net, 'a', 3)); await session.flush();
  assert.notEqual(calls.at(-1).body.runtime, null, 'first delivery carries the program');
  const glsl = session.snapshot().glsl;
  session.nodeChanges([{ type: 'position', id: 'a', position: { x: 400, y: 90 }, dragging: false }]); await session.flush();
  assert.equal(calls.at(-1).body.runtime, null, 'layout only: no program, so TD skips GPU work');
  assert.equal(JSON.parse(calls.at(-1).body.document).stages.pixel.nodes.find(n => n.id === 'a').ui.x, 400);
  assert.equal(session.snapshot().glsl, glsl);
  session.transact('wire', net => net.connect(net.node('a').outputs[0], net.node('pixel_out').port('input', 'color'), GrapeGraph.values.policy));
  await session.flush();
  assert.notEqual(calls.at(-1).body.runtime, null, 'a program change is sent');
});

test('a note refreshes the GLSL shown in the editor but is not sent as a program change (rule B)', async t => {
  const { session, calls } = open(t, undefined, 60000);
  session.transact('wire', net => net.connect(net.node('a').outputs[0], net.node('pixel_out').port('input', 'color'), GrapeGraph.values.policy));
  await session.flush();
  session.transact('note', net => { net.node('a').update({ comment: 'hello note' }); });
  assert.match(session.snapshot().glsl, /hello note/);
  await session.flush();
  assert.equal(calls.at(-1).body.runtime, null);
});

// Editing-time limit (capacity.ts): warnings on the status line. 編輯時的上限：狀態列警告。
test('an over-limit graph opens with a warning; growth is refused with a message, shrinking works', t => {
  const { session: probe, loaded } = open(t), big = loaded();
  withDoc(big.state, graph => { for (let i = 0; i < 260; i++) graph.stages.pixel.nodes.push(makeNode('f' + i, 'float')); });
  const session = new EditorSession(probe.host, bootstrap, big, 60000, 60000); t.after(() => session.dispose());
  assert.match(zh(session.snapshot().message), /^警告：這張圖超過上限/);
  const before = clone(session.graph());
  session.add('sgrape.builtin.float', { x: 0, y: 0 });
  assert.match(zh(session.snapshot().message), /已達上限，這次修改沒有套用：每層節點 \d+／256/);
  assert.deepEqual(clone(session.graph()), before);
  session.remove({ nodes: session.snapshot().projection.nodes.filter(n => n.id === 'f0'), edges: [] });
  assert.equal(session.graph().stages.pixel.nodes.length, before.stages.pixel.nodes.length - 1);
});

// Color Output identity (Q42): the core refuses; this layer skips it on Delete and words the reason.
// Color Output 身分：核心拒絕；畫面在 Delete 時跳過它並說明原因。
test('Delete skips Color Output and its unselected wires; the rest is deleted in one step', async t => {
  const { session } = open(t);
  session.transact('wire', net => net.connect(net.node('a').outputs[0], net.node('pixel_out').port('input', 'color'), GrapeGraph.values.policy));
  const flow = session.snapshot().projection, before = clone(session.graph());
  const nodes = flow.nodes.filter(n => n.id === 'pixel_out' || n.id === 'b').map(n => ({ ...n, selected: true }));
  const edges = flow.edges.filter(e => e.target === 'pixel_out').map(e => ({ ...e, selected: false }));
  const allowed = await session.beforeDelete({ nodes, edges });
  assert.deepEqual(clone(allowed.nodes.map(n => n.id)), ['b']); assert.equal(allowed.edges.length, 0);
  session.remove(allowed);
  const ids = session.graph().stages.pixel.nodes.map(n => n.id);
  assert.ok(ids.includes('pixel_out') && !ids.includes('b'));
  assert.ok(session.graph().stages.pixel.edges.some(e => e.to[0] === 'pixel_out'), 'its wire stays');
  assert.match(zh(session.snapshot().message), /Color Output 不能刪除/);
  session.history(false); assert.deepEqual(clone(session.graph()), before);
});

test('deleting only Color Output changes nothing and says why; the core refuses it anyway', async t => {
  const { session } = open(t), before = clone(session.graph());
  const out = session.snapshot().projection.nodes.filter(n => n.id === 'pixel_out');
  const allowed = await session.beforeDelete({ nodes: out, edges: [] });
  assert.equal(allowed.nodes.length, 0); assert.match(zh(session.snapshot().message), /^Color Output 不能刪除$/);
  session.remove({ nodes: out, edges: [] }); // bypassing the UI filter: the core gate refuses
  assert.deepEqual(clone(session.graph()), before);
  assert.match(zh(session.snapshot().message), /沒有套用：圖裡必須有一個 Color Output/);
});

test('a graph with two Color Outputs opens with a warning; a third is refused; removing one repairs it', t => {
  const { session: probe, loaded } = open(t), broken = loaded();
  withDoc(broken.state, graph => graph.stages.pixel.nodes.push({ id: 'second', nodeType: 'sgrape.builtin.pixel_out', params: {}, ui: { x: 0, y: 0 } }));
  const session = new EditorSession(probe.host, bootstrap, broken, 60000, 60000); t.after(() => session.dispose());
  assert.match(zh(session.snapshot().message), /^警告：這張圖不符合結構規則.*Color Output 只能有一個（目前 2 個）/);
  const before = clone(session.graph());
  session.transact('third', net => net.insert({ id: 'third', nodeType: 'sgrape.builtin.pixel_out', params: {}, ui: { x: 0, y: 0 } }));
  assert.deepEqual(clone(session.graph()), before); assert.match(zh(session.snapshot().message), /目前 3 個/);
  session.remove({ nodes: session.snapshot().projection.nodes.filter(n => n.id === 'second'), edges: [] });
  assert.equal(session.graph().stages.pixel.nodes.filter(n => n.nodeType === 'sgrape.builtin.pixel_out').length, 1);
});

// Localization skeleton and reports (Refactor.38; design-interview Q34, Q35).
// 在地化骨架與回報：沒設定語言跟著瀏覽器；缺翻譯顯示英文原文、永不顯示代號；紀錄不重複、有來源。
test('language: a chosen one wins, else the browser language when supported, else English', () => {
  assert.equal(chooseLanguage('en', ['zh-TW']), 'en');
  assert.equal(chooseLanguage('zh-Hant', ['en-US']), 'zh-Hant');
  assert.equal(chooseLanguage(null, ['zh-TW', 'en']), 'zh-Hant');
  assert.equal(chooseLanguage(null, ['fr-FR', 'zh-HK']), 'zh-Hant');
  assert.equal(chooseLanguage(null, ['zh-CN']), 'en');
  assert.equal(chooseLanguage('ja', ['ja-JP']), 'en');
  assert.equal(chooseLanguage(undefined, []), 'en');
});

test('a message shows its translation, else its English original, never its code', () => {
  assert.equal(localize(tr('sync.applied', 'Applied to TD; the project still needs saving'), 'zh-Hant'), '已套用 TD；專案尚需保存');
  assert.equal(localize(tr('toolbar.undo', 'Undo'), 'zh-Hant'), 'Undo', 'an empty translation shows English');
  assert.equal(localize(tr('nowhere.unknown', 'Only English'), 'zh-Hant'), 'Only English');
  const limits = [tr('limit.measure', '{name} {value}/{limit}', { name: tr('limit.nodesPerNetwork', 'nodes per network'), value: 300, limit: 256 }),
    tr('limit.measure', '{name} {value}/{limit}', { name: tr('limit.edgesPerNetwork', 'wires per network'), value: 2, limit: 1 })];
  const message = tr('limit.reached', 'Limit reached; this change was not applied: {limits}', { limits });
  assert.equal(localize(message, 'en'), 'Limit reached; this change was not applied: nodes per network 300/256, wires per network 2/1');
  assert.equal(localize(message, 'zh-Hant'), '已達上限，這次修改沒有套用：每層節點 300／256、每層接線 2／1');
});

test('each report is logged once, with its source; status updates without news add nothing', async t => {
  const { session } = open(t);
  const before = session.log.entries().length;
  session.transact(tr('edit.valueChanged', 'Value updated; waiting to apply'), net => setValue(net, 'a', 4));
  await session.flush();
  const added = session.log.entries().slice(before).map(report => report.source + ':' + report.message.code);
  assert.deepEqual(added, ['editor:edit.valueChanged', 'sync:sync.sending', 'sync:sync.applied']);
  assert.ok(session.log.entries().every(report => typeof report.time === 'number'));
});

// Ghosts (Refactor.39; design-interview Q37 1-1, 1-3): an unknown node and a bad wire no longer
// refuse the graph; they are kept byte for byte, shown, and left out of the program.
// Ghost：不認得的節點與不合法的線不再讓整張圖打不開；原樣保留、顯示出來、不進程式。
test('a graph with an unknown node and a bad wire opens; ghosts survive edits and delivery unchanged', async t => {
  const future = { id: 'future', nodeType: 'vendor.pack.future', params: { knob: 3, nested: { keep: [1, 2] } }, ui: { x: 400, y: 40 } };
  let sent;
  const { session, calls } = open(t, async (action, body, remote) => {
    if (action === 'state') {
      const state = remote.get();
      withDoc(state.state, graph => {
        graph.stages.pixel.nodes.push(future);
        graph.stages.pixel.edges.push({ id: 'eFuture', from: ['future', 'out'], to: ['sum', 'b'] });
      });
      return state;
    }
    sent = body; const state = { document: body.document, revision: body.revision + 1, targetId: target }; remote.set(state); return { state };
  });
  // open() builds the session from loaded(): rebuild with the ghost graph through the fetcher's state.
  const loadedState = await session.host.call('state');
  const ghostSession = new EditorSession(session.host, bootstrap, loadedState, 60000, 60000, undefined, '9.9.9 Test');
  t.after(() => ghostSession.dispose());
  const view = ghostSession.snapshot().projection;
  const ghostNode = view.nodes.find(node => node.id === 'future');
  assert.equal(ghostNode.data.ghost, 'unknown');
  assert.deepEqual(ghostNode.data.outputs.map(port => port.key), ['out']);
  assert.equal(view.edges.find(edge => edge.id === 'eFuture').style.strokeDasharray, '6 4');
  assert.match(zh(ghostSession.snapshot().message), /1 個 Ghost 節點、1 條 Ghost 線/);
  ghostSession.transact(tr('edit.valueChanged', 'Value updated; waiting to apply'), net => setValue(net, 'a', 6));
  await ghostSession.flush();
  assert.notEqual(sent.runtime, null, 'the rest of the graph still compiles and is sent');
  assert.ok(!JSON.parse(sent.runtime).pixel.includes('future'));
  const stored = JSON.parse(sent.document).stages.pixel;
  assert.deepEqual(stored.nodes.find(node => node.id === 'future'), future, 'the ghost is stored byte for byte');
  assert.ok(stored.edges.some(edge => edge.id === 'eFuture'));
  assert.ok(calls.length >= 2);
});

test('a known node outside this entry still refuses: as a ghost it would silently leave TD', t => {
  const { loaded } = open(t), state = loaded();
  withDoc(state.state, graph => { graph.subgraphs = [{ id: 'unknown', graph: { nodes: [], edges: [] } }]; });
  assert.throws(() => new EditorSession(new HostClient(target, '', async () => new Response('{}')), bootstrap, state), error => error instanceof UnsupportedGraphError);
});

// Shared sources: global constants (Refactor.40; design-interview Q41, Q45).
// 共用來源：全域常數——新增、放到圖上、接線、送出、改名、名稱衝突、刪除連同引用、Undo。
test('a global constant: add, place, wire, apply; rename; refused names; delete with its nodes; undo', async t => {
  const { session, calls } = open(t);
  // The default graph already has a texture input (Refactor.43); constants are counted on their own.
  // 預設圖已經有一個貼圖輸入；常數另外算。
  const constants = () => session.snapshot().declarations.filter(d => d.kind === 'constant');
  session.addConstant();
  const declaration = constants()[0];
  assert.deepEqual([declaration.kind, declaration.name, declaration.type], ['constant', 'constant1', 'float']);
  session.setDeclarationValue(declaration.id, 0.25);
  session.placeDeclaration(declaration.id, { x: 0, y: 0 });
  const ref = session.snapshot().projection.nodes.find(node => node.data.authored.nodeType === 'sgrape.builtin.declaration');
  assert.equal(ref.data.colorGroup, 'constant');
  assert.equal(session.snapshot().references[declaration.id], 1);
  session.transact(tr('edit.wired', 'Wire updated'), net => net.connect(net.node(ref.id).outputs[0], net.node('sum').port('input', 'a'), GrapeGraph.values.policy));
  session.transact(tr('edit.wired', 'Wire updated'), net => net.connect(net.node('sum').outputs[0], net.node('pixel_out').port('input', 'color'), GrapeGraph.values.policy));
  await session.flush();
  const pixel = JSON.parse(calls.at(-1).body.runtime).pixel;
  assert.match(pixel, /^const float constant1 = 0\.25;$/m);
  assert.equal(session.renameDeclaration(declaration.id, 'kGain'), true);
  assert.equal(constants()[0].name, 'kGain');
  session.addConstant();
  const other = constants()[1];
  assert.equal(session.renameDeclaration(other.id, 'kGain'), false);
  assert.match(zh(session.snapshot().message), /名稱 kGain 已經被另一個共用來源使用/);
  assert.equal(session.renameDeclaration(other.id, 'float'), false);
  session.removeDeclaration(declaration.id);
  assert.ok(!session.graph().stages.pixel.nodes.some(node => node.id === ref.id), 'its nodes go with it');
  assert.equal(constants().length, 1);
  session.history(false);
  assert.equal(constants().length, 2, 'one Undo brings both back');
  assert.ok(session.graph().stages.pixel.nodes.some(node => node.id === ref.id));
});

// TD built-in values (Refactor.41; Q45 01): placed from the Sources panel, read straight from TD.
// TD 內建值：從共用來源面板放到圖上，直接讀 TD 的值。
test('a TD built-in value is placed, coloured as runtime info, wired and sent as TD wrote it', async t => {
  const { session, calls } = open(t);
  session.placeTdValue('uTDOutputInfoResZw', { x: 0, y: 0 });
  const node = session.snapshot().projection.nodes.find(n => n.data.authored.nodeType === 'sgrape.builtin.td_value');
  assert.equal(node.data.colorGroup, 'runtime');
  assert.equal(node.data.view.label, 'uTDOutputInfo.res.zw');
  session.transact(tr('edit.wired', 'Wire updated'), net => {
    net.insert({ id: 'len', nodeType: 'sgrape.builtin.length', params: { type: 'vec2' }, ui: {} });
    net.connect(net.node(node.id).outputs[0], net.node('len').port('input', 'value'), GrapeGraph.values.policy);
    net.connect(net.node('len').outputs[0], net.node('pixel_out').port('input', 'color'), GrapeGraph.values.policy);
  });
  await session.flush();
  assert.match(JSON.parse(calls.at(-1).body.runtime).pixel, /vec2 sg_n_\w+ = uTDOutputInfo\.res\.zw;/);
  assert.equal(session.snapshot().declarations.filter(d => d.kind !== 'topInput').length, 0, 'no declaration is needed');
});

// Color Output takes anything (Refactor.42; Q46): vUV.st wires straight to it.
test('vUV.st can be wired straight to Color Output and is filled to (x, y, 0.5, 1)', async t => {
  const { session, calls } = open(t);
  session.placeTdValue('vUVSt', { x: 0, y: 0 });
  const id = session.snapshot().projection.nodes.find(n => n.data.authored.nodeType === 'sgrape.builtin.td_value').id;
  const wire = { source: id, sourceHandle: 'out', target: 'pixel_out', targetHandle: 'color' };
  assert.equal(session.valid(wire), true);
  session.connect(wire); await session.flush();
  assert.match(JSON.parse(calls.at(-1).body.runtime).pixel, /vec4 sg_color = vec4\(vec2\(sg_n_\w+\), 0\.5, 1\.0\);/);
});

// TOP texture inputs (Refactor.43; texture-inputs.md): added in the Sources panel, sampled, sent to TD
// as an ordered binding list. TOP 貼圖輸入：在共用來源面板新增、取樣、照順序當成綁定交給 TD。
test('a texture input: add, choose its default image, place, sample, wire; the input list goes to TD in order', async t => {
  const { session, calls } = open(t);
  session.addTopInput();
  const inputs = () => JSON.parse(JSON.stringify(session.snapshot().declarations.filter(d => d.kind === 'topInput')));
  assert.deepEqual(inputs().map(d => [d.name, d.defaultTexture]), [['input1', 'grape'], ['input2', 'grape']]);
  session.setDefaultTexture(inputs()[1].id, 'black');
  session.placeDeclaration(inputs()[1].id, { x: 0, y: 0 });
  const ref = session.snapshot().projection.nodes.find(n => n.data.authored.nodeType === 'sgrape.builtin.declaration');
  assert.equal(ref.data.colorGroup, 'sampler');
  assert.deepEqual([...ref.data.outputs.map(p => p.key)], ['out', 'size', 'pixelSize']);
  session.add('sgrape.builtin.texture_sample', { x: 200, y: 0 });
  const tex = session.snapshot().projection.nodes.find(n => n.data.authored.nodeType === 'sgrape.builtin.texture_sample');
  assert.equal(session.valid({ source: ref.id, sourceHandle: 'out', target: 'pixel_out', targetHandle: 'color' }), false, 'a texture is not a colour');
  session.connect({ source: ref.id, sourceHandle: 'out', target: tex.id, targetHandle: 'sampler' });
  session.connect({ source: tex.id, sourceHandle: 'out', target: 'pixel_out', targetHandle: 'color' });
  await session.flush();
  const runtime = JSON.parse(calls.at(-1).body.runtime);
  assert.match(runtime.pixel, /vec4 sg_n_\w+ = texture\(sTD2DInputs\[1\], vUV\.st\);/);
  assert.deepEqual(runtime.bindings.map(d => [d.kind, d.name, d.defaultTexture]), [['topInput', 'input1', 'grape'], ['topInput', 'input2', 'black']]);
});

// Uniforms, round A (Refactor.44; uniform-round.md, Q51): added in the Sources panel; the value goes
// to TD as a binding, so changing it leaves the GLSL as it was. Uniform A：值以綁定交給 TD，改值不改 GLSL。
test('a Uniform: add, vec4 colour, value, place, wire; a value change only changes the binding', async t => {
  const { session, calls } = open(t);
  session.addUniform();
  assert.deepEqual(['name', 'type'].map(k => session.snapshot().declarations.find(d => d.kind === 'uniform')[k]), ['uniform1', 'float']);
  session.removeDeclaration(session.snapshot().declarations.find(d => d.kind === 'uniform').id);
  // A colour is chosen when added (Q59) and starts white. 顏色在新增時決定，從白色開始。
  session.addUniform(true);
  const uniform = () => JSON.parse(JSON.stringify(session.snapshot().declarations.find(d => d.kind === 'uniform')));
  assert.deepEqual([uniform().type, uniform().color, uniform().value], ['vec4', true, [1, 1, 1, 1]]);
  session.setDeclarationValue(uniform().id, [1, 0.5, 0, 1]);
  session.placeDeclaration(uniform().id, { x: 0, y: 0 });
  const ref = session.snapshot().projection.nodes.find(n => n.data.authored.nodeType === 'sgrape.builtin.declaration');
  assert.equal(ref.data.colorGroup, 'uniform');
  session.connect({ source: ref.id, sourceHandle: 'out', target: 'pixel_out', targetHandle: 'color' });
  await session.flush();
  const first = JSON.parse(calls.filter(c => c.action === 'apply').at(-1).body.runtime);
  assert.match(first.pixel, /^uniform vec4 uniform1;$/m);
  assert.deepEqual(first.bindings.filter(b => b.kind === 'uniform').map(b => [b.name, b.type, b.value, b.color]), [['uniform1', 'vec4', [1, 0.5, 0, 1], true]]);
  session.setDeclarationValue(uniform().id, [0, 1, 0, 1]);
  await session.flush();
  const second = JSON.parse(calls.filter(c => c.action === 'apply').at(-1).body.runtime);
  assert.equal(second.pixel, first.pixel, 'the GLSL is the same');
  assert.deepEqual(second.bindings.find(b => b.kind === 'uniform').value, [0, 1, 0, 1]);
});

// Time (Refactor.45, D1; Q61): a preset Uniform, created once when placed and reused after.
// 時間：預設 Uniform，第一次放到圖上時建立，之後重用。
test('a time value placed twice is one declaration with two reference nodes; it goes to TD by its entry', async t => {
  const { session, calls } = open(t);
  session.placePreset('absTime', { x: 0, y: 0 });
  session.placePreset('absTime', { x: 0, y: 200 });
  const builtins = session.snapshot().declarations.filter(d => d.kind === 'uniform' && d.entry === 'absTime');
  assert.equal(builtins.length, 1);
  const refs = session.snapshot().projection.nodes.filter(n => n.data.authored.params.declarationId === builtins[0].id);
  assert.equal(refs.length, 2);
  assert.equal(session.snapshot().references[builtins[0].id], 2);
  session.connect({ source: refs[0].id, sourceHandle: 'out', target: 'pixel_out', targetHandle: 'color' });
  await session.flush();
  const runtime = JSON.parse(calls.at(-1).body.runtime);
  assert.match(runtime.pixel, /^uniform float uAbsTime;$/m);
  assert.deepEqual(runtime.bindings.filter(b => b.kind === 'uniform').map(b => [b.name, b.entry, b.value]), [['uAbsTime', 'absTime', 0]]);
  session.renameDeclaration(builtins[0].id, 'uClock');
  assert.equal(session.snapshot().declarations.find(d => d.entry === 'absTime').name, 'uAbsTime', 'the name is locked in the web editor');
  session.history(false); session.history(false); session.history(false);
  assert.equal(session.snapshot().declarations.filter(d => d.entry === 'absTime').length, 0, 'Undo removes what placing created');
});

// Uniform D1 (Q58, Q60): TD reports each component's state with its replies; TD-Grape's notices are
// said as TD-Grape wrote them (translated when the editor knows the code).
// TD 在回覆裡帶回各分量的狀態；TD-Grape 的提醒照原樣說（有翻譯就翻）。
test('TD states arrive on open and with each reply; notices go to the log as TD-Grape said them', async t => {
  const states = { u: [{ mode: 'expression', text: 'absTime.seconds' }] };
  const notice = { code: 'uniform.exportRemains', source: '{uniform} was deleted, but {parameter} of the GLSL OP is still driven by an Export from {origin}; TD-Grape cannot remove that from here.',
    params: { uniform: 'uTint', parameter: 'color0alpha', origin: 'lfo1:chan1' } };
  const { session } = open(t, (action, body, remote) => {
    if (action === 'state') return { ...remote.get(), uniforms: { u: [{ mode: 'constant', value: 1 }] } };
    const state = { document: body.document, revision: body.revision + 1, targetId: target };
    remote.set(state);
    return { state, uniforms: states, notices: [notice] };
  });
  assert.deepEqual(session.snapshot().tdUniforms, {}, 'this test opens with a reply that has none');
  await session.check();
  assert.deepEqual(session.snapshot().tdUniforms, { u: [{ mode: 'constant', value: 1 }] });
  session.addUniform();
  await session.flush();
  assert.deepEqual(session.snapshot().tdUniforms, states);
  const said = session.log.entries().at(-1);
  assert.equal(said.source, 'td');
  assert.match(zh(said.message), /uTint.*color0alpha.*lfo1:chan1/);
});

// Uniform C (Refactor.46; Q53): a Uniform's value goes to TD the moment it changes; dragging never
// touches the graph or Undo. Uniform C：值一改就送到 TD；拖曳中不改圖、不進 Undo。
test('Uniform values go live: dragging sends only the latest, never the graph; typing and Undo send at once', async t => {
  let release;
  const gate = () => new Promise(resolve => { release = resolve; });
  let waiting;
  const { session, calls } = open(t, async (action, body, remote) => {
    if (action === 'live') { await waiting; return { ok: true, applied: true }; }
    if (action === 'state') return remote.get();
    const next = { document: body.document, revision: body.revision + 1, targetId: target }; remote.set(next); return { state: next };
  });
  session.addUniform();
  const id = session.snapshot().declarations.find(d => d.kind === 'uniform').id;
  await new Promise(resolve => setTimeout(resolve, 0));
  const live = () => calls.filter(c => c.action === 'live').map(c => [c.body.id, c.body.value]);
  const before = { version: session.snapshot().version, graph: JSON.stringify(session.graph()) };
  waiting = gate();
  for (const value of [0.1, 0.2, 0.3, 0.4]) session.previewDeclarationValue(id, value);
  release(); await new Promise(resolve => setTimeout(resolve, 0)); await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(live(), [[id, 0.1], [id, 0.4]], 'one on the way, then only the latest');
  assert.equal(session.snapshot().version, before.version, 'dragging is not an edit');
  assert.equal(JSON.stringify(session.graph()), before.graph);
  waiting = undefined;
  session.setDeclarationValue(id, 0.5);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(live().at(-1), [id, 0.5], 'a committed value is sent at once, before the normal save');
  session.history(false);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(live().at(-1), [id, 0], 'Undo sends the value it brings back');
  session.addConstant();
  const constant = session.snapshot().declarations.find(d => d.kind === 'constant').id, count = live().length;
  session.previewDeclarationValue(constant, 1);
  assert.equal(live().length, count, 'a constant is never live: changing it changes the program');
});
