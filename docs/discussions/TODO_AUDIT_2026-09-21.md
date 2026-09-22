# 待辦總整理：0.8.161 盤點與 0.8.162 review

2026-09-23 更新：Inputs → Sources／來源、來源搜尋列與名稱選單分行、Uniform／常數／特化常數預設置頂已於 0.8.176 交付。分類排序、Graph Constants 卡片數值控制、最小化显示依新確認繼續實作，最新範圍見 [Sources 面板整理](../ui/SOURCES_PANEL.md)；下方 W09 的對應部分不再只是候選。

2026-09-21 最新 review：使用者已讀並大致接受此盤點；Alpha 前希望補齊 GLSL／TD 函式節點、MAT Attribute 與來源能力、Inputs → Sources／來源命名、名稱切換入口，以及自訂參數重構。詳見[Alpha 範圍筆記](ALPHA_SCOPE_2026-09-21.md)；使用者仍在補充，等補充完再安排修改順序，本文舊建議不直接當成排程。[TD 函式缺口盤點](TD_FUNCTION_NODE_GAPS.md)已另列，標準 GLSL 缺口尚待完整核對。0.8.163 另補 Frame 無動畫，導覽視角現為五選一。本文保留作索引，不自動啟動舊待辦。

同日補充：所有內建來源與 GLSL／TD 內建函式都須在 Help 有基本說明及官方對應章節連結，包含現有入口。這是能力完成條件；Built-in Source 的通用 Help 尚不符合逐來源對應，詳見上述 Alpha 筆記。其「引用來源」切換的現況已查明，尚未定案要改成固定來源節點。

2026-09-21。依目前程式、Git 交付紀錄與討論文件交叉整理；相同需求合併，較新的明確決定優先。這是待辦狀態盤點，不是授權把所有提案一併實作，也不把所有遠期能力列為 Alpha 發布條件。

基準：盤點起點為功能提交 `9145780`、TD 保存檢查點 `3e9fd97`（0.8.161）；最新 review 已以程式 `ea63cee`、文件 `1677ed4` 交付 **0.8.162**。盤點本身只改文件；期間新增的導覽 review 另以 0.8.162 處理，下表採最新行為。交付與測試原始紀錄見 [STATUS](../development/STATUS.md)；後續決定應更新本表並保留歷史依據。

## 本輪已完成，可直接 review

| 項目 | 現在的行為 |
| --- | --- |
| 方向鍵導覽 | 實驗功能提供「原版路徑／雙向分支／依畫面位置」三版，0.8.162 改預設依畫面位置，其他兩版保留。一般方向鍵只接受單選，不選線、不循環；按鍵時搜尋。雙向分支版的上下切換同一分支組，返回後仍能選剛經過節點的其他上游。0.8.163 視角獨立選擇不移動、Frame 有動畫、Frame 無動畫、Center 有動畫、Center 無動畫；Center 只平移不縮放。 |
| Ctrl＋左／右 | 選取全部上游／下游，包含起點。實驗選項「Ctrl＋左右逐階擴展選取」預設關閉；開啟後保留既有單選／多選，每按一次加入直接相鄰的一階，下一次再繼續向外擴展；端點保留選取。0.8.162 修正了 161 的替換選取。 |
| Ctrl＋上／下 | 上：選取全部相連節點。下：選取目前圖層中不屬於那些相連區塊的節點。多選以各起點的聯集計算；Group 成員關係不算接線，不跨 Stage／子圖。 |
| 專注編輯 | 畫布 Ctrl＋Enter 反覆切換。Esc 保留取消／關閉操作，不再退出專注。文字輸入與對話框有自己的提交／取消規則；Alt＋Enter 全螢幕保留。 |
| Mac 名稱 | 支援的快捷鍵與提示依瀏覽器平台資訊顯示 Ctrl 或 Cmd；新增命令接受 Control／Meta。Windows 已驗證，Mac 平台資訊及 Meta 事件僅在 Chromium 模擬；Mac／Safari 實機待使用者有空驗證。數值拖曳的 Ctrl 精度鍵仍是真正的 Ctrl，不假改成 Cmd。 |
| 線的命中區 | 最小 **6 CSS px**，放大時可再增大；可見線寬維持原樣。所有透明命中線在可見線後、節點後、Group 背景前；Group 標題已依最新 review 恢復到線下。 |
| 臨時節點放置 | **亮綠外框／文字與 Glow，半透明黑底**；Excellent 及之後加入毛玻璃。臨時線為接孔原色虛線；節點輪廓與標題分隔線為實線；無外陰影。Simple 不發光，Professional 及之後發光；高亮不跟介面亮度一起變暗。選完種類後跟隨滑鼠，點一下才提交。 |

