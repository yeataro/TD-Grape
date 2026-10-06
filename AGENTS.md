# Agent 工作入口

TD-Grape 是 TouchDesigner 的 Shader 節點編輯器（瀏覽器前端 + TD 宿主）。目前在 `refactor` 分支重構：以固定 Legacy 的能力與體驗為基準，前端核心改為 TypeScript、宿主改為新 Manager／Family、UI 遷往 React／React Flow。

文件中的「人類」／human 指專案擁有者。文件幾乎都由 agent 撰寫；「人類確認…」是 agent 轉述，影響重大或看起來不對時，直接向人類確認。

## 範圍

上層 workspace（`../`）不是 git repo，不要在那裡 `git init`。它底下是同一個 repo 的 worktree：

| 目錄 | 分支 | 規則 |
| --- | --- | --- |
| `TD-Grape-refactor/`（本目錄） | `refactor` | **唯一可改動與提交之處** |
| `../TD-Grape/` | `main` | 只讀，查舊行為用 |
| `../TD-Grape-legacy/` | `legacy` | 只讀，固定驗收基準 `90a946b`（0.8.276） |

workspace 的其他位置可自由讀取。驗證輸出、私人證據、截圖與一次性腳本放 `../work/refactor/`（由 `tools/dev/paths.py` 的 `work_path()` 指定，開發工具讀 `.local/development.json`），不成為產品執行或建置依賴。`docs/Goose_City_Revelation/` 與專案無關，忽略。

## 開始工作前

1. 讀 [目前現況](docs/development/CURRENT.md)：做到哪、下一步、未完成與未驗證項目。
2. `git status`、`git log -5`。未提交的 `src/td/TD-Grape-dev.toe` 可能是人類的工作，保留；`src/td/.tdmcp/` 是本機認證狀態，不提交。TD 顯示開啟 `TD-Grape-dev.<N>.toe`（如 `.23`）是遞增存檔的正常狀態，存檔仍回 `TD-Grape-dev.toe`，不要當成開錯檔。
3. 依任務查 [文件地圖](docs/development/DOC-MAP.md)，只讀需要的部分。歷史文件只在查舊行為時翻。

## 權威文件

前三份在 workspace，**不在 git 內**：

- 產品責任：`../work/in-place-refactor-design/target-architecture.md`（按功能查章節）
- 人類決策紀錄：`../work/in-place-refactor-design/design-interview.md`（按題號查）
- 工作流程：`../REFACTOR-WORKFLOW.md`（第 1–158 行為規則，其後為歷史）
- 執行路線：[B 案](docs/development/REFACTOR_REACT_FLOW_PLAN_B.md)
- 交付紀錄：[STATUS](docs/development/STATUS.md)（很長，只讀頂段）
- 用語：[GLOSSARY](docs/GLOSSARY.md)；新概念先查既有定義

## 建置與測試

Node 20.19+ 或 22.12+：

```text
npm ci
npm run check:core && npm run test:core
npm run check:editor && npm run test:editor
npm run build:editor -- --out ../work/refactor/editor-service/web
```

`build:core` 由 `src/core-ts/` 產生 `src/editor/` 的 `wire_planning.js`、`editor-bootstrap.json`、`editor-library.json`，不要手改。瀏覽器測試與 TD 部署見 [React 入口](src/editor-react/README.md)；TD 內嵌程式與保存 TOE 見 [DEVELOPMENT](docs/development/DEVELOPMENT.md)；驗證方法見 [TESTING](docs/development/TESTING.md)。

## 每輪工作

1. **開工**：在對話中向人類說明本輪行為、受影響責任、驗收與退回方式。
2. **實作**：一條完整可驗證的操作為單位；例行技術選擇自行完成。
3. **收尾**：跑受影響測試；在 STATUS 頂端加一段（交付、commit、證據、限制），覆寫 CURRENT 的現況與下一步；每次 Refactor.N 前進就建立對應本地 commit，回報版號與 hash。

改變產品行為、資料權威或已定範圍時，帶具體情境請人類選擇，一次一題。討論有結論時寫回 design-interview／target-architecture，不只留在對話。

