// Zero cost (Refactor.107): what the session computes on an edit, and for whom. Two guarantees, checked here on the real session with
// HTTP replaced (as test_render_scaling.cjs): (1) a derivation only a panel needs is not run while no panel asks for it — counted, not
// inferred from object identity; (2) what did not change keeps its object, and what did change is recomputed. Times are measured on a
// real page (tests/browser/benchmark_scaling.cjs); here only what node can prove.
// 零成本（R.107）：一次修改時 session 算了什麼、為了誰。兩種保證，在真正的 session 上驗（只替換 HTTP，同 test_render_scaling.cjs）：
// （1）只有面板要的推導，沒有面板要時不執行——用計數驗，不從物件識別推；（2）沒變的保持同一物件、變了的重算。時間在真頁面量；這裡只驗
// node 證得了的。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const producer = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'src/generated/grape_core.js'), 'utf8'), producer);
// The core as the editor sees it, with counted entry points: the editor reads `core.ghostsOf` through this object, so each call is seen.
// 編輯器看到的核心，帶計數的入口：編輯器經這個物件讀 core.ghostsOf，每次呼叫都看得到。
const calls = { ghostsOf: 0 };
global.GrapeGraph = new Proxy(producer.GrapeGraph, { get: (core, key) => key === 'ghostsOf' ? (...args) => { calls.ghostsOf++; return core.ghostsOf(...args); } : core[key] });
global.GrapeTopCompiler = producer.GrapeTopCompiler;
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => name.endsWith('.json')
    ? (data => ({ default: data, ...data }))(JSON.parse(fs.readFileSync(path.resolve(path.dirname(file), name), 'utf8')))
    : name.startsWith('.') ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name), module, module.exports);
  return module.exports;
}
const { Editor: EditorSession } = load(path.join(root, 'src/editor-react/editor.ts'));
const { HostClient } = load(path.join(root, 'src/editor-react/host.ts'));
const bootstrap = JSON.parse(fs.readFileSync(path.join(root, 'src/generated/editor-bootstrap.json')));
const target = '1'.repeat(32);
const graphOf = () => JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/scaling_base_graph.json'), 'utf8'));
function open(t, graph = graphOf(), generator) {
  const loaded = () => ({ state: { document: JSON.stringify(graph), revision: 4, targetId: target }, format: 'grape-next-1', shaderKind: 'top',
    target: '/test/family', frontendCompiler: { protocol: GrapeTopCompiler.protocol, catalogHash: bootstrap.catalogHash, required: true } });
  const fetcher = async (url, options) => {
    const action = url.split('?')[0].split('/').at(-1), body = options.body && JSON.parse(options.body);
    const result = action === 'state' ? loaded() : action === 'live' ? { ok: true, applied: true }
      : { state: { document: body.document, revision: body.revision + 1, targetId: target } };
    return new Response(JSON.stringify(result));
  };
  const session = new EditorSession(new HostClient(target, '', fetcher, 20000), bootstrap, loaded(), 60000, 60000, generator, '9.9.9 Test');
  t.after(() => session.dispose());
  return session;
}
/** Which fields of the state hold another object (or value) than before. 狀態裡哪些欄位換了物件（或值）。 */
const replacedFields = (before, after) => [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => before[key] !== after[key]).sort();
const move = (session, id, x, y) => session.nodeChanges([{ type: 'position', id, position: { x, y }, dragging: false }]);

// (2) A move changes the layout only: the projection, the version and the editing flags are new; everything derived from the graph's
// content keeps its object. Codex 2026-10-13 R03: this is the identity half; the call counts below are the other half.
// （2）移動只改版面：投影、版本與編輯旗標是新的；從圖的內容推出來的全部保持同一物件。
const MOVE_FIELDS = new Set(['dirty', 'level', 'message', 'projection', 'redo', 'undo', 'version']);
test('a move-only commit replaces only the projection, the version and the editing flags', t => {
  const session = open(t), id = session.snapshot().projection.nodes[5].id;
  move(session, id, 300, 300); // the first commit of the session settles dirty and the log 第一次修改讓 dirty 與紀錄定下來
  const before = session.snapshot(), groups = session.groups();
  move(session, id, 320, 340);
  const after = session.snapshot(), replaced = replacedFields(before, after);
  assert.deepEqual(replaced.filter(key => !MOVE_FIELDS.has(key)), [], 'replaced: ' + replaced.join(', '));
  assert.ok(replaced.includes('projection') && replaced.includes('version'));
  assert.equal(after.declarations, before.declarations, 'the declarations are the same list');
  assert.equal(session.groups(), groups, 'the groups are the same list');
});

// (1) Ghosts are judged once per commit, for the projection; the warning reads that answer. 每次 commit 判一次 Ghost，給投影；警告讀同一份答案。
test('a commit asks the core for ghosts once', t => {
  const session = open(t), id = session.snapshot().projection.nodes[5].id;
  move(session, id, 300, 300);
  calls.ghostsOf = 0;
  move(session, id, 320, 340);
  assert.equal(calls.ghostsOf, 1);
});

