// Guards for docs/ui/EDITOR_UI_RULES.md that a test can check. 畫面規則中可以用測試把關的部分。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const web = path.resolve(__dirname, '../../src/editor-react');
const components = fs.readdirSync(web).filter(file => /\.tsx$/.test(file));

// Rule 四: only our own widgets; a browser dropdown is never just recoloured (human 2026-10-09).
// 只用我們自己的部件；不拿瀏覽器內建的下拉選單改色來用。
test('components use our Select, never a native dropdown', () => {
  const found = components.filter(file => /<select[\s>]/.test(fs.readFileSync(path.join(web, file), 'utf8')));
  assert.deepEqual(found, []);
});

// Personal preferences go through preferences.ts only (human 2026-10-09: one place, layout included); other code never
// touches localStorage. 個人偏好只經 preferences.ts（人類：一處、排版也是）；其他程式不直接碰 localStorage。
test('only preferences.ts uses localStorage', () => {
  const files = fs.readdirSync(web).filter(file => /\.tsx?$/.test(file) && file !== 'preferences.ts');
  const found = files.filter(file => /localStorage/.test(fs.readFileSync(path.join(web, file), 'utf8')));
  assert.deepEqual(found, []);
});

// Rule 六: animations move only the element itself (human 2026-10-10; legacy's glow animated an inherited variable on :root,
// restyling and repainting the whole page every frame). No animation on the root, no keyframes on custom properties, and
// keyframes change only cheap or small-element properties.
// 動畫只動元素自己（人類；舊產品的光暈在根元素上動畫會往下傳的變數，每一格整頁重算重畫）。根元素不做動畫、不動畫自訂屬性、
// keyframes 只改便宜或只用在小元素上的屬性。
test('animations stay on the element itself', () => {
  const css = fs.readFileSync(path.join(web, 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rootAnimated = [...css.matchAll(/(^|})\s*([^{}]*)\{([^{}]*)\}/g)]
    .filter(([, , selector, body]) => /(^|[\s,])(:root|html|body)(?![\w-])/.test(selector) && /(^|;|\s)animation(-name)?\s*:/.test(body))
    .map(([, , selector]) => selector.trim());
  assert.deepEqual(rootAnimated, [], 'no animation on :root, html or body');
  const allowed = new Set(['transform', 'opacity', 'filter', 'stroke-dashoffset']);
  for (const [, name, body] of css.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)) {
    const properties = [...body.matchAll(/([\w-]+)\s*:/g)].map(m => m[1]).filter(p => !/^(from|to)$/.test(p));
    assert.deepEqual(properties.filter(p => !allowed.has(p)), [], `@keyframes ${name} changes only ${[...allowed].join(', ')}`);
  }
});