0.8.161 的 91 組相關瀏覽器檢查及完整 portable checks（510 項 Python）通過；37 份內嵌來源與 11 份 HTTP 資產一致，四份現有 Shader 保留。這不代表所有歷史瀏覽器腳本或跨平台實機皆已通過。0.8.162 追加驗證共 92 組相關瀏覽器檢查與完整 portable checks（510 Python），TD 保存與資產核對完成；阻尼首次並行測試的時序失敗及單獨重跑通過均保留於 TESTING。詳細行為見 [UI_NAVIGATION](../ui/UI_NAVIGATION.md) 與 [UX_BACKLOG](UX_BACKLOG.md)。

## 仍需處理：錯誤、限制與驗證

下表順序是建議的風險／依賴順序，不是另一輪已開工承諾。

| ID | 狀態 | 項目與下一步 | 依據 |
| --- | --- | --- | --- |
| B01 | 待重現與修正 | 右鍵框選從畫布開始、在 Slider 上放開，會誤開預設值選單。應由手勢起點／是否已拖曳判斷，不只把開啟時機改成按下就宣稱完成；保留正常 Slider 右鍵與取消。 | [最新 UI 筆記](UX_BACKLOG.md)；`inspector.js` 的 `installValueLadder` 仍使用 `contextmenu` 開啟預設值。 |
| B02 | 已知風險，待處理 | MAT 套用期間暫時 Lock 預覽擷取 TOP，可能在這時保存 TOE 而留下暫態。需驗證窗口內存檔／重開；使用者預計換自製 Viewer，若仍需留上一幀，再评估 Cache TOP。不能把曾通過當機回歸當成保存風險已消除。 | [預覽筆記](PREVIEW_UI_NOTES.md)；`src/remote_panel/runtime.py` 仍有 `image.lock = True` 與恢復流程。 |
| B03 | 舊調查缺口仍在，修改待審 | Array Parameter 長度的 Escape／失焦和節點欄位取消規則不同。現行 `arrayLengthControl` 仍用通用 `input`，後者僅處理 Enter，未加入草稿 Escape 還原；Parameter 數字底色差異也仍需一併復驗。先小範圍修草稿契約，不因調查而全域換元件。 | [UI 共用調查](UI_COMPONENT_REUSE_AUDIT.md)。0.8.104 已重現；本次核對程式路徑，沒有重跑該瀏覽器案例。 |
| B04 | 待實機驗證 | Mac／Safari：Ctrl／Cmd 名稱、快捷鍵、瀏覽器攔截與 TD 行為。Windows 模擬不能代替；使用者會有空再測。Mac 的 Open Editor 目前走一般預設瀏覽器，專用 app-window 尚未啟用。 | [Editor Launch](../ui/EDITOR_LAUNCH.md)、本輪交付。 |
| B05 | 待實機調查 | iOS Add Node 自動 focus 造成頁面縮放／移動、雙指頁面縮放破壞布局、Value Ladder 在頁面縮放後偏移；需分開量測 visual viewport、軟鍵盤及畫布縮放。不要先全域封鎖瀏覽器手勢。 | [節點工作流程](NODE_WORKFLOW_ROUND.md)、[Inputs UI](INPUTS_UI_NEXT_ROUND.md)。 |
| B06 | 待补驗 | MAT 幾何體缺少已配置 Attribute 的行為、Render／Instancing 等实际場景，不能由 POP Buffer 的缺失結果推論。已完成具名 Attribute 功能不等於全部幾何組合皆驗完。 | [來源五輪計畫](SOURCE_COMPLETION_PLAN.md)。 |
| B07 | 待調查，未歸因 | 偶發卡頓、DevTools 與頁面 RAF 指標不一致。需要可重現 trace；RAF 不是 GPU 已呈現幀率。不要直接把整圖同步、TD 或顯卡當原因。 | [UX_BACKLOG](UX_BACKLOG.md)。 |
| B08 | 待重現 | HTTP 顯示 TD 無回應但 WebSocket／Uniform 仍正常，需檢查連線提示的證據與分類。尚無足夠資料認定宿主已失聯。 | [連線筆記](UX_BACKLOG.md)。 |
| B09 | 待量測 | 預覽改大小的體感延遲：區分畫面縮放與新解析度影格，量測放開→請求→TD→顯示。既有 350ms 穩定等待不是已證實的全部原因。 | [預覽筆記](PREVIEW_UI_NOTES.md)。 |
| B10 | 低優先，最後 review | Light 模式：Sources 卡片深底／低對比文字、Expression 深底、Structure 備註等截圖問題。使用者明確暫不要求這輪修。 | [放置 review](NODE_PLACEMENT_REVIEW.md)。 |
| B11 | 暫緩調查 | TDFAM 是否造成原生 OP Create Dialog 底部說明消失，尚未確證因果，依使用者要求先放著。 | [STATUS](../development/STATUS.md)。 |

