# 文件索引

目前狀態以 [STATUS.md](development/STATUS.md) 為準。既有文件保留歷史設計與驗證背景，提案出現在文件中不代表已經實作。

- [專案用語表](GLOSSARY.md)：跨功能的中英術語與概念界線；不代替行為規格。
- [值、節點與來源模型](architecture/VALUE_MODEL.md)：已確認的固定／通用入口、穩定名稱、來源引用及能力邊界。
- [矩陣與雙精度值](features/MATRIX_NODES.md)：矩陣型別、Column 介面、新節點及 TD 原生傳輸實測；既有運算擴充分批交付。
- [陣列與結構](features/ARRAYS_AND_STRUCTURES.md)：建立、Array[i]、Replace、Length、Field、共用型別及保存規則。
- [TD 陣列來源](features/TD_ARRAY_SOURCES.md)：CHOP Uniform Arrays、TD 內建結構、TOP／MAT 可用範圍及宿主限制。
- [TD 來源分類與命名總表](discussions/TD_SOURCE_NAMING_RESEARCH.md)：GLSL TOP／MAT 的 TD 名、Python 來源、共通別名候選、結構欄位與現況；附可篩選 CSV，研究完成、命名待審。
- [陣列與結構後續計畫](discussions/ARRAY_AND_STRUCT_PLAN.md)：原始決策及執行期間補充定案；最新交付狀態以開發狀態為準。
- [自含式圖封存提案](discussions/GRAPH_ARCHIVE_PROPOSAL.md)：另行評估隨圖打包節點實作與相依定義，尚未實作。
- [接線轉換與背景工作提案](discussions/CONVERSION_AND_RUNTIME_NEXT.md)：現況、推薦方向與尚未定案的規則。
- [UI 元件共用調查](discussions/UI_COMPONENT_REUSE_AUDIT.md)：0.8.104 數值編輯、樣式、來源綁定與選單的共用缺口；只有調查，修改待審。
- [Uniform 即時數值](features/UNIFORM_LIVE_VALUES.md)：0.8.118 首批 scalar／vector 即時編輯、訂閱、Undo、斷線恢復與成本界線。
- [Uniform 連續編輯與按需同步評估](discussions/UNIFORM_LIVE_EDITING.md)：保留原始調查、候選架構與未採用方向。
- [圖同步、暫存與 Shader 套用方案](discussions/GRAPH_SYNC_SAVE_PLAN.md)：外觀／運算／Uniform 責任、同步與磁碟保存分離、主執行緒成本、portable 架構取捨及分批驗收；供審查，未實作。
- [開發與更新內嵌程式](development/DEVELOPMENT.md)
- [開發技巧：外部擷取 TD 原生 Console](development/TD_NATIVE_CONSOLE.md)：不用畫面讀取診斷文字、GLSL 編譯線索與掛起前階段記錄。
- [測試方式](development/TESTING.md)
- [獨立 TD Remote Panel 試驗元件](../src/remote_panel/README.md)
- [目錄與私人工作區](development/PROJECT_LAYOUT.md)
- `architecture/`：編譯、型別、保存與升級契約。
- `features/`：目前功能與相容行為；[向量拆分、組合與常數](features/VECTOR_NODES.md)。
- `ui/`：UI 操作及設計。
- `discussions/`：未完成或仍待取捨的設計討論。
- [Inputs 面板與工作區設計](discussions/INPUTS_UI_NEXT_ROUND.md)：已確認的 UI 整理方向、型別擴充目標與待決範圍。
- [節點工作流程 0.8.84](discussions/NODE_WORKFLOW_ROUND.md)：Vector／Replace、名稱、快捷型別、Spec Constants 與導航整合。
- `specs/`：原始規格與歷史背景。

機器設定、逐輪對話整理、個人路徑、原始測試輸出及一次性遷移紀錄不在公開專案內。
