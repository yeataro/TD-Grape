# 文件索引

目前狀態以 [STATUS.md](development/STATUS.md) 為準。既有文件保留歷史設計與驗證背景，提案出現在文件中不代表已經實作。

- [Sources 面板整理](ui/SOURCES_PANEL.md)：2026-09-23 確認的名稱、搜尋、排序、數值控制與最小化顯示，分批實作進度。
- [Wire／Link 接線樣式](ui/WIRE_LINK.md)：直線虛線、接孔箭頭導覽、右鍵對端清單與顯示切換。

- [基本 Phong／PBR 預置圖](features/BASIC_MATERIAL_PRESETS.md)：TDFam 新增入口、Group、Color 來源、範本與副本的編輯位置、驗證及未完成範圍。

- [待辦總整理（2026-09-21）](discussions/TODO_AUDIT_2026-09-21.md)：目前待辦、候選、已完成與已被取代的舊筆記；開始後續工作前先核對此表。
- [Alpha 能力範圍](discussions/ALPHA_SCOPE_2026-09-21.md)：最新需求收集中；GLSL／TD 節點、MAT／來源、命名及自訂參數，待使用者補充完再排修改順序。
- [TD 函式節點缺口](discussions/TD_FUNCTION_NODE_GAPS.md)：0.8.163 與 TOP／MAT 公開函式逐項對照，附 CSV；已有入口、自動產碼、缺口及宿主邊界分開記錄。
- [原生 Phong／PBR 函數清單](features/MAT_NATIVE_FUNCTIONS.md)：依原生功能分支匯出的 GLSL，列出 GLSL 內建函數、TD 原生函數、資料來源、對應節點與未完成項目。
- [原生材質功能研究](discussions/MAT_FUNCTIONAL_RESEARCH.md)：從外觀需求向下整理資料、運算、階段與宿主依賴；附原生匯出證據，供重構或新專案參考。
- [TD 2025.32820 原生函數版本查核](discussions/TD_NATIVE_VERSION_REVIEW_2026-09-23.md)：區分宿主版本差異、指南未涵蓋與專案缺少入口；記錄本次官方發布資料查核界線。

- [專案用語表](GLOSSARY.md)：跨功能的中英術語與概念界線；不代替行為規格。
- [值、節點與來源模型](architecture/VALUE_MODEL.md)：已確認的固定／通用入口、穩定名稱、來源引用及能力邊界。
- [矩陣與雙精度值](features/MATRIX_NODES.md)：矩陣型別、Column 介面、新節點及 TD 原生傳輸實測；既有運算擴充分批交付。
- [陣列與結構](features/ARRAYS_AND_STRUCTURES.md)：建立、Array[i]、Replace、Length、Field、共用型別及保存規則。
- [TD 陣列來源](features/TD_ARRAY_SOURCES.md)：CHOP Uniform Arrays、TD 內建結構、TOP／MAT 可用範圍及宿主限制。
- [TD 來源分類與命名總表](discussions/TD_SOURCE_NAMING_RESEARCH.md)：原始研究與可篩選 CSV；分類／共通名稱已經後續 review 交付，CSV 仍區分非來源與未納入的擴充。
- [來源選單分類表](discussions/TD_SOURCE_MENU_REVIEW.md)：分組、時間預置、Texture 維度與來源集合；0.8.131 已落地分類，之後的 UI 修訂見交付紀錄。
- [來源建構、型別與 MAT Attribute](discussions/SOURCE_ARCHITECTURE_REVIEW.md)：原始責任邊界；來源五輪已於 0.8.132 完成，剩餘宿主限制與候選見[來源計畫](discussions/SOURCE_COMPLETION_PLAN.md)。
- [Loop 與控制流程筆記](discussions/LOOPS_DISCUSSION.md)：Loop 子圖、bool 停止接口、Break／Discard／Return 邊界及自訂碼診斷；後續設計，不插入目前來源主線。
- [陣列與結構後續計畫](discussions/ARRAY_AND_STRUCT_PLAN.md)：原始決策及執行期間補充定案；最新交付狀態以開發狀態為準。
- [自含式圖封存提案](discussions/GRAPH_ARCHIVE_PROPOSAL.md)：另行評估隨圖打包節點實作與相依定義，尚未實作。
- [接線轉換與背景工作提案](discussions/CONVERSION_AND_RUNTIME_NEXT.md)：現況、推薦方向與尚未定案的規則。
- [UI 元件共用調查](discussions/UI_COMPONENT_REUSE_AUDIT.md)：0.8.104 數值編輯、樣式、來源綁定與選單的共用缺口；只有調查，修改待審。
- [Uniform 即時數值](features/UNIFORM_LIVE_VALUES.md)：0.8.118 首批 scalar／vector 即時編輯、訂閱、Undo、斷線恢復與成本界線。
- [Uniform 連續編輯與按需同步評估](discussions/UNIFORM_LIVE_EDITING.md)：保留原始調查、候選架構與未採用方向。
- [圖同步、暫存與 Shader 套用方案](discussions/GRAPH_SYNC_SAVE_PLAN.md)：保留各批實作與原始取捨；0.8.115–119 已完成部分責任切分及即時值工作，磁碟快取／增量同步仍未定案。Uniform 逐來源編輯保護另於 0.8.155 完成第一階段。
- [開發與更新內嵌程式](development/DEVELOPMENT.md)
- [開發技巧：外部擷取 TD 原生 Console](development/TD_NATIVE_CONSOLE.md)：不用畫面讀取診斷文字、GLSL 編譯線索與掛起前階段記錄。
- [測試方式](development/TESTING.md)
- [獨立 TD Remote Panel 試驗元件](../src/remote_panel/README.md)
- [目錄與私人工作區](development/PROJECT_LAYOUT.md)
- `architecture/`：編譯、型別、保存與升級契約。
- `features/`：目前功能與相容行為；[向量拆分、組合與常數](features/VECTOR_NODES.md)。
- `ui/`：UI 操作及設計。
- `discussions/`：設計歷史、已交付的決策與仍待取捨的討論，不能只憑文件存在就判定未完成。
- [Inputs 面板與工作區設計](discussions/INPUTS_UI_NEXT_ROUND.md)：已確認的 UI 整理方向、型別擴充目標與待決範圍。
- [節點工作流程 0.8.84](discussions/NODE_WORKFLOW_ROUND.md)：Vector／Replace、名稱、快捷型別、Spec Constants 與導航整合。
- `specs/`：原始規格與歷史背景。

機器設定、逐輪對話整理、個人路徑、原始測試輸出及一次性遷移紀錄不在公開專案內。
