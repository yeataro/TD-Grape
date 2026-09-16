# 開發狀態

產品版本：**0.8.83**（開發版，未進入 Alpha）。本輪已完成節點顯示精簡、Vector 分量展開與維度新增入口、交付驗證及正式 TOE 保存。這仍不是公開發佈版本。後續版號允許持續向前小幅遞增，不固定停留在此版本，也不可倒退。

## 目前待辦與建議順序（2026-09-16）

使用者已確認並啟動以下三項 UI 整理，於 0.8.76 完成，預覽控制列再依回饋於 0.8.77 精簡。尺寸變更可能有延遲的觀察已記入 [預覽 UI 筆記](../discussions/PREVIEW_UI_NOTES.md)，先保留待測，不預判原因。

### 本輪已完成

0.8.83 將 Vector 完整輸入／輸出左右對齊，分量按需展開，已接線的分量始終可見；保留原本分組、覆寫與常數判定。一般節點只保留單一 float inline 編輯，多分量回到 Parameter。左側與浮動新增選單直接提供 Vector 2／3／4，舊固定值入口標示 Constant。展開狀態保存於圖面資料，不造成 Shader 變更。

0.8.82 新增整合 Vector（vec2／vec3／vec4）：完整向量基底、分量覆寫、連續分組及最終分量輸出；新線取代重疊的舊分量線，一次 Undo 恢復。節點可直接編輯固定值及未接線數值，Value Ladder 放開才提交；接線後隱藏手填值，斷線恢復。常數判定與產碼只追蹤有效來源。舊固定值與 Split／Combine／Swizzle 保持相容，新增選單分類／搜尋及 Color Output Help 一併更新。詳細規則見 [向量與數值操作](../features/VECTOR_NODES.md)。

0.8.80 完成一般向量操作：Vector 4 固定值、Split、Combine、Swizzle，向量輸出的 Split 快捷及依接線情境排序。Combine 固定分量位置，接入向量時明示占用範圍；保留未接線值與 Undo。可要求編譯期常數，UI／編譯器拒絕執行期來源，Subgraph 常數鏈也可追蹤。舊節點定義與 GLSL 指紋保持不變；詳細規則見 [向量操作](../features/VECTOR_NODES.md)。完整可攜、原生 TOP／MAT 與桌面瀏覽器驗證完成，Master 同步與正式 TOE 保存完成。

0.8.79 提示修正：純節點位移與其復原／重做顯示「圖待儲存／圖已儲存」，不再顯示 Shader 檢查／套用。後端回傳 `shaderUpdated`，實際更新才顯示「Shader 已套用」；圖修訂 r 移至提示說明。接線／參數與位移混合、請求期間繼續編輯的狀態依已確認圖判斷。維持既有提示位置、版本、編譯契約與儲存行為。

0.8.79 已將 TOP 貼圖統整為單一 `topInputs` 清單（`topSourceVersion: 1`）。圖內節點只引用來源，零輸入合法，模板提供一個香蕉來源。舊 Sampler 與合併式 Texture 節點經明確升級轉換為 TOP Input → Texture 2D；來源 ID、既有連線及公開 TOP 參數保留。TD 內部每來源一列，移除已登記舊資源鏈；Time／Frame 預置重複新增會共用來源。詳見 [本輪實作](../features/TOP_SOURCE_INVENTORY.md)。

1. **預覽介面精簡**：隱藏 Open Viewer，解析度移到影像內右下角，刪除下方常駐操作提示整列。0.8.77 將路徑與控制合併一列，右側使用 14px 無框重新連線及電源圖示；正常狀態看綠燈，異常訊息留在影像內。長路徑可點開完整內容，分頁配置不變。
2. **移除節點 Parameter／Settings 的刪除節點按鈕**：畫布工具列與既有刪除操作保留，Input 來源管理的刪除入口不受影響。
3. **左側節點說明卡可調整高度**：0.8.78 加入上緣分隔線，可拖曳調整並保存至瀏覽器偏好；上下方向鍵微調，雙擊恢復預設 240px。切換說明或收合後重新開啟仍保持選定高度，內容獨立捲動。短面板自動限制高度、保留節點清單空間；放大後恢復原高度。是否合併 Help、是否折疊詳細敘述，仍待使用者檢視。

