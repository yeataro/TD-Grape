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
const { localize, errorText, chooseLanguage, tr, clockOf } = load(path.join(root, 'src/editor-react/text.ts'));
const zh = message => localize(message, 'zh-Hant');
const bootstrap = JSON.parse(fs.readFileSync(path.join(root, 'src/generated/editor-bootstrap.json')));
const clone = value => JSON.parse(JSON.stringify(value));
const target = '1'.repeat(32);
// Named as every node now is (Refactor.76), so opening the fixture upgrades nothing. 和現在每個節點一樣有名字（R.76），開圖不會升級。
const makeNode = (id, key) => ({ id, nodeType: 'sgrape.builtin.' + key, name: GrapeGraph.validNodeName(id) ? id : id + '_1',
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
// What TD receives: the editor's graph with the editor that saved it (Refactor.66). TD 收到的：編輯器的圖，加上是哪一版存的。
const saved = graph => ({ ...clone(graph), savedBy: '9.9.9 Test' });
function open(t, request, retry = 60000, generator, live) {
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
  const session = new EditorSession(new HostClient(target, '', fetcher, 20000, live), bootstrap, loaded(), 60000, retry, generator, '9.9.9 Test');
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

// Refactor.52: a different build is not a conflict (no version choice helps); every reply's "which TD" reaches
// the page. 建置不同不是衝突；每個回覆的「哪個 TD」都送到頁面。
test('a build change on apply is not a conflict, and replies say which TD answered', async t => {
  const td = { file: 'p.7.toe', build: '2025.33230' };
  const { session } = open(t, async (action, body, remote) => action === 'state' ? remote.get()
    : new Response(JSON.stringify({ error: 'different builds', code: 'build_changed', td }), { status: 409 }));
  const seen = []; session.host.seen = found => seen.push(found);
  session.transact('edit', net => setValue(net, 'a', 9)); await session.flush();
  assert.equal(session.snapshot().phase, 'error'); assert.equal(session.snapshot().message.code, 'sync.hostChanged');
  assert.equal(session.snapshot().dirty, true, 'the change stays, to be kept as a draft');
  assert.deepEqual(JSON.parse(JSON.stringify(seen)), [td]);
  await session.flush(); assert.equal(seen.length, 1, 'nothing is resent after the refusal');
});

// Refactor.52: "also give this Grape OP a new Grape ID" only once everything is in TD.
// 換新 Grape ID 只在所有修改都已送到 TD 之後。
test('a new Grape ID is asked only when nothing is left unsent', async t => {
  let down = false;
  const { session, calls } = open(t, async (action, body, remote) => {
    if (down) return notResponding();
    if (action === 'identity') return { targetId: 'd'.repeat(32) };
    return strictHost()(action, body, remote);
  });
  down = true; session.transact('edit', net => setValue(net, 'a', 9)); await session.flush();
  assert.equal(await session.renewId(), null, 'refused while a change is not in TD');
  assert.equal(session.snapshot().message.code, 'identity.renewPending');
  assert.ok(!calls.some(c => c.action === 'identity'));
  down = false; await session.check();
  await until(() => !session.snapshot().dirty);
  assert.equal(await session.renewId(), 'd'.repeat(32));
  assert.equal(calls.filter(c => c.action === 'identity').length, 1);
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
  assert.deepEqual(doc(loaded().state), saved(draft)); assert.equal(loaded().state.revision, 6);
  assert.equal(session.snapshot().phase, 'ready'); assert.equal(session.snapshot().dirty, false); assert.equal(session.snapshot().revision, 6);
});

test('migration convenience: an unopenable test graph can be reset to the default through normal apply', async t => {
  const { session, calls, loaded } = open(t, strictHost());
  const unsupported = loaded(); withDoc(unsupported.state, graph => graph.stages.pixel.nodes.push({ id: 'x', nodeType: 'sgrape.builtin.subgraph_input', params: {} }));
  assert.throws(() => new EditorSession(session.host, bootstrap, unsupported), error => error instanceof UnsupportedGraphError);
  await resetToDefault(session.host, bootstrap, '9.9.9 Test');
  assert.deepEqual(calls.map(c => c.action), ['state', 'apply']); assert.equal(calls[1].body.revision, 4);
  assert.deepEqual(JSON.parse(calls[1].body.runtime), clone(GrapeTopCompiler.compile(bootstrap.defaultDocument.graph, bootstrap.typeContract.glslCode)));
  assert.deepEqual(doc(loaded().state), saved(bootstrap.defaultDocument.graph)); assert.equal(loaded().state.revision, 5);
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
  assert.deepEqual(JSON.parse(calls[0].body.document), saved(session.graph()));
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
    graph.stages.pixel.nodes = [...graph.stages.pixel.nodes, { id: 'nu', nodeType: 'sgrape.builtin.subgraph_input', params: {} }];
  });
  // Named as it opened (Refactor.76), so the message gives its name too. 開圖時補了名字（R.76），訊息也寫出名字。
  assert.throws(() => new EditorSession(session.host, bootstrap, known), error => /subgraph_input 節點.*（nu）/.test(zh(errorText(error))));
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
  assert.match(zh(session.snapshot().message), /TD 還開著，但沒在處理請求/);
  session.transact('more', net => setValue(net, 'b', 6));
  assert.equal(valueOf(session, 'b'), 6, 'editing is not blocked while TD is away');
  await session.flush(); assert.equal(applies.length, 0, 'no write while offline');
  down = false;
  await until(() => session.snapshot().phase === 'ready' && !session.snapshot().dirty);
  assert.equal(applies.length, 1); assert.equal(applies[0].revision, 4);
  assert.equal(loaded().state.revision, 5);
  assert.deepEqual(doc(loaded().state), saved(session.graph()));
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
  assert.deepEqual(doc(loaded().state), saved(draft)); assert.equal(loaded().state.revision, 6);
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
  const { supportedDefinitions, creatableDefinitions, creatableEntries } = load(path.join(root, 'src/editor-react/core.ts'));
  const retired = ['float', 'vec2', 'vec3', 'vec4'].map(k => 'sgrape.builtin.' + k);
  // Stage outputs are never offered (Q42); the reference nodes are made from the Sources panel (Q45).
  // Both are now declared by the modules themselves (Q37 1-5): no node name is special-cased in the menu.
  const fixed = ['sgrape.builtin.pixel_out', 'sgrape.builtin.declaration', 'sgrape.builtin.td_value'];
  assert.deepEqual(creatableDefinitions, supportedDefinitions.filter(uuid => !retired.includes(uuid) && !fixed.includes(uuid)));
  for (const key of ['vector', 'scalar', 'combine', 'replace', 'swizzle', 'convert']) assert.ok(creatableDefinitions.includes('sgrape.builtin.' + key), key);
  // Fixed-type entries (Refactor.50, legacy functions_ui.js:78-80): Scalar 4 + Vector 12, after each generic one.
  const of = uuid => creatableEntries.filter(e => e.uuid === uuid).map(e => e.label);
  assert.deepEqual(of('sgrape.builtin.scalar'), ['Scalar', 'float', 'int', 'uint', 'bool']);
  assert.deepEqual(of('sgrape.builtin.vector'), ['Vector', 'vec2', 'vec3', 'vec4', 'ivec2', 'ivec3', 'ivec4', 'uvec2', 'uvec3', 'uvec4', 'bvec2', 'bvec3', 'bvec4']);
  assert.equal(creatableEntries.filter(e => e.literal).length, 16);
});

// Refactor.50: a fixed entry makes a node locked to its type, titled by it, with no type menu; the
// graph keeps only type and fixedType (never which entry). 固定入口：鎖型別、以型別為標題、沒有型別選單；圖只存 type 與 fixedType。
test('a fixed entry makes a locked node that compiles; the graph does not record the entry', async t => {
  const { creatableEntries } = load(path.join(root, 'src/editor-react/core.ts'));
  const { session, calls } = open(t);
  for (const label of ['vec3', 'bvec2', 'int']) {
    const entry = creatableEntries.find(e => e.label === label);
    session.add(entry.uuid, { x: 0, y: 0 }, entry.params);
  }
  const added = session.graph().stages.pixel.nodes.slice(-3);
  assert.deepEqual(JSON.parse(JSON.stringify(added.map(n => [n.params.type, n.params.fixedType]))), [['vec3', 'vec3'], ['bvec2', 'bvec2'], ['int', 'int']]);
  assert.ok(added.every(n => !JSON.stringify(n).includes('entry')), 'no entry recorded');
  const card = session.snapshot().projection.nodes.find(n => n.id === added[0].id);
  const module = GrapeGraph.registry.get('sgrape.builtin.vector');
  const view = module.presentation(card.data.authored, {});
  assert.deepEqual([view.label, view.typeLocked], ['vec3', true]);
  session.configure(added[0].id, 'vec4');
  assert.equal(session.graph().stages.pixel.nodes.find(n => n.id === added[0].id).params.type, 'vec3', 'the core refuses another type');
  session.connect({ source: added[0].id, sourceHandle: 'out', target: 'pixel_out', targetHandle: 'color' });
  await session.flush();
  assert.match(JSON.parse(calls.filter(c => c.action === 'apply').at(-1).body.runtime).pixel, /vec3\(0\.0, 0\.0, 0\.0\)/);
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
  // Drawn as a wire that does not count: the ghost edge type, its look the theme's (Refactor.78). 畫成不算數的線：ghost 類型，樣子由主題決定。
  assert.equal(view.edges.find(edge => edge.id === 'eFuture').type, 'ghost');
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
  assert.deepEqual([declaration.kind, declaration.name, declaration.type], ['constant', 'cValue', 'float']);
  session.setDeclarationValue(declaration.id, 0.25);
  session.placeDeclaration(declaration.id, { x: 0, y: 0 });
  const ref = session.snapshot().projection.nodes.find(node => node.data.authored.nodeType === 'sgrape.builtin.declaration');
  assert.equal(ref.data.colorGroup, 'constant');
  // The card shows the constant's value and follows its edits (Refactor.55.9). 卡片顯示常數的值，改了就跟著更新。
  assert.equal(ref.data.declaration.value, 0.25);
  session.setDeclarationValue(declaration.id, 0.5);
  assert.equal(session.snapshot().projection.nodes.find(node => node.id === ref.id).data.declaration.value, 0.5);
  session.setDeclarationValue(declaration.id, 0.25);
  assert.equal(session.snapshot().references[declaration.id], 1);
  session.transact(tr('edit.wired', 'Wire updated'), net => net.connect(net.node(ref.id).outputs[0], net.node('sum').port('input', 'a'), GrapeGraph.values.policy));
  session.transact(tr('edit.wired', 'Wire updated'), net => net.connect(net.node('sum').outputs[0], net.node('pixel_out').port('input', 'color'), GrapeGraph.values.policy));
  await session.flush();
  const pixel = JSON.parse(calls.at(-1).body.runtime).pixel;
  assert.match(pixel, /^const float cValue = 0\.25;$/m);
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

// Color Output takes anything (Refactor.42; Q46): vUV's UV output wires straight to it (one UV node, Refactor.64).
test('the UV output of vUV can be wired straight to Color Output and is filled to (x, y, 0.5, 1)', async t => {
  const { session, calls } = open(t);
  session.placeTdValue('vUV', { x: 0, y: 0 });
  const id = session.snapshot().projection.nodes.find(n => n.data.authored.nodeType === 'sgrape.builtin.td_value').id;
  const wire = { source: id, sourceHandle: 'uv', target: 'pixel_out', targetHandle: 'color' };
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
  // The template's input1 shows Grape (its own content); a new input starts transparent, as TD (Refactor.60).
  // 範本的 input1 用 Grape（範本的內容）；新增的輸入一開始是透明，同 TD。
  assert.deepEqual(inputs().map(d => [d.name, d.defaultTexture]), [['input1', 'grape'], ['input2', 'none']]);
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
  assert.deepEqual(['name', 'type'].map(k => session.snapshot().declarations.find(d => d.kind === 'uniform')[k]), ['uValue', 'float']);
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
  assert.match(first.pixel, /^uniform vec4 uColor;$/m);
  assert.deepEqual(first.bindings.filter(b => b.kind === 'uniform').map(b => [b.name, b.type, b.value, b.color]), [['uColor', 'vec4', [1, 0.5, 0, 1], true]]);
  session.setDeclarationValue(uniform().id, [0, 1, 0, 1]);
  await session.flush();
  const second = JSON.parse(calls.filter(c => c.action === 'apply').at(-1).body.runtime);
  assert.equal(second.pixel, first.pixel, 'the GLSL is the same');
  assert.deepEqual(second.bindings.find(b => b.kind === 'uniform').value, [0, 1, 0, 1]);
  // Names in the GLSL panel (Refactor.63.4): the Uniform's name leads to its declaration and selects its reference nodes;
  // the output names lead to Color Output. GLSL 面板的名字：Uniform 名字帶回宣告、選取引用節點；輸出名字帶回 Color Output。
  const state = session.snapshot();
  assert.deepEqual({ ...state.glslDeclarations }, { uColor: uniform().id });
  assert.deepEqual([state.glslVariables.fragColor, state.glslVariables.sg_color], ['pixel_out', 'pixel_out']);
  session.placeDeclaration(uniform().id, { x: 0, y: 200 });
  const refs = [...session.snapshot().projection.nodes.filter(n => n.data.declaration?.id === uniform().id).map(n => n.id)].sort();
  assert.equal(refs.length, 2);
  assert.deepEqual([...session.selectReferences(uniform().id)].sort(), refs);
  assert.deepEqual([...session.snapshot().projection.nodes.filter(n => n.selected).map(n => n.id)].sort(), refs);
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
  assert.deepEqual(session.tdSnapshot(), {}, 'this test opens with a reply that has none');
  await session.check();
  assert.deepEqual(session.tdSnapshot(), { u: [{ mode: 'constant', value: 1 }] });
  session.addUniform();
  await session.flush();
  assert.deepEqual(session.tdSnapshot(), states);
  const said = session.log.entries().at(-1);
  assert.equal(said.source, 'td');
  assert.match(zh(said.message), /uTint.*color0alpha.*lfo1:chan1/);
});

// Uniform C (Refactor.46; Q53): a Uniform's value goes to TD the moment it changes; dragging never
// touches the graph or Undo. Uniform C：值一改就送到 TD；拖曳中不改圖、不進 Undo。
// A stand-in for the browser WebSocket (Uniform D2). 代替瀏覽器 WebSocket。
function fakeSocket() {
  // Heartbeat pings are kept apart (Refactor.71). 心跳的 ping 另外放。
  return { readyState: 0, sent: [], pings: [], send(text) { const message = JSON.parse(text); (message.type === 'ping' ? this.pings : this.sent).push(message); },
    close() { this.readyState = 3; this.onclose?.(); }, onopen: null, onclose: null, onerror: null, onmessage: null };
}
const nextFrame = () => new Promise(resolve => setTimeout(resolve, 30));
test('Uniform values go live over the WebSocket: once per frame, latest only; dragging never edits; dropped while disconnected', async t => {
  const sockets = [];
  const { session, calls } = open(t, undefined, 60000, undefined, () => { const socket = fakeSocket(); sockets.push(socket); return socket; });
  const socket = sockets[0];
  session.addUniform();
  const id = session.snapshot().declarations.find(d => d.kind === 'uniform').id;
  session.previewDeclarationValue(id, 0.05);
  await nextFrame();
  assert.deepEqual(socket.sent, [], 'not connected yet: dropped');
  socket.readyState = 1; socket.onopen();
  const before = { version: session.snapshot().version, graph: JSON.stringify(session.graph()) };
  for (const value of [0.1, 0.2, 0.3, 0.4]) session.previewDeclarationValue(id, value);
  await nextFrame();
  assert.deepEqual(socket.sent, [{ type: 'value', id, value: 0.4, seq: 1 }], 'one per frame, the latest');
  assert.equal(session.snapshot().version, before.version, 'dragging is not an edit');
  assert.equal(JSON.stringify(session.graph()), before.graph);
  session.setDeclarationValue(id, 0.5);
  await nextFrame();
  assert.deepEqual(socket.sent.at(-1).value, 0.5, 'a committed value goes at once; the normal save follows');
  session.history(false);
  await nextFrame();
  assert.deepEqual(socket.sent.at(-1).value, 0, 'Undo sends the value it brings back');
  assert.ok(!calls.some(c => c.action === 'live'), 'never over HTTP any more');
  session.addConstant();
  const constant = session.snapshot().declarations.find(d => d.kind === 'constant').id, count = socket.sent.length;
  session.previewDeclarationValue(constant, 1);
  await nextFrame();
  assert.equal(socket.sent.length, count, 'a constant is never live: changing it changes the program');
  // TD -> editor: state, then values bundles by TD frame; an older bundle is dropped.
  // TD → 編輯器：先 state，再依 TD 影格的數值包；比較舊的包丟掉。
  const seen = [];
  session.tdSubscribe(() => seen.push(session.tdSnapshot()));
  const versionBefore = session.snapshot().version;
  socket.onmessage({ data: JSON.stringify({ type: 'state', frame: 10, uniforms: { [id]: [{ mode: 'constant', value: 0 }] } }) });
  socket.onmessage({ data: JSON.stringify({ type: 'values', frame: 12, values: { [id]: [0.7] } }) });
  socket.onmessage({ data: JSON.stringify({ type: 'values', frame: 11, values: { [id]: [0.2] } }) });
  assert.equal(session.tdSnapshot()[id][0].value, 0.7);
  assert.equal(seen.length, 2);
  assert.equal(session.snapshot().version, versionBefore, 'TD values never touch the graph or the status line');
  // Refactor.67 (D3): TD can no longer read the Grape OP — said once as an error from TD, with TD's reason.
  // TD 讀不到這個 Grape OP 了：以 TD 來源的錯誤說一次，附上原因。
  socket.onmessage({ data: JSON.stringify({ type: 'refused', frame: 13, message: 'No GLSL TOP named shader. Undo the change in TD.' }) });
  const refused = session.log.entries().at(-1);
  assert.deepEqual([refused.level, refused.source, refused.message.code], ['error', 'td', 'live.refused']);
  assert.equal(zh(refused.message), 'TD-Grape 在 TD 裡讀不到這個 Grape OP 了：No GLSL TOP named shader. Undo the change in TD.');
  assert.equal(session.snapshot().version, versionBefore, 'a refusal never touches the graph');
  session.previewDeclarationValue(id, 0.9);
  assert.equal(session.tdSnapshot()[id][0].value, 0.9, 'what was just sent shows at once');
  // Disconnected: fields fall back to the graph's values; values are dropped; it reconnects by itself.
  socket.readyState = 3; socket.onclose();
  assert.deepEqual(session.tdSnapshot()[id], [{ mode: 'constant' }]);
  const sent = socket.sent.length;
  session.previewDeclarationValue(id, 0.3);
  await nextFrame();
  assert.equal(socket.sent.length, sent);
});

// Refactor.71 (human 2026-10-10: TD had been minimized long before the editor showed it): the live connection tells before
// anything is sent. Closed = TD unreachable; no answer to the heartbeat = TD not responding; either way a check brings it back.
// A save in TD is told; a save this page asked for: one line when asked, one when TD says it is saved (Refactor.75.12).
// R.71：即時連線在送出之前就會說。斷了＝連不到 TD；心跳沒回＝TD 沒處理；檢查後恢復。TD 存檔會告訴編輯器；這一頁自己要求的存檔只說一次。
test('the heartbeat is answered or not; a closed live connection is TD unreachable; a save in TD is told', async t => {
  const { LiveValues } = load(path.join(root, 'src/editor-react/live_values.ts'));
  const socket = fakeSocket(), answers = [];
  const live = new LiveValues(() => socket, () => {}, () => {}, { retry: 60000, nextFrame: run => setTimeout(run, 0), answering: responding => answers.push(responding), beat: 20, patience: 70 });
  t.after(() => live.dispose());
  socket.readyState = 1; socket.onopen();
  assert.deepEqual(socket.pings, [{ type: 'ping', seq: 1 }], 'asked at once');
  await new Promise(resolve => setTimeout(resolve, 45));
  assert.deepEqual(answers, [], 'asked again and again, but not yet waited long enough (R.75.13)');
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.deepEqual(answers, [false], 'no answer for long enough: not responding');
  assert.equal(socket.pings.length, 1, 'never two at a time');
  socket.onmessage({ data: JSON.stringify({ type: 'pong', seq: 1, frame: 5 }) });
  assert.deepEqual(answers, [false, true], 'answered again');

  const sockets = [];
  let saving;
  const { session } = open(t, async (action, body, remote) => {
    if (action === 'save') { saving?.(); return { saved: 'test.toe' }; }
    return action === 'state' ? remote.get() : { state: (remote.set({ document: body.document, revision: body.revision + 1, targetId: target }), remote.get().state) };
  }, 60000, undefined, () => { const each = fakeSocket(); sockets.push(each); return each; });
  const ws = sockets[0];
  ws.readyState = 1; ws.onopen();
  ws.readyState = 3; ws.onclose();
  assert.deepEqual([session.snapshot().phase, session.snapshot().link], ['offline', 'unreachable']);
  await session.check();
  assert.equal(session.snapshot().phase, 'ready', 'a check brings it back');
  // A save in TD: said as the editor's own save says it. 在 TD 存檔：和編輯器自己存檔說得一樣。
  const live2 = sockets.at(-1);
  live2.onmessage?.({ data: JSON.stringify({ type: 'saved', frame: 9, file: 'project.toe' }) });
  const told = session.log.entries().at(-1);
  assert.deepEqual([told.source, told.message.code, zh(told.message)], ['td', 'save.done', 'TD 專案已保存：project.toe']);
  // A save this page asked for: one line when asked, one when TD says it is saved; the reply adds none (R.75.12).
  // 這一頁要求的存檔：要求時一行、TD 說存好時一行；回覆不再多說。
  const count = session.log.entries().length;
  saving = () => live2.onmessage?.({ data: JSON.stringify({ type: 'saved', frame: 10, file: 'test.toe' }) });
  await session.save();
  assert.deepEqual(session.log.entries().slice(count).map(entry => zh(entry.message)), ['保存 TD 專案…', 'TD 專案已保存：test.toe']);
});

// Refactor.75.13 (human 2026-10-11: people press again and again): until the reply, pressing again asks for nothing.
// 回覆之前再按，不會再要求一次。
test('a save waits for its reply; pressing again meanwhile asks for nothing', async t => {
  let answer, saves = 0;
  const { session } = open(t, async (action, body, remote) => {
    if (action !== 'save') return remote.get();
    saves++; await new Promise(resolve => { answer = resolve; }); return { saved: 'test.toe' };
  });
  const first = session.save();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(session.snapshot().saving, true);
  await session.save(); await session.save();
  answer(); await first;
  assert.deepEqual([saves, session.snapshot().saving], [1, false]);
});

// Refactor.75.12 (human 2026-10-11: a big project can take more than 10 s to save): the service stops waiting, TD goes on.
// 大專案可能存超過 10 秒：服務不再等，TD 照樣存；說 TD 已開始、存好時會通知，不當成失敗。
test('a save that outlasts the service is said as started, not failed', async t => {
  const { session } = open(t, async action => action === 'save' ? new Response(JSON.stringify({ code: 'application_outcome_unknown',
    error: 'TD started this operation but has not returned its result.' }), { status: 503 }) : undefined);
  await session.save();
  const last = session.log.entries().at(-1);
  assert.deepEqual([last.level, zh(last.message)], ['warning', 'TD 已開始存檔、還沒回覆結果；存好時會另外通知。']);
});

// Refactor.75.14 (human 2026-10-11): TD never took the save; said in the editor's words. TD 沒接手這次存檔：用編輯器的話說。
test('a save TD never took is said plainly, not as the raw reply', async t => {
  const { session } = open(t, async action => action === 'save' ? new Response(JSON.stringify({ code: 'manager_not_responding',
    error: 'TD did not process this request. No changes were made; it will not run later.' }), { status: 503 }) : undefined);
  await session.save();
  const last = session.log.entries().at(-1);
  assert.deepEqual([last.level, zh(last.message)], ['warning', 'TD 沒有處理這次存檔（TD 當時沒有回應），沒有存檔，之後也不會自動存。']);
});

// Refactor.71, covered in the audit since R.67 (human 2026-10-11): while the page is not seen (another tab, another app on a
// phone) the heartbeat does not ask, so it never says "not responding"; seen again, it asks at once.
// 頁面看不到時（別的分頁、手機切到別的 App）心跳不問，也就不會說「沒有回應」；又看得到時馬上問。
test('the heartbeat waits while the page is not seen and asks at once when it is seen again', async t => {
  const { LiveValues } = load(path.join(root, 'src/editor-react/live_values.ts'));
  let shown;
  globalThis.document = { hidden: true, addEventListener: (type, run) => { if (type === 'visibilitychange') shown = run; }, removeEventListener() {} };
  const socket = fakeSocket(), answers = [];
  const live = new LiveValues(() => socket, () => {}, () => {}, { retry: 60000, nextFrame: run => setTimeout(run, 0),
    answering: responding => answers.push(responding), beat: 10, patience: 30 });
  t.after(() => { live.dispose(); delete globalThis.document; });
  socket.readyState = 1; socket.onopen();
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.deepEqual([socket.pings.length, answers], [0, []], 'not seen: not asked, never "not responding"');
  globalThis.document.hidden = false; shown();
  assert.deepEqual(socket.pings.map(ping => ping.seq), [1], 'seen again: asked at once');
});

// Refactor.73.2, covered in the audit since R.67 (human 2026-10-11): a result shows at once; "on its way" only once it has
// lasted 0.1 s, and then as the latest state; sending itself is not touched. 結果立刻顯示；「途中」持續 0.1 秒才顯示，而且是最新的狀態。
test('the foot bar shows "on its way" only once it has lasted, and never over a newer result', async t => {
  const { CalmGate } = load(path.join(root, 'src/editor-react/calm.ts'));
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let changes = 0;
  const gate = new CalmGate('applied', state => state.startsWith('sending'), () => changes++, 30);
  t.after(() => gate.dispose());
  gate.feed('sending 1');
  assert.deepEqual([gate.view('sending 1'), changes], ['applied', 0], 'a send that ends at once is never shown');
  gate.feed('applied 2');
  assert.deepEqual([gate.shown, changes], ['applied 2', 1], 'a result shows at once');
  await wait(45);
  assert.equal(gate.shown, 'applied 2', 'the earlier "on its way" did not come back over the newer result');
  gate.feed('sending 3'); await wait(15); gate.feed('sending 4');
  assert.equal(gate.shown, 'applied 2', 'not yet lasted');
  await wait(30);
  assert.equal(gate.shown, 'sending 4', 'lasted: shown, as the latest state');
  gate.feed('sending 5');
  assert.equal(gate.shown, 'sending 5', 'already on its way: more of it at once');
});

// Refactor.75.1, covered in the audit since R.67 (human 2026-10-11): a panel is placed at once, and again when its bar (not
// just the button) or the window changes size; closing it stops that. 面板馬上放一次；所在的列（不只是按鈕）或視窗大小一變就再放；關掉就停。
test('a panel opened from a bar is placed again when that bar or the window changes size', () => {
  const { followBar } = load(path.join(root, 'src/editor-react/follow_bar.ts'));
  const bar = { name: 'foot-bar' }, anchor = { closest: selector => selector.includes('.foot-bar') ? bar : null };
  let placed = 0, watched, changed, stopped = false;
  const listeners = new Map(), win = { addEventListener: (type, run) => listeners.set(type, run), removeEventListener: type => listeners.delete(type) };
  const stop = followBar(anchor, () => placed++, (target, run) => { watched = target; changed = run; return () => { stopped = true; }; }, win);
  assert.deepEqual([placed, watched], [1, bar], 'placed at once; the bar is what is watched');
  changed(); listeners.get('resize')();
  assert.equal(placed, 3, 'the bar or the window changed size: placed again');
  stop();
  assert.deepEqual([stopped, listeners.size], [true, 0], 'closed: nothing is watched');
});

// Refactor.75.27 (human 2026-10-11): each ghost starts at its own place in the round, the same one every time for its ID;
// the hem repeats every 4 units, so sliding it 4 units loops without a jump. 每隻幽靈從自己的位置開始、同一個 ID 永遠一樣；
// 裙擺每 4 單位重複，滑 4 單位就能無縫循環。
test('ghosts start at their own place in the round, and the hem loops without a jump', () => {
  const { ghostPhase, roundedHem } = load(path.join(root, 'src/editor-react/ghost_motion.ts'));
  const ids = ['n1', 'n2', 'e-n1-out-n2-in', 'abc'], phases = ids.map(ghostPhase);
  assert.deepEqual(phases, ids.map(ghostPhase), 'the same ID, the same start');
  assert.ok(phases.every(p => p >= 0 && p < 1), 'a share of each round (each animation is offset by it times its own length)');
  assert.ok(new Set(phases).size > 1, 'different IDs start at different places');
  // R.76.13 (human 2026-10-11: two ghost wires moved almost together): IDs differing only in their last character spread over
  // the round. 只差最後一個字的 ID 也散開在一輪裡（人類：兩條 Ghost 線幾乎同時動）。
  const run = Array.from({ length: 100 }, (_, i) => ghostPhase('edge_' + i));
  assert.equal(new Set(run.map(p => Math.floor(p * 10))).size, 10, 'edge_0…edge_99 fill every tenth of the round');
  const apart = run.slice(1).map((p, i) => { const d = Math.abs(p - run[i]); return Math.min(d, 1 - d); });
  assert.ok(apart.reduce((a, b) => a + b) / apart.length > .2, 'neighbouring IDs start far apart on average');
  assert.notEqual(ghostPhase('edge_4', 1), ghostPhase('edge_4'), 'a seed gives another start');
  const corners = [...roundedHem().matchAll(/Q(\d+) ([\d.]+)/g)].map(m => [+m[1], +m[2]]);
  const at = x => corners.find(c => c[0] === x)?.[1];
  for (let x = 6; x <= 22; x += 2) assert.equal(at(x), at(x + 4), `corner at ${x} repeats at ${x + 4}`);
});

// Refactor.75 (human 2026-10-10): TD says why it closed the live connection (4001 TD closed, 4002 service stopped, 4003
// reloading, 4004 Grape OP deleted); what the editor only sees afterwards does not replace it; nothing said is "unreachable".
// R.75：TD 在關閉訊框裡說原因；之後編輯器只看到的症狀不會蓋掉它；沒說就是連不到。
test('the reason TD gives for closing is what the light and the message say, and it stays', async t => {
  const sockets = [];
  const { session } = open(t, async () => { throw new TypeError('fetch failed'); }, 60000, undefined,
    () => { const each = fakeSocket(); sockets.push(each); return each; });
  const ws = sockets[0];
  ws.readyState = 1; ws.onopen();
  ws.readyState = 3; ws.onclose({ code: 4001, reason: 'td-closed' });
  assert.deepEqual([session.snapshot().phase, session.snapshot().link], ['offline', 'closed']);
  assert.equal(zh(session.snapshot().message), 'TD 已被關閉。修改保留在瀏覽器；重新開啟 TD 後，請從 Grape OP 再打開編輯器。');
  await session.check();
  assert.equal(session.snapshot().link, 'closed', 'a failed check only confirms it is still away');
  ws.onmessage = null;
  const cases = [[4002, 'stopped'], [4003, 'reloading'], [4004, 'deleted'], [1006, 'unreachable'], [undefined, 'unreachable']];
  for (const [code, link] of cases) {
    const other = open(t, async () => { throw new TypeError('fetch failed'); }, 60000, undefined,
      () => { const each = fakeSocket(); sockets.push(each); return each; }).session;
    const socket = sockets.at(-1);
    socket.readyState = 1; socket.onopen();
    socket.readyState = 3; socket.onclose(code === undefined ? undefined : { code, reason: '' });
    assert.equal(other.snapshot().link, link, String(code));
  }
});

// Audit since R.67: TD says why it closed while a send is on its way; the send then fails and the light keeps TD's reason.
// 送出途中 TD 說了關閉原因；送出接著失敗，燈號保留 TD 說的原因。
test('a reason TD gives while a send is on its way is kept when the send fails', async t => {
  const sockets = [];
  let fail;
  const { session } = open(t, async (action, body, remote) => {
    if (action === 'state') return remote.get();
    await new Promise(resolve => { fail = resolve; });
    throw new TypeError('fetch failed');
  }, 60000, undefined, () => { const each = fakeSocket(); sockets.push(each); return each; });
  sockets[0].readyState = 1; sockets[0].onopen();
  session.addConstant();
  const sending = session.flush();
  await new Promise(resolve => setTimeout(resolve, 0));
  sockets[0].readyState = 3; sockets[0].onclose({ code: 4002, reason: 'service-stopped' });
  fail(); await sending;
  assert.deepEqual([session.snapshot().phase, session.snapshot().link], ['offline', 'stopped']);
});

// Refactor.75.16 (human 2026-10-11: the time "as the case needs"): today the time, this year the day, before that the year.
// 存檔時間看狀況：今天只寫時間、今年加月日、更早再加年。
test('a save time says only as much as it needs', () => {
  const now = new Date(2026, 9, 11, 9, 0).getTime();
  assert.deepEqual([new Date(2026, 9, 11, 8, 6), new Date(2026, 7, 8, 8, 6), new Date(2025, 7, 8, 8, 6)].map(at => clockOf(at.getTime(), now)),
    ['08:06', '8/8 08:06', '2025/8/8 08:06']);
});

// Refactor.73 (human 2026-10-10): the editor never saves the TD project, so after an apply it says which revision the file
// holds and how far it is behind, briefly; a save in TD moves that on. R.73：編輯器不會自己存 TD 專案，套用後簡短說出檔案存的是哪一版、
// 落後多少；在 TD 存檔後跟著更新。
test('after an apply the editor says how far the saved project is behind; a save in TD moves it on', async t => {
  const at = new Date(); at.setHours(20, 29, 0, 0);
  let projectSaved = { revision: 3, time: at.getTime() };
  const sockets = [];
  const { session } = open(t, async (action, body, remote) => {
    if (action === 'state') return { ...remote.get(), projectSaved };
    remote.set({ document: body.document, revision: body.revision + 1, targetId: target });
    return { state: remote.get().state, projectSaved };
  }, 60000, undefined, () => { const each = fakeSocket(); sockets.push(each); return each; });
  session.addConstant();
  await session.flush();
  assert.equal(zh(session.snapshot().message), '已套用；上次存檔 r3（20:29），有 2 版未存');
  sockets[0].readyState = 1; sockets[0].onopen();
  projectSaved = { revision: 5, time: at.getTime() };
  sockets[0].onmessage({ data: JSON.stringify({ type: 'saved', frame: 3, file: 'project.toe', projectSaved }) });
  assert.equal(zh(session.snapshot().message), 'TD 專案已保存：project.toe（r5）');
  assert.deepEqual(session.snapshot().saved, projectSaved);
  // Before TD-Grape saw a save, only the time is known. TD-Grape 看到存檔之前只知道時間。
  projectSaved = { revision: null, time: at.getTime() };
  session.addConstant();
  await session.flush();
  assert.equal(zh(session.snapshot().message), '已套用；專案尚需保存（上次存檔 20:29）');
});

// Selection (Refactor.49; design-interview Q33, Q39): Ctrl toggles, Shift only adds, plain replaces
// (a selected node keeps its group); nodes and wires never together; the primary is the last pressed.
// 選取：Ctrl 切換、Shift 只加選、一般取代（已選的保留整組）；節點與接線不混選；主要＝最後按下的。
test('selection follows TD: Ctrl toggles, Shift adds, nodes and wires apart, a primary that is never saved', async t => {
  const { session, calls } = open(t);
  const selected = () => session.snapshot().projection.nodes.filter(n => n.selected).map(n => n.id).sort();
  const wires = () => session.snapshot().projection.edges.filter(e => e.selected).map(e => e.id);
  const version = session.snapshot().version, graph = JSON.stringify(session.graph());
  session.pressNode('a', 'only');
  assert.deepEqual([selected(), session.primarySnapshot()], [['a'], 'a']);
  session.pressNode('b', 'add');
  assert.deepEqual([selected(), session.primarySnapshot()], [['a', 'b'], 'b']);
  session.pressNode('a', 'only');
  assert.deepEqual([selected(), session.primarySnapshot()], [['a', 'b'], 'a'], 'pressing a selected node keeps the group');
  session.pressNode('a', 'toggle');
  assert.deepEqual([selected(), session.primarySnapshot()], [['b'], 'b'], 'Ctrl takes it away; the primary moves on');
  session.pressNode('b', 'add');
  assert.deepEqual(selected(), ['b'], 'Shift never takes away');
  const edge = session.snapshot().projection.edges[0].id;
  session.clickEdge(edge, 'only');
  assert.deepEqual([selected(), wires(), session.primarySnapshot()], [[], [edge], null], 'a wire clears the nodes');
  session.pressNode('sum', 'toggle');
  assert.deepEqual([selected(), wires()], [['sum'], []], 'a node clears the wires, even with Ctrl');
  // A box is applied once, on release (Refactor.50.1). 框選放開時套用一次。
  session.clickEdge(edge, 'only');
  session.boxSelect(new Set(['sum', 'idle']), ['idle']);
  assert.deepEqual([selected(), wires(), session.primarySnapshot()], [['idle', 'sum'], [], 'idle'], 'a box clears wires; the primary is the first touched');
  session.pressNode('sum', 'only');
  session.boxSelect(new Set(['sum', 'a']), ['a']);
  assert.equal(session.primarySnapshot(), 'sum', 'a box keeps the primary when it is still selected');
  session.boxSelect(new Set(['a', 'idle']), ['b', 'idle', 'a']);
  assert.deepEqual([selected(), session.primarySnapshot()], [['a', 'idle'], 'idle'], 'otherwise the first node touched that is selected');
  session.clearSelection();
  assert.deepEqual([selected(), wires(), session.primarySnapshot()], [[], [], null]);
  await session.flush();
  assert.equal(session.snapshot().version, version, 'selection is not an edit');
  assert.equal(JSON.stringify(session.graph()), graph);
  assert.ok(!calls.some(c => c.action === 'apply'), 'never sent to TD');
});

// Refactor.49.1 (human 2026-10-09): wire multi-selection behaves exactly like node multi-selection.
// 接線的多選行為和節點完全一樣。
test('wires follow the node rules: Shift adds, Ctrl toggles, a plain click on a selected one keeps the group', t => {
  const { session } = open(t);
  session.transact('wire', net => {
    net.connect(net.node('a').outputs[0], net.node('sum').port('input', 'a'), GrapeGraph.values.policy);
    net.connect(net.node('b').outputs[0], net.node('sum').port('input', 'b'), GrapeGraph.values.policy);
  });
  const [x, y, z] = session.snapshot().projection.edges.map(e => e.id);
  const wires = () => session.snapshot().projection.edges.filter(e => e.selected).map(e => e.id).sort();
  session.clickEdge(x, 'only');
  session.clickEdge(y, 'add');
  assert.deepEqual(wires(), [x, y].sort(), 'Shift adds');
  session.clickEdge(y, 'add');
  assert.deepEqual(wires(), [x, y].sort(), 'Shift never takes away');
  session.clickEdge(x, 'only');
  assert.deepEqual(wires(), [x, y].sort(), 'a plain click on a selected wire keeps the group');
  session.clickEdge(x, 'toggle');
  assert.deepEqual(wires(), [y], 'Ctrl takes it away');
  session.clickEdge(z, 'only');
  assert.deepEqual(wires(), [z], 'a plain click on another wire replaces');
});

// Refactor.51: the one source of the Grape OP list (TD's /api/shaders); bad rows are dropped, a TD refusal
// is said in the editor's words. 「專案有哪些 Grape OP」的唯一來源；壞的列丟掉，TD 拒絕時用編輯器自己的話說。
test('the Grape OP list comes from /api/shaders only', async () => {
  const { listGrapeOps } = load(path.join(root, 'src/editor-react/grape_ops.ts'));
  const seen = [];
  const { rows, td } = await listGrapeOps('tok', async (url, options) => {
    seen.push([url, options.headers['X-Sgrape-Token']]);
    return new Response(JSON.stringify({ shaders: [{ id: 'a'.repeat(32), path: '/project1/one', kind: 'top' }, { id: 'bad', path: '/x' }],
      td: { file: 'p.3.toe', build: '2025.33230' } }));
  });
  assert.deepEqual(JSON.parse(JSON.stringify(rows)), [{ id: 'a'.repeat(32), path: '/project1/one', kind: 'top' }]);
  assert.deepEqual(JSON.parse(JSON.stringify(td)), { file: 'p.3.toe', build: '2025.33230' }, 'the list also says which TD answered');
  assert.deepEqual(seen, [['/api/shaders', 'tok']]);
  await assert.rejects(listGrapeOps('', async () => new Response(JSON.stringify({ error: 'Editor assets are ready; the new TD Manager is not connected yet' }), { status: 501 })),
    error => /not connected/.test(error.message));
});

// Refactor.54: adding from the two entries. One list (add_entries.ts); a dropped wire lists what fits, rehearsed on
// a discarded candidate so it follows the real rules; adding + wiring is one step; a picked-up wire moves.
// 新增節點的兩個入口：同一份清單；放開的線只列接得上的（在丟棄的候選上預演，規則同真正的修改）；新增＋接線是一步；拿起的線可搬。
test('a dropped wire lists only what fits, and adding wires it in one step', t => {
  const { session } = open(t);
  const { addChoices, wireOrder } = load(path.join(root, 'src/editor-react/add_entries.ts'));
  const choices = addChoices(session.snapshot().declarations, key => key), before = clone(session.graph());
  const end = { node: 'a', port: 'out', side: 'output' };
  const fits = choices.map(choice => [choice, session.portFor(choice.spec, end)]).filter(([, port]) => port);
  assert.ok(fits.length > 10 && fits.length < choices.length, 'some fit a float output, not all');
  assert.deepEqual(clone(session.graph()), before, 'rehearsals never change the graph');
  const add = fits.find(([choice]) => choice.key === 'add');
  assert.equal(add[1].port, 'a');
  session.addNode(add[0].spec, { x: 5, y: 5 }, { end, port: add[1].port });
  const graph = session.graph(), added = graph.stages.pixel.nodes.at(-1);
  assert.equal(added.nodeType, 'sgrape.builtin.add');
  assert.ok(graph.stages.pixel.edges.some(edge => edge.from[0] === 'a' && edge.to[0] === added.id && edge.to[1] === 'a'));
  session.history(false);
  assert.deepEqual(clone(session.graph()), before, 'one Undo removes the node and its wire');
  assert.deepEqual([...wireOrder('vec3', 'output')].slice(0, 2), ['vector_split', 'split'], 'the legacy order for a vector output');
});

// Refactor.77 (human 2026-10-11; design-interview Q37 1-5 supplement): a dropped wire is looked up in the table the build wrote
// with the real rules, so a vector wire lists nodes in the type that takes it (R.54 rehearsed default types only: a vec4 wire
// listed three nodes). Adding still goes through the real edit, in the table's configuration, one Undo step.
// 拉線新增查建置時用真正規則寫好的表，向量線也列得出用那個型別建立的節點（R.54 只試預設型別：vec4 只列三個）；新增仍走真正的修改、一步 Undo。
test('a dropped vector wire lists nodes in the type that takes it, from the build-time table', t => {
  const { session } = open(t);
  const { addChoices } = load(path.join(root, 'src/editor-react/add_entries.ts'));
  const choices = addChoices(session.snapshot().declarations, key => key);
  session.addNode({ nodeType: 'sgrape.builtin.combine', params: { type: 'vec4' } }, { x: 400, y: 0 });
  const wide = session.graph().stages.pixel.nodes.at(-1).id, end = { node: wide, port: 'out', side: 'output' };
  const fits = new Map(choices.map(choice => [choice.key, session.wireFit(choice.id, choice.spec, end)]).filter(([, fit]) => fit));
  assert.ok(fits.size > 30, 'a vec4 wire lists many nodes (' + fits.size + ')');
  for (const key of ['add', 'length', 'vector_split', 'swizzle', 'replace']) assert.ok(fits.get(key), key + ' takes a vec4 wire');
  assert.deepEqual(clone(fits.get('add')), { port: 'a', type: 'vec4', configure: { type: 'vec4' } });
  const before = clone(session.graph()), add = choices.find(choice => choice.key === 'add'), fit = fits.get('add');
  session.addNode(add.spec, { x: 0, y: 0 }, { end, port: fit.port, configure: fit.configure });
  const made = session.graph().stages.pixel.nodes.at(-1);
  assert.equal(made.params.type, 'vec4', 'made in the type the table chose');
  assert.ok(session.graph().stages.pixel.edges.some(edge => edge.from[0] === wide && edge.to[0] === made.id && edge.to[1] === 'a'));
  session.history(false);
  assert.deepEqual(clone(session.graph()), before, 'one Undo removes the node and its wire');
  // From a vec2 wire Combine is one size bigger, the wire on x as one group: the module's preference (legacy kept it in the
  // editor). 由 vec2 線新增的 Combine 大一號、線接 x 成一組：模組自己的偏好（舊產品寫在編輯器）。
  session.addNode({ nodeType: 'sgrape.builtin.vec2', params: {} }, { x: 0, y: 300 });
  const pair = session.graph().stages.pixel.nodes.at(-1).id, fromPair = { node: pair, port: 'out', side: 'output' };
  const combine = choices.find(choice => choice.key === 'combine'), joined = session.wireFit(combine.id, combine.spec, fromPair);
  assert.deepEqual(clone(joined), { port: 'x', type: 'vec2', configure: { type: 'vec3' } });
  session.addNode(combine.spec, { x: 0, y: 400 }, { end: fromPair, port: joined.port, configure: joined.configure });
  const assembly = session.graph().stages.pixel.nodes.at(-1);
  assert.equal(assembly.params.type, 'vec3');
  assert.deepEqual(clone(assembly.params.groups), { x: 'vec2' });
});

// The full wire-drop audit (Refactor.77): only with `npm run test:wire-drop`. Every add-menu entry, every value type, both
// directions: the table agrees with rehearsing every configuration the old way, and every row really adds and wires. Rerun
// it, and look at the timings and the table's size, whenever types or node modules change (new types such as matrices,
// matrix multiply's operand combinations; docs/development/TESTING.md).
// 拉線新增完整稽核（R.77）：只在 `npm run test:wire-drop` 跑。每個入口、每種型別、兩個方向：表與「逐一試每個設定」的舊做法一致，
// 表上每一格真的能新增並接上。型別或節點模組改了（例如加矩陣、矩陣乘法的運算元組合）就重跑，並看時間與表的大小。
test('wire-drop table: full audit against rehearsing every configuration', { skip: process.env.npm_lifecycle_event !== 'test:wire-drop' }, t => {
  const { session } = open(t);
  const { addChoices } = load(path.join(root, 'src/editor-react/add_entries.ts'));
  const table = bootstrap.typeContract.wireDrop, types = bootstrap.typeContract.valueTypes;
  const choices = addChoices(session.snapshot().declarations, key => key).filter(choice => table[choice.id]);
  // One Router per type gives an output and an input of that type. 每種型別一個 Router，提供該型別的輸出與輸入。
  const routers = {};
  for (const type of types) {
    session.addNode({ nodeType: 'sgrape.builtin.router', params: {} }, { x: 0, y: 0 });
    const id = session.graph().stages.pixel.nodes.at(-1).id;
    if (session.graph().stages.pixel.nodes.at(-1).params.type !== type) session.configure(id, type);
    routers[type] = id;
  }
  class Done extends Error {}
  // The old way: try the entry as made and in every type, every port, through the network's own planner.
  // 舊做法：入口原樣與每個型別、每個接孔，用網路自己的規劃逐一試。
  let serial = 0;
  const rehearsed = (choice, end) => {
    let fits = false;
    try { session.document.change(document => {
      const net = document.networks.get('pixel'), side = end.side;
      for (const configure of [undefined, ...types.map(type => ({ type }))]) {
        const id = 'audit' + serial++;
        net.insert({ id, nodeType: choice.spec.nodeType, params: structuredClone(choice.spec.params), ui: { x: 0, y: 0 } });
        try { if (configure) net.node(id).configure(configure); } catch { continue; }
        const ports = Object.keys(net.node(id).interface[side === 'output' ? 'inputs' : 'outputs']);
        // A module's `wire` throws for a group that cannot fit; that is "does not fit", as the editor treats it.
        // 模組的 `wire` 遇到放不下的分量組會拋錯，這就是「接不上」，和編輯器的處理一樣。
        fits = ports.some(port => { try { return net.plan(GrapeGraph.values.policy, { kind: 'wire', ...(side === 'output'
          ? { from: { node: end.node, port: end.port }, to: { node: id, port } } : { from: { node: id, port }, to: { node: end.node, port: end.port } }) }).ok; } catch { return false; } });
        if (fits) break;
      }
      throw new Done();
    }); } catch (error) { if (!(error instanceof Done)) throw error; }
    return fits;
  };
  const disagree = [], failed = [];
  let rows = 0;
  for (const type of types) for (const side of ['output', 'input']) {
    const end = { node: routers[type], port: side === 'output' ? 'out' : 'value', side };
    for (const choice of choices) {
      const fit = session.wireFit(choice.id, choice.spec, end), old = rehearsed(choice, end);
      if (!!fit !== old) disagree.push(choice.key + ' ' + side + ' ' + type + ': table ' + !!fit + ', rehearsed ' + old);
      if (!fit) continue;
      rows++;
      const count = session.graph().stages.pixel.edges.length;
      try {
        session.addNode(choice.spec, { x: 0, y: 0 }, { end, port: fit.port, configure: fit.configure });
        const made = session.graph().stages.pixel.nodes.at(-1).id, edges = session.graph().stages.pixel.edges;
        const wired = edges.some(edge => side === 'output' ? edge.from[0] === end.node && edge.to[0] === made && edge.to[1] === fit.port
          : edge.from[0] === made && edge.from[1] === fit.port && edge.to[0] === end.node);
        if (!wired) failed.push(choice.key + ' ' + side + ' ' + type + ': not wired');
        session.history(false);
      } catch (error) { failed.push(choice.key + ' ' + side + ' ' + type + ': ' + error.message); }
      if (session.graph().stages.pixel.edges.length !== count) failed.push(choice.key + ' ' + side + ' ' + type + ': Undo left edges');
    }
  }
  // Opening Create node from a vec4 wire: the table, R.54's default-only rehearsal, and rehearsing every configuration.
  // 從 vec4 線打開新增面板：查表、R.54 只試預設、逐一試每個設定。
  const all = addChoices(session.snapshot().declarations, key => key), end = { node: routers.vec4, port: 'out', side: 'output' };
  const time = run => { const start = performance.now(); for (let i = 0; i < 5; i++) run(); return (performance.now() - start) / 5; };
  const lookup = time(() => all.map(choice => session.wireFit(choice.id, choice.spec, end)));
  const defaults = time(() => all.map(choice => session.portFor(choice.spec, end)));
  const everything = time(() => choices.map(choice => rehearsed(choice, end)));
  const bytes = JSON.stringify(table).length, packed = require('node:zlib').gzipSync(JSON.stringify(table)).length;
  console.log('wire-drop audit: ' + choices.length + ' entries x ' + types.length + ' types x 2 directions, ' + rows + ' rows added and wired');
  console.log('opening from a vec4 wire: table ' + lookup.toFixed(2) + ' ms, default-only rehearsal ' + defaults.toFixed(1) + ' ms, every configuration ' + everything.toFixed(1) + ' ms');
  console.log('table size: ' + bytes + ' bytes, ' + packed + ' gzipped');
  assert.deepEqual(disagree, [], 'the table agrees with rehearsing every configuration');
  assert.deepEqual(failed, [], 'every row adds and wires, and one Undo takes it back');
});

// Refactor.77.8: the conversion label's hand is Fluent UI Emoji's (MIT), kept unchanged in src/third_party with its licence.
// 轉型標籤的手取自 Fluent UI Emoji（MIT），原檔與授權留在 src/third_party，路徑不改。
test('the crossed fingers path is the third-party file, unchanged, with its licence beside it', () => {
  const { crossedFingersPath, crossedFingersViewBox } = load(path.join(root, 'src/editor-react/crossed_fingers.ts'));
  const folder = path.join(root, 'src/third_party/fluentui-emoji'), svg = fs.readFileSync(path.join(folder, 'crossed_fingers_high_contrast_default.svg'), 'utf8');
  assert.equal(crossedFingersPath, /<path d="([^"]+)"/.exec(svg)[1]);
  assert.equal(crossedFingersViewBox, /viewBox="([^"]+)"/.exec(svg)[1]);
  assert.match(fs.readFileSync(path.join(folder, 'LICENSE'), 'utf8'), /MIT License[\s\S]*Copyright \(c\) Microsoft Corporation/);
});

// Dragging a wire previews what dropping it changes (Refactor.57): rehearsed with the real edit, never written.
// 拖線預告放開後會改變什麼：用真正的修改預演，不寫入。
test('a wire preview names the inputs it merges and the wires it replaces, exactly as the drop does', t => {
  const { session } = open(t);
  session.addNode({ nodeType: 'sgrape.builtin.combine', params: { type: 'vec4' } }, { x: 400, y: 0 });
  const join = session.graph().stages.pixel.nodes.at(-1).id;
  session.addNode({ nodeType: 'sgrape.builtin.vec3', params: {} }, { x: 0, y: 200 });
  const wide = session.graph().stages.pixel.nodes.at(-1).id;
  session.connect({ source: 'a', sourceHandle: 'out', target: join, targetHandle: 'y' });
  session.connect({ source: 'b', sourceHandle: 'out', target: join, targetHandle: 'w' });
  const before = clone(session.graph()), intoY = before.stages.pixel.edges.find(edge => edge.to[0] === join && edge.to[1] === 'y').id;
  const drop = { source: wide, sourceHandle: 'out', target: join, targetHandle: 'x' };
  const preview = session.wirePreview(drop);
  assert.deepEqual(clone(preview), { node: join, port: 'x', type: 'vec3', merged: ['y', 'z'], replaced: [intoY] });
  assert.deepEqual(clone(session.graph()), before, 'a preview never changes the graph');
  session.connect(drop);
  const after = session.graph().stages.pixel;
  const node = after.nodes.find(n => n.id === join);
  assert.deepEqual(clone(node.params.groups), { x: 'vec3' });
  assert.ok(!after.edges.some(edge => edge.id === intoY), 'the previewed wire is the one replaced');
  assert.ok(after.edges.some(edge => edge.to[0] === join && edge.to[1] === 'w'), 'w keeps its wire');
  // Any node: dropping on a wired input previews the wire it replaces (Refactor.78); an empty input has nothing to show.
  // 任何節點：放到已接線的輸入上，預告會被換掉的線（R.78）；空的輸入沒有要預告的。
  assert.equal(session.wirePreview({ source: 'a', sourceHandle: 'out', target: 'sum', targetHandle: 'b' }), null);
  session.connect({ source: 'a', sourceHandle: 'out', target: 'sum', targetHandle: 'b' });
  const intoB = session.graph().stages.pixel.edges.find(edge => edge.to[0] === 'sum' && edge.to[1] === 'b').id;
  assert.deepEqual(clone(session.wirePreview({ source: 'b', sourceHandle: 'out', target: 'sum', targetHandle: 'b' })),
    { node: 'sum', port: 'b', type: 'float', merged: [], replaced: [intoB] });
  // From that input onto empty canvas, the pull is previewed by the release's own edit (Refactor.78.1); nothing changes
  // until released. 從那個輸入拉到空白處：用放開時同一個修改預告拔線（R.78.1）；放開前什麼都不變。
  const wired = clone(session.graph());
  assert.deepEqual(clone(session.pullPreview('sum', 'b')), { node: 'sum', port: 'b', type: '', merged: [], replaced: [intoB] });
  assert.equal(session.pullPreview('sum', 'a'), null, 'an empty input has no wire to pull');
  assert.deepEqual(clone(session.graph()), wired);
  session.disconnectInput('sum', 'b');
  assert.ok(!session.graph().stages.pixel.edges.some(edge => edge.id === intoB), 'the release pulls the previewed wire');
});

test('a picked-up wire moves to another input in one step', t => {
  const { session } = open(t);
  session.transact('wire', net => net.connect(net.node('a').outputs[0], net.node('sum').port('input', 'a'), GrapeGraph.values.policy));
  const edge = session.graph().stages.pixel.edges.find(item => item.from[0] === 'a' && item.to[0] === 'sum');
  session.moveWire(edge.id, { node: 'sum', port: 'b' });
  const edges = session.graph().stages.pixel.edges.filter(item => item.from[0] === 'a' && item.to[0] === 'sum');
  assert.deepEqual(clone(edges.map(item => item.to[1])), ['b']);
  session.history(false);
  assert.deepEqual(clone(session.graph().stages.pixel.edges.filter(item => item.from[0] === 'a' && item.to[0] === 'sum').map(item => item.to[1])), ['a']);
});

test('the add list carries categories, sources and search', t => {
  const { session } = open(t);
  const { addChoices, searchChoices, topCategories } = load(path.join(root, 'src/editor-react/add_entries.ts'));
  const choices = addChoices(session.snapshot().declarations, key => key);
  assert.equal(topCategories(choices)[0], 'source', 'Source first, as the legacy browser');
  assert.ok(choices.some(choice => choice.path[0] === 'source' && choice.path[1] === 'tdBuiltIn'));
  assert.ok(searchChoices(choices, 'sub').some(choice => choice.key === 'subtract'));
  assert.equal(searchChoices(choices, '').length, choices.length);
});

// Refactor.54.2: ports know whether they are wired, both ends, and follow Undo (the source node is refreshed too).
// 接孔知道自己有沒有接線（兩端都知道），Undo 也跟著變（來源節點也會更新）。
test('the projection marks wired inputs and outputs, and follows Undo', t => {
  const { session } = open(t);
  const node = id => session.snapshot().projection.nodes.find(item => item.id === id).data;
  assert.deepEqual(clone(node('a').wired), []);
  session.transact('wire', net => net.connect(net.node('a').outputs[0], net.node('sum').port('input', 'a'), GrapeGraph.values.policy));
  assert.deepEqual(clone(node('a').wired), ['out']);
  assert.deepEqual(clone(node('sum').connected), ['a']);
  session.history(false);
  assert.deepEqual(clone(node('a').wired), [], 'the source forgets the wire after Undo');
});

// Refactor.59: a vector node made from a wire takes the other end's component names, in the same step (legacy
// graph_ui.js:2346). 由拉線新增的向量節點沿用另一端的分量名稱樣式，同一步完成。
test('a vector node added from a wire takes the component names of the node at the other end', t => {
  const { session } = open(t);
  session.addNode({ nodeType: 'sgrape.builtin.color', params: {} }, { x: 0, y: 300 });
  const color = session.graph().stages.pixel.nodes.at(-1).id, before = clone(session.graph());
  session.addNode({ nodeType: 'sgrape.builtin.vector_split', params: { type: 'vec4' } }, { x: 300, y: 300 },
    { end: { node: color, port: 'out', side: 'output' }, port: 'value' });
  const split = session.graph().stages.pixel.nodes.at(-1);
  assert.equal(split.ui.componentNames, 'rgba');
  session.addNode({ nodeType: 'sgrape.builtin.add', params: {} }, { x: 300, y: 500 }, { end: { node: 'a', port: 'out', side: 'output' }, port: 'a' });
  assert.equal(session.graph().stages.pixel.nodes.at(-1).ui.componentNames, undefined, 'only vector nodes take the names');
  session.history(false); session.history(false);
  assert.deepEqual(clone(session.graph()), before, 'Undo removes the node with its names');
});

// Texture inputs (Refactor.60, 61.1): TD's word about rewiring is only a nudge over the socket; connected again, the
// inputs are asked once more, since rewiring while away sent no word. 接線通知只是提醒；重新連上時再問一次。
test('the inputs are asked again when TD says it was rewired and when the socket connects again', async t => {
  const sockets = [], wired = { inputs: [{ id: 'tex', node: 'in1', source: '/project1/moviefilein1' }] };
  const { session, calls } = open(t, (action, body, remote) => action === 'inputs' ? wired : action === 'state' ? remote.get() : { saved: 'test.toe' },
    60000, undefined, () => { const socket = fakeSocket(); sockets.push(socket); return socket; });
  const asked = () => calls.filter(c => c.action === 'inputs').length;
  const socket = sockets[0];
  socket.readyState = 1; socket.onopen();
  await nextFrame();
  assert.equal(asked(), 0, 'never asked before: connecting asks nothing');
  await session.refreshInputs();
  assert.deepEqual(JSON.parse(JSON.stringify(session.inputsSnapshot())), { tex: { node: 'in1', source: '/project1/moviefilein1', info: null } });
  const taken = session.inputsTake();
  socket.onmessage({ data: JSON.stringify({ type: 'inputs', frame: 3 }) });
  await nextFrame();
  assert.equal(asked(), 2, 'rewired in TD: asked again');
  socket.readyState = 3; socket.onclose();
  socket.readyState = 1; socket.onopen();
  await nextFrame();
  assert.equal(asked(), 3, 'connected again: asked once');
  assert.ok(session.inputsTake() > taken, 'open previews take new snapshots');
  // After an apply (R.61.5): asked again, but new snapshots only when what is wired in changed. 套用後再問，接的東西變了才重拍。
  const still = session.inputsTake();
  socket.onmessage({ data: JSON.stringify({ type: 'inputs', frame: 4, retake: false }) });
  await nextFrame();
  assert.equal(asked(), 4);
  assert.equal(session.inputsTake(), still, 'same wiring: no new snapshots');
  wired.inputs[0].source = '/project1/moviefilein2';
  socket.onmessage({ data: JSON.stringify({ type: 'inputs', frame: 5, retake: false }) });
  await nextFrame();
  assert.ok(session.inputsTake() > still, 'other wiring: new snapshots');
});


// A compile failure in TD (Refactor.63): TD's log read for its lines; a stuck Shader known when opening; back to the
// graph TD runs as one Undo step, then delivered as any edit. TD 編譯失敗：讀出行號；開圖時就知道 Shader 卡住；回到 TD 正在跑的圖。
test('TD compile errors are read for their lines; a stuck Shader can go back to the last known good graph', async t => {
  const { glslErrors, errorNodes } = load(path.join(root, 'src/editor-react/glsl_errors.ts'));
  // TD's own log, as measured 2026-10-10. TD 自己的紀錄（實測）。
  const log = ['Vertex Shader Compile Results:', '', 'Compiled Successfully', '', '=============', 'Pixel Shader Compile Results:',
    "ERROR: /project1/grape/pixel_shader:4: 'undefined_thing' : undeclared identifier ", 'ERROR: 1 compilation errors.  No code generated.', ''].join('\n');
  assert.deepEqual(JSON.parse(JSON.stringify(glslErrors(log))), [{ line: 4, text: "'undefined_thing' : undeclared identifier" }]);
  // Error-node marks (Refactor.63.6 trial): the exact line's node, only for the GLSL that failed. 錯誤節點標記：確定的行、只對失敗的那份。
  const lines = [{ line: 3, node: 'a' }, { line: 4, node: 'b' }];
  assert.deepEqual([...errorNodes({ log, pixel: 'glsl' }, 'glsl', lines)], ['b']);
  assert.equal(errorNodes({ log, pixel: 'glsl' }, 'edited since', lines), null, 'changed since: nothing marked');
  assert.equal(errorNodes({ log, pixel: 'glsl' }, 'glsl', [{ line: 3, node: 'a' }]), null, 'no exact line: nothing guessed');
  assert.equal(errorNodes(undefined, 'glsl', lines), null);
  // TD runs revision 3 (the fixture); the graph moved to 4 with a program that failed. TD 跑第 3 版；圖到第 4 版、程式失敗。
  const good = JSON.stringify(fixture()), edited = fixture();
  edited.stages.pixel.nodes[0].ui = { x: 999, y: 0 };
  const failure = { kind: 'compile', revision: 4, log: 'ERROR: /p/pixel_shader:3: oops', pixel: 'bad' };
  const sent = [];
  const fetcher = async (url, options) => {
    const action = url.split('?')[0].split('/').at(-1), body = options.body && JSON.parse(options.body);
    if (action === 'apply') sent.push(body);
    return new Response(JSON.stringify(action === 'apply'
      ? { state: { document: body.document, revision: body.revision + 1, targetId: target, runtimeRevision: body.revision + 1 } }
      : { saved: 'test.toe' }));
  };
  const loaded = { state: { document: JSON.stringify(edited), revision: 4, runtimeRevision: 3, targetId: target, failure,
    lastKnownGood: { revision: 3, document: good } }, format: 'grape-next-1', shaderKind: 'top', target: '/test/family',
    frontendCompiler: { protocol: GrapeTopCompiler.protocol, catalogHash: bootstrap.catalogHash, required: true } };
  const session = new EditorSession(new HostClient(target, '', fetcher, 20000), bootstrap, loaded, 0, 60000, undefined, '9.9.9 Test');
  t.after(() => session.dispose());
  assert.equal(session.snapshot().stuck.failure.log, failure.log, 'known as soon as the editor opens');
  session.revertToLastGood();
  assert.equal(JSON.stringify(session.graph()), good, 'back to the graph TD runs');
  assert.equal(session.snapshot().undo, true, 'one Undo step');
  await session.flush();
  assert.deepEqual(JSON.parse(sent.at(-1).document), saved(session.graph()), 'delivered as any edit');
  assert.equal(session.snapshot().stuck, undefined, 'TD runs a program again: no longer stuck');
});

// Refactor.63.2 (human 2026-10-10): going back to the program TD still runs, in the same tab, clears a stuck Shader. The
// program is sent although TD already runs it, so TD records it as running and forgets the failure (it compiles nothing).
// 同一個分頁回到 TD 仍在跑的程式時，卡住要解除：照樣送程式，TD 記成正在跑並忘掉失敗（不重新編譯）。
test('going back to the running program in the same tab clears a stuck Shader', async t => {
  let failing = false, failure = null, running = 4;
  const { session, calls } = open(t, async (action, body, remote) => {
    if (action === 'state') return remote.get();
    const revision = body.revision + 1;
    if (body.runtime && failing) failure = { kind: 'compile', revision, log: 'ERROR: /p/pixel_shader:5: oops', pixel: JSON.parse(body.runtime).pixel };
    else if (body.runtime) { failure = null; running = revision; }
    const state = { document: body.document, revision, targetId: target, runtimeRevision: running,
      ...(failure ? { failure, lastKnownGood: { revision: running, document: '{}' } } : {}) };
    remote.set(state);
    return { state, shaderError: body.runtime && failing ? failure.log : null, shaderFailure: body.runtime && failing ? 'compile' : null };
  });
  session.transact('value', net => setValue(net, 'a', 3)); await session.flush();
  assert.equal(session.snapshot().stuck, undefined, 'running');
  failing = true;
  session.transact('value', net => setValue(net, 'a', 4)); await session.flush();
  assert.equal(session.snapshot().stuck.failure.kind, 'compile', 'stuck');
  failing = false;
  session.transact('value', net => setValue(net, 'a', 3)); await session.flush();
  assert.notEqual(calls.at(-1).body.runtime, null, 'the running program is sent again while stuck');
  assert.equal(session.snapshot().stuck, undefined, 'no longer stuck');
  session.nodeChanges([{ type: 'position', id: 'a', position: { x: 300, y: 90 }, dragging: false }]); await session.flush();
  assert.equal(calls.at(-1).body.runtime, null, 'not stuck: a layout edit sends the graph only, as before');
});

// Node upgrades (Refactor.65, human 2026-10-10): a graph stored with older node forms opens in the current ones, with a
// replacement report, and is sent like any edit — the program too, since TD may run the older one.
// 節點升級：存著舊寫法的圖用目前的寫法打開、附替換報告，照一般編輯送出——程式也送，因為 TD 跑的可能是舊的。
test('older node forms are upgraded as the graph opens, reported, and sent with the program', async t => {
  const TD = 'sgrape.builtin.td_value', graph = clone(bootstrap.defaultDocument.graph);
  graph.stages.pixel.nodes.push({ id: 'rgba', nodeType: 'sgrape.builtin.rgba', name: 'rgba', params: {}, ui: {} },
    { id: 'uv3', nodeType: TD, params: { entry: 'vUV' }, ui: {} }, { id: 'st', nodeType: TD, params: { entry: 'vUVSt' }, ui: {} });
  graph.stages.pixel.edges.push({ id: 'e2', from: ['uv3', 'out'], to: ['rgba', 'rgb'] });
  const stored = JSON.stringify(graph), sent = [];
  const fetcher = async (url, options) => {
    const action = url.split('?')[0].split('/').at(-1), body = options.body && JSON.parse(options.body);
    if (action === 'apply') sent.push(body);
    return new Response(JSON.stringify({ state: { document: body.document, revision: body.revision + 1, targetId: target, runtimeRevision: body.revision + 1 } }));
  };
  // TD runs this very revision: without the upgrade nothing would be sent. TD 正在跑這一版：沒有升級的話不會送任何東西。
  const loaded = { state: { document: stored, revision: 4, runtimeRevision: 4, targetId: target }, format: 'grape-next-1', shaderKind: 'top',
    target: '/test/family', frontendCompiler: { protocol: GrapeTopCompiler.protocol, catalogHash: bootstrap.catalogHash, required: true } };
  const session = new EditorSession(new HostClient(target, '', fetcher, 20000), bootstrap, loaded, 0, 60000, undefined, '9.9.9 Test');
  t.after(() => session.dispose());
  const state = session.snapshot();
  assert.deepEqual([...state.upgrades.map(c => c.node)].sort(), ['st', 'uv3']);
  assert.equal(state.dirty, true, 'the upgraded graph waits to be sent');
  assert.ok(session.log.entries().some(e => e.message.code === 'upgrade.report'), 'the report is in the log');
  assert.equal(session.graph().stages.pixel.edges.find(e => e.id === 'e2').from[1], 'uvw');
  await session.flush();
  assert.equal(sent.length, 1);
  assert.equal(JSON.parse(sent[0].document).stages.pixel.nodes.find(n => n.id === 'st').params.entry, 'vUV');
  assert.ok(sent[0].runtime, 'the program goes too: TD compares');
  session.dismissUpgrades();
  assert.equal(session.snapshot().upgrades.length, 0, 'the notice is dismissed by the person');
  assert.equal(session.snapshot().undo, false, 'opening is not an Undo step');
});

// Which editor saved the graph (Refactor.66, human 2026-10-10): only the fact of the last save, written as the graph is sent;
// opening a graph another version saved is not an edit, and the code fingerprint ignores it.
// 最後是哪一版存的：只記最後一次存的事實，送出時寫上；打開別版存的圖不算修改，產碼指紋也不看它。
test('savedBy names the editor of the last save; opening a graph another editor saved sends nothing', async t => {
  const { session, calls, loaded } = open(t, async (action, body, remote) => {
    if (action === 'state') return remote.get();
    const state = { document: body.document, revision: body.revision + 1, targetId: target }; remote.set(state); return { state };
  });
  // Rebuilt on a stored graph that an older editor saved. 以舊版存的圖重開。
  const stored = loaded(); withDoc(stored.state, graph => { graph.savedBy = '0.8.276 Refactor.60'; });
  const reopened = new EditorSession(session.host, bootstrap, stored, 0, 60000, undefined, '9.9.9 Test');
  t.after(() => reopened.dispose());
  assert.equal(reopened.snapshot().dirty, false, 'opening is not an edit');
  await reopened.flush(); assert.equal(calls.filter(c => c.action === 'apply').length, 0);
  assert.equal(GrapeTopCompiler.key(reopened.graph()), GrapeTopCompiler.key({ ...clone(reopened.graph()), savedBy: 'other' }), 'not in the fingerprint');
  reopened.transact('edit', net => setValue(net, 'a', 3)); await reopened.flush();
  assert.equal(JSON.parse(calls.filter(c => c.action === 'apply').at(-1).body.document).savedBy, '9.9.9 Test', 'only the last save is named');
  assert.equal(reopened.snapshot().dirty, false);
});

// Refactor.76 (human 2026-10-11): a new node is named by the one rule; a rename turns spaces into underscores and moves a
// taken name up; a name GLSL cannot use is refused and said; each is one Undo step. A node's note is its comment.
// 新節點照同一套規則取名；改名時空白變底線、撞名往上加；GLSL 用不了的名稱拒絕並說明；各是一步 Undo。節點的註記就是它的 comment。
test('new nodes are named Float_1, Float_2; a rename moves a taken name up; a bad one is refused; notes are kept', t => {
  const { session } = open(t);
  const nodes = () => session.graph().stages.pixel.nodes;
  session.add('sgrape.builtin.float', { x: 0, y: 0 }); session.add('sgrape.builtin.float', { x: 0, y: 0 });
  const [first, second] = nodes().slice(-2);
  assert.deepEqual([first.name, second.name], ['Float_1', 'Float_2']);
  const nameOf = node => nodes().find(n => n.id === node.id).name;
  session.rename(first.id, 'Float 2');
  assert.equal(nameOf(first), 'Float_3', 'Float_2 is taken: the number moves up to the next free one');
  session.rename(second.id, 'Float 1');
  assert.equal(nameOf(second), 'Float_1', 'free again once the first moved');
  session.rename(second.id, 'Glow Pass');
  assert.equal(nameOf(second), 'Glow_Pass');
  session.rename(second.id, 'gl Thing');
  assert.equal(nameOf(second), 'Glow_Pass', 'refused');
  assert.equal(session.log.entries().at(-1).message.code, 'name.invalid');
  session.history(false);
  assert.equal(nameOf(second), 'Float_1', 'one Undo step per rename');
  session.setNote(first.id, 'keeps the base colour');
  assert.equal(nodes().find(n => n.id === first.id).comment, 'keeps the base colour');
});
