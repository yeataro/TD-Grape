// Render scaling (Refactor.106): object-identity invariants of the session's projection, so a change re-renders only what it touches.
// Times are measured on a real page (tests/browser/benchmark_scaling.cjs); here only what node can prove: which objects change.
// 畫面更新規模化（R.106）：session 投影的物件識別不變量，讓一個改變只重繪它碰到的東西。時間在真頁面量（benchmark_scaling.cjs）；
// 這裡只驗 node 證得了的：哪些物件換了。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const producer = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'src/generated/grape_core.js'), 'utf8'), producer);
global.GrapeGraph = producer.GrapeGraph; global.GrapeTopCompiler = producer.GrapeTopCompiler;
// The same loader as test_react_session.cjs: the real typed session, only HTTP replaced. 和 test_react_session.cjs 同一個載入方式：
// 真正的 session，只替換 HTTP。
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => name.endsWith('.json')
    ? (data => ({ default: data, ...data }))(JSON.parse(fs.readFileSync(path.resolve(path.dirname(file), name), 'utf8')))
    : name.startsWith('.') ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name), module, module.exports);
  return module.exports;
}
const { Editor: EditorSession } = load(path.join(root, 'src/editor-react/editor.ts'));
const { HostClient } = load(path.join(root, 'src/editor-react/host.ts'));
const { project } = load(path.join(root, 'src/editor-react/projection.ts'));
const bootstrap = JSON.parse(fs.readFileSync(path.join(root, 'src/generated/editor-bootstrap.json')));
const target = '1'.repeat(32);

// The benchmark's graph (tests/browser/benchmark_scaling.cjs): the base graph and its 9-node cluster with the conversion wires, copied
// 24 times — 248 nodes. 量測腳本的圖：基準圖加上帶轉換線的 9 節點叢集複製 24 次——248 個節點。
const CLUSTER = ['n14ad3a26b739', 'nd9052a8cfd8c', 'ndacfca70715a4188b4654c397a55c38a', 'ndf1a0d36e8bb43e78c2399e136288865',
  'nc75a3b96a9654918bff5ef13479a7c14', 'n722439006d09', 'nedfb0f9e6dd5', 'n718d19ab3cc3', 'ne852d6bf9732'];
