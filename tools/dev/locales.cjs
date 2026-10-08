/* Collect every tr('code', 'original') and check the language files (design-interview Q34).
 *
 *   node tools/dev/locales.cjs           check only (used by run_tests.py)
 *   node tools/dev/locales.cjs --write   rewrite en.json and add missing codes to zh-Hant.json
 *
 * en.json is generated for reference (the English lives in the code); zh-Hant.json is written by
 * people: a missing or empty entry shows the English original. Codes and originals must be
 * complete literals so this script can find them.
 * 掃描所有 tr('代號','原文')：產生 en.json（對照用）、檢查 zh-Hant.json。代號與原文必須是完整字面。
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const write = process.argv.includes('--write');
const folder = path.join(root, 'src/editor-react/locales');
const CODE = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*){1,2}$/;
const LITERAL = /\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")/y;

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'locales' || entry.name === 'node_modules' ? [] : files(full);
    return /\.(ts|tsx|py)$/.test(entry.name) ? [full] : [];
  });
}
const problems = [], messages = new Map();
// TD's text for people is scanned too (src/td/runtime, td_text.tr, design-interview Q58): same shape.
// TD 給人看的文字也掃（td_text.tr）：同一種寫法。
for (const file of [...files(path.join(root, 'src/editor-react')), ...files(path.join(root, 'src/core-ts')),
  ...files(path.join(root, 'src/td/runtime'))]) {
  const python = file.endsWith('.py');
  const text = fs.readFileSync(file, 'utf8'), where = index => path.relative(root, file) + ':' + (text.slice(0, index).split('\n').length);
  for (const match of text.matchAll(/\btr\(/g)) {
    // Mentions in comments are not messages. 註解裡提到 tr() 不算訊息。
    const line = text.slice(text.lastIndexOf('\n', match.index) + 1, match.index);
    if (/^\s*(\*|\/\/|\/\*)/.test(line) || line.includes('//')) continue;
    let at = match.index + match[0].length;
    // Python: only calls with a literal code are messages (not `def tr(` or mentions in docstrings).
    // Python 只算以字面代號呼叫的（def tr( 與說明文字裡的提及不算）。
    if (python && (/^\s*#/.test(line) || !/^\s*['"]/.test(text.slice(at)))) continue;
    const read = () => { LITERAL.lastIndex = at; const found = LITERAL.exec(text); if (!found) return undefined; at = LITERAL.lastIndex; return vm.runInNewContext(found[1]); };
    const code = read();
    if (code === undefined) { problems.push(where(match.index) + ': tr() needs a literal code'); continue; }
    if (!/^\s*,/.test(text.slice(at))) { problems.push(where(match.index) + ': tr() needs a literal original'); continue; }
    at = text.indexOf(',', at) + 1;
    const source = read();
    if (source === undefined) { problems.push(where(match.index) + ': tr() needs a literal original'); continue; }
    if (!CODE.test(code)) problems.push(where(match.index) + ': bad code "' + code + '" (area.item, at most three parts)');
    if (!source.trim()) problems.push(where(match.index) + ': empty original for ' + code);
    if (messages.has(code) && messages.get(code).source !== source) problems.push(where(match.index) + ': ' + code + ' has two different originals');
    messages.set(code, { source, where: where(match.index) });
  }
}
// Data that carries its own English (Q34 修訂 4: the code is derived where the text is used): the
// TD built-in value table's hints, code tdValue.<id>. 自帶英文的資料：TD 內建值表的說明，代號 tdValue.<id>。
const tdValueFile = path.join(root, 'src/core-ts/td_values.ts');
for (const line of fs.readFileSync(tdValueFile, 'utf8').split('\n')) {
  if (!/^\s*\{"id":/.test(line)) continue;
  const entry = JSON.parse(line.trim().replace(/,$/, ''));
  if (entry.hint) messages.set('tdValue.' + entry.id, { source: entry.hint, where: 'src/core-ts/td_values.ts' });
}
// Uniform presets carry their own English too (Q61): code uniformPreset.<entry>. 預設 Uniform 的說明。
const presetFile = path.join(root, 'src/library/uniform_presets.json');
for (const preset of JSON.parse(fs.readFileSync(presetFile, 'utf8')).presets)
  messages.set('uniformPreset.' + preset.entry, { source: preset.hint, where: 'src/library/uniform_presets.json' });
const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
const en = Object.fromEntries([...messages].sort(([a], [b]) => a.localeCompare(b)).map(([code, m]) => [code, m.source]));
const enFile = path.join(folder, 'en.json'), zhFile = path.join(folder, 'zh-Hant.json');
const enText = JSON.stringify(en, null, 2) + '\n';
const zh = fs.existsSync(zhFile) ? JSON.parse(fs.readFileSync(zhFile, 'utf8')) : {};
const missing = Object.keys(en).filter(code => !(code in zh)), extra = Object.keys(zh).filter(code => !(code in en));
for (const code of Object.keys(en)) if (zh[code] && placeholders(zh[code]) !== placeholders(en[code]))
  problems.push('zh-Hant.json: ' + code + ' uses {' + placeholders(zh[code]) + '}, the original uses {' + placeholders(en[code]) + '}');
if (write) {
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(enFile, enText);
  const next = Object.fromEntries(Object.keys(en).map(code => [code, zh[code] ?? '']));
  fs.writeFileSync(zhFile, JSON.stringify(next, null, 2) + '\n');
  if (extra.length) console.log('removed from zh-Hant.json: ' + extra.join(', '));
  if (missing.length) console.log('added to zh-Hant.json (empty, shows English): ' + missing.join(', '));
} else {
  if (!fs.existsSync(enFile) || fs.readFileSync(enFile, 'utf8') !== enText) problems.push('en.json is out of date: run node tools/dev/locales.cjs --write');
  if (missing.length) problems.push('zh-Hant.json lacks: ' + missing.join(', ') + ' (run --write to add them)');
  if (extra.length) problems.push('zh-Hant.json has unused: ' + extra.join(', ') + ' (run --write to remove them)');
}
const untranslated = Object.keys(en).filter(code => !zh[code]);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(JSON.stringify({ messages: messages.size, untranslatedZhHant: untranslated.length }));
