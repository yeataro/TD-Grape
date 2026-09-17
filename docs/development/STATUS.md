# 開發狀態

2026-09-17 節點工作流程（0.8.84）：Vector 2／3／4 改為手填值、無輸入、單一完整輸出；Replace 負責完整基底與分量覆寫，Combine／Split 保持各自用途。Vector／Color RGBA 的數值可緊湊同列或展開具名分量；標題提供與 Parameter 共用的主要型別快捷。來源節點以宣告名稱為主標題，普通節點支援自訂名稱切換與畫布內改名，合法唯一名稱用於可讀 GLSL。Inputs 區分 New 與新增引用，加入 Graph Constants／Spec Constants 與 TD Built In 入口。導航併入工具列，縮放／置中移至畫布角落；浮動工具列為預設關閉的程式 flag，頂欄開關移到 Layout 左方。完整決議與延後事項見 [本輪清單](../discussions/NODE_WORKFLOW_ROUND.md)。

Spec Constants 支援 int／uint／bool／float、穩定 constant ID 與共同 Undo／Redo，透過 TD 原生 Constants 頁供值。TD 2025.32820 GPU 實測有原生整數傳輸限制：負 int 不可正確覆寫；MAT 的整數須能以 float32 精確表示。編輯與回放預檢會拒絕不安全數值；直接從 TD 改入異常值會顯示來源提示。一般 int／uint 運算與整數向量仍未全面開放，詳見 [型別契約](../architecture/TYPE_CONTRACT.md)。

2026-09-17 共同操作歷史（0.8.83）：畫布與 Inputs 共用依操作順序的 Undo／Redo，來源刪除不再清空圖的歷史；自動 Apply 合併請求但不合併使用者步驟。撤回來源操作依固定 ID 修改原生實體，再同步 UI，已移除前端另一份會補回來源的清單。支援來源新增／刪除／改名／驅動、目前值、owned Bind 主控與既有 exposed Sampler 來源值。每步固定真正修改的欄位，外部未觸及分量與其他來源保留；有衝突則停止且不移動歷史游標。復原資料僅存在工作階段記憶體，不寫入 TOE，也不呼叫 TD 全域 Undo。權責及保守限制見 [Inputs 流程](../features/INPUTS_WORKFLOW.md) 與 [Undo／Redo](../features/NATIVE_UNDO.md)。

2026-09-17 Inputs 刪除修復（0.8.83）：Uniform 在所有 stage／Subgraph 均無引用時，刪除會清除原生來源、宣告與清單記錄；既有零引用缺失項目也可直接刪除。Constants／Samplers 的零引用缺失記錄同樣有刪除入口。來源變更待套用、但本地沒有額外草稿時仍可修復，避免另一個缺失來源造成 Apply 失敗後鎖住操作；輪詢與 Graph Undo 不會復活已刪除來源。有引用的來源仍可移除原生列並保留節點／接線，缺失標示與重新綁定改善另依後續回饋處理。已通過來源單元、瀏覽器與 TD TOP／MAT 驗證，並同步保存。

產品版本：**0.8.84**（開發版，未進入 Alpha）。最新規則以上方節點工作流程與本輪清單為準，下方較早記錄保留歷史背景。使用者允許此次移除舊統合式 Vector 開發測試節點；這是 Alpha 前一次性例外，不是一般資產遷移政策。這仍不是公開發佈版本，版號只向前。

## 目前待辦與建議順序（2026-09-17）

使用者已確認並啟動以下三項 UI 整理，於 0.8.76 完成，預覽控制列再依回饋於 0.8.77 精簡。尺寸變更可能有延遲的觀察已記入 [預覽 UI 筆記](../discussions/PREVIEW_UI_NOTES.md)，先保留待測，不預判原因。

### 本輪已完成