function scalingGraph(copies = 24) {
  const graph = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/scaling_base_graph.json'), 'utf8'));
  const pixel = graph.stages.pixel, byId = new Map(pixel.nodes.map(n => [n.id, n])), inside = new Set(CLUSTER);
  const inner = pixel.edges.filter(e => inside.has(e.from[0]) && inside.has(e.to[0]));
  const idOf = (base, k) => 'n' + crypto.createHash('md5').update(base + ':' + k).digest('hex');
  for (let k = 1; k <= copies; k++) {
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
function open(t, graph) {
  const loaded = () => ({ state: { document: JSON.stringify(graph), revision: 4, targetId: target }, format: 'grape-next-1', shaderKind: 'top',
    target: '/test/family', frontendCompiler: { protocol: GrapeTopCompiler.protocol, catalogHash: bootstrap.catalogHash, required: true } });
  const fetcher = async (url, options) => {
    const action = url.split('?')[0].split('/').at(-1), body = options.body && JSON.parse(options.body);
    const result = action === 'state' ? loaded() : action === 'live' ? { ok: true, applied: true }
      : { state: { document: body.document, revision: body.revision + 1, targetId: target } };
    return new Response(JSON.stringify(result));
  };
  const session = new EditorSession(new HostClient(target, '', fetcher, 20000), bootstrap, loaded(), 60000, 60000, undefined, '9.9.9 Test');
  t.after(() => session.dispose());
  return session;
}
/** Which objects of `after` are not the ones of `before`, by id. after 裡哪些物件不是 before 的那一個（依 id）。 */
const replaced = (before, after) => { const old = new Map(before.map(item => [item.id, item])); return [...after].filter(item => old.get(item.id) !== item).map(item => item.id); };
const count = (subscribe) => { const seen = { n: 0 }; subscribe(() => seen.n++); return seen; };

test('switching the primary replaces exactly the old and the new primary, nothing else (Refactor.106 C)', t => {
  const session = open(t, scalingGraph()), ids = session.snapshot().projection.nodes.map(n => n.id);
  assert.ok(ids.length >= 200, 'a graph of at least 200 nodes');
  const [a, b] = [ids[40], ids[41]];
  session.pressNode(a, 'only'); session.pressNode(b, 'add');
  const before = session.snapshot().projection, primary = count(session.primarySubscribe), wires = count(session.wireKeySubscribe);
  const nodes = session.selectionSnapshot();
  session.pressNode(a, 'only'); // a selected node pressed keeps the group; the primary moves to it 已選的保留整組；主要選取換成它
  const after = session.snapshot().projection;
  assert.deepEqual(replaced(before.nodes, after.nodes).sort(), [a, b].sort());
  assert.equal(after.edges, before.edges, 'every wire object kept');
  assert.equal(session.primarySnapshot(), a); assert.equal(primary.n, 1, 'the primary listeners hear it once');
  assert.equal(wires.n, 0, 'the wire listeners do not wake'); assert.equal(session.selectedWiresSnapshot(), '');
  assert.equal(session.selectionSnapshot(), nodes, 'the same selected nodes: the same set');
  const look = id => after.nodes.find(n => n.id === id);
  assert.deepEqual([look(a).className, look(b).className, look(a).selected, look(b).selected], ['primary', undefined, true, true]);
});

test('a box preview growing from 8 to 9 nodes replaces exactly 1 node object (Refactor.106 C)', t => {
  const session = open(t, scalingGraph()), ids = session.snapshot().projection.nodes.map(n => n.id).slice(100, 109);
  session.previewBox(new Set(ids.slice(0, 8)));
  const before = session.snapshot().projection;
  session.previewBox(new Set(ids));
  const after = session.snapshot().projection;
  assert.deepEqual(replaced(before.nodes, after.nodes), [ids[8]]);
  assert.equal(after.nodes.find(n => n.id === ids[8]).className, 'box-in');
  // Released: the preview goes and the selection comes in one publish. 放開：預覽拿掉、選取進來，同一次發布。
  let published = 0; session.subscribe(() => published++);
  session.boxSelect(new Set(ids), ids);
  assert.equal(published, 1);
  assert.ok(session.snapshot().projection.nodes.every(n => !(n.className ?? '').includes('box-in')));
});

test('a drag frame publishes, but only the moved node changes and the slices the bars read keep their values (Refactor.106 D, E)', t => {
  const session = open(t, scalingGraph()), ids = session.snapshot().projection.nodes.map(n => n.id), moved = ids[60];
  session.pressNode(moved, 'only');
  const before = session.snapshot(), select = [state => state.undo, state => state.redo, state => state.phase, state => state.version, state => state.message];
  const values = select.map(pick => pick(before));
  let published = 0; session.subscribe(() => published++);
  session.nodeChanges([{ type: 'position', id: moved, position: { x: 123, y: 456 }, dragging: true }]);
  const after = session.snapshot();
  assert.equal(published, 1, 'the frame is published (the canvas follows it)');
  assert.deepEqual(select.map(pick => pick(after)), values, 'what the bars and panels select is unchanged, so they do not re-render');
  assert.deepEqual(replaced(before.projection.nodes, after.projection.nodes), [moved]);
  assert.equal(after.projection.edges, before.projection.edges);
  // The id index carried over: a selection after the frame still touches only its own nodes. 位置索引沿用：拖曳之後的選取仍只碰自己的節點。
  // Shift adds ids[61], the new primary; the moved node's look (selected, not marked: the primary is the other) stays. Shift 加選 ids[61]，
  // 它是新的主要選取；被移動的節點樣子不變（被選、沒有標記：主要選取是另一個）。
  session.pressNode(ids[61], 'add');
  assert.deepEqual(replaced(after.projection.nodes, session.snapshot().projection.nodes), [ids[61]]);
});

test('project() after one value changes keeps every other node data object, conversion-wire ends included (Refactor.106 G)', t => {
  const session = open(t, scalingGraph()), document = new GrapeGraph.GraphDocument(session.graph(), GrapeGraph.registry);
  const before = project(document, { nodes: [], edges: [] }, bootstrap.typeContract);
  const converting = new Set(before.nodes.filter(n => n.data.conversions && Object.keys(n.data.conversions).length).map(n => n.id));
  assert.ok(converting.size > 9, 'the graph has nodes at the ends of conversion wires');
  const scalar = before.nodes.find(n => n.data.authored.nodeType === 'sgrape.builtin.scalar' && !n.data.ghost);
  const result = document.change(candidate => {
    const net = candidate.networks.get('pixel'), node = net.node(scalar.id);
    node.edit(node.definition.presentation(node.data, net.context).value.valueCommand, { value: 0.25 });
  });
  const next = new GrapeGraph.GraphDocument(result.after, GrapeGraph.registry);
  const after = project(next, before, bootstrap.typeContract, result.changes);
  // Spread first: the core's arrays come from another script realm. 先展開：核心的陣列來自另一個 script realm。
  const changed = [...after.nodes].filter(n => before.nodes.find(old => old.id === n.id).data !== n.data).map(n => n.id);
  assert.deepEqual(changed, [scalar.id], 'only the edited node has new data');
  assert.ok([...converting].every(id => after.nodes.find(n => n.id === id).data === before.nodes.find(n => n.id === id).data));
});

// A seeded random walk over the selection (Refactor.106; selection-performance-2026-10-13.md §三): after every step the flags on the
// nodes and wires are exactly what the session's selection implies. 選取的隨機操作（固定種子）：每一步之後，節點與接線上的旗標正好是 session
// 的選取推得出來的。
test('5,000 random selection steps keep every flag equal to the selection (Refactor.106 C)', t => {
  // The base graph alone (32 nodes, 16 wires, a ghost among them): every edit compiles, so a small graph keeps 5,000 steps quick.
  // 只用基準圖（32 個節點、16 條線，含 Ghost）：每次修改都產碼，小圖讓 5,000 步跑得快。
  const session = open(t, scalingGraph(0));
  let seed = 106;
  const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const pick = list => list[Math.floor(random() * list.length)];
  const hows = ['only', 'toggle', 'add'];
  const check = step => {
    const { nodes, edges } = session.snapshot().projection, selection = session.selection, box = session.box;
    const where = `step ${step}`;
    const present = new Set(nodes.map(n => n.id)), wires = new Set(edges.map(e => e.id));
    for (const node of nodes) {
      const selected = selection.nodes.has(node.id), classes = (node.className ?? '').split(' ');
      assert.equal(!!node.selected, selected, where + ' selected ' + node.id);
      assert.equal(classes.includes('primary'), node.id === selection.primary && selection.nodes.size > 1, where + ' primary ' + node.id);
      assert.equal(classes.includes('box-in'), !!box?.has(node.id) && !selected, where + ' box-in ' + node.id);
    }
    for (const edge of edges) assert.equal(!!edge.selected, selection.edges.has(edge.id), where + ' wire ' + edge.id);
    assert.ok([...selection.nodes].every(id => present.has(id)), where + ' a selected node is missing');
    assert.ok([...selection.edges].every(id => wires.has(id)), where + ' a selected wire is missing');
    assert.ok(selection.primary === null || selection.nodes.has(selection.primary), where + ' primary not selected');
    assert.ok(!(selection.nodes.size && selection.edges.size), where + ' nodes and wires together');
    assert.equal(session.primarySnapshot(), selection.primary); assert.equal(session.selectionSnapshot(), selection.nodes);
    assert.equal(session.selectedWiresSnapshot(), [...selection.edges].join('\u0000'));
  };
  for (let step = 0; step < 5000; step++) {
    const { nodes, edges } = session.snapshot().projection, roll = random();
    const removable = nodes.filter(n => GrapeGraph.removable(GrapeGraph.registry.get(n.data.authored.nodeType)));
    if (roll < .30) session.pressNode(pick(nodes).id, pick(hows));
    else if (roll < .40 && edges.length) session.clickEdge(pick(edges).id, pick(hows));
    else if (roll < .45 && edges.length) session.selectWire(pick(edges).id);
    else if (roll < .53) { const box = new Set(nodes.filter(() => random() < .1).map(n => n.id)); session.previewBox(box); }
    else if (roll < .62) {
      const chosen = nodes.filter(() => random() < .1).map(n => n.id), touched = [...chosen].sort(() => random() - .5);
      session.boxSelect(new Set(chosen), touched);
    } else if (roll < .66) session.clearSelection();
    else if (roll < .68) session.selectReferences(pick(session.snapshot().declarations)?.id ?? 'none');
    else if (roll < .73 && removable.length) session.remove({ nodes: [pick(removable)], edges: [] });
    else if (roll < .78 && edges.length) session.remove({ nodes: [], edges: [pick(edges)] });
    else if (roll < .86) session.history(false);
    else if (roll < .92) session.history(true);
    else if (roll < .95) session.previewBox(null);
    else { const clip = session.copyNodes(session.selectedInOrder()); if (clip) session.paste(clip, { x: random() * 900, y: random() * 900 }); }
    check(step);
  }
});

// The GLSL panel's lines (Refactor.106 H): split and coloured once per GLSL; each node knows the lines its tracing changes. Checked on
// a long real GLSL against the old way (one `\b(name|…)\b` over every plain piece). GLSL 面板的行：每份 GLSL 只切一次；每個節點知道
// 被追蹤時會變的行。用一份長的真正 GLSL，對照以前的做法（每段純文字都用一條 `\b(名字|…)\b` 去切）。
test('GLSL lines: the same links as the old split, and each node touches exactly the lines that show it (Refactor.106 H)', t => {
  // Prism's core as the bundler gives it (a default export); it also sets the global Prism its grammar files use.
  // Prism 核心照打包工具給的樣子（default 匯出）；它也設好規則檔要用的全域 Prism。
  const prism = require('prismjs/components/prism-core'); prism.default ??= prism;
  const { highlightGlsl } = load(path.join(root, 'src/editor-react/code_highlight.ts'));
  const { glslRows } = load(path.join(root, 'src/editor-react/glsl_lines.ts'));
  // The 248-node graph's copies do not reach the output, so its GLSL is short; a chain of 200 Floor nodes from the uAbsTime Uniform
  // into the output makes one line and one name per node (232 nodes: within a network's node limit). 248 節點圖的複本不接到輸出，GLSL
  // 很短；從 uAbsTime Uniform 接 200 個 Floor 節點的鏈到輸出，每個節點一行、一個名字（232 個節點：在一個網路的節點上限內）。
  const graph = scalingGraph(0), pixel = graph.stages.pixel, floor = pixel.nodes.find(n => n.id === 'n49284b53ac094698861f7f3770a8e591');
  let from = ['ncd61a81cad554c3f8f8d0d47998ecbb7', 'out'];
  for (let k = 1; k <= 200; k++) {
    pixel.nodes.push({ ...JSON.parse(JSON.stringify(floor)), id: 'nfloor' + k, name: 'Floor_c' + k, ui: { x: k * 48, y: 2400 } });
    pixel.edges.push({ id: 'efloor' + k, from, to: ['nfloor' + k, 'value'] }); from = ['nfloor' + k, 'out'];
  }
  pixel.edges.find(e => e.to[0] === 'n95a062f14f7d4138ba5e2d764b752351' && e.to[1] === 'x').from = from;
  const { glsl, glslMap, glslVariables, glslDeclarations } = open(t, graph).snapshot();
  const lines = highlightGlsl(glsl);
  assert.ok(lines.length > 200 && Object.keys(glslVariables).length > 200 && Object.keys(glslDeclarations).length, 'a long GLSL with many names');
  const started = performance.now(), { rows, touching } = glslRows(lines, glslMap, glslVariables, glslDeclarations);
  assert.ok(performance.now() - started < 200, 'worked out quickly');
  const names = [...Object.keys(glslVariables), ...Object.keys(glslDeclarations)].sort((a, b) => b.length - a.length);
  const pattern = new RegExp('\\b(' + names.join('|') + ')\\b', 'g');
  const nodeOf = new Map(glslMap.map(row => [row.line, row.node])), shows = new Map();
  const show = (node, index) => { if (!shows.has(node)) shows.set(node, new Set()); shows.get(node).add(index); };
  let links = 0;
  rows.forEach((row, index) => {
    assert.equal(row.node, nodeOf.get(index + 1));
    if (row.node !== undefined) show(row.node, index);
    row.pieces.forEach((piece, i) => {
      const was = lines[index][i];
      if (!('linked' in piece)) { assert.equal(piece, was); if (!was.kind) assert.equal(was.text.split(pattern).length, 1); return; }
      const old = was.text.split(pattern).filter(Boolean), now = piece.linked.map(part => typeof part === 'string' ? part : part.text);
      assert.deepEqual(now, old, 'line ' + (index + 1));
      for (const part of piece.linked) if (typeof part !== 'string') {
        links++;
        if ('node' in part) { assert.equal(part.node, glslVariables[part.text]); show(part.node, index); }
        else assert.equal(part.declaration, glslDeclarations[part.text]);
      }
    });
  });
  assert.ok(links > 200);
  assert.deepEqual(new Map([...touching].map(([node, list]) => [node, new Set(list)])), shows);
});
