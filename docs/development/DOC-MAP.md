# 文件地圖

整理日期：2026-10-06。路徑相對 repo 根目錄；`../` 開頭者在 workspace，**不在 git 內**。新增或淘汰文件時更新本頁。

分類：**現役**＝描述現在／接下來的工作｜**參考**＝仍有效的規格、設計理由、舊行為說明，需要時查｜**歷史**＝過時或被取代，只在查舊行為時用。

## 現役（依閱讀順序）

| 文件 | 用途 |
| --- | --- |
| `AGENTS.md` | Agent 工作入口：範圍、規則、建置測試、每輪流程 |
| `docs/development/CURRENT.md` | 目前現況：做到哪、待處理、未驗證 |
| `docs/development/HANDOFF.md` | Codex 最後交接（2026-10-06），含人類要守住的價值 |
| `../REFACTOR-WORKFLOW.md` 第 1–158 行 | 重構正式流程：固定目標、環境、review 節點、退回規則；其後為 Refactor.2–13 歷史 |
| `docs/development/REFACTOR_REACT_FLOW_PLAN_B.md` | 已接受的執行路線（B 案）、每輪完成條件、Human Takeover Test |
| `src/editor-react/README.md` | 正式 React 入口：責任入口表、建置測試、保存與恢復 |
| `docs/development/LEGACY-GAPS.md` | 舊產品漏接清查：以功能為單位只寫最終狀態，分批，人類只審 ❌／❓ |
| `docs/development/LEGACY-PYTHON.md` | 舊 Python 現況清單：在哪、誰在用、去向；與 TD 內 Legacy annotate 框一致 |
| `docs/development/STATUS.md` 頂段 | 交付紀錄（每輪新增於頂端）。322KB，「以下為舊主線交付歷史」之後是重構前紀錄 |
| `../work/in-place-refactor-design/target-architecture.md` | **產品責任的權威**，按功能查章節 |
| `../work/in-place-refactor-design/design-interview.md` | 人類決策紀錄 Q1–Q27，按題號查（Q17 文件組織、Q20 宿主 Shell、Q22 價值優先、Q25–26 React／B 案、Q27 接手設定） |
| `docs/README.md` | 產品文件索引（多為重構前文件） |

## 參考

| 文件 | 用途 |
| --- | --- |
| `docs/development/EDITOR_SERVICE.md` | Editor Service 使用與驗證 |
| `docs/development/REFACTOR_TOP_COMPILER.md`、`REFACTOR_WIRE_PLANNING.md` | 早期 TS compiler／接線模組說明 |
| `docs/development/DEVELOPMENT.md` | 開發流程、TD 內嵌程式更新、保存 TOE |
| `docs/development/TESTING.md` | 測試說明（151KB，重構前，按需查） |
| `docs/development/TD_NATIVE_CONSOLE.md` | TD 原生 Console 擷取 |
| `docs/GLOSSARY.md` | 產品用語表 |
| `../GLOSSARY.md` | 重構討論用語表（與上一份不同） |
| `docs/architecture/`（7 份） | 值模型、型別契約、升級政策、Shader 發布保護等（重構前） |
| `docs/features/`（46 份）、`docs/ui/`（27 份） | **Legacy 功能與 UI 行為說明**——查舊行為的主要來源 |
| `../work/legacy-reference/ux-ui-design-handoff/` | **舊產品外觀與互動手冊**（Legacy Codex 製作，2026-10-07 人類提供；含 atlas 網頁圖鑑、design、research）。**用法**：只取「看起來／操作起來怎樣」當驗收參考，不照抄其實作方式；先用我們自己的方式定義概念，再拿它對照外觀；agent 所寫，重要處對照舊產品程式或實際畫面；不併入 repo 規格。內含腳本不執行。 |
| `docs/specs/shader-graph-handoff-v2.md` | 原始實作規格（2026-09-14） |
| `../work/in-place-refactor-design/` 其他檔 | 個別技術查證（WebRTC、Safari、VFS、TD history、物件模型研究等） |
| `../work/in-place-refactor-design/refactor-workflow-draft.md` | 操作索引與切入點理由（流程建議已被 REFACTOR-WORKFLOW 取代） |
| `../TD-Grape-in-place-refactor-feasibility-2026-10-04.md` | 原地重構可行性評估與初始測試基準 |
| `../work/refactor/*/` | 每輪私人驗證證據（REVIEW.md、RESULTS.md、json、截圖） |
| `src/remote_panel/README.md`、`src/editor/vendor/README.md`、`src/assets/brand/README.md`、`dist/README.md` | 各目錄說明 |

## 歷史

| 文件 | 原因 |
| --- | --- |
| `refactor-plan/`（10 份） | 2026-09-30～10-01 重構初稿，早於分支；無現役文件引用，責任定義由 target-architecture 承接（未逐條比對） |
| `docs/development/REFACTOR_UI_UPDATES.md` | A 案，保留比較 |
| `docs/development/RELEASE_0.8.163.md`、`RELEASE_0.8.271.md` | 舊版發布紀錄 |
| `docs/development/MIGRATION_VALIDATION.md`、`PROJECT_LAYOUT.md`、`UI_REFINEMENT.md`、`UV_INITIALIZATION_INCIDENT.md` | 2026-09 一次性紀錄 |
| `docs/discussions/` | 舊主線討論、待辦盤點、新專案草案 |

## 排除

- `docs/Goose_City_Revelation/`：與專案無關。
- [顏色系統](../ui/COLOR_SYSTEM.md)：新編輯器的顏色規範（主色、color-mix、主題、禁止事項）；寫任何介面前先讀。
