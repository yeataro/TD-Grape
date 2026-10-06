# 目前現況

最後更新：2026-10-06（Claude 接手自 Codex 時整理）。每輪收尾時覆寫本頁；完整交付紀錄見 [STATUS](STATUS.md)。標 ✅ 者已用 git／測試核對。

## 做到哪裡

**路線：** [B 案](REFACTOR_REACT_FLOW_PLAN_B.md)——一次一條真實產品能力，正式 React UI、核心與 TD 同輪打通，逐步擴大到接管全產品後關閉舊入口。A 案（[REFACTOR_UI_UPDATES](REFACTOR_UI_UPDATES.md)）只留作比較。

**最新交付：Refactor.15 / `7b52579`** ✅——第一條正式 React TOP 路徑，限定 TOP／pixel 常數圖（Float、Color RGBA、Add、Color Output）：編輯、接線、Undo／Redo、前端 GLSL 產碼、真實 TD 套用與保存重開。入口與責任表見 [React 入口](../../src/editor-react/README.md)。

- 自動測試：core 97 + session 15 = 112 項通過；`check:core`、`check:editor` 通過 ✅（2026-10-06，Node 25.5.0）
- 8 組 browser 情境、真實 GPU 拒絕、TOX 重載：STATUS 記有證據，接手時未重跑
- **人類 UX 驗收：進行中，尚無結論。** 已知觀察與要求見下方「待處理」。

**更早完成（Refactor.1–14）：** TS 接線規劃、TOP 前端 compiler、56 個節點模組（scalar／vector／條件／Router／子圖）、Editor Service（VFS 資產服務，port 65465）、新 Manager `/TD_Grape/GrapeManager` 與原生 TOP Family、Family 對 Manager 只有編輯依賴。

## 待處理

1. **人類 UX 驗收（Refactor.15）——2026-10-06 人類回饋：** 遷移期間不要求外觀／行為與舊入口一致。MVP 是開不了圖時至少說出**什麼不支援**——已做：拒絕畫面列出具體宣告／節點／子圖等（`src/editor-react/core.ts` `unsupportedReasons`），已更新 Embedded VFS，待人類看過確認。Uniform 支援牽涉宣告、TD 原生參數與綁定，不只節點本身，**不可當成小切片直接做**，需另行規劃。
2. **版本衝突恢復 UX（人類要求，近期切片須納入）：** 兩入口同時編輯同一 UUID 時，新入口目前只有保護（停寫、留草稿、查版本），缺三個操作——
   - 使用 TD 版本：載入最新 TD 圖，先讓使用者明確處理本地未保存修改
   - 用編輯器版本覆寫 TD：明確確認後核對最新 revision，以正常產碼／資料／GPU 驗證重新提交；期間再有更新仍回報衝突
   - 暫不處理：保留草稿與衝突狀態

   按鈕命名由實作者決定；下載草稿／重開頁只能當備援。
3. **首輪覆蓋限制：** 從舊入口加過 Uniform 再刪節點，殘留 `uValue` 宣告使新入口拒絕開圖。不能靠刪使用者資料或繞過驗證當修正。（2026-10-06 `Grape_TOP_React` 現場即此狀態：`uValue` 宣告＋Uniform 節點 `n416684d63ca1`。）
4. **下一切片（HANDOFF 建議）：** 從「動態 Math／Split 接孔與多輸出」挑一個小而真實的操作；先讀實際 NodeModule 與正式 UI 確認缺口。之後建議順序：Uniform 單次編輯與原生歷史 → 真正 Subgraph 編輯。

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
| `src/core/` | 舊 Python 核心；舊入口／未遷移整圖仍可明示使用，新路徑不得 fallback |
| `src/td/runtime/` | 新宿主 Python（host_api、native_family、Manager 等） |
| `src/library/` | 內建子圖 Library 來源 |

## 現場 TD（文件記載，使用前以 TD MCP 重新確認）

- 主組件 `/TD_Grape`；最後測試 Family `/project1/Grape_TOP_React`
- 新入口 `http://127.0.0.1:65465/react-editor.html?target=3ffb8d81896943c8bf90bec56791a33b`
- 開發 TOE：`src/td/TD-Grape-dev.toe`（TD 顯示 `.23.toe` 是遞增存檔的正常狀態，存檔仍回原檔）；未提交的修改是人類的，須保留
- 2026-10-06 TD MCP 確認 ✅：server 1.1.55／port 13316，TD 2025.32820；`Grape_TOP_React` 對應上方 target、Editor Service 65465 有回應、無 error
- 保護區：`/TD_Grape/IconGen → /TD_Grape/icon` 及其依賴