**理解衝突時與人類同步**（小流程，不無限上綱）：
- **只在三種情況問**：文件／程式／TD 現場說法互相矛盾且影響手上工作；同一個詞在不同地方意思不同；人類現在的說法和已記錄的決定不一致。
- **不問**：能從程式、TD 現場、舊產品查到的事實（自己查）；例行技術選擇（自己決定）；不影響手上工作的矛盾（記到 CURRENT「已發現、尚未處理」，不打斷人類）。
- **怎麼問**：一次一題；先說查到什麼、自己怎麼理解，再給建議答案。
- **問完**：寫回文件——定義寫 AGENTS.md 或 GLOSSARY，決定寫 design-interview。同一件事不問第二次。

## 必守規則

- **TD 現場**：操作前用 TD MCP 確認進程、TOE、目標、資產版本與服務，不假定舊 port／路徑有效。`/TD_Grape/IconGen → /TD_Grape/icon` 及其依賴禁止修改。更新運行中的 TD 時保留使用者的圖、參數關聯、Shader ID 與連線；更新來源、保存 TOE、升級 Shader 是不同操作。
- **網頁資產（`/TD_Grape/GrapeEditor`）**：開發期間 `Use External Folder` 開啟，`build:editor` 輸出到 Rootfolder 後按 **Reload Assets**（TD 在 Reload 當下讀入整包快照，不即時監看資料夾）。交付或提交 TOE 前：按 **Update Embedded VFS** → 關閉 `Use External Folder` → 存 TOE；否則 TOE 帶的是舊副本，且開關狀態會一起存檔。
- **Grape OP 對 Manager 只有編輯依賴**：Manager 缺席時原生參數、Bind、texture、Shader 執行照常；不輪詢、不重試；子 OP 不設 Global Shortcut。（用語：使用者建立的 Grape TOP／Grape MAT 總稱 **Grape OP**，人類也稱「子 OP」；程式裡的「Family」是舊稱，「Family」一詞只保留給 TDFam 的 OP Family。）
- **權威（依範圍，2026-10-07 定案，見 design-interview Q28）**：
  - **編輯器內部：GraphDocument 是唯一權威。** React Flow、畫面、面板只是投影；拖曳中、輸入中的暫態可以存在，提交時一律寫回 GraphDocument。
  - **編輯器與 TD 之間：** TD 的 Grape OP 保存已送達的圖與 Shader，重開時讀這一份。送出以版本號核對；對不上即衝突，由使用者選「編輯端／TD 端」，不自動合併。
  - **編輯不等 TD：** 同步在背景進行；TD 慢、最小化或不在，都不能讓編輯變慢或被鎖住，只有開圖時需先讀一次。衝突提示必須浮動、不擋編輯。
  - 比喻：Google 文件——分頁裡正在打的文件＝GraphDocument，已儲存到雲端＝TD，離線照樣能打字、連上後自動同步。
- **核心不依賴 DOM、React Flow、舊 Python compiler**；新路徑出錯不得靜默改用舊 compiler 或另一個 writer。
- **框架耦合（design-interview Q29）**：要的是需求，不是框架的某個功能——React Flow 合用就用、不合用就自己做，它不在了我們仍能自己做；作品、規則、節點永遠在 Grape。判斷問「這是誰需要的？」只有畫面需要的留畫面。RF 掛勾只問核心不自己判斷；不用 `useNodesState`、`addEdge`、`toObject` 存檔。mapping 保持單向、薄，需要大量特例就先檢查設計。**舊產品是功能基準，不是模仿對象**：參照它「需要什麼」，不照抄「怎麼做」；所需概念核心未定義時，屬核心的先在核心定義，不在畫面將就。
- **新抽象必須有當輪真實 caller**；不建 event bus、diff 系統或治理平台。
- **產品程式只在 `src/`**；來源與 TD DAT 的對應由 `src/td/source_files.json`、`src/td/embedded_sources.json` 定義。
- **註解**：新寫或改到的程式碼用精簡「英文摘要＋繁中說明」，範例 `src/core-ts/values.ts`；不全面追補舊程式。
- **證據**：自動測試或網路替身不能當真實 TD 證據；未驗證就寫未驗證；區分已證實與推測。
- **根目錄 Markdown** 只放 README、AGENTS.md、CLAUDE.md。產品版本只能向前。
- 公開資料清理須涵蓋檔案、TOE 的 DAT／參數／storage 及 Git 歷史；`.gitignore` 不會移除已提交內容。
