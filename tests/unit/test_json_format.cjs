// The graph JSON laid out for reading (Refactor.102, src/editor-react/json_format.ts). 圖的 JSON 排成好讀的樣子（R.102）。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const loaded = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../src/editor-react/json_format.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(loaded, loaded.exports);
const { formatJson } = loaded.exports;

test('short objects and arrays stay on one line', () => {
  assert.equal(formatJson({ x: 1, y: [1, 2], z: {}, w: [] }), '{ "x": 1, "y": [1, 2], "z": {}, "w": [] }');
});

test('a line over 60 characters opens, one item a line, two spaces deeper', () => {
  const value = { id: 'color', nodeType: 'sgrape.builtin.color', params: { value: [0.55, 0.28, 0.9, 1] } };
  assert.equal(formatJson(value), [
    '{',
    '  "id": "color",',
    '  "nodeType": "sgrape.builtin.color",',
    '  "params": { "value": [0.55, 0.28, 0.9, 1] }',
    '}'].join('\n'));
});

test('what is shown is what is saved: read back it is the same value, undefined fields left out', () => {
  const graph = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/top_compiler_legacy.json'), 'utf8'));
  // Compared with the saved form: JSON writes -0 as 0 (case 51 has one), and so does saving. 跟存下來的樣子比：JSON 把 -0 寫成 0（案例 51 有一個），存檔也一樣。
  assert.deepEqual(JSON.parse(formatJson(graph)), JSON.parse(JSON.stringify(graph)));
  assert.equal(formatJson({ a: 1, b: undefined }), '{ "a": 1 }');
  assert.equal(formatJson('text'), '"text"');
  assert.equal(formatJson(undefined), '');
});
