// Makes the built-in Tint the way a person makes a Library subgraph (D-2, Refactor.121; human 2026-10-18: 「按使用者合法流程做」): the core's
// own operations build the subgraph in a graph, and the core's "save as Library file" writes it with a Library ID from crypto random
// bytes. The file is not overwritten: port and wire IDs are new each time, so a rerun is a new version; --replace makes one, keeping
// the Library ID (the same subgraph). Content follows legacy src/core/sgrape_core.py:1795 function_library():
// Color × Tint, Tint defaulting to grape. Then run npm run build:core, which reads and checks the file.
// 照使用者做資源庫子圖的方式做出內建 Tint（人類 10-18：「按使用者合法流程做」）：用核心的正式操作在一張圖裡做出子圖，再用核心的「存成資源庫檔」
// 寫出，Library ID 由 crypto 亂數配給。不覆蓋已寫出的檔：接口與接線 ID 每次都是新的，重跑等於新版本；加 --replace 才做，沿用
// 同一個 Library ID（同一份子圖）。內容照舊產品 function_library()：Color × Tint，Tint 預設葡萄色。
// 之後跑 npm run build:core，它會讀檔驗證。
// usage: node tools/make_tint.cjs [--replace]
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), { webcrypto } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({}); vm.runInContext(fs.readFileSync(path.join(root, 'src/generated/grape_core.js'), 'utf8'), context);
const G = context.GrapeGraph, bootstrap = JSON.parse(fs.readFileSync(path.join(root, 'src/generated/editor-bootstrap.json'), 'utf8'));
const out = path.join(root, 'src/library/subgraphs/tint.json');
if (fs.existsSync(out) && !process.argv.includes('--replace')) { console.error('tint.json exists; a rerun makes a new version: use --replace to keep its Library ID and replace it'); process.exit(1); }
const kept = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')).subgraph.libraryId : undefined;

const made = new G.GraphDocument(JSON.parse(JSON.stringify(bootstrap.defaultDocument.graph)), G.registry).change(m => {
  m.createSubgraph({ id: 'tint', title: 'Tint' });
  const tint = m.subgraph('tint'), color = tint.data.inputs[0].id, result = tint.data.outputs[0].id;
  tint.editInterface('inputs', { kind: 'update', id: color, patch: { label: 'Color', default: [1, 1, 1, 1] } });
  tint.editInterface('inputs', { kind: 'add', port: { id: G.newPortId(new Set([color, result])), label: 'Tint', type: 'vec4', default: [0.7, 0.3, 1, 1] } });
  tint.editInterface('outputs', { kind: 'update', id: result, patch: { label: 'Color', default: [0, 0, 0, 1] } });
  const net = m.networks.get('subgraph:tint'), amount = tint.data.inputs[1].id;
  for (const edge of net.edges) edge.disconnect();
  net.create('multiply', 'sgrape.builtin.multiply', { type: 'vec4' });
  net.node('multiply').update({ name: 'Apply_Tint', ui: { x: 336, y: 144 } });
  net.connect(net.node('input').port('output', color), net.node('multiply').port('input', 'a'), G.values.policy);
  net.connect(net.node('input').port('output', amount), net.node('multiply').port('input', 'b'), G.values.policy);
  net.connect(net.node('multiply').port('output', 'out'), net.node('output').port('input', result), G.values.policy);
}).after;

const file = G.saveLibraryFile(made, G.registry, 'tint', () => kept ?? G.libraryIdFrom(webcrypto.getRandomValues(new Uint8Array(16))), {
  category: 'color',
  description: 'The simplest Library subgraph: multiplies the input color by another color. Grape flavour by default. The first Library subgraph, made to verify development.',
  texts: { 'zh-Hant': { description: '簡單至極的資源庫子圖：把輸入的顏色乘上另一個顏色，預設是葡萄口味。開發驗證用的第一個資源庫子圖。' } },
});
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(file, null, 2) + '\n');
console.log(JSON.stringify({ written: path.relative(root, out), libraryId: file.subgraph.libraryId, kept: !!kept, stages: file.subgraph.stages, targets: file.subgraph.targets }));
