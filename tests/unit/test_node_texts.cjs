// Node texts (Refactor.74.1, human 2026-10-10): the core names them by key; the editor loads only node-texts.json (English);
// the legacy translation file is a reference in docs/reference and is never shipped.
// 節點文字：核心用代號指名；編輯器只載入 node-texts.json（英文）；舊翻譯檔放在 docs/reference 當參考，不送出。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../..');
const texts = JSON.parse(fs.readFileSync(path.join(root, 'src/editor-react/static/node-texts.json'), 'utf8'));
const sources = ['src/generated/grape_core.js', 'src/generated/editor-bootstrap.json']
  .map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
const quoted = key => ["'", '"', '`'].some(q => sources.includes(q + key + q));

test('every node text is still named by the core, and has its English', () => {
  for (const [key, english] of Object.entries(texts)) {
    assert.ok(quoted(key), 'no longer used: ' + key);
    assert.equal(typeof english, 'string', key);
    assert.ok(english.length > 0, key);
  }
});

test('a key the core names in these groups has its text', () => {
  const groups = [...new Set(Object.keys(texts).map(key => key.split('.')[0]))];
  const named = new Set();
  for (const match of sources.matchAll(new RegExp(`['"\`]((?:${groups.join('|')})\\.[A-Za-z0-9_.]+)['"\`]`, 'g'))) named.add(match[1]);
  const missing = [...named].filter(key => !(key in texts));
  assert.deepEqual(missing, [], 'take them from docs/reference/legacy-locales.json or write new ones');
});

test('the legacy translation file is not shipped', () => {
  assert.ok(!fs.existsSync(path.join(root, 'src/editor-react/static/locales.json')));
  assert.ok(!/['"]\/locales\.json['"]/.test(fs.readFileSync(path.join(root, 'src/editor-react/main.tsx'), 'utf8')));
});
