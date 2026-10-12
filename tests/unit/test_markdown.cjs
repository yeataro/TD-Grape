// The Markdown engine's reading half (Refactor.100, src/editor-react/markdown_parse.ts; legacy inspector.js:963-1015). Markdown 引擎的「讀」（R.100）。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const loaded = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../src/editor-react/markdown_parse.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(loaded, loaded.exports);
const { parseMarkdown, parseInline } = loaded.exports;
const plain = value => JSON.parse(JSON.stringify(value));

test('inline: code, bold, italic and links, only to the web or mail', () => {
  assert.deepEqual(plain(parseInline('a `x` **b** *c* [d](https://e.com) [f](javascript:alert(1))')), [
    { kind: 'text', text: 'a ' }, { kind: 'code', text: 'x' }, { kind: 'text', text: ' ' }, { kind: 'strong', text: 'b' }, { kind: 'text', text: ' ' },
    { kind: 'em', text: 'c' }, { kind: 'text', text: ' ' }, { kind: 'link', text: 'd', href: 'https://e.com/' }, { kind: 'text', text: ' ' }].concat(
    plain(parseInline('a `x` **b** *c* [d](https://e.com) [f](javascript:alert(1))')).slice(9)));
  // The script link is not a link: its text stays as written. 腳本連結不是連結：文字照原文。
  const tail = plain(parseInline('[f](javascript:alert(1))'));
  assert.ok(tail.every(piece => piece.kind === 'text'));
  assert.equal(tail.map(piece => piece.text).join(''), '[f](javascript:alert(1))');
});

test('blocks: headings, paragraphs keeping line breaks, lists, code with a language', () => {
  const blocks = plain(parseMarkdown('# Title\nline one\nline two\n\n- a\n- b\n3. c\n\n```glsl\nvec3 c = vec3(1.0);\n```\nafter'));
  assert.deepEqual(blocks.map(b => b.kind), ['heading', 'paragraph', 'list', 'list', 'code', 'paragraph']);
  assert.equal(blocks[0].level, 1);
  assert.equal(blocks[1].lines.length, 2, 'a line break stays a break');
  assert.deepEqual([blocks[2].ordered, blocks[2].items.length, blocks[3].ordered, blocks[3].start], [false, 2, true, 3]);
  assert.deepEqual([blocks[4].language, blocks[4].source], ['glsl', 'vec3 c = vec3(1.0);']);
});

test('a code block is closed only by the same mark, at least as long; unclosed runs to the end; HTML stays text', () => {
  const blocks = plain(parseMarkdown('~~~~\n```\nstill code\n~~~~\n<b>x</b>'));
  assert.deepEqual(blocks[0], { kind: 'code', language: '', source: '```\nstill code' });
  assert.deepEqual(blocks[1].lines[0], [{ kind: 'text', text: '<b>x</b>' }]);
  assert.equal(plain(parseMarkdown('```\nopen'))[0].source, 'open');
});