2026-09-17 外觀快捷：footer 正中央提供介面大小「標準／舒適」與外觀「深色／淺色」兩個圖示開關，預設維持標準深色。舒適版放大頂欄、位置列、工具列與狀態列，既有面板內容、節點大小及圖縮放保持；淺色模式已延伸至灰色畫布、淺灰節點與淡色分類標題，型別接孔／接線採同色相的較深色，RGBA 提示、數字欄位與互動狀態同步調整；深色模式保持原樣，預覽影像不改色。偏好僅存目前瀏覽器本機，不寫入 Shader 或 TOE。交付通過切換／記憶／草稿隔離與窄版驗證；已同步 24 份內嵌來源並保存正式 TOE，保留使用者兩份 Shader。詳見 [工作區配置](../ui/WORKSPACE_LAYOUT.md)。

2026-09-17 UI 批：Inputs 改為分類標題 `＋` 開啟建立對話框，保留搜尋與收合記憶，桌面整列可拖入畫布建立既有來源的引用；來源列採緊湊淡色底，新增節點維持獨立的中性背景與圖示；Inputs 分類標題對齊同層標題，Personal 說明移入 Help。Panel 標題只選取／展開，收合統一使用右箭頭。頂欄可收合，開關置中於整條位置列；畫布工具按四組換行並統一高度；持久圖狀態移到底部，小型整頁 Refresh 位於 footer 最左端，保護未提交欄位、寫入中的請求與未保存圖。Inputs 頂部移除常駐來源提示，改在選取或操作受限原生 Uniform 時於 footer 說明，輪詢不覆蓋其他操作狀態。型別、來源身分與編譯語意維持既有規則。

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

0.8.84 已實作 Specialization Constants、Vector／Replace 職責分開與上述節點工作流程。後續補一般數值型別、TOP 的其他貼圖維度，以及 Parameter／Inputs 來源值介面。Array／Matrix 希望至少型別與合理初始化可用，初版範圍仍需評估，完整值編輯介面後補。節點收合、多選工具、Comment、中途預覽與 Canvas Backdrop 分輪處理。詳細已決議／延後範圍見 [本輪清單](../discussions/NODE_WORKFLOW_ROUND.md)；较早筆記保留於 [Inputs 面板與工作區設計](../discussions/INPUTS_UI_NEXT_ROUND.md)。空白畫布設定頁與資源庫獨立 panel 仍未定案。

### 等待使用者補充或共同決策

- TOP 來源 0.8.79 已先收斂：來源可全部刪除，首版為 0–16 個 2D 來源，每項對應 COMP 接口；3D／Array／Cube 尚未實作。Inputs 與新增節點面板的最新整理已列入上述下一輪清單；其他來源維度與節點資訊布局仍待討論。見 [TOP 來源模型筆記](../discussions/TOP_INPUTS_SOURCE_MODEL.md)。
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

2026-09-17：0.8.84 已完成本輪節點／Inputs／工具列工作流程，含可編輯的型別失效草稿與保留接線、目前版本錯誤不誤判為升級，以及 Spec Constants 改型別失敗後的 Undo／Redo。完整可攜檢查及最後修改的定向回歸通過；隔離瀏覽器基本功能 15 組、型別草稿 15 組、工作區控制 10 組通過，TD 向量 53 項、Spec Constants 18 組、既有來源歷史 21 組與 Master 模板檢查通過。25 份內嵌來源及服務資產核對一致，兩份 Master 版本／預設圖均為目前狀態，正式 TOE 已保存為 685,276 bytes，排除私人開發橋接。僅按本次例外移除開發 TOP 中一顆舊統合 Vector 及其接線，已先私人備份；其餘使用者節點與 MAT 保留。實體 iPad／Safari、TD 跨程序拖放調查仍待後續，不在此次自動啟動。

2026-09-17：Inputs／工作區 UI 批保留版本 0.8.83。203 項 Python 測試與完整可攜檢查通過，另通過 Inputs／原生來源、workspace、整頁重載保護及 320–1280px 版面驗證。TD 24 份內嵌來源與服務資產核對一致，最終更新與保存確認使用者 `/project1/Grape_TOP1`、`/project1/Grape_MAT1` 均保持不變，正式 TOE 已保存為 632,948 bytes，排除私人開發橋接。實體 iPad／Safari 尚未回驗。TD OP／Parameter 跨進程拖入網頁的獨立調查已記錄，交付時提醒，未自動啟動。

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

