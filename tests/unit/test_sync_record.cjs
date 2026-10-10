// The sync state's own record (Refactor.70.1). 同步狀態自己的紀錄。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const file = path.resolve(__dirname, '../../src/editor-react/sync_record.ts');
const loaded = { exports: {} };
new Function('module', 'exports', 'require', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(loaded, loaded.exports, () => ({}));
const { recordSync, SYNC_RECORDS } = loaded.exports;
const lines = records => records.map(r => r.kind + ':' + (r.from !== undefined && r.from !== r.revision ? r.from + '-' : '') + r.revision);

test('trouble starting and ending is always kept; routine applies in a row are one growing line', () => {
  let records = recordSync([], null, { phase: 'ready', revision: 10 }, undefined, 0);
  const step = (before, after, reason) => { records = recordSync(records, before, after, reason, 1); };
  step({ phase: 'ready', revision: 10 }, { phase: 'sending', revision: 10 });
  step({ phase: 'sending', revision: 10 }, { phase: 'ready', revision: 11 });
  step({ phase: 'ready', revision: 11 }, { phase: 'ready', revision: 12 });
  step({ phase: 'ready', revision: 12 }, { phase: 'ready', revision: 13 });
  assert.deepEqual(lines(records), ['opened:10', 'applied:11-13'], 'three applies, one line');
  step({ phase: 'ready', revision: 13 }, { phase: 'offline', revision: 13 }, 'Cannot reach TD');
  step({ phase: 'offline', revision: 13 }, { phase: 'offline', revision: 13 });
  assert.equal(records.at(-1).reason, 'Cannot reach TD');
  step({ phase: 'offline', revision: 13 }, { phase: 'uncertain', revision: 13 });
  step({ phase: 'uncertain', revision: 13 }, { phase: 'ready', revision: 14 });
  step({ phase: 'ready', revision: 14 }, { phase: 'ready', revision: 15 });
  assert.deepEqual(lines(records), ['opened:10', 'applied:11-13', 'offline:13', 'uncertain:13', 'recovered:14', 'applied:14-15']);
  const same = records;
  step({ phase: 'ready', revision: 15 }, { phase: 'sending', revision: 15 });
  assert.equal(records, same, 'nothing worth a line: the same array');
});

test('the record keeps the last 50 lines', () => {
  let records = recordSync([], null, { phase: 'ready', revision: 0 }, undefined, 0);
  for (let i = 0; i < 60; i++) {
    records = recordSync(records, { phase: 'ready', revision: i }, { phase: 'offline', revision: i }, undefined, i);
    records = recordSync(records, { phase: 'offline', revision: i }, { phase: 'ready', revision: i }, undefined, i);
  }
  assert.equal(records.length, SYNC_RECORDS);
  assert.equal(records.at(-1).kind, 'recovered');
});

// Refactor.75: the record keeps why TD was away, and a different reason while still away is a new line.
// 紀錄保留 TD 為什麼不在；還不在時換了原因也記一行。
test('the reason TD gave is kept, and a new reason while away is a new line', () => {
  let records = recordSync([], null, { phase: 'ready', revision: 5 }, undefined, 0);
  records = recordSync(records, { phase: 'ready', revision: 5 }, { phase: 'offline', revision: 5, link: 'unreachable' }, 'x', 1);
  records = recordSync(records, { phase: 'offline', revision: 5, link: 'unreachable' }, { phase: 'offline', revision: 5, link: 'closed' }, 'y', 2);
  records = recordSync(records, { phase: 'offline', revision: 5, link: 'closed' }, { phase: 'offline', revision: 5, link: 'closed' }, 'y', 3);
  assert.deepEqual(records.map(r => r.kind + ':' + (r.link ?? '')), ['opened:', 'offline:unreachable', 'offline:closed']);
});
