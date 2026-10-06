# 目前現況

最後更新：2026-10-07。每輪收尾時覆寫本頁；完整交付紀錄見 [STATUS](STATUS.md)。標 ✅ 者已用 git／測試核對。

## 做到哪裡

**路線：** [B 案](REFACTOR_REACT_FLOW_PLAN_B.md)——一次一條真實產品能力，正式 React UI、核心與 TD 同輪打通，逐步擴大到接管全產品後關閉舊入口。A 案（[REFACTOR_UI_UPDATES](REFACTOR_UI_UPDATES.md)）只留作比較。

**最新交付：Refactor.15 / `7b52579`** ✅——第一條正式 React TOP 路徑，限定 TOP／pixel 常數圖（Float、Color RGBA、Add、Color Output）。入口與責任表見 [React 入口](../../src/editor-react/README.md)。

**Refactor.15 人類 UX 驗收：已有結論（2026-10-07）。** 遷移期間不要求外觀／行為與舊入口一致。補上的遷移期便利行為：
- 開不了圖時列出不支援的具體內容（`f803dca`）。
- 開不了圖時可「載入預設圖」恢復測試環境；編輯器內衝突時可「用編輯器草稿覆寫 TD」（`4017f53`）。

自動測試：core 97 + session 19 項通過；8 組 browser 情境通過 ✅（2026-10-07）。

**同日其他：** `GrapeManager` 依去向分組並加 Legacy 標注，新增 [舊 Python 現況清單](LEGACY-PYTHON.md)（`5a08665`）；重構歷史已查證，寫在該文件。

**權威與 TD 不在時的編輯：2026-10-07 定案**（[訪談 Q28](../../../work/in-place-refactor-design/design-interview.md)、[target-architecture](../../../work/in-place-refactor-design/target-architecture.md)「權威的範圍與 TD 不在時的編輯」）。規則摘要已寫入 AGENTS.md 必守規則。

**更早完成（Refactor.1–14）：** TS 接線規劃、TOP 前端 compiler、56 個節點模組、Editor Service（VFS 資產服務，port 65465）、新 Manager `/TD_Grape/GrapeManager` 與原生 Grape TOP、Grape OP 對 Manager 只有編輯依賴。

## 待處理

> **遷移期便利行為，非產品行為（人類 2026-10-07）：** 新舊入口並存才有的功能——版本衝突覆寫、拒絕開圖的不支援說明與載入預設圖、返回舊入口——只是遷移途中方便測試，做最小可用即可，不寫進產品規格；安全底線（版本核對、不靜默丟資料）照守。舊入口關閉時移除。

1. **TD 不在時的編輯（產品功能，Q28 定案，尚未實作）：** 新編輯器目前在 TD 無回應時只顯示「交付未確認」並要人類手動按「檢查連線與版本」，且把 `manager_not_responding`（確定未修改）誤當成「結果不明」。要做：
   - 提示分兩種：「TD 沒有回應（可能最小化）」／「連不到 TD（可能卡住、已關閉或網路中斷）」，接「修改保留在瀏覽器，連上後自動送出」。
   - 只在未連線期間定期詢問 TD，連上即停；TD 回來且圖未變就自動補送。
   - 圖也變了：浮動提示「TD 端的圖似乎有被修改」，按鈕「編輯端／TD 端」，預設建議編輯端；不擋編輯。現有 `session.overwrite` 可作「編輯端」的基礎。
   - 逾時後仍保留「結果不明、先查版本、不自動重送」（實測：瀏覽器放棄後 TD 仍可能執行）。
2. **Uniform 支援：** 牽涉宣告、TD 原生參數與綁定，不只節點本身，**不可當成小切片直接做**，需另行規劃。
3. **下一切片候選（HANDOFF 建議）：** 「動態 Math／Split 接孔與多輸出」挑一個小而真實的操作。與第 1 項的先後未定。
4. **Legacy 盤點續作：** `src/core/` 其餘 6 檔與 TOE 內其他 Python（見 [LEGACY-PYTHON](LEGACY-PYTHON.md)「尚未整理」）。

## 已發現、尚未處理

| 發現日 | 情況 |
| --- | --- |
| 2026-10-07 | 衝突時選「TD 端」後，編輯器修改要留成草稿、不擋畫面、之後可叫出——未設計；草稿累積的後果未知。 |
| 2026-10-07 | 現有草稿機制每個 Grape OP 只存一份（sessionStorage，關分頁即失）；「找到先前草稿」提示出現時畫布被鎖住，違反「編輯不等 TD」。 |
| 2026-10-07 | 被擋在「無法在此入口開啟」畫面時，瀏覽器內未送出的草稿無法取回（遷移期人類接受）。 |
| 2026-10-07 | 沒有對應 Grape OP 時也能先寫草稿——屬之後部署到網路（可能另開倉庫）的議題，先不做。 |
| 2026-10-07 | 舊編輯器匯入草稿用的 `POST inspect` 新 Manager 未提供（已斷）。 |

## 未完成／未驗證

- **Human Takeover Test**：人類不靠 AI 完成一項維護（如新增 unary 節點），未執行。見 [B 案](REFACTOR_REACT_FLOW_PLAN_B.md#human-takeover-test)。
- **完整 TOE 冷啟動**：未驗證。
- **未遷移**：MAT／ISF、TOP texture／array／進階來源、舊 `expose` 旗標、Uniform 拖曳即時更新（目前放開才送值）、pixel preview session、Personal Library、離線 Sketch、阻尼、面板（待人類討論）。

## 程式目錄現況 ✅

| 目錄 | 身分 |
| --- | --- |
| `src/core-ts/` | **新核心**（TS）：節點模組、型別、接線、TOP compiler |
| `src/editor-react/` | **新正式 React 入口** |
| `src/editor/` | **舊前端入口**，仍服務未遷移能力；含 `build:core` 生成的 `wire_planning.js`、`editor-bootstrap.json`、`editor-library.json`（勿手改） |
| `src/core/` | 舊 Python 核心；部分仍由新 Manager 使用，見 [LEGACY-PYTHON](LEGACY-PYTHON.md)；新路徑不得 fallback 到舊 compiler |
| `src/td/runtime/` | 新宿主 Python（host_api、native_family、Manager 等） |
| `src/library/` | 內建子圖 Library 來源 |

## 現場 TD（使用前以 TD MCP 重新確認）

- 主組件 `/TD_Grape`；測試用 Grape TOP `/project1/Grape_TOP_React`（2026-10-07 已換成預設圖）
- 新入口 `http://127.0.0.1:65465/react-editor.html?target=3ffb8d81896943c8bf90bec56791a33b`
- `GrapeEditor` 的 `Use External Folder` **開啟中**（開發模式）；交付前依 AGENTS.md 打包進 VFS 並關閉
- 開發 TOE：`src/td/TD-Grape-dev.toe`（TD 顯示 `.23.toe` 是遞增存檔的正常狀態）；未提交的修改是人類的，須保留。2026-10-07 在 TD 內的 GrapeManager 整理需人類存 TOE 才保留
- 2026-10-07 TD MCP 確認 ✅：server 1.1.55／port 13316，TD 2025.32820
- 保護區：`/TD_Grape/IconGen → /TD_Grape/icon` 及其依賴