後續能獨立於 Inputs 改版往下推進的是數值型別核心：int／uint、對應向量、明確轉型、literal／合法函式簽名與舊圖相容驗證。這是較大的工作，宜分輪完成，來源與 Parameter 的最終介面仍配合後續設計。參考 [型別計畫](../discussions/NUMERIC_TYPES_PLAN.md)。0.8.80 已完成 float 向量組合／拆分與常數性檢查；int／uint 等擴充尚未啟動。

### 下一輪方向

節點內數值操作於 0.8.82 交付，0.8.83 已依第一批回饋精簡，等待下一次實際操作意見。Inputs 清單及其與自訂參數的銜接仍另行整理；新數值型別與 Specialization Constants 保留後續里程碑，不先決定 Parameter 的最終位置。

### 等待使用者補充或共同決策

- TOP 來源 0.8.79 已先收斂：來源可全部刪除，首版為 0–16 個 2D 來源，每項對應 COMP 接口；3D／Array／Cube 尚未實作。Inputs、新增節點面板與節點資訊的整體 UI 仍等使用者後續筆記。見 [TOP 來源模型筆記](../discussions/TOP_INPUTS_SOURCE_MODEL.md)。
- TDFAM 是否造成 OP Create Dialog 底部說明文字消失：已發現其有介入共用說明資料鏈，但尚未確認回報問題的原因；使用者要求暫緩調查，後續再處理。
- OP 參數呈現與 Parameter 整體安排（2026-09-16 修訂）：不確定／待決議。OP 參數呈現保留為可行方向；Parameter 可能位於另一個位置，其位置、排版與切換規則尚未定案。「點回畫布顯示 OP 參數」仍是提案，不視為已確定要求，也不預先與 Parameter 改版綁在同一輪。見 [Parameter 筆記](../discussions/NEXT_UI_NOTES.md#parameter-改版筆記2026-09-15待討論實作)。
- 自訂參數工作區與 Inputs 拖入建立公開控制保留為後續設計方向；其工作區位置不因上述 Parameter 待決事項而被預先選定。
- Grape TOP Common／Output 一比一綁定及 UV 的人工模板；TOP 輸入链簡化與 TD 網路四象限配置，以使用者人工範本為依據。
- 使用者自製的 Universal／PBR Viewer 接入；控制面板後續設計、原生快捷鍵與 Viewer 更新時機的限制。
- 0.8.81 的預覽 Lock 暫解仍有存檔時把暫態寫入 TOE 的疑慮，尚未處理。使用者預計替換 OP Viewer；若仍需保留上一幀，優先評估 Cache TOP。此次僅記錄，見 [預覽暫存筆記](../discussions/PREVIEW_UI_NOTES.md)。
- Open Editor 在沒有 Shader 時的行為：現有自動建立 MAT 仍在；空白啟動與建立／選擇入口尚未定案。
- 灰點快捷延伸到外部 Subgraph 呼叫、Uniform／Attributes／Color Output／Vertex Output 等入口；各類型的命名、排序及合法操作邊界仍需設計。

### 較大後續與 Alpha 能力

- Attributes／Input Buffers 完整來源管理、MAT 跨 stage 介面、Instancing 的變形／法線／顏色／UV／自訂屬性存取。
- Render TOP Uniform 外部供值與同名衝突診斷，優先序較後但保留能力目標。
- 可編修的 PBR／其他 MAT／TOP 範例與對應節點；Pixel stage 節點中間結果的獨立預覽。
- 手機／iPad Remote Panel 實機驗收、macOS 驗證；發佈前整理可讀的升級相容性紀錄、打包與安裝流程。
- 多來源／Clone 預覽暫緩，初期維持共用單一來源。

已完成的 GLSL Code 多輸出、Subgraph **內部**灰點、全節點拖曳、Sampler／取樣函式配色、TOP 輸入槽位與 Constants、模板同步及共用預覽，不重列成未實作項目。舊討論文件中較早的「尚未」描述需以後續交付記錄為準。

## 交付紀錄

2026-09-16：0.8.82 完成上述 Vector 與 inline 數值操作。201 項 Python 核心測試、可攜檢查、34 項瀏覽器互動，以及 TD 新舊向量共 66 項原生檢查通過。兩份 Master 同步至目前 catalog／compiler，建立 TOP／MAT 不需升級預設圖；保留使用者 Shader、OP 身分、參數與位置。24 份內嵌來源及服務資產確認一致，正式 TOE 已保存。實體手機／iPad／Safari 仍待回驗；本輪沒有修改既有 OP Viewer 限制或 Lock 暫解。

2026-09-16：0.8.81／Remote Panel 0.1.5 修正正在即時預覽的 MAT 套用新 Shader 時，OP Viewer TOP 擷取可能使 TD 掛起。套用及失敗回復期間保留預覽影像，經過三個更新 callback 後恢復同一條 WebRTC 連線；只處理當前預覽來源。Combine 產碼、圖格式、節點定義與原本的同步編譯驗證保持不變。


2026-09-16：0.8.78 為左側新增節點說明卡加入高度拖曳、鍵盤調整、雙擊重設與瀏覽器偏好保存。保留固定高度的閱讀方式；視窗縮小時限制顯示尺寸，回復空間後恢復偏好高度。圖格式、編譯契約與 Remote Panel 0.1.4 維持；Color Output 舊版說明只列待辦。Master 版本同步及正式 TOE 保存已完成。

2026-09-16：0.8.77 將來源路徑與預覽控制合併單列，改用小型無框圖示，保留連線／接管、停止與偏好保存。完整路徑可點選查看；停止時取消尚未完成的連線請求。沿用 Remote Panel 0.1.4；圖格式與編譯契約未變更。已完成瀏覽器、可攜檢查及 TD 模板驗證，正式 TOE 已保存。

2026-09-16：0.8.76 完成上述三項 UI 整理，沿用 Remote Panel 0.1.4。未變更圖格式、節點定義或編譯契約；兩份 Master 的版本紀錄同步，既有使用者圖與 TD OP 位置保留。驗證細節見 [測試紀錄](TESTING.md)。

2026-09-16：0.8.75／Remote Panel 0.1.4 加入預覽尺寸連動：拖曳時縮放現有影片，放開並穩定 350 毫秒後，由目前連線更新 OP Viewer COMP／TOP 的解析度；保留同一個 WebRTC peer／video track。網頁與原生實測完成，介面控制項精簡另記於 [預覽 UI 筆記](../discussions/PREVIEW_UI_NOTES.md)。

2026-09-16：0.8.74 將 Graph UI 預覽替換為共用 Remote Panel 0.1.3，即時影像、OP 路徑、滑鼠／觸控及 H 暫代重設沿用同一個元件。新的有效連線才會切換來源並接管；舊頁面背景更新不搶回，面板重排保留連線。MAT 的編譯驗證 Geometry／Camera／Render 已移到主組件 `compiler_validation`；Master 的四個舊預覽節點移除，圖、OP 身分及其餘位置保留，兩份 Master 同步至 0.8.74。後續自製 Viewer 可沿用此入口，多來源 Clone 暫緩。

2026-09-16：Remote Panel 0.1.2 加入網頁端觸控轉譯：單指點按／拖曳，3D OP Viewer 支援雙指平移與捏合縮放，分別轉成右鍵拖曳與中鍵 dolly。手勢取消、失焦及來源／連線切換會釋放按鍵；一般 Panel 保留單指操作。15 項 Node 檢查、24 項原生元件檢查及 TD 控制事件回放通過，桌面 Chromium 拖曳回驗通過；手機與 iPad 實機觸控仍待使用者回驗。沿用既有 WebRTC／擷取架構。

2026-09-15：主組件內新增獨立的 [TD Remote Panel 0.1](../../src/remote_panel/README.md) 試驗元件。以原生 WebRTC 傳送 Panel／OP Viewer，滑鼠操作回傳至同一個 TD 面板；單一接收端、來源路徑、斷線釋放及無效來源恢復已驗證。另附可在 Grape 外載入的 TOX。這次未改動編譯器版本或現有 Output Preview；觸控、鍵盤、中間 Shader 預覽及多接收端尚未實作。

2026-09-16：修正 OP Viewer 模式的深度顯示問題：改成 TOP 直接擷取 Target OP，OP Viewer COMP 僅處理滑鼠，避免 MAT 透過 COMP 再擷取時的破面。停用不需要的 TOP 舊版 Panel Interaction；擷取與原生旋轉已回驗，詳見 [測試紀錄](TESTING.md#td-remote-panel-01)。

2026-09-16：Remote Panel 0.1.1 加入面板焦點外框與 H 暫代動作，呼叫指定 Target OP 的 `resetViewer()`；不是原生 H/Home。TD 2025.32820 實測 Panel COMP／OP Viewer COMP 均沒有 `interactKeyboard`；MAT 的重設會恢復顯示選項，但旋轉視角仍保留，因此原生快捷鍵與 Home 仍待後續。連線改成新端接管舊端；舊頁面顯示 Taken over，不自動搶回，按 Connect 可重新接管。20 項原生檢查與兩個瀏覽器分頁接管、焦點邊界實測通過。次要 OP Viewer 拖曳結束才更新的回報已記錄，後續可評估接入使用者自製的 Universal Viewer；本輪不變更 Viewer 架構。

2026-09-15：0.8.73 新增 [GLSL Code](../features/GLSL_CODE.md) 多輸出手寫節點，以及 [Subgraph 內部灰點 I/O、全節點拖曳 flag 與 Sampler／取樣函式辨識色](../features/SUBGRAPH_SHORTCUTS.md)。Windows TD 原生與瀏覽器驗證通過；節點重大顯示、Inputs 邏輯與新增節點面板大改仍等待使用者後續筆記。

2026-09-15：完成管理元件、TOP／MAT 模板與附屬小型網路共 83 個 TD OP 的位置整理。原生畫面檢視及功能狀態比對通過；此為一次性配置，供使用者後續人工 review，不加入產品自動重排。見 [TD 內部網路配置](DEVELOPMENT.md#td-內部網路配置)。

2026-09-15：原生管理元件與模板名稱統一為 `TD_Grape`、`grape_top`、`grape_mat`；更新建立入口並保留舊模板與 TDFam 識別碼相容。TOP 模板四個未使用的原生預設節點已清理；TOP／MAT 新增與編譯通過，現有模板的接線、資料與人工位置保持。見 [原生元件名稱](DEVELOPMENT.md#原生元件名稱)。

2026-09-15：管理元件參數整理為 `TD-Grape`／`Settings` 兩頁，以原生分隔線分組，產品標籤統一英文。個人函式庫預設路徑優先使用 `TD-Grape/Functions`；本機舊庫已改名並驗證內容及讀入結果相同。既有設定值、Shader 資料與節點位置保留。見 [管理元件參數分類](DEVELOPMENT.md#管理元件參數分類)。

2026-09-15：TOP／MAT Master 的預設圖、GLSL、編譯紀錄與 catalog snapshot 已由舊模板同步至 0.8.73／targetShellVersion 2；新建組件不需再升級圖。MAT 清理四個未使用的舊節點，原生與網頁 Viewer 均指向 material。修正模板更新略過升級確認，以及開啟 Master Editor 會清掉模板身分的問題。既有圖升級確認與新組件參數初始化維持；兩種模板渲染結果、既有 OP 身分、人工位置及參數值比對相同。正式開發 TOE 已保存，主組件位於專案根層。見 [Master 同步](DEVELOPMENT.md#master-同步與-mat-清理)。

2026-09-14：0.8.72 將 MAT 網頁預覽改為 OP Viewer TOP 擷取原生 material Viewer，COMP Viewer 也指向 material。保留 Render 場景作編譯驗證；Inputs 與 TOP 預覽流程維持。詳見 [MAT 原生預覽](../features/NATIVE_MAT_PREVIEW.md)。

2026-09-14：0.8.71 分開連線與編譯錯誤，加入 Cooking／最小化檢查提示及保留畫布的讀取重試。Inputs 操作設計維持上一版。詳見 [連線恢復與啟動驗證](../features/CONNECTION_RECOVERY.md)。

2026-09-13：0.8.7 已加入 TOP 原生輸入槽位、解析度／像素大小、具名 Constants、頂部新增表單、節點與來源共用拖放，以及遠端隱藏原生參數入口。TOP 舊引用與外部接線在排序後仍跟隨原槽位。Windows TD 原生及瀏覽器回歸通過，iPad／macOS 仍需本輪實機回驗。

此前已加入精簡 Inputs 清單、來源選取進入 Parameter、明確區分新增與引用、拖入引用／拉線新增，以及 Time／Frame 預設與原生 Expression 編輯。詳見 [Inputs 實作範圍](../features/INPUTS_WORKFLOW.md)。

目前來源包含 MAT／TOP 圖編輯、Subgraph、Sampler 引用與取樣分離、原生 Uniform 同步、多頁自訂控制、GLSL 註解、可選 LAN 編輯與本機 COMP Viewer 入口。原生 TD OP 路徑、圖身分與歷史 schema 維持相容。

本次目錄整理的驗收：正式 TOE 位於 `src/td`；程式、UI、節點定義與品牌素材集中於 `src`；測試與工具分開；工作憑證與本機紀錄在 repository 外；獨立複製後可以開啟與驗證。

仍需後續處理的產品工作包括：完整 Sampler／Attributes／Buffers 來源管理、跨 stage 介面與更多節點，以及 macOS 實機驗證。圖根層固定來源入口是後續設計提案，尚未因本次資料夾遷移而實作。

Label 與來源資訊的節點呈現仍保留決策。TOX 發佈、Web 資源安裝／載入方式、公開發佈時程也另行處理。歷史文件中的功能構想不直接等同目前已完成能力。

已完成內容及驗證見 [UI 本輪紀錄](UI_REFINEMENT.md)；剩餘設計方向見 [討論筆記](../discussions/NEXT_UI_NOTES.md)。

本次已完成的實測與固定開檔入口限制見 [遷移驗證](MIGRATION_VALIDATION.md)。

連線顯示已改用與節點共用的 HTML 畫布座標，避開舊版 WebKit 的 SVG 轉換差異；桌面及 WebKit 自動化測試通過；使用者於 2026-09-12 確認 iPad mini 6（iPadOS 18.7.8／Chrome 151）的接線顯示已正常。觸控節點拖曳、連線、雙擊新增、長按選單及手勢取消已實作並通過自動化驗證，使用者隨後回報觸控狀態良好；這不代表所有瀏覽器與手勢組合皆完成實機驗證。見 [連線定位與驗證](../ui/WIRE_GEOMETRY.md)。

觸控操作與衝突處理規則見 [觸控編輯](../ui/TOUCH_EDITING.md)。

畫布工具列已加入複製、貼上、建立子圖與刪除快捷按鈕；選取連線時可直接斷線。見 [快捷編輯](../features/CLIPBOARD_AND_EXPOSED.md#canvas-quick-actions)。

已另外加入右下角拖放垃圾桶試驗：放開才刪除節點／斷線，支援復原及取消；縮放比例移至導覽列右端。這是待使用者回驗的嘗試性互動，見 [垃圾桶試驗](../ui/GRAPH_TRASH.md)。


2026-09-16：0.8.83 實作與驗證完成。203 項 Python 單元測試、完整可攜檢查、43 項瀏覽器操作及原生 TOP／MAT 圖面保存檢查通過；24 份內嵌來源與服務資產已同步，Master 同步及建立驗證完成。使用者已確認先前實例移除屬手動操作；正式 TOE 已依目前場景保存，保留保存時的使用者 Shader，排除私人開發助手。原生建立測試的清理已收窄為只刪除自己建立的實例，避免誤清理同時移入根目錄的使用者物件。
