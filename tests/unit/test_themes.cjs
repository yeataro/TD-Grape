// The colour system's guard (docs/ui/COLOR_SYSTEM.md, Refactor.54.1): colour codes live only in the theme palettes;
// an independent theme (Light) names every palette colour and strength Dark names; an inheriting theme (TD) only
// overrides names Dark has; components never write a colour code.
// 顏色系統的把關：色碼只在主題的調色盤；獨立主題（Light）寫齊 Dark 的所有調色盤與強度；繼承主題（TD）只覆寫 Dark 有的名字；
// 元件不寫色碼。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../..'), web = path.join(root, 'src/editor-react');
const read = file => fs.readFileSync(path.join(web, file), 'utf8');
const names = css => new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(match => match[1]));
const colourCode = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
const withoutComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(line => line.replace(/(^|\s)\/\/.*$/, '')).join('\n');

test('Light names every palette colour and strength Dark names', () => {
  const dark = names(read('theme/dark.css')), light = names(read('theme/light.css'));
  const required = [...dark].filter(name => name.startsWith('--palette-') || name.startsWith('--lift-') || name.startsWith('--tint-')
    || name.startsWith('--text-alpha-') || name === '--title-alpha');
  assert.deepEqual(required.filter(name => !light.has(name)), []);
});

test('TD only overrides names Dark has', () => {
  const dark = names(read('theme/dark.css'));
  assert.deepEqual([...names(read('theme/td.css'))].filter(name => !dark.has(name)), []);
});

test('colour codes appear only in the palette layer of a theme', () => {
  for (const file of ['theme/dark.css', 'theme/light.css', 'theme/td.css']) {
    for (const line of withoutComments(read(file)).split('\n'))
      if (colourCode.test(line)) assert.match(line, /^\s*--palette-[\w-]+\s*:/, `${file}: ${line.trim()}`);
  }
  // The brand mark is artwork, not a theme colour (icons.tsx). 標誌是圖，不是主題色。
  const components = ['style.css', 'theme/sizes.css', ...fs.readdirSync(web).filter(file => /\.tsx?$/.test(file) && file !== 'icons.tsx')];
  for (const file of components) {
    const code = withoutComments(read(file));
    assert.ok(!colourCode.test(code), `${file} writes a colour code`);
  }
});

test('every purpose a component uses is defined by the default theme', () => {
  const defined = new Set([...names(read('theme/dark.css')), ...names(read('theme/sizes.css')), ...names(read('style.css'))]);
  const used = new Set();
  for (const file of ['style.css', ...fs.readdirSync(web).filter(file => /\.tsx?$/.test(file))])
    for (const match of read(file).matchAll(/var\((--[\w-]+)/g)) used.add(match[1]);
  // Set inline by a component for its own children. 元件給自己子元素設的行內變數。
  const local = new Set(['--port-color', '--group-color', '--badge-color', '--message', '--components']);
  const dynamic = name => /^--group-/.test(name) || /^--component-/.test(name) || /^--type-/.test(name);
  assert.deepEqual([...used].filter(name => !defined.has(name) && !local.has(name) && !dynamic(name)), []);
});

// The type scale (Refactor.54.2): components name a level (--font-*, --line-*), never a pixel font size, so every row
// keeps a fixed height in Chinese and English. 元件只寫字級，不寫像素字級，中英文每列等高。
test('components use the type scale, not pixel font sizes', () => {
  const code = withoutComments(read('style.css'));
  assert.deepEqual([...code.matchAll(/font-size:\s*[\d.]+px/g)].map(match => match[0]), []);
});
