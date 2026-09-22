/**
 * 架構不變量測試 (Architecture Invariant Test)
 * 貢獻者：Claude Opus 4.8 (Anthropic) 與 @yeataro 協作 · 2026-09-22
 *
 * 把 Antigravity AGENTS.md 的架構紅線轉成會失敗的 CI 測試。
 * 標記 [ADAPT] 處依 GrapeL 實際 API 對接；不變量意圖不可弱化，只可調整存取方式。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// [ADAPT] 依 GrapeL 實際模組路徑對接。
import { emitExpression } from '../src/core/emitter';
import { CAPABILITIES } from '../src/core/capabilities';
import { loadAllDefinitions } from '../src/core/definitions';

const ENGINE_SOURCE_DIRS = ['src/core', 'src/editor/graph']; // [ADAPT] 引擎與編輯器核心
const DEFINITIONS_DIR = 'templates'; // [ADAPT] 正式專案為 definitions/

function readSourceFiles(dir: string): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|js)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
        out.push({ path: full, text: readFileSync(full, 'utf8') });
      }
    }
  };
  walk(dir);
  return out;
}

// 不變量 1：引擎核心零節點身分特例（紅線一）。結構掃描，違反即編譯期紅燈。
describe('Invariant 1 — 引擎核心不得硬編碼節點身分', () => {
  const engineFiles = ENGINE_SOURCE_DIRS.flatMap(readSourceFiles);
  const forbidden: { name: string; re: RegExp }[] = [
    { name: '對 node.id/key 的等值比較', re: /\b(node|def|definition|n)\.(id|key)\s*===?\s*['"`]/ },
    { name: '以節點身分為 switch 主詞', re: /switch\s*\(\s*\w+\.(id|key)\s*\)/ },
    { name: '節點身分字面值命中清單', re: /\[\s*(['"`])(add|multiply|compare|texture|uniform)\1\s*,/ },
  ];
  for (const file of engineFiles) {
    it(`${file.path} 不得含節點特例分支`, () => {
      const hits = forbidden.filter(({ re }) => re.test(file.text)).map(({ name }) => name);
      expect(hits, `發現節點身分特例：${hits.join('、')}`).toEqual([]);
    });
  }
});

// 不變量 2：emit.capability 屬於封閉且小型的能力集（紅線三）。發明新能力即失敗。
describe('Invariant 2 — emit.capability 屬於封閉能力集', () => {
  const defs = loadAllDefinitions(DEFINITIONS_DIR);
  const registered = new Set(Object.keys(CAPABILITIES));
  const MAX_CAPABILITIES = 24; // [ADAPT] 依泛型原語數調整，但必須遠小於節點數

  it('已註冊能力數量維持在小型封閉集', () => {
    expect(registered.size).toBeLessThanOrEqual(MAX_CAPABILITIES);
  });

  for (const def of defs) {
    for (const [subsetId, subset] of Object.entries(def.subsets)) {
      it(`${def.id}/${subsetId} 使用已註冊能力`, () => {
        expect(registered.has(subset.emit.capability)).toBe(true);
      });
    }
  }
});

// 不變量 3：節點完整行為僅由定義資料決定（紅線一、三）。需定義表外邏輯即失敗。
describe('Invariant 3 — 純資料產碼閉環', () => {
  const defs = loadAllDefinitions(DEFINITIONS_DIR);

  for (const def of defs) {
    for (const [subsetId, subset] of Object.entries(def.subsets)) {
      const optionChoices = Object.entries(def.options ?? {}).map(
        ([name, spec]) => [name, spec.choices.map((c: { id: string }) => c.id)] as const,
      );
      const optionCases = optionChoices.length
        ? optionChoices.flatMap(([name, ids]) => ids.map((id) => ({ [name]: id })))
        : [{}];

      for (const options of optionCases) {
        it(`${def.id}/${subsetId} options=${JSON.stringify(options)} 可純資料產碼`, () => {
          const inputs = Object.fromEntries(
            Object.keys(subset.signatures?.[0]?.inputs ?? subset.signatureTemplates?.[0]?.inputs ?? {})
              .map((port) => [port, `sg_${port}`]),
          );
          const result = emitExpression({ definition: def, subsetId, inputs, options });
          for (const port of Object.keys(subset.emit.outputs)) {
            expect(typeof result.outputs[port]).toBe('string');
            expect(result.outputs[port].length).toBeGreaterThan(0);
          }
        });
      }
    }
  }
});

// 不變量 4：節點身分單一來源（紅線一 / SSOT）。別處出現平行清單即失敗。
describe('Invariant 4 — 節點註冊表僅由定義目錄構成', () => {
  it('載入器只從定義目錄建立節點身分，別處無平行清單', () => {
    const fromDefinitions = new Set(loadAllDefinitions(DEFINITIONS_DIR).map((d) => d.id));
    const engineFiles = ENGINE_SOURCE_DIRS.flatMap(readSourceFiles);
    const parallelList = /\b(NODE_IDS|EMITTER_IDS|KNOWN_NODES)\b/;
    const offenders = engineFiles.filter((f) => parallelList.test(f.text)).map((f) => f.path);

    expect(offenders, `發現平行節點清單：${offenders.join('、')}`).toEqual([]);
    expect(fromDefinitions.size).toBeGreaterThan(0);
  });
});
