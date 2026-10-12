// The one shortcut table (Refactor.95, src/editor-react/shortcuts.ts). 唯一的快捷鍵表（R.95）。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const web = path.resolve(__dirname, '../../src/editor-react');
const loaded = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync(path.join(web, 'shortcuts.ts'), 'utf8'), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(loaded, loaded.exports);
const { matches, shortcutText, withShortcut, SHORTCUTS } = loaded.exports;
const press = (key, mods = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods });
const which = event => Object.keys(SHORTCUTS).filter(id => matches(id, event));

test('a key press is the command with exactly its modifiers', () => {
  assert.deepEqual(which(press('z', { ctrlKey: true })), ['undo']);
  assert.deepEqual(which(press('Z', { ctrlKey: true, shiftKey: true })), ['redo'], 'Shift makes it a capital');
  assert.deepEqual(which(press('z', { metaKey: true })), ['undo'], 'Cmd on a Mac');
  assert.deepEqual(which(press('z', { ctrlKey: true, metaKey: true })), [], 'not both');
  assert.deepEqual(which(press('h')), ['home']);
  assert.deepEqual(which(press('H', { shiftKey: true })), [], 'Shift+H is not H');
  assert.deepEqual(which(press('Tab')), ['add']);
  assert.deepEqual(which(press('Tab', { shiftKey: true })), [], 'Shift+Tab moves the focus back');
  assert.deepEqual(which(press('F10', { shiftKey: true })), ['menu']);
  assert.deepEqual(which(press('ContextMenu')), ['menu']);
  assert.deepEqual(which(press('Enter', { ctrlKey: true })), ['focusGraph']);
  assert.deepEqual(which(press('Escape')), ['leaveFocus']);
  assert.deepEqual(which(press('Delete')), ['delete']);
});

// A letter by its key's place only when no Latin letter was typed (2026-10-12). 只有打出的不是拉丁字母時，字母才看按鍵位置（10-12）。
test('letters: as typed, or by place when the key typed no Latin letter', () => {
  assert.deepEqual(which(press('©', { altKey: true, code: 'KeyG' })), ['leaveGroup'], 'Option+G on a Mac');
  assert.deepEqual(which(press('я', { ctrlKey: true, code: 'KeyZ' })), ['undo'], 'a Russian layout');
  assert.deepEqual(which(press('w', { ctrlKey: true, code: 'KeyZ' })), [], 'AZERTY Ctrl+W is not Undo');
  assert.deepEqual(which(press('z', { ctrlKey: true, code: 'KeyW' })), ['undo'], 'AZERTY Ctrl+Z is Undo');
});

test('the keys are written for people from the same table', () => {
  assert.equal(shortcutText('redo'), 'Ctrl＋Shift＋Z');
  assert.equal(shortcutText('delete'), 'Delete / Backspace');
  assert.equal(shortcutText('menu'), 'Shift＋F10 / Menu');
  assert.equal(withShortcut('Restore layout', 'focusGraph', 'leaveFocus'), 'Restore layout　Ctrl＋Enter　Esc');
});

test('every command has a section and keys', () => {
  for (const [id, entry] of Object.entries(SHORTCUTS)) {
    assert.ok(['ui', 'edit', 'core'].includes(entry.section), id);
    assert.ok(entry.keys.length > 0, id);
  }
});

// The guard (human 2026-10-12: shortcuts must not spread out again): outside shortcuts.ts no code writes a command's keys, as text or
// as a key test, and no interface text spells them; the only key text left is TD's own (Ctrl+Z in TD) and a widget's gestures.
// 把關（人類 10-12：快捷鍵不能又散落各地）：shortcuts.ts 以外，程式不寫指令的鍵（文字或按鍵判斷），介面文字也不寫；只剩 TD 自己的鍵與元件的手勢。
test('only shortcuts.ts knows the commands\' keys', () => {
  const strip = source => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  const code = fs.readdirSync(web).filter(file => /\.tsx?$/.test(file) && file !== 'shortcuts.ts');
  const textual = /['"`](?:Ctrl|Cmd|Shift|Alt)[+＋]/;
  // Tab and Esc are also widgets' own keys (a menu, the value ladder), so only the commands' letters and keys are looked for.
  // Tab、Esc 也是元件自己的鍵（選單、數值梯尺），所以只找指令的字母與鍵。
  const commandKeys = /deleteKeyCode=\{\[|event\.key(?:\.toLowerCase\(\))? === '(?:z|p|f|h|d|c|v|g|x|f\d{1,2}|contextmenu)'/i;
  const found = code.filter(file => {
    const source = strip(fs.readFileSync(path.join(web, file), 'utf8'))
      .replace(/tr\('status\.recoveryDeleted'[^)]*\)/, ''); // TD's own Ctrl+Z, not ours 那是 TD 的 Ctrl＋Z
    return textual.test(source) || commandKeys.test(source);
  });
  assert.deepEqual(found, []);
  // Both languages: a translation kept from before can still spell a key (R.95: the Chinese tooltips did). 兩種語言都查：沿用的翻譯
  // 也可能還寫著鍵（R.95：中文提示就是）。
  const allowed = new Set(['number.help', 'status.recoveryDeleted']); // a field's gestures; TD's key 欄位的手勢；TD 的鍵
  for (const language of ['en', 'zh-Hant']) {
    const texts = JSON.parse(fs.readFileSync(path.join(web, `locales/${language}.json`), 'utf8'));
    assert.deepEqual(Object.entries(texts).filter(([key, text]) => !allowed.has(key) && /\b(?:Ctrl|Cmd)[+＋]|[(（](?:[A-Z]|Tab)[)）]|\bF\d{1,2}\b/.test(text)).map(([key]) => key), [], language);
  }
});
