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