## 已有方向、尚未交付的工作

| ID | 狀態 | 工作與界線 | 依據 |
| --- | --- | --- | --- |
| W01 | Uniform 第二階段，待排程 | 來源列表結構變動時，將共用 `metadata_epoch` 失效後的恢復縮到受影響來源。**一般圖修改造成未變來源變灰已由 0.8.155 解決**；不能再以此名義重做全面保護或改圖同步協定。 | [同步邊界研究](UNIFORM_SYNC_BOUNDARY_STUDY.md)。 |
| W02 | 定案方向，延後 | Uniform 引用的隱式自訂名稱使用來源名與唯一尾碼，提高中間變數可讀性。保留中間變數及既有自訂名稱，不順便內嵌所有運算、合併引用或移除轉型。這和已完成的 `specValue` 預設命名是兩件事。 | [UX_BACKLOG](UX_BACKLOG.md)「Uniform 產碼可讀性」。 |
| W03 | 待實作 | 多選時 Help 顯示適用的多選操作，不使用其中一顆節點的說明。 | [UX_BACKLOG](UX_BACKLOG.md)。 |
| W04 | 待實作；跨次保存待定 | 排列工具採分割按鈕：右側選單選定即執行，主按鈕重複最後動作；共用可用性判斷。是否跨次開啟記憶最後動作另定。 | [UX_BACKLOG](UX_BACKLOG.md)。 |
| W05 | 待調查與設計 | GLSL OP 狀態卡：名稱／路徑、實際可得的統計、錯誤與警告；更新成本與原生欄位先查明。 | [UX_BACKLOG](UX_BACKLOG.md)。 |
| W06 | 後續目標 | 節點中間結果預覽、Canvas Backdrop、自製 Universal／PBR Viewer 接入；自製 Viewer 由使用者提供。多來源／Clone 預覽仍暫緩。 | [節點工作流程](NODE_WORKFLOW_ROUND.md)、[STATUS](../development/STATUS.md)。 |
| W07 | 已確認後續里程碑，未交付 | TD Pane 內嵌 Editor、共用 Panel 範本及多窗格。**外部瀏覽器的獨立 app-window 不是內嵌 Pane**；目前沒有 Web Render／Editor Panel 產品實作。原生選單整合仍須驗證接口。 | [內嵌 Editor](EMBEDDED_EDITOR.md)、[Editor Launch](../ui/EDITOR_LAUNCH.md)。 |
| W08 | 後續設計 | ShaderToy 封裝節點的預設作者／作品網址註記，先採純文字；不等於已決定導入 ShaderToy 自動匯入或全域 Markdown 註記。 | [節點工作流程](NODE_WORKFLOW_ROUND.md)。 |
| W09 | 後續節點能力 | Switch／控制分支與 UV 數字顯示。Compare／If 已完成且 If 已支援整數／布林／矩陣，不能繼續列為缺口；Switch 規格與數字顯示 UI 尚待細化。 | [數值型別計畫](NUMERIC_TYPES_PLAN.md)、[節點工作流程](NODE_WORKFLOW_ROUND.md)。 |
| W10 | 後續節點能力 | Component reduction、其餘三角／指數／對數及複合公式、Noise 導數／Curl／Fade 等；先查目前 catalog，避免把可組合運算或已有別名重複新增。第一批 Math／TD helper／Perlin／Simplex 已交付。 | [節點工作流程](NODE_WORKFLOW_ROUND.md)。 |
| W11 | 後續來源能力 | TOP 自訂 3D／Array／Cube 與 MAT 非 2D sampler 管理、`POffset`、texture-layer Attribute accessor；`gl_PrimitiveID`／`gl_SampleMaskIn` 尚未納入已驗證來源。內建來源可讀與完整原生配置管理是不同範圍。 | [來源 CSV](TD_SOURCE_NAMING_CATALOG.csv)、[分類表](TD_SOURCE_MENU_REVIEW.md)。 |
| W12 | 後續能力 | MAT 跨 Stage／Instancing 完整流程、Render TOP Uniform 外部供值及同名衝突診斷、一般 SSBO／執行期陣列、可編修的 PBR／其他 MAT／TOP 範例。現有 Attribute／Buffer／結構能力不代表這些全部完成。 | [STATUS](../development/STATUS.md)、[MAT 範例](../features/MAT_PRESETS.md)、[陣列與結構](../features/ARRAYS_AND_STRUCTURES.md)。 |
| W13 | 發布前整理 | Mac／實體 iPad 驗收、打包安裝及可讀升級紀錄。已驗過的 iPad 接線與觸控不必重新標為完全未知，但不是所有裝置／手勢的保證。哪些能力屬 Alpha 必要條件仍需另行定義。 | [STATUS](../development/STATUS.md)、[升級政策](../architecture/UPGRADE_POLICY.md)。 |