2026-09-16 配色微調（維持 0.8.83）：Float 共用型別色由黃色改成偏暖淺灰 `#b8b5ae`，連動接孔、一般連線與型別文字；新增快捷接點保留較深的灰色。只調整 CSS 色票，沒有改編譯器、節點資料或接線行為。

2026-09-16 Vector 顯示微調（維持 0.8.83）：分量收合列右側顯示有效手填值摘要；接線覆寫的分量略過，部分值帶分量標籤，基底已接線時隱藏休眠值。摘要只讀圖中現有資料，不引入上游常數求值、額外保存欄位或編譯規則。

2026-09-16 Color RGBA 顯示微調（維持 0.8.83）：色條上方改成同一行 R／G／B／A 四個緊湊數字框；點擊色條沿用 Parameter 的 RGB 調色盤。共用既有值與 Undo，數字允許 HDR／負值，調色盤保留 Alpha；不增加節點寬度，不改編譯器或圖資料格式。

RGBA 分量試色：四框加入低飽和紅、綠、藍與中性灰底色／邊框，數字維持中性亮色；明確的 R／G／B／A 單分量接孔與標籤亦染色，連線依起點接孔的顯示色。涵蓋 Split RGBA、Compose RGBA 的 Alpha，以及已選 RGBA 顯示的 Vector 系列單分量；整組 RGB／向量與 XYZ／UV 維持型別色。提示不穿過運算節點自動傳導，也不依自訂名稱猜測；不新增型別或更動接線／編譯規則。限定瀏覽器檢查確認來源配色、運算後不傳導、選取／hover 優先與圖／Undo 資料不變，零頁面錯誤；100% 外觀確認，24 份內嵌來源／服務資產一致，正式 TOE 已保存。

RGBA 染色現由程式內 `EDITOR_DEV_SETTINGS.rgbaComponentTint` 統一開關，預設 `true`；關閉時數字文字、分量接孔／標籤及線條恢復原本配色。依後續確認，所有節點數字框統一使用 `--node-value-bg` 中性底色、移除常態框線；RGBA 改染數字文字，保留聚焦與錯誤輪廓。數字改為靠左，單值框往節點內側填滿可用空間；保留原本外側留白與接孔名稱／型別空間，不增加節點寬度。實際色條預覽仍保留。暫不新增選單或保存到圖資料，後續選單位置尚未定案。開／關兩設定瀏覽器對照通過；加寬後另完成 100% 視覺與幾何檢查，Color 四欄維持同行，沒有重疊或裁切，圖／Undo 資料不變、零頁面錯誤；24 份來源／服務資產一致，正式 TOE 已保存。

2026-09-16 Vector 常數名稱修正（維持 0.8.83）：固定 vec2／vec3／vec4 在新增清單、畫布、Parameter 與 PNG 匯出統一保留「Vector N · Constant」，可接線的 Vector 按維度顯示原名。共用純顯示名稱，不改 catalog、圖格式或常數推導。六節點瀏覽器對照確認標題完整、圖與 Undo 資料不變、零頁面錯誤；既有 Vector 編輯契約測試通過，24 份內嵌來源與服務資產一致，正式 TOE 已保存。

2026-09-17 Inputs 入口與圖示修正（維持 0.8.83）：GLSL 原生參數按鈕及其 HTML、前端事件、隱藏樣式、未使用翻譯已移除，原生參數 API 能力保留。Add Node 的 Subgraph 圖示改用實心填色，沿用原模板與大小；一般節點圖示維持線框。限定瀏覽器檢查確認按鈕無 DOM、圖示填色正確、圖與 Undo 資料不變、零頁面錯誤；24 份內嵌來源／服務資產一致，正式 TOE 已保存。較大範圍的 Inputs／工具列／頂欄整理與型別擴充仍未實作，範圍見 [Inputs 面板與工作區設計](../discussions/INPUTS_UI_NEXT_ROUND.md)。
