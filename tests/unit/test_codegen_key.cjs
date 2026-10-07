// Property test for the code-generation fingerprint (design-interview Q38 2-1, required by the human):
// across random edit sequences, an unchanged key must mean an unchanged program apart from comment
// lines. A failure here means the fingerprint would skip a needed code generation.
// 產碼指紋的性質測試：隨機編輯序列中，指紋沒變就必須代表程式（扣掉註解行）沒變；失敗代表指紋會漏判。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const producer = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'src/generated/wire_planning.js'), 'utf8'), producer);
const { GrapeGraph: G, GrapeTopCompiler: C } = producer;
const bootstrap = JSON.parse(fs.readFileSync(path.join(root, 'src/generated/editor-bootstrap.json')));
const clone = value => JSON.parse(JSON.stringify(value));
const make = (id, key) => ({ id, nodeType: 'sgrape.builtin.' + key,
  params: clone(G.registry.get('sgrape.builtin.' + key).catalog.definition.defaults), ui: { x: 0, y: 0 } });

// Deterministic generator so a failure can be replayed. 固定亂數種子，失敗可重現。
function random(seed) { return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }; }
const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const program = graph => {
  try {
    const out = C.compile(graph, bootstrap.typeContract.glslCode);
    const strip = text => text.split('\n').map(line => line.replace(/\s*\/\/.*$/, '')).filter(line => line.trim()).join('\n');
    return JSON.stringify({ pixel: strip(out.pixel), bindings: out.bindings });
  } catch (error) { return 'error: ' + error.message; }
};

function start() {
  const graph = clone(bootstrap.defaultDocument.graph);
  graph.stages.pixel.nodes.push(make('a', 'float'), make('b', 'float'), make('sum', 'add'));
  return graph;
}
const edits = [
  ['value', (net, rand) => { const node = net.node(pick(rand, ['a', 'b']));
    const view = node.definition.presentation(node.data, net.context).value; node.edit(view.valueCommand, { value: Math.round(rand() * 8) / 4 }); }],
  ['move', (net, rand) => { const node = pick(rand, net.nodes); node.update({ ui: { ...node.data.ui, x: Math.round(rand() * 900), y: Math.round(rand() * 600) } }); }],
  ['comment', (net, rand) => { const node = pick(rand, net.nodes); node.update({ comment: pick(rand, ['', 'note', 'line' + String.fromCharCode(92), 'two' + String.fromCharCode(10) + 'lines']) }); }],
  ['add isolated', (net, rand) => { net.insert(make('iso' + Math.floor(rand() * 1e9), 'float')); }],
  ['remove isolated', (net) => { const iso = net.nodes.filter(n => n.id.startsWith('iso')); if (iso.length) net.removeAll([iso[0]]); }],
  ['rename', (net, rand) => { const node = net.node(pick(rand, ['a', 'b', 'sum'])); node.update({ name: pick(rand, [undefined, 'Alpha', 'Beta', 'Alpha']) }); }],
  ['wire', (net, rand) => { const from = pick(rand, ['a', 'b']), port = pick(rand, ['a', 'b']);
    net.connect(net.node(from).outputs[0], net.node('sum').port('input', port), G.values.policy); }],
  ['wire output', (net, rand) => { const from = pick(rand, ['a', 'sum', 'color']);
    net.connect(net.node(from).outputs[0], net.node('pixel_out').port('input', 'color'), G.values.policy); }],
  ['disconnect', (net, rand) => { if (net.edges.length) net.disconnectAll([pick(rand, net.edges)]); }],
];

test('an unchanged code-generation key never hides a changed program (random edit sequences)', () => {
  let changedKeys = 0, sameKeys = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const rand = random(seed);
    let doc = new G.GraphDocument(start(), G.registry);
    for (let step = 0; step < 120; step++) {
      const [name, edit] = pick(rand, edits), before = doc.snapshot();
      let after;
      try { after = doc.change(candidate => edit(candidate.networks.get('pixel'), rand)).after; } catch { continue; }
      if (C.key(before) === C.key(after)) {
        sameKeys++;
        assert.equal(program(after), program(before), `seed ${seed} step ${step} (${name}): key unchanged but program changed`);
      } else changedKeys++;
      doc = new G.GraphDocument(after, G.registry);
    }
  }
  // The property must not pass vacuously: both kinds of edits occur.
  assert.ok(sameKeys > 100 && changedKeys > 100, JSON.stringify({ sameKeys, changedKeys }));
});

test('layout and notes do not change the key; names, values and wires do', () => {
  const graph = start(), key = C.key(graph), node = id => graph.stages.pixel.nodes.find(n => n.id === id);
  const variant = edit => { const g = clone(graph); edit(g, id => g.stages.pixel.nodes.find(n => n.id === id)); return C.key(g); };
  assert.equal(variant((g, n) => { n('a').ui = { x: 500, y: 9 }; n('a').comment = 'note'; }), key);
  assert.equal(variant(g => { g.stages.pixel.edges.forEach(e => { e.id = 'other_' + e.id; e.ui = { style: 'link' }; }); }), key);
  assert.equal(variant(g => { g.description = 'About'; g.comment = 'Notes'; g.userVersion = '2'; }), key);
  assert.notEqual(variant((g, n) => { n('a').name = 'Alpha'; }), key, 'names become GLSL identifiers and can collide');
  assert.notEqual(variant((g, n) => { n('a').params.value = 7; }), key);
  assert.notEqual(variant(g => { g.stages.pixel.edges.push({ id: 'x', from: ['a', 'out'], to: ['sum', 'a'] }); }), key);
  assert.ok(node('a'));
});