## 候選或尚未定案：不可直接照舊筆記開工

| ID | 題目 | 仍需決定的事／已被取代的部分 | 依據 |
| --- | --- | --- | --- |
| D01 | 插入已接好的線 | 雙端相容檢查、單筆原子交易、失敗回復、fan-out 插哪一支。線右鍵的選來源／選目的／Disconnect 已完成，不能把「插入」也報完成。 | [放置 review](NODE_PLACEMENT_REVIEW.md)。 |
| D02 | Group-aware 自動排列 | 是否把 Group 作為排列約束，避免以整框寬度造成巨大間距；目前依節點／接孔排列後再包 Group，使用者也接受可先不改。 | [UX_BACKLOG](UX_BACKLOG.md)。 |
| D03 | 來源 UI | Inputs → Sources／來源與 TD Names／Common Names 入口改善已由最新 Alpha 需求明確提出，實際布局待 review；名稱切換緊貼搜尋框造成誤解仍未修。其他 Language 置中、Common 單擊／展開／新增分工、Graph Constant 卡片滑桿、Custom Uniforms 置頂／分類拖曳、POP 分類、常駐來源數量 tag、Add Node 分類 review、CHOP Export 路徑顯示仍是候選。 | [Alpha 範圍](ALPHA_SCOPE_2026-09-21.md)、[UX_BACKLOG](UX_BACKLOG.md)、[來源計畫](SOURCE_COMPLETION_PLAN.md)。 |
| D04 | 額外選取動作 | Ctrl+A 是否加入右鍵選單；選取真正參與產碼的節點與快捷鍵。**Ctrl＋上是接線相連區塊，不等於從 Output 回推的編譯依賴**，後者沒有因此完成。 | [UX_BACKLOG](UX_BACKLOG.md)。 |
| D05 | 外观與預設偏好 | 全域 Glow／亮度分離仍待低成本方案；Uniform Slider 及放置高亮已有獨立配色。Damping 預設開啟需先決定既有偏好政策，現行預設關閉是刻意保留；Double 入口隱藏也未定案，不能刪除型別能力。 | [UX_BACKLOG](UX_BACKLOG.md)。 |
| D06 | 通用 UI 整理 | 數值草稿共用之外的 Binding／選單重複、英文文案基準 0.8.101 的 63 個候選、操作區誤選文字。需對目前版本重新篩選；不可全域禁止文字選取或把整份舊稽核當批次修改單。 | [UI 共用調查](UI_COMPONENT_REUSE_AUDIT.md)、[UX_BACKLOG](UX_BACKLOG.md)、[Inputs UI](INPUTS_UI_NEXT_ROUND.md)。 |
| D07 | 工作區／Parameter | OP 參數位置與點空白畫布行為、自訂控制工作區與拖入建立公開控制、Library／GLSL 是否獨立 panel、Add Node 多選 tags、更多 Viewer 操作／解析度對照。既有面板重排與 Layout 已完成。 | [下一輪 UI](NEXT_UI_NOTES.md)、[Inputs UI](INPUTS_UI_NEXT_ROUND.md)、[預覽筆記](PREVIEW_UI_NOTES.md)。 |
| D08 | 原生互通 | TD OP／Parameter 拖入瀏覽器的跨程序資料調查、空白啟動無 Shader 時的入口、Viewer expression／所有權、Common／Output 綁定與人工模板。Open Editor 不改 Viewer 開關已修好；其他註冊副作用與內嵌 Pane 分開。 | [STATUS](../development/STATUS.md)、[Editor Launch](../ui/EDITOR_LAUNCH.md)。 |
| D09 | 快捷來源構想 | 圖根永久集合節點、外部 Call／Uniform／Attribute／Output 灰點新增、Select／Data Link 節點、解開子圖。內部 Subgraph 灰點與 Sources 管理已存在；永久集合需求需依現行 Sources 重新確認，不自動新增第二份來源模型。 | [下一輪 UI](NEXT_UI_NOTES.md)、[節點工作流程](NODE_WORKFLOW_ROUND.md)、[Subgraph 快捷](../features/SUBGRAPH_SHORTCUTS.md)。 |
| D10 | 轉型與貼上 | Convert 來源 Auto、數值／bool 的自動接線政策、自動插入 Convert；複製部分 Auto 節點失去外部型別來源後的提示／保留推導體驗。現有型別拒絕是合法保護，不能為方便而移除。 | [轉型提案](CONVERSION_AND_RUNTIME_NEXT.md)、[UX_BACKLOG](UX_BACKLOG.md)。 |
| D11 | Loop／自訂碼 | Loop 子圖、停止接口、Break／Discard／Return 作用域、自訂程式碼作者介面與診斷；是設計討論，並未啟動控制流重构。數值 Loop／Zigzag helper 已完成，不等於控制流程 Loop。 | [Loop 討論](LOOPS_DISCUSSION.md)。 |
| D12 | 同步與效能後續 | 磁碟快取路徑／保存／恢復、project UUID／Save As 分支、增量同步／checkpoint、原生歷史成本、相同 GLSL 略過重編譯、通用 Parameter 輪詢範圍、Binding 恢復生命週期、TD 喚醒可行性。先量測、再改；圖分塊傳輸不是 Uniform 修復的前提。 | [圖同步方案](GRAPH_SYNC_SAVE_PLAN.md)、[Uniform 邊界](UNIFORM_SYNC_BOUNDARY_STUDY.md)、[轉型／背景工作](CONVERSION_AND_RUNTIME_NEXT.md)、[UX_BACKLOG](UX_BACKLOG.md)。 |
| D13 | 檔案／來源可攜性 | 圖封存連同節點實作／相依資產、原生驅動配置匯出、個人庫來源升級／雲端衝突、跨 Editor／刷新後歷史、Graph 納入 TD 全域 Undo、跨管理身分升級。普通 JSON／PNG 與現有工作階段 Undo 都已完成。 | [圖封存](GRAPH_ARCHIVE_PROPOSAL.md)、[個人庫](../features/PERSONAL_LIBRARY.md)、[Undo](../features/NATIVE_UNDO.md)、[更新](../features/UPDATING.md)。 |
| D14 | 遠期連線／執行 | Online／PWA 配對 portal、離線／直接連線服務、瀏覽器執行圖、ISF 等交換；現有 LAN／QR／Remote Panel 可用不代表這些已定案。 | [UX_BACKLOG](UX_BACKLOG.md)。 |
| D15 | 其他低優先候選 | 狀態列向上展開、TOP Vertex Stage、更多來源／取樣維度、自訂預覽 channel、GPU texture-sharing／桌面專用傳輸。保留目標，需使用情境與成本依據。 | [UX_BACKLOG](UX_BACKLOG.md)、[Inputs UI](INPUTS_UI_NEXT_ROUND.md)、[GPU 預覽](GPU_PREVIEW_OPTIONS.md)。 |

