# 接續 B 案：最小交接

2026-10-06。這份交接補足最新人類結論；實作依既有 B 案推進，不另建計畫或治理流程。

## 先確認現在在哪裡

- 起開目錄：`C:\Users\user\Dropbox\Codex\TD-Grape-workspace`。先讀根目錄 `REFACTOR-WORKFLOW.md`；產品開發限定 `TD-Grape-refactor` worktree，分支 `refactor`。
- 接手先看 Git 現況。已交付基準是 **Refactor.15 / `7b52579`**；交接時 `src/td/TD-Grape-dev.toe` 有後續未提交修改，須保留。`docs/Goose_City_Revelation/`、`src/td/.tdmcp/` 是既有未追蹤內容，勿清除或順手納入提交。
- 再讀 [STATUS](STATUS.md)、[正式 React 入口說明](../../src/editor-react/README.md)、[B 案](REFACTOR_REACT_FLOW_PLAN_B.md)。其他文件按當輪問題讀；Legacy / main 只在必要時作唯讀參照。

## 最新結果與接手時的判斷

首個正式常數 TOP slice 已完成：Float、Color RGBA、Add、Color Output 的編輯、接線、Undo / Redo、前端 GLSL 產碼、真實 TD 套用與保存。112 項核心 / session 測試、8 組瀏覽器情境，以及真實 GPU 拒絕、TOX 重載已有證據。**人類剛確認首輪操作驗收沒問題**；STATUS 較早的「人類 UX 審閱尚未執行」已被此結論更新。Human Takeover Test、完整 TOE 程序冷啟動仍未驗證，不能宣稱通過。

新舊網頁同包內嵌在 `GrapeEditor` 的 VFS，由同一服務提供；既有開啟按鈕仍可能走舊入口。最後使用的測試 Family 是 `/project1/Grape_TOP_React`，主組件是 `/TD_Grape`，新入口：

`http://127.0.0.1:65465/react-editor.html?target=3ffb8d81896943c8bf90bec56791a33b`

先用新工具的 TD MCP 確認進程、TOE、目標、資產版本及服務，不能假定舊 port / 路徑仍有效。`IconGen → icon` 與其 handoff 保護內容禁止修改；其他 Shell、Family、Masters 可依新架構調整。

本次人類測試曾透過舊入口加入 Uniform，再刪掉節點；`uValue` 宣告仍在，故新入口拒絕開圖。移除來源後已可開啟。這是首輪覆蓋限制，不能靠刪使用者資料或繞過驗證當成修正。

**待補：版本衝突的恢復 UX 尚未完整遷移。** 兩個入口編輯同一 UUID 時，新入口已能停止寫入、保留草稿並檢查版本；但這只完成保護，尚未提供完整恢復選擇。舊入口已有「重新載入已套用」流程。人類要求衝突提示提供清楚的操作，至少涵蓋：

- **使用 TD 版本**：載入最新 TD 圖；先讓使用者明確處理本地未保存修改，不能靜默丟棄。
- **使用編輯器版本覆寫 TD**：使用者明確確認後，核對最新 revision，以正常產碼、資料及 GPU 驗證重新提交；若期間再有更新，仍應回報衝突，不能繞過版本保護。
- **暫不處理**：保留草稿與衝突狀態。

按鈕命名與安排由實作者依既有能力決定；下載草稿／重新開頁可作備援，不能代替上述恢復操作。首輪操作驗收接受不代表此能力可省略；接手者須將它作為已知 UX 缺口納入近期切片判斷。本次僅記錄交接，未實作恢復按鈕。

## 人類要守住的價值

- 最高目標是完成產品：能力、效能、使用者體驗優先。組織、命名、責任清楚與 UI 品質也要維持；單純搬檔、測試過關或外觀相似不能代替可用功能。
- 使用者只想使用 Shader 時，不應持續承擔隱藏的編輯成本。子 Family 對 Manager **只有編輯依賴**；Manager 缺席時原生參數、texture、Shader 更新與執行照常，安全略過編輯呼叫；Manager 回來可恢復編輯，沒有輪詢重試負擔。子 OP 不設 Global Shortcut，Manager 的位置不可假定固定。
- 前端核心、型別規則與產碼屬 Grape，不依賴 DOM / React Flow 或舊 Python compiler。React / RF 承接顯示與互動；節點透過共用顯示契約描述能力，避免 renderer 按節點名字寫特殊業務規則。
- 唯一權威是 GraphDocument；輸入草稿、drag、selection、viewport、RF 量測可以有暫態 mutable state。一筆 transaction 聚合發布一次 nodes / edges；未變項保留 reference identity，只有 Handle 結構 / 實際幾何改變才補 RF geometry invalidation。
- 新抽象須服務當輪真實 caller；沿用足夠的 GraphChanges。按執行成本與產品效果選工具；宿主端在效果相當時偏好 TD 慣用方式，也可用 Python。問題必須可定位、可追蹤，人類不靠 AI 也應能擴充系統。新寫或修改區塊配合精簡英／繁中註解與清楚換行。

## 接下來做什麼

接續已接受的 B 案，首選從既有 **動態 Math / Split 接孔與多輸出** 選一個小而真實的操作作下一輪；先讀實際 NodeModule 與正式 UI，確認具體缺口，再說明這輪行為、受影響責任、驗收及退回方式。若現場證據顯示更急的 blocker，具體說明並調整順序。核心、application、正式 React UI 與 TD 在同輪完成操作；不等待整套 Interface 完備，也不先考古全部能力，其餘可保留 UNKNOWN。

每輪交付：真實 UI 可操作且確實走 Grape 規則；變更、接線與 Undo 完整；資料不丟失；無關 DOM / reference、幾何及互動效能有適用驗證；圖、GLSL、綁定同快照，TD 證據與網路替身分清。保留未交付作品與最後成功產物，錯誤不靜默改用另一 compiler / writer。Refactor 版號前進時提交該輪來源、必要資產與測試，回報部署版本、commit、限制與人類可 review 的成果。

Human Takeover 另約人類不靠 AI 新增節點、改規則或修真實陌生 bug；記錄找入口、修改責任區、無關閱讀、TypeScript 指路及測試信心。未完成就如實記未驗證，不由 agent 代做計為通過，也不阻塞無依賴的安全工作。

保留 A 案及評估版原處。面板設計留待人類討論；Uniform live、通訊改造、Library、雲端 / 離線 Sketch 仍沿原有待辦，不因本次交接自動啟動。Uniform 單次編輯與原生歷史可按 B 案後續切片推進，不能把它和 live channel 混為一件事。

例行工程判斷自行完成；改變產品行為、資料權威或已定範圍時，提出具體情境給人類選擇。測試設置只證明當輪能力，不能靠縮掉需求宣稱完整交付。收尾更新既有 STATUS 並留下下一步，供任何工具或人類接續。