// (1) The reference counts and the GLSL line map are panels' derivations: a commit never works them out; a panel asks the session,
// which reads the document in place. Codex 2026-10-13 R08: not through session.graph(), which copies the whole document.
// （1）引用數與 GLSL 行對照是面板的推導：commit 不算；面板問 session，session 就地讀文件。R08：不經 session.graph()（會整份複製）。
test('a commit works out neither the reference counts nor the line map; a panel asks and gets them without a copy', t => {
  const session = open(t), id = session.snapshot().projection.nodes[5].id;
  const references = session.references, graph = session.graph; let asked = 0, copied = 0;
  session.references = () => { asked++; return references(); }; session.graph = () => { copied++; return graph(); };
  move(session, id, 300, 300);
  session.transact('note', net => { net.node(id).update({ comment: 'counted' }); });
  const state = session.snapshot();
  assert.equal(asked, 0, 'no commit asked for the reference counts');
  assert.ok(!('references' in state) && !('glslMap' in state), 'neither lives in the state');
  const counts = session.references();
  assert.equal(counts['d09c2ff51ca8d4f49'], 1, 'the declaration the base graph references once');
  assert.equal(copied, 0, 'counted on the document in place');
});

// A failed code generation keeps the last program that compiled (as the GLSL shown does), and the line map is derived from that one
// object — the same list each time it is asked, so a panel opened later still has it. Codex 2026-10-13 R02.
// 產碼失敗時留最後一次成功的程式（同顯示的 GLSL），行對照從那一個物件推——每次問都是同一份清單，之後才打開的面板也拿得到。
test('after a failed code generation the last compiled program stays, and its line map is one list', t => {
  const generator = { fail: false, key: graph => GrapeTopCompiler.key(graph), compile: (...args) => { if (generator.fail) throw Error('forced failure'); return GrapeTopCompiler.compile(...args); } };
  const session = open(t, graphOf(), generator), { glslMapOf } = load(path.join(root, 'src/editor-react/glsl_lines.ts'));
  const good = session.snapshot().compiled;
  assert.ok(good && good.pixel === session.snapshot().glsl);
  const map = glslMapOf(good);
  assert.ok(map.length > 0 && map.every(row => row.line > 0 && row.node)); assert.equal(glslMapOf(good), map, 'the same list for the same program');
  const scalar = session.snapshot().projection.nodes.find(n => n.data.authored.nodeType === 'sgrape.builtin.scalar' && !n.data.ghost);
  const setValue = value => session.transact('value', net => { const node = net.node(scalar.id); node.edit(node.definition.presentation(node.data, net.context).value.valueCommand, { value }); });
  generator.fail = true; setValue(0.25);
  assert.equal(session.snapshot().compiled, good, 'the failed edit keeps the last compiled program');
  assert.equal(session.snapshot().glsl, good.pixel);
  generator.fail = false; setValue(0.5);
  assert.notEqual(session.snapshot().compiled, good, 'a successful edit brings a new program');
  assert.equal(glslMapOf(session.snapshot().compiled).length, map.length);
});

// A note is a GLSL comment line (rule B): it follows the document through Undo and Redo, and never asks TD to recompile (the program key
// is unchanged). Codex 2026-10-13 R01: every way a document is adopted must keep this, not only an ordinary edit.
// 註記是 GLSL 的註解行（規則 B）：經 Undo／Redo 跟著文件走，也不會要求 TD 重編（程式 key 不變）。每一條採用文件的路都要守住，不只一般修改。
test('a note follows Undo and Redo in the GLSL and leaves the program key alone', t => {
  const session = open(t), key = () => GrapeTopCompiler.key(session.graph());
  const node = session.snapshot().projection.nodes.find(n => n.id === 'n95a062f14f7d4138ba5e2d764b752351'); // Combine_1 feeds the output 接到輸出
  assert.ok(node);
  const program = key();
  session.transact('note', net => { net.node(node.id).update({ comment: 'hello zero cost' }); });
  assert.match(session.snapshot().glsl, /hello zero cost/);
  assert.equal(key(), program, 'a note does not change the program key');
  session.history(false);
  assert.doesNotMatch(session.snapshot().glsl, /hello zero cost/, 'Undo takes the note out of the GLSL');
  session.history(true);
  assert.match(session.snapshot().glsl, /hello zero cost/, 'Redo brings it back');
  // Replacing the whole document (a restored draft) is another way in. 整份文件替換（還原草稿）是另一條路。
  const draft = session.graph(); draft.stages.pixel.nodes.find(n => n.id === node.id).comment = 'from the draft';
  assert.equal(session.restoreDraft(draft), true);
  assert.match(session.snapshot().glsl, /from the draft/);
  assert.equal(key(), program);
});