## 已完成、被取代或不該再當成待辦的筆記

| 舊筆記／說法 | 核對後的狀態 |
| --- | --- |
| 「來源五輪接續第四輪」「來源分類尚未套 UI」 | **過時。** 五輪到 0.8.132 已完成，Colors／數量 UI 0.8.133，之後還有 0.8.134–142 review。MAT Attribute、Texture／POP Buffer、結構作者 UI 均已交付；仍保留 B06、W11 的驗證／能力邊界。 |
| CSV 的 311 列都應變成可新增節點 | **錯誤解讀。** 表包含非來源、宿主對照、使用者自行建立及欄位共用；列數不是缺漏數。4 個「可沿用機制擴充」與 MAT sampler 部分支援已納入 W11。 |
| 移動／調大小／刪除不參與運算的節點／改名／常數／分量名就鎖 Uniform | **0.8.155 已修第一階段**，使用者試用未發現已知矛盾。仍保護來源定義／分量實體改變；來源列表局部恢復是 W01，不能混回原 bug。 |
| 為修 Uniform 必須整圖重構或分塊傳輸 | **沒有採用。** 已沿現有 TD 實體與瀏覽器草稿責任，收斂逐來源保護邊界；一般 Apply 仍完整圖。 |
| Uniform 初始化漏算 Slider、Group 超框；footer 標準模式偏下 | **0.8.143 已修**：初始化預留控制排版、幾何與 Group 更新；footer 尺寸回歸。功能入口窄化後續 0.8.145 完成。 |
| Uniform C 把手、32px 高度 | **被後續指示取代。** 0.8.154 移除把手、回一般滑桿高度；0.8.147 的提亮配色保留，不重做早期 mockup。 |
| Vertex Stage 按鈕與相關來源配色不一致 | **0.8.154 已完成**，沿用 TD Position 的 Attribute 系列色，只改 Stage 按鈕。 |
| Note 隱藏標題時 body 往上、Group 計標題高度 | **0.8.148 修正**：標題始終不參與節點大小，body 不移動；Note 配色、實驗 Group 角把手 0.8.146，重複副標／圓角／完整選取輪廓 0.8.154 完成。不是全局節點規則。 |
| Uniform Color／Color RGBA 的分量命名、Split STPQ 不一致 | **0.8.150 已修**，共用既有命名規則；固定 UV 初始化遺漏引發的致命錯誤另以 **0.8.152** 修正並驗證重開。見 [錯誤報告](../development/UV_INITIALIZATION_INCIDENT.md)。 |
| Spec Constant 保留 sValue 不必改 | **後來已撤回。** 0.8.151 新建預設 `specValue`，既有名稱不批次改動；Appearance 等寬置中／水平分隔線同批完成，Language 置中仍待定。 |
| Common Names 本身、Source 可用性與引用選取、來源 Glow | 名稱切換 0.8.141、選所有引用 0.8.137、只讓 available Source 發光 0.8.156 已完成。名稱選單擺放位置仍是 D03。 |
| Color 小數位改變節點寬；數字要三次點擊才能全選 | **0.8.156 已修**：數字值不撐寬節點；雙擊進編輯並全選。不要解讀成所有結構改變都禁止重新量測。 |
| 接孔右鍵新增、線右鍵選來源／目的／斷線尚未做 | **0.8.156 已交付**；插入既有線尚未做（D01）。 |
| 放置輪廓亮紫色、全透明 body、陰影 | **已由最新決定覆蓋**：綠色＋半透明黑底，高等級毛玻璃；紫色只保留設計歷史，使用者最後撤回改回紫色的要求。 |
| 命中區 2／2.5px、Group title 提到線上 | **已被取代。** 最小 6 CSS px；0.8.160 恢復 Group title 在線下，保留角把手的既有層級。 |
| 導覽上下選線、L 或 Alt＋L 選全部相連、Esc 退出專注 | **最終方案不同。** 一般導覽只選節點；L／Shift＋L 保留排列，Ctrl＋上相連、Ctrl＋下不相連；Ctrl＋Enter 切專注，Esc 專心取消。 |
| int／uint／bool／double／矩陣、Array／Structure 尚未啟動 | **過時。** 型別基礎、矩陣運算、Convert／Matrix Convert（0.8.90）、Array／Structure（0.8.91）、Array Create（0.8.104）、矩陣四則（0.8.106）與結構作者（0.8.132）已交付。 |
| Array Fill／長度接孔仍完全沒有 | **Array Create 已處理長度接孔與填值。** 任意 SSBO 動態長度、同 Function 多實例的不同符號長度等仍有明確限制，不能概括為完整執行期陣列。 |
| UI 每次移動都重建整個 Library | **原觀察部分過時。** 現行 `change`／`render({layoutOnly})` 在純外觀變更不重建 library／declarations／sources。語義變更仍可能重建，需針對現行 trace 再決定，不把舊拖曳例當現況。 |
| Uniform 只靠全清單輪詢、WebSocket 還只是研究 | **已被 0.8.117–119、125、155 的讀取／即時通道與可見訂閱取代。** Matrix／Array／通用 Parameter 的擴充仍分開界定。 |
| 預覽必須用每個 MAT 自己的 Render／定時 PNG | **主 UI 已在 0.8.74 改共用 Remote Panel／WebRTC**，驗證 Renderer 移至 manager；舊 PNG API／研究不代表現在的主 UI。Lock 暫解仍在（B02），也沒有做 GPU 零拷貝保證。 |
| PNG 圖交換、Library 分頁、QR、Sources 缺失保留／恢復仍待做 | **已交付。** 早期匯入／Library／Inputs 文件的「未實作」屬當時階段；圖封存包含實作／外部資產仍是不同提案。 |
| 開 Editor 會強制打開已有 Shader 的 Viewer | **0.8.92 已修**；不等於把所有註冊副作用或 Viewer 所有權也處理完。 |
| FPS 要恢復 30 秒曲線、比較 shader staging 必須重寫 A/B | FPS 最後採 10 秒的統計與曲線；舊曲線不是未完成需求。Shader staging 已有候選验证及动态失败保护证据，沒有後續授權改 A/B；研究備選不是執行清單。 |

