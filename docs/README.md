# 文件索引

目前狀態以 [STATUS.md](development/STATUS.md) 為準。既有文件保留歷史設計與驗證背景，提案出現在文件中不代表已經實作。

- [專案用語表](GLOSSARY.md)：跨功能的中英術語與概念界線；不代替行為規格。
- [值、節點與來源模型](architecture/VALUE_MODEL.md)：已確認的固定／通用入口、穩定名稱、來源引用及能力邊界。
- [矩陣與雙精度值](features/MATRIX_NODES.md)：矩陣型別、Column 介面、新節點及 TD 原生傳輸實測；既有運算擴充分批交付。
- [陣列與結構後續計畫](discussions/ARRAY_AND_STRUCT_PLAN.md)：已確認操作、型別／來源／UI／產碼責任、TOP／MAT 里程碑及待 review 行為；尚未實作。
- [自含式圖封存提案](discussions/GRAPH_ARCHIVE_PROPOSAL.md)：另行評估隨圖打包節點實作與相依定義，尚未實作。
- [接線轉換與背景工作提案](discussions/CONVERSION_AND_RUNTIME_NEXT.md)：現況、推薦方向與尚未定案的規則。
- [Uniform 連續編輯與按需同步評估](discussions/UNIFORM_LIVE_EDITING.md)：閃動重現、來源控制權、Binding／WebSocket 候選及主執行緒成本；尚未實作。
- [開發與更新內嵌程式](development/DEVELOPMENT.md)
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
