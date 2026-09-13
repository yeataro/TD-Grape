# 開發狀態

產品版本：**0.8.6**（開發版，未進入 Alpha）。獨立目錄遷移後，已完成 UI 精簡、Layout 分頁排序、Label 行尾註解與 TOP／MAT 原生頁面整理，並保存正式開發 TOE。這仍不是公開發佈版本。後續版號允許持續向前小幅遞增，不固定停留在此版本，也不可倒退。

2026-09-13 已加入精簡 Inputs 清單、來源選取進入 Parameter、明確區分新增與引用、拖入引用／拉線新增，以及 Time／Frame 預設與原生 Expression 編輯。詳見 [Inputs 實作範圍](../features/INPUTS_WORKFLOW.md)。

目前來源包含 MAT／TOP 圖編輯、Subgraph、Sampler 引用與取樣分離、原生 Uniform 同步、多頁自訂控制、GLSL 註解、可選 LAN 編輯與本機 COMP Viewer 入口。原生 TD OP 路徑、圖身分與歷史 schema 維持相容。

本次目錄整理的驗收：正式 TOE 位於 `src/td`；程式、UI、節點定義與品牌素材集中於 `src`；測試與工具分開；工作憑證與本機紀錄在 repository 外；獨立複製後可以開啟與驗證。

仍需後續處理的產品工作包括：完整 Sampler／Attributes／Buffers 來源管理、MAT 原生 Viewer 影像來源、跨 stage 介面與更多節點，以及 macOS 實機驗證。圖根層固定來源入口是後續設計提案，尚未因本次資料夾遷移而實作。

Label 與來源資訊的節點呈現仍保留決策。TOX 發佈、Web 資源安裝／載入方式、公開發佈時程也另行處理。歷史文件中的功能構想不直接等同目前已完成能力。

已完成內容及驗證見 [UI 本輪紀錄](UI_REFINEMENT.md)；剩餘設計方向見 [討論筆記](../discussions/NEXT_UI_NOTES.md)。

本次已完成的實測與固定開檔入口限制見 [遷移驗證](MIGRATION_VALIDATION.md)。

連線顯示已改用與節點共用的 HTML 畫布座標，避開舊版 WebKit 的 SVG 轉換差異；桌面及 WebKit 自動化測試通過；使用者於 2026-09-12 確認 iPad mini 6（iPadOS 18.7.8／Chrome 151）的接線顯示已正常。觸控節點拖曳、連線、雙擊新增、長按選單及手勢取消已實作並通過自動化驗證，使用者隨後回報觸控狀態良好；這不代表所有瀏覽器與手勢組合皆完成實機驗證。見 [連線定位與驗證](../ui/WIRE_GEOMETRY.md)。

觸控操作與衝突處理規則見 [觸控編輯](../ui/TOUCH_EDITING.md)。

畫布工具列已加入複製、貼上、建立子圖與刪除快捷按鈕；選取連線時可直接斷線。見 [快捷編輯](../features/CLIPBOARD_AND_EXPOSED.md#canvas-quick-actions)。

已另外加入右下角拖放垃圾桶試驗：放開才刪除節點／斷線，支援復原及取消；縮放比例移至導覽列右端。這是待使用者回驗的嘗試性互動，見 [垃圾桶試驗](../ui/GRAPH_TRASH.md)。
