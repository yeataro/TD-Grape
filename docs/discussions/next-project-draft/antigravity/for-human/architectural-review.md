# GrapeL 架構審查與概念重構報告

* **貢獻者**：Antigravity (Google DeepMind) 與 [@yeataro](https://github.com/yeataro) 協作  
* **適用對象**：人類維護者、架構設計者  
* **文件版本**：2026-09-22.r3  
* **授權標註**：本文件依循本專案開源授權協議保存與公開  

---

## 一、 審查總覽（依照 AGENTS 規約標記）

總覽：致命 0、嚴重 2、次要 2、建議 2

---

### 【嚴重 1】具體簽名逐筆書寫（Concrete Signatures）會引發維護成本與資料體積的爆炸，破壞「人類易於維護」的核心目標。

* **第一句結論**：這個做法有嚴重問題：以完全具體的簽名逐筆手寫，將導致基礎數學節點的維護成本呈現維度爆炸，背離了人類維護定義表的初衷。
* **事實**：在 [node-definition-candidate-materialx.md:L58-L117](file:///c:/Users/user/Dropbox/Codex/TD-Grape-workspace/TD-Grape/docs/discussions/next-project-draft/node-definition-candidate-materialx.md#L58-L117) 中，單一 `compare` 節點僅列出 `float` 與 `vec2~vec4` 四種型別，其簽名資料即佔用近 60 行 JSON，且每個分量的 input、output 與 default 皆為人工逐筆重複填寫。
* **推論**：若將此結構推廣至標準數學運算節點（如 `add`、`multiply`、`min`、`clamp` 等），若要完整覆蓋 GLSL 標準型別（`float`, `int`, `uint`, `double`, `vec2..4`, `ivec2..4`, `uvec2..4`, `dvec2..4`, `mat2..4`），單一節點需要手寫 20 到 40 筆完整的簽名物件。這會導致單一節點定義檔膨脹至數百行，大幅增加人工維護時複製貼上遺漏（Copy-paste error）的風險。
* **意見**：雖然草案在 §7 標記「不代表長期排除泛型」，但若第一階段最小結構完全仰賴具體簽名枚舉，人類維護者在建立基本節點庫時會立即面臨極高的重複勞動負擔。建議在基本結構中引入「受限的同構簽名範型（Homogeneous Signatures）」，讓相同拓撲結構的型別以型別清單形式聲明。
* **把握程度**：確定（可由型別維度乘積與資料行數確證）。

---

### 【嚴重 2】節點層 `options.data` 與子集層 `emit.code` 之間存在未受結構約束的隱式跨層耦合。

* **第一句結論**：這個做法有嚴重問題：將產碼字串細節（如 `symbol` 與 `function`）混在節點根層級的選項資料中，造成根層級資料與特定子集產生未被 Schema 約束的隱式依賴。
* **事實**：在 [node-definition-candidate-materialx.md:L35-L47](file:///c:/Users/user/Dropbox/Codex/TD-Grape-workspace/TD-Grape/docs/discussions/next-project-draft/node-definition-candidate-materialx.md#L35-L47)，`options.op` 位於節點根層級，其 `data` 同時包含了 `symbol` 與 `function` 兩個鍵；而在 [L75](file:///c:/Users/user/Dropbox/Codex/TD-Grape-workspace/TD-Grape/docs/discussions/next-project-draft/node-definition-candidate-materialx.md#L75) `subsets.scalar` 引用了 `{{option.op.symbol}}`，在 [L114](file:///c:/Users/user/Dropbox/Codex/TD-Grape-workspace/TD-Grape/docs/discussions/next-project-draft/node-definition-candidate-materialx.md#L114) `subsets.vector` 引用了 `{{option.op.function}}`。
* **推論**：根層級的選項字典並不知道下游子集究竟依賴哪些具體鍵。若維護者新增一個選項卻漏填 `function`，或某些選項本質上只對純量合法（例如特定位元運算子）、對向量不合法，現有的結構無法在資料層做出排他約束與靜態 Schema 驗證，錯誤只能延遲到模板代換失敗時才暴露。
* **意見**：根層級的選項只應保留純粹的介面枚舉（`id` 與 `label`）；將「該選項如何代換成具體程式碼」移入各子集的 `emit` 內進行映射（Mapping），讓子集自洽並承擔排他性檢查。
* **把握程度**：確定。

---

### 【次要 1】具名產碼能力 `glsl.expression` 缺乏多輸出（Multi-output）的擴充結構預留。

* **事實**：在 [node-definition-candidate-materialx.md:L72-L76](file:///c:/Users/user/Dropbox/Codex/TD-Grape-workspace/TD-Grape/docs/discussions/next-project-draft/node-definition-candidate-materialx.md#L72-L76)，`emit` 物件僅定義了單一字串 `output: "out"` 與單行 `code` 表達式。
* **推論**：Shader 中存在大量多輸出節點（如拆分分量 Split、分解矩陣、同時計算值與微分、或傳回商與餘數的運算）。若第一階段將 `emit` 鎖定在單一 `output` 鍵，後續遇到多輸出節點時將被迫更換 capability 或推翻此處的欄位形狀。
* **意見**：第一階段雖以單輸出算式驗證為主，但建議將產碼輸出的結構設計為字典映射（`outputs: { [portName]: "..." }`），使單輸出與多輸出的資料形狀完全一致。
* **把握程度**：推論。

---

### 【次要 2】型別標識符（Type Strings）缺乏環境層級的合法性詞彙依據。

* **事實**：候選資料中的型別皆為純字串（如 `"float"`, `"bvec2"`），而 [node-definition-candidate-materialx.md:L49-L57](file:///c:/Users/user/Dropbox/Codex/TD-Grape-workspace/TD-Grape/docs/discussions/next-project-draft/node-definition-candidate-materialx.md#L49-L57) 宣告了 `webgl2` 與 `td_glsl_top` 兩種環境。
* **推論**：節點定義表本身無法自我驗證其所填入的型別名稱是否屬於該環境所支援的集合（例如雙精度型別在 WebGL 2 不合法，但在特定硬體 GLSL 合法）。
* **意見**：環境定義表（Environment Manifest）應獨立提供該環境合法的型別清單，以便在節點定義被載入或編輯時，能第一時間阻擋不合法的型別字串。
* **把握程度**：推論。

---

### 【建議 1】子集在畫布圖實例（Graph Instance）上的決議生命週期（Resolution Lifecycle）需在第一階段給出明確定義。

* **事實**：交接文件 [node-definition-handoff.md:§3.1](file:///c:/Users/user/Dropbox/Codex/TD-Grape-workspace/TD-Grape/docs/discussions/next-project-draft/node-definition-handoff.md#L48-L53) 將「子集（Subsets）」列為已定前提，但候選案在 [node-definition-candidate-materialx.md:L228](file:///c:/Users/user/Dropbox/Codex/TD-Grape-workspace/TD-Grape/docs/discussions/next-project-draft/node-definition-candidate-materialx.md#L228) 標明「子集切換與接線的處理尚未決定」。
* **意見**：圖實例在儲存時，必須顯式記錄目前決議的子集與簽名 ID。若未顯式保存，每次載入圖時必須仰賴全圖型別推導才能還原接孔，斷線或圖有語法錯誤時介面將無法維持正確的節點外觀。

---

### 【建議 2】對「後續目標筆記」中的解釋圖、常數傳播與更新鏈路，應在第一階段維持嚴格的資訊隔離。

* **事實**：[node-definition-future-notes.md](file:///c:/Users/user/Dropbox/Codex/TD-Grape-workspace/TD-Grape/docs/discussions/next-project-draft/node-definition-future-notes.md) 包含了動態接孔 UUID、快照身分、4 級屬性傳播（constant/spec/uniform/varying）及依賴拓撲聯集等編譯期優化方案。
* **意見**：舊專案停擺的主因是在核心資料模型尚未穩定前過早引入過多狀態機。強烈建議在啟動新專案第一階段時，**物理排除此文件**，避免後續智能體在定義表層級提前預留複雜欄位。

---

## 二、 概念重構：解開「子集、方言、多載」的纏繞

在討論中，作者敏銳地指出：*「方言往往是會改變寫法的東西，而子集反而是方言的變體……子集的講法很不乾淨，如果是子集它應該是再大一點的概念，而不是分量或型別。」*

這指出了候選 01 最核心的建模失誤：**GLSL 的語法怪癖反客為主，污染了頂層的領域模型。**

### 1. 為什麼會感到「不乾淨」？
* 在 HLSL 或 WGSL 中，向量比較可以直接寫 `a < b`（自動產出布林向量）。
* 只有 GLSL 偏偏規定純量寫 `a < b`，向量必須呼叫 `lessThan(a, b)`。
* 候選 01 為了迎合 GLSL 這一個語法特例，在節點頂層生造出 `subsets.scalar` 和 `subsets.vector` 兩個子集。若未來引入 HLSL，HLSL 將被迫繼承這個毫無意義的割裂。

### 2. 三層正交概念劃分

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 節點語意 (Node Semantic)                                │
│    - 定義「做什麼」：Compare (比較 A 與 B)                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. 多載與型別形態 (Overload / Signatures)                  │
│    - 定義「接孔形狀與型別約束」：                            │
│      • 輸入 T，輸出 bool / bvecN (T 為數值或向量)            │
│    - 與任何具體 Shader 語言代碼無關                         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. 方言實作 (Dialect Implementations)                      │
│    - 定義「在特定目標語言中怎麼寫出來」：                    │
│      • 預設寫法：({{a}} {{op}} {{b}})                        │
│      • GLSL 特例：若 T 是向量，轉為 {{func}}({{a}}, {{b}})    │
└─────────────────────────────────────────────────────────────┘
```

* **子集（Subset）的真正身分**：
  子集不是 `float` vs `vec3`，子集是**「能力設定檔（Capability Profile）」**（例如：頂點階段子集 vs 片段階段子集，或 2D 紋理能力子集 vs 3D Compute 能力子集）。
