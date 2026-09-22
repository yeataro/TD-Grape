# GrapeL 專案第一階段啟動任務 (Phase 1 Bootstrap Task)

文件版本：2026-09-22.r3  
閱讀對象：接手啟動 GrapeL 新專案的 AI 智能體。

---

## 一、 第一天任務目標（單節點純資料產碼閉環）

**禁止建立 UI、禁止建立複雜系統架構。** 今天的唯一目標是驗證：
「依據 `templates/compare.json` 定義表，透過泛型模板代換，成功產出正確的 GLSL 片段，且代碼中零寫死判斷。」

---

## 二、 驗收測試檔（`tests/emitter.test.ts`）

智能體在 `src/core/emitter.ts` 完成的實作必須使以下測試全數通過：

```typescript
import { describe, it, expect } from 'vitest';
import { emitExpression } from '../src/core/emitter';
import compareDef from '../templates/compare.json';

describe('Generic GLSL Expression Emitter', () => {
  it('should emit scalar comparison without hardcoded node logic', () => {
    const result = emitExpression({
      definition: compareDef,
      subsetId: 'scalar',
      inputs: { a: 'val_a', b: 'val_b' },
      options: { op: 'lt' }
    });
    // 純量替換為運算子
    expect(result.outputs.out).toBe('(val_a < val_b)');
  });

  it('should emit vector comparison using subset mapping function', () => {
    const result = emitExpression({
      definition: compareDef,
      subsetId: 'vector',
      inputs: { a: 'vec_a', b: 'vec_b' },
      options: { op: 'ge' }
    });
    // 向量替換為內建函數
    expect(result.outputs.out).toBe('greaterThanEqual(vec_a, vec_b)');
  });

  it('should reject invalid options not mapped in subset', () => {
    expect(() => emitExpression({
      definition: compareDef,
      subsetId: 'vector',
      inputs: { a: 'vec_a', b: 'vec_b' },
      options: { op: 'non_existent_op' }
    })).toThrow();
  });
});
```

---

## 三、 第一輪啟動 Prompt（由使用者直接複製給新 Agent）

> 「我們正在從零開始建立全新專案 **GrapeL**。請嚴格遵守 `AGENTS.md`。
> 
> 專案的唯一核心目標是：**讓人類能維護節點定義表，而非維護程式碼特例**。
> 
> 請勿嘗試建立龐大的系統架構或前端介面。你今天的唯一任務是完成 **Phase 1 最小產碼閉環**：
> 1. 閱讀 `SPEC_MINIMAL_SCHEMA.md` 與 `templates/compare.json`。
> 2. 在 `src/core/emitter.ts` 中實作純函數 `emitExpression`，支援 `glsl.expression`。
> 3. 在 `tests/emitter.test.ts` 中建立單元測試，驗證純量（運算子）與向量（函數）的正確代換。
> 
> **硬性約束**：`emitter.ts` 必須是 100% 泛型的模板代換器，嚴禁出現 `if (node.id === 'compare')` 或任何節點特例判斷。測試通過即為完成。」
