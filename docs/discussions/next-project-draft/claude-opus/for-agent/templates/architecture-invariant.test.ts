/**
 * 架構不變量測試 (Architecture Invariant Test)
 *
 * 貢獻者：Claude Opus 4.8 (Anthropic) 與 @yeataro 協作
 * 文件版本：2026-09-22
 *
 * 這個檔案是一個「機制」，不是一份「守則」。它的存在理由：
 * TD-Grape 的架構之所以漂移，不是因為沒有人寫下「不要硬編碼節點特例」，
 * 而是因為違反這條規則時，沒有任何東西會立即、客觀地報錯。
 *
 * 本檔把 Antigravity AGENTS.md 的三條架構紅線，從「文字約定」轉成
 * 「會失敗的測試」。CI 每次執行；違反的當下就紅燈，不等人工審查。
 *
 * 這是範本。標記為 [ADAPT] 的地方需依 GrapeL 實際 API 對接；
 * 不變量的意圖不可弱化，只可依實作調整存取方式。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// [ADAPT] 依 GrapeL 實際模組路徑對接。
import { emitExpression } from '../src/core/emitter';
import { CAPABILITIES } from '../src/core/capabilities';
import { loadAllDefinitions } from '../src/core/definitions';

// 引擎核心原始碼目錄。這些檔案裡不允許出現任何針對特定節點身分的分支。
const ENGINE_SOURCE_DIRS = ['src/core', 'src/editor/graph']; // [ADAPT]

// 節點定義表的唯一來源目錄。節點身分只能從這裡誕生。
const DEFINITIONS_DIR = 'templates'; // [ADAPT] 正式專案應為 definitions/

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

/**
 * 不變量 1：引擎核心零節點身分特例（AGENTS.md 紅線一）。
 *
 * 這是結構性掃描：引擎原始碼中不得出現對特定節點 id/key 的字串比較或
 * switch 分派。這正是 TD-Grape 累積 1,800 行 elif 的入口；在這裡把它
 * 變成編譯即失敗，就永遠不會再累積第二條。
 */
describe('Invariant 1 — 引擎核心不得硬編碼節點身分', () => {
  const engineFiles = ENGINE_SOURCE_DIRS.flatMap(readSourceFiles);

  // 針對 node/def 的身分欄位做等值比較，或以其為 switch 主詞。
  const forbidden: { name: string; re: RegExp }[] = [
    { name: '對 node.id/key 的等值比較', re: /\b(node|def|definition|n)\.(id|key)\s*===?\s*['"`]/ },
    { name: '以節點身分為 switch 主詞', re: /switch\s*\(\s*\w+\.(id|key)\s*\)/ },
    { name: '節點身分字面值命中清單', re: /\[\s*(['"`])(add|multiply|compare|texture|uniform)\1\s*,/ },
  ];

  for (const file of engineFiles) {
    it(`${file.path} 不得含節點特例分支`, () => {
      const hits = forbidden
        .filter(({ re }) => re.test(file.text))
        .map(({ name }) => name);
      expect(hits, `發現節點身分特例：${hits.join('、')}`).toEqual([]);
    });
  }
});

/**
 * 不變量 2：產碼能力是封閉且小型的詞彙（AGENTS.md 紅線三）。
 *
 * 每個 subset 的 emit.capability 必須是已註冊能力之一。能力總數必須有上限——
 * 若有人為了某個節點「發明」一個新能力，這裡會失敗，逼他回到泛型能力，
 * 而不是偷偷為單一節點開後門。
 */
describe('Invariant 2 — emit.capability 屬於封閉能力集', () => {
  const defs = loadAllDefinitions(DEFINITIONS_DIR);
  const registered = new Set(Object.keys(CAPABILITIES));

  // 能力是跨節點共用的泛型原語，不是每個節點一個。設一個保守上限守住這件事。
  const MAX_CAPABILITIES = 24; // [ADAPT] 依實際泛型原語數量調整，但必須遠小於節點數。

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

/**
 * 不變量 3：每個節點的完整行為僅由其定義資料決定。
 *
 * 對每個節點、每個 subset、每個 option 值，泛型引擎必須只憑定義資料就能產碼，
 * 不呼叫任何以節點身分為條件的外部邏輯。若某節點需要定義表無法表達的行為，
 * 這裡會失敗——那就是架構退化的第一個信號，必須當下處理，不得累積。
 */
describe('Invariant 3 — 純資料產碼閉環（無節點特例路徑）', () => {
  const defs = loadAllDefinitions(DEFINITIONS_DIR);

  for (const def of defs) {
    for (const [subsetId, subset] of Object.entries(def.subsets)) {
      const optionChoices = Object.entries(def.options ?? {}).map(
        ([name, spec]) => [name, spec.choices.map((c: { id: string }) => c.id)] as const,
      );
      // 至少覆蓋每個 option 的每個選項一次。
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
          // 產碼成功且每個宣告的輸出都有對應字串——不留未定義行為。
          for (const port of Object.keys(subset.emit.outputs)) {
            expect(typeof result.outputs[port]).toBe('string');
            expect(result.outputs[port].length).toBeGreaterThan(0);
          }
        });
      }
    }
  }
});

/**
 * 不變量 4：節點身分的唯一來源（SSOT，AGENTS.md 紅線一）。
 *
 * 引擎與編輯器認得的每個節點，都必須來自定義目錄，別處不得另有一份
 * 硬編碼的節點清單。這防止「定義表有一份、程式碼裡又偷偷維護一份」的
 * 雙重事實來源——那是 TD-Grape 裡 EMITTER_IDS 與 CATALOG 需要人工對齊的病根。
 */
describe('Invariant 4 — 節點註冊表僅由定義目錄構成', () => {
  it('載入器只從定義目錄建立節點身分，別處無平行清單', () => {
    const fromDefinitions = new Set(loadAllDefinitions(DEFINITIONS_DIR).map((d) => d.id));

    // 掃描引擎原始碼，不得存在「看起來像節點 id 集合」的硬編碼陣列。
    const engineFiles = ENGINE_SOURCE_DIRS.flatMap(readSourceFiles);
    const parallelList = /\b(NODE_IDS|EMITTER_IDS|KNOWN_NODES)\b/;
    const offenders = engineFiles.filter((f) => parallelList.test(f.text)).map((f) => f.path);

    expect(offenders, `發現平行節點清單：${offenders.join('、')}`).toEqual([]);
    expect(fromDefinitions.size).toBeGreaterThan(0);
  });
});