## 宿主限制與測試維護，分開看

- TD 原生資料載體的 double 精度、Spec 長度 CHOP Uniform Array 讀值問題、MAT Attribute 沒有 Array Size，以及已配置 POP Attribute 缺失時宿主可能報错，均有獨立實測界線。這些不是「前端顯示某型別就應無限制可用」，也不代表該型別的圖內 GLSL 運算不可用。見 [精度紀錄](TD_SOURCE_PRECISION_REVIEW.md)、[TD Array](../features/TD_ARRAY_SOURCES.md)、[來源計畫](SOURCE_COMPLETION_PLAN.md)。
- Matrix／Array 原生即時編輯、通用 Parameter 按需訂閱，不因 scalar／vector live 已完成就自動算完成；反之，來源配置管理與圖內矩陣／陣列值編輯早已可用。
- `test_creator_palette.cjs` 的舊分類、`test_fixed_value_nodes.cjs` 固定 16 型別、`test_edit_shortcuts.cjs` 點擊窄版隱藏工具列，已在舊基準發現失敗；需更新測試與適用 fixture，不能當本輪回歸或宣稱通過。
- `test_editor_chrome.cjs` 有舊 footer Refresh／Reload 直出入口假設；`test_wire_geometry.cjs` 的拖節點斷言曾在未修改基準失敗。保留既有接線幾何與新專項檢查的證據，維護時先判別測試假設與真實產品問題，不直接刪掉失敗斷言。
- `test_inline_vector_values.cjs` 的舊展開入口、`test_touch_editing.cjs` 的 fixture／第二指取消，以及 `test_node_collapse.cjs` 的舊 toggle 假設也曾在原基準失敗。`test_value_ladder.cjs` 需使用含指定 Uniform 的 fixture，不能把錯誤 fixture 的逾時說成產品回歸。見 [TESTING](../development/TESTING.md)。
- 本次只盤點上述測試負債；**沒有重跑或修好所有歷史腳本**。新增快捷鍵、命中區及設定的本輪專項測試已通過。

## 建議下一輪的切分

1. 依使用者 review 已選依畫面位置為預設；接續 review 0.8.162 的 Center／Frame 與增量選取；實機 Mac 等有設備時再驗，不阻擋 Windows 使用。
2. 若開下一輪小修，優先 B01 的 Slider 右鍵誤觸；B03 的草稿取消差異單独確認範圍再修，避免跟大型共用重構綁一起。
3. B02 的預覽保存風險另立調查批；W01 的 Uniform 第二階段獨立審查，不混入外觀小修。
4. W02–W05 可各自小批實作。Light review、Group 排列、插入節點及其他候選保持各自優先序，未定案的不自動採舊方案。

本次覆核涵蓋所有 `docs/discussions` 主題，並交叉查閱 `features`／`ui`／`architecture` 與交付紀錄。原始討論仍保留日期和當時的限制，供追溯；閱讀舊的「本輪／下一輪／尚未」時，先以本表及其後的新交付紀錄判斷。
