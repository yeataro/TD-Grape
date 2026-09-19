# 測試

2026-09-19 同步效能 E（0.8.117）：完整 `tools/dev/run_tests.py` 通過（466 Python unit、integration／locales／Node suites）。`test_uniform_pending.cjs` 5 組驗證慢回覆期間 Apply／節點數值／來源按鈕等顏色與透明度不變，但 inert／寫入互斥仍有效；成功與失敗不改 graph／revision／dirty，保留單步值歷史，唯讀與舊 Expose 路徑不被解除。既有 browser input history 10、selection toolbar 12、parameter values 15、type drafts 15、reload applied graph 8 組通過，共 65 組。舊 `test_uniform_recovery.cjs` 的專用 fixture／選取入口已不符合目前 Uniform Source inspector，於取得 legacy 欄位前失敗，未列為通過；本批 legacy 欄位由新 pending 測試直接驗證，TD 真實值／模式衝突由 native sources 與 history 回歸涵蓋。

TD 原生 `test_native_sources.py` 21、`test_input_history.py` 21 組通過；`test_uniform_value_performance.py` 3 組以獨立元件驗證 1／100／200 來源，值變更沒有 state／graph／manifest／shader DAT 寫入、沒有圖版本增加或 Python 產碼，舊 expected 寫入拒絕。保留逐來源掃描的對照策略與索引策略比較，每次 native_rows 呼叫分別 11／407／807 → 固定 7 次；100 來源約 2512–2520 → 62 ms、200 來源約 17010–17101 → 203–221 ms。對照是同版 request 路徑換回逐列查找，不是舊版完整程式的 FPS 測試；保留的完整快照／歷史仍有可見成本。測試元件清除、使用者三份 Shader／registry 不變。私人報告 `sync-perf-e-{native,sources,history}-20260919`。

2026-09-19 同步效能 B／C（0.8.116）：新增 `test_graph_checks.py` 6 組，涵蓋 TOP／MAT／函式布局輸出完全比對、註解與非布局失效、複本隔離、契約及 compiler 更新、損壞／重複鍵／大小上限與有界快取。完整 portable checks 通過（465 Python unit）。`tests/td/test_graph_sync_performance.py` 在獨立元件通過 8 組條件，核對版本、graph／DAT、原碼不變、過期拒絕、破損原文保護、數值／comment 更新與外部修改 shader 後重新驗證；既有使用者 Shader／registry 未改。三次相同操作的中位數：TOP 16 節點 53.2→22.3 ms、101 節點 72.8→31.2 ms；MAT 16 節點 47.1→21.9 ms、101 節點 72.9→31.5 ms。此為 TD 主執行緒 request 耗時、不是整體 FPS；比較透過同路徑停用／啟用純計算重用。preview／native viewer／分享／state 原文下載不新增圖依賴。私人 native 報告 `sync-perf-bc-native-20260919`。

2026-09-19 同步效能 A（0.8.115）：新增 `test_layout_edits.cjs` 5 組，比較 16／101 節點以舊入口／布局入口執行相同編輯後的 graph、Undo before／after、sourceIds 與立即草稿；驗證零 Auto／常數檢查、零無關 sidebar 建立、Undo／Redo、誤標語意／Label 回退及唯讀。既有 node width 15、selection collapse 6、spread 8、arrange 15、canvas selection 7、matrix values 15、node notes 3 組通過，共 74 組；完整 `tools/dev/run_tests.py` 通過。單次 Chromium JS 計時 16 節點 25.4→14.9 ms、101 節點 77.3→70.3 ms，只作局部探針，不代表 FPS／穩定硬體效能。`test_node_collapse.cjs` 尋找已不存在的 `.node-collapse-toggle` 超時，修改前基線也在同處失敗，未列為通過。私人報告位於系統暫存 `grape-sync-perf`；未操作使用者瀏覽器。

2026-09-19 操作 review 定稿（0.8.114）：`test_canvas_framing.cjs` 7 組驗證 Home 在四種開關組合均立即到位，鍵盤／按鈕／右鍵選單中斷 active Frame 後零待執行回呼；F 有選取與無選取都使用 Frame 設定，保留編輯／IME／手勢隔離及只讀操作。`test_canvas_damping.cjs` 10 組更新預設與 Reset 為 150／333 ms，保存並 reload 自訂 100／450 ms 不覆寫；既有 UI experiments 20、zoom menu 7 組通過，共 44 組。檢查 971 組雙語鍵及 JS 語法，窄版標籤顯示正常。私人結果位於 `reports/canvas-motion-defaults`。插值演算法未變，本輪測試針對呼叫路徑、預設／偏好與關閉狀態。

2026-09-19 畫布插值 review／H、F（0.8.113）：連續輸入回放 `test_canvas_motion_input.cjs` 在舊版失敗、修正後 2 組通過；20 幀 pointer input 每次在該幀 RAF timestamp 後 2 ms 到達，舊版位置不變，新版第二幀開始持續移動，停止後精確到位。`test_canvas_framing.cjs` 6 組涵蓋 H 全圖／F 單選、多選、無選取回退、唯讀、文字／數值／contenteditable／IME／修飾鍵／手勢隔離、兩組開關的四種組合與獨立 200／450 ms、重複 F 不重啟計時、關閉組直接中斷另一組動畫、系統 fit 仍立即、無 DOM／graph／history 改動。更新 damping 10 組含兩列 UI／各自保存與 Reset 250 ms；既有 experiments 20、selection toolbar 12、shortcut help 7、zoom menu 7、canvas selection 7 組通過。私人輸入時序與結果位於 `reports/canvas-damping-review`；舊版 before 為預期失敗的根因證據。時間回放只控制相機 RAF，保留一般瀏覽器工作；另有真實 RAF 的完成檢查。未聲稱已驗收實體 iOS 或 TD 般手感。

2026-09-19 畫布阻尼（0.8.112）：`test_canvas_damping.cjs` 9 組通過。檢查預設關閉／100 ms、10–1000 ms 共用數值滑桿與唯讀圖的本機設定、快速 wheel 累積／單一 rAF、插值中游標錨點與 graphPoint、實際滑鼠平移不重建 DOM／改圖／送 POST、關閉後零插值 target／rAF／專用 listeners、背景／blur、兩指縮放接一指放開不遺失倍率、設定持久化／Reset／窄版及真實 scheduler 收尾。測試用可控制的插值回呼驗證中間狀態，最後另走實際 rAF；不是硬體 FPS 或實機 iOS 手感驗證。既有 experiments 20、zoom menu 7、canvas selection 7、numeric scrub 32、numeric presets 7、numeric touch 20 組通過。舊 `test_value_ladder.cjs` 依賴帶有 uniform_tint 的專用 fixture，誤以本輪矩陣 fixture 執行於該欄位等待逾時，未列為通過；中鍵 Ladder 與唯讀／取消行為已由上述共用 numeric scrub 回歸涵蓋。私人結果位於 `reports/canvas-damping-round`。

2026-09-19 畫布選取：`test_canvas_selection.cjs` 7 組驗證無選取／单／多／群組／接線取消、pan、marquee、觸控雙擊與拉線開啟 creator，以及失焦提交數值仍是一筆 Undo；比對 graph／history／dirty、DOM identity 與 API 請求，防止透過整圖 render 處理純選取。12 組既有 selection toolbar、15 組 Parameter 通過。私人 `reports/canvas-click-round/{before,after}.json` 保存 16／101 節點的同探針前後計時；沒有將單次 JS 耗時等同於實際 GPU 幀率。

同輪擴大回歸的限制：舊 `test_inline_vector_values.cjs` 仍尋找已不存在的 `data-vector-expand`，`test_touch_editing.cjs` 在開啟無實體預覽的 fixture 中拖曳未提交；兩者使用修改前 HEAD 的 editor 亦於相同位置失敗，並非本次新增通過項目。關閉 fixture 預覽後，touch 測試可前進至第二指取消接線的既有失敗；後續需獨立更新這兩份舊測試，本輪不擴大修改產品行為。

2026-09-19 HTTP 初始化：`test_lan_access.py` 新增同一 socket 連續讀 24 個資源／API、未授權 POST 關閉且不寫入、帶 body 的靜態 GET 關閉、rebind 後舊 keep-alive 連線回 503 且不執行寫入。與 share links 共 21 項通過。私人 `reports/canvas-click-round/reload-http10.json`／`reload-http11.json` 保留實際 TD 服務 Chromium A/B：前者 5/6 次腳本連線失敗，後者 6/6 次資源完整；根路徑 API 的 422 是未指定 Shader，與資源載入失敗分開記錄。完整 Shader 頁面驗證隨正式同步執行。

2026-09-19 FPS Low／Min：`test_fps_display.cjs` 4 組驗證 99／100 幀暖機界線、200 幀中兩個慢幀的平均換算、單幀 Min、讀取不改變樣本、精確 10 秒淘汰、buffer wrap／極端容量溢出；使用假的 rAF 驗證 FPS 回復 60 時 Low=2、Min=1 保留之前的 1,000ms 單幀尖峰，過期後均恢復 60。維持 10Hz 曲線／每秒數字、背景暫停、無 graph／history／wires 變更與 320／390px 排版。既有 experiments 20 組與 693 雙語鍵通過，tooltip 使用共用翻譯處理。私人 `reports/fps-low-round` 保留結果、截圖及 7,200 次合成 120Hz callback 的命令提交計時；不是 GPU／實機 iOS 效能保證。

2026-09-19 FPS trail：`test_fps_display.cjs` 擴充一幀 1,000ms 停頓、FPS 恢復後尖峰仍保留、30 秒到期、57 秒缺口無舊資料混入、最多 10Hz 繪圖與固定最多 300 格；關閉 canvas 寬度歸零，背景／恢復無假尖峰，390／320px 不遮擋 view controls。3 組通過，另有 experiments 20 組回歸與 690 雙語鍵。私人 `reports/fps-history-round/recorder-cost.json` 記錄 7,200 次合成 callback 的 JS／Canvas 命令提交計時；不包含延後執行的 GPU／合成成本，低於計時解析度的樣本會顯示零，不當作實機效能保證。

2026-09-19 `tests/browser/test_fps_display.cjs`：隔離瀏覽器驗證 FPS 預設關閉且無採樣、顯示開关不修改圖與歷史、不重畫 wires、每秒按實際幀間隔顯示讀值，模擬主執行緒停頓與分頁隱藏／恢復；另驗證 390px 左下位置。沿用 `test_ui_experiments.cjs` 的 20 組設定回歸。FPS 衡量瀏覽器回呼節奏，不能據此斷言 TD 或 GPU 的實際幀率。

2026-09-19 矩陣四則與分層型別選單：`test_matrix_arithmetic.py`／`.js` 檢查 352 組完整簽名、輸入形狀、序列化、預設數值與非法配對；`tests/browser/test_matrix_arithmetic.cjs` 實際連線、切換操作數、Undo／Redo、拉線新增；`test_creator_performance.cjs` 持續檢查候選配對與 101 節點的搜尋成本。既有 138 圖編譯基準保持一致。TD 的 `tests/td/test_matrix_arithmetic.py` 比對 360 個 TOP Pixel／MAT Pixel／MAT Vertex 結果（包含 12 個未接線預設），使用獨立 fixture，結束核對既有 Shader、registry 並清理 fixture。前端使用共用的 type contract；若用舊 browser state，先以 `tests/browser/export_editor_fixture.py` 更新 fixture，避免測到舊簽名。

`test_type_menus.cjs` 驗證分層順序、水平線、Double 第三級、鍵盤、320／390px 與 UI scale；`test_select_menus.cjs` 驗證其他既有下拉選單與共用提交路徑。實際 iOS 裝置的手勢體感仍待使用者 review。

2026-09-19 Array Create：`tools/dev/run_tests.py` 通過（445 Python unit、14 integration、687 雙語 keys、Node suites）。`test_array_create.cjs` 6 組檢查，包含長度數字修改同步下游、執行期長度拒絕、Uniform 填值、複製重映射及兩種子圖擷取；匯出的三份圖另由 core 實際編譯。`test_array_structure.cjs` 12 組既有陣列檢查通過。`tests/td/test_array_create.py` 在 TD 2025.32820 以隔離 fixture 載入工作樹 core，42 項 TOP／MAT Pixel／Vertex GPU 比對全部通過，包含 Spec 值改變時原 Shader 文字不變、Uniform 填值更新、bool／double／非方形矩陣；既有 Shader／registry 不變，fixture 刪除。私人報告在 `work/reports/array-create-round/native`；瀏覽器及 portable 證據在 Documents 工作區 `reports/array-create-round`，不打包進產品。


2026-09-19 Array 共用控制（0.8.103）：`test_array_structure.cjs` 12 組、`test_matrix_values.cjs` 15 組及 `test_parameter_values.cjs` 15 組通過。陣列增加與現有 INT／bool 欄位的明暗樣式對照、整數範圍及小數拒絕、Escape、重繪保留草稿、連接型別更新與單次 Undo。舊 `test_inline_vector_values.cjs` 仍尋找已不存在的 `data-vector-expand`，無法用於目前 Vector UI；本批使用現行 Matrix／Parameter 回歸，不將舊測試計為通過。隔離 Chromium 驗證，並非實機 iOS。

2026-09-19 表現模式即時切換（0.8.100）：既有 `test_ui_experiments.cjs` 20 組、`test_note_appearance.cjs` 16 組通過。Note fixture 明確開啟它所操作的展開節點收合提示，修正仍依賴舊預設的前置條件；未更動產品預設。另在私人 `visual-no-transition` 報告保留 4 組 Chromium 計算樣式探針：Professional 與移除整套光暈 CSS 的基準相同（含選取／錯誤節點、Note）；模式即刻切換、無 CSSTransition 或入場延遲、退回 Professional 的 filter 為 none；Cool 非光暈節點／接孔／文字／面板及 Stage 與基本樣式相同；Light／減少動態效果與圖資料不變。未做實機 iOS 效能量測。

2026-09-19 陣列／結構 0.8.91 已整合 main、同步 TD 並保存：32 份內嵌來源、9 份服務資源一致，core 無錯誤，TOP／MAT Master current，三份使用者 Shader 與模板身分保留。正式 TOE 889,438 bytes，SHA-256 `fb8b99f706b93881204131d759022d2e0e29272b1414a67dc565dc11f57de648`，排除一份私人助手。原生交付報告為 `array-{refresh,masters,audit,save}-20260919`；功能提交 `60f71f8`、掛起修正 `4c3d921`。沒有重新載入使用者現有 Editor。

2026-09-19 陣列／結構 0.8.91 交付前驗證：完整 portable checks 通過，包含 425 項 Python unit、678 個雙語鍵、14 項 launch、metadata／brand／JS 模型及 26 項 Remote Panel 檢查。既有 138 個圖編譯指紋保持不變。複合型別新增動態描述，保留原 38 種數值型別；覆蓋零初始化、讀取 Clamp、Replace 越界不修改、明確 int／uint 索引設定、型別隔離、結構欄位 ID、宣告依賴、匯入／Undo／原生綁定與最後成功 Shader 的保護。

本輪 browser 檢查：Array／結構 8 組、Function／Subgraph／GLSL Code／剪貼簿整合 5 組、搜尋效能及副作用 11 組、GLSL Code 9 組通過；兩份瀏覽器生成的複合型別圖另經 core 編譯成功。最終搜尋測試的 101 節點圖，正反向、有／無常數限制的開啟時間約 13.9–23.7ms；沒有完整圖 planner 呼叫，搜尋文字沿用局部配對結果。這是本機隔離測量，不代表所有設備上限。GLSL Code 舊測試的 fixture 改為關閉不存在的 Remote Panel 預覽，避免啟動等待阻擋測試操作；產品預览行為未更改。

TD 2025.32820／Windows／NVIDIA 的 `test_array_nodes.py` 最終 51 cases、139 programs、277 項 GPU records 全部通過，包含 TOP Pixel、MAT Pixel／Vertex、动态索引、Replace 來源分支不變、TD 內建結構欄位與零初始化。最終來源 fixture 按 TOP 4／MAT 3／Light 1 串行重跑全過，包含隔離 MAT light 設定還原及清理。測試發現並修正 Replace 的常數越界索引即使在不執行的分支仍被 GLSL 編譯器拒絕，故保留 no-op guard 並使分支內 subscript 合法。宿主 struct constructor 實測另找到文件未列的 TDMatrix `quadReproject`／`clipDistances`、TDCameraInfo `ipdShift`，已按此 build 註冊並驗證，不能推廣為所有 TD 版本。

掛起調查：277 項 GPU job 完成後接續 sources job 未回覆。使用者關閉 TD 後重開，TOP-only fixture 在新增 `float[3]` 來源時再次重現；flushed phase 顯示候選驗證已返回，外部 py-spy stack 則落在 `prepare_managed_top_slots` 對既有 In TOP 呼叫 `connect(default)`。新增 Uniform 未改 TOP slots，但舊程式每次 deploy 都斷線、暫時改名、重接。修正只在 slots／順序或 plumbing 損壞時重建，原目標接線相同時不重接；沒有跳過來源內容更新。這是已重現路徑的定位，不能推定 TD 內部是哪個鎖或依賴評估機制。

修正後 TOP／MAT／Light 共 8 組全部回覆成功，另 `test_top_source_inventory.py` 的 6 組原生回歸驗證五個輸入、重複引用、未變更時 OP identity／外線保留、改 default、缺線修復、重排依 ID 保留外線及解析度、零輸入清理。全部在隔離管理器執行，三份使用者 Shader／registry 保留、fixture 移除。報告為 `array-sources-{top,mat,light}-fixed-20260919` 及 `top-plumbing-fixed-20260919`。未回覆的舊 request 均以原 ID 改名暫存，沒有於重開後重播。

另觀察 TOP Vectors 頁面傳入動態 uint 最大值未維持探針預期，與圖內 exact literal 的索引檢查分開記錄，未重新加入已撤銷的整數範圍限制。

2026-09-18 Matrix Convert／double 第二批 0.8.90 已同步 TD 並保存：31 份內嵌來源、9 份服務資源一致，core 無錯誤，TOP／MAT Master current，三份使用者 Shader 保留。正式 TOE 865,718 bytes，SHA-256 `c79c0833fb8d2cf1560b6029fd1cd11856d9a1ac2c283fdb7ebb7f4f904abc6a`，排除一份私人助手；現有 Editor 未強制刷新。原生交付報告為 matrix-convert-{refresh,catalog-audit,masters,audit,save}-20260918。

交付途中 Git index 曾拒寫，檔案已落地但 HEAD 未移動；核對工作樹／index 完全等於已驗證的 0e242b9 後，以原 HEAD 比對完成快轉，未丟棄其他變更。TD 切换來源期間曾輸出 Unknown catalog identity，另作唯讀 catalog／DAT／純編譯核對後確認 valid、core 前後無錯誤、使用者圖不變，才繼續模板更新与保存。

2026-09-18 Matrix Convert 與搜尋修正整合：保留新版 Convert 配對與同形狀排序，前端新增操作 9 組、type foundation 13 組、搜尋效能及副作用 11 組全過；Matrix editor 10 組、metadata／syntax／diff check 通過。正式搜尋測試補入合法 Matrix→Matrix Replace fixture、double／dvec3／非方形 dmat 及非空候選斷言，另實際驗證兩 Convert 入口的 7 組建立／拒絕／單筆 Undo 情況。101 節點正反向且有／無常數要求，清單開啟 12.3–21.8ms，32 次查詢 1.1–6.4ms；文字變更沒有 planner 呼叫。未因前端合併重跑未改動核心的 237 項 GPU 檢查；此前已全過。報告位於私人 `work/matrix-perf-integration` 及 `work/matrix-creator-performance/final`。

搜尋修正補充：舊 `test_node_browser.cjs` 的 .library-tabs 三頁籤假設、`test_creator_palette.cjs` 的未展開 tree 內 UV 項目選擇器仍失敗；固定 pre-change ead882e 資產及相同 fixture 重現同一失敗。這兩支列為既有測試維護待辦，不列為本次通過項目。

2026-09-18 第二批既有運算擴充交付前驗證：portable checks 383 項 Python unit、656 個雙語鍵、14 個 launch 檢查、既有 JS 與 26 個 Remote Panel 測試通過。第二批隔離 browser 新功能 7、basic math 8、control 11、type foundation 13 共 39 組通過；包括 Convert 1,109 個合法配對、If matrix 預設 true identity／false zero、double 簽名，以及保留拖線建立 Convert 的同形狀優先。

新增 `tests/td/test_matrix_double_operations.py` 有 73 個圖案例、219 份 core GLSL 編譯及 237 次 GPU 檢查。首次提交曾在請求進入佇列前遇到 Windows 存取拒絕（WinError 5）；完成 Convert／Matrix Convert 分流後重新提交成功，237 項 TOP Pixel／MAT Pixel／MAT Vertex GPU 檢查全過，existingShadersPreserved／registryPreserved／fixtureRemoved 均為 true。包含 scalar 對角矩陣、Matrix 擴縮／精度、Matrix 擷取、If 原生動態切换、double Dot／Length／Mix／Range 等。這是工作樹的隔離驗證，尚未同步產品來源。

分流後完整 portable checks 再次通過（384 項 Python unit、657 個雙語鍵），另有 60 項核心／契約／catalog／歷史指紋 focused checks；前端新增功能 9 組及 type foundation 13 組共 22 組通過，Matrix editor unit 10 組、metadata、syntax／diff check 通過。Matrix Convert 的 28 個有效來源沒有 vec2／vec3 無合法目的的死路；全部 1,109 個配對由兩個入口聯集完整覆蓋。

2026-09-18 搜尋修正 0.8.89 已同步 TD 並保存：31 份內嵌來源、9 份服務資源一致，core 無錯誤，TOP／MAT Master current，三份使用者 Shader 保留。正式 TOE 863,390 bytes，SHA-256 `b0698e620bf75acf46116185cd1c808379c160cd4beb63c518d88359cdd3c817`，排除一份私人助手。creator_position 既有回歸另通過 13 組。未重新整理使用者現有 Editor；私人原生報告為 creator-performance-{refresh,masters,audit,save}-20260918。

2026-09-18 拉線新增搜尋效能：完整 portable checks 通過（374 項 Python unit、656 個雙語鍵、14 項 editor launch、metadata／JS model／26 項 Remote Panel）。新增 `test_creator_performance.cjs`，10 組 headless Chromium 檢查全過、零頁面錯誤。涵蓋正反向純量／向量／矩陣候選与舊完整 planner 的結果／排序對照、文字／來源／指定型別篩選、Combine／Replace 重疊接線、If bool 接口、圖值／宣告／函式庫／契約／Undo 失效，以及過期候選與常數／下游限制拒絕時 graph／history 不變。正常建立仍執行 fresh 全圖驗證並只有一筆 Undo。

效能 fixture 為來源加 100 個 Auto Add，正反向均含有／無 requireConstant：每次重開清單約 12.5–23.1ms，後續輸入约 1.1–7.1ms；候選完整圖 planner 呼叫為 0，文字變更 Auto planner 也為 0。另一支獨立 profiler 同樣 101 節點，舊版 standalone 開啟 12ms、往下游 773ms，修正後往下游 14ms；mat 查詢由 635ms 降為 5ms，standalone 約 2ms。這是本機隔離合成圖及工具計時，並非使用者實際圖或跨設備保證。計時路徑沒有 TD API 搜尋請求。報告位於私人 `work/creator-performance-regression`、`work/wire-creator-profile` 與 `work/wire-creator-independent`。

獨立原始碼審查未發現資料正確性問題；已接受的小幅行為差異是僅受整圖常數或下游限制影響的項目可先出現在清單，點選時才回報限制，完整提交驗證及 rollback 保持不變。搜尋仍使用同一份型別契約，沒有新增後端索引、背景監看或改動 cast 規則。

2026-09-18 Matrix 覆寫標記試行（0.8.88）：15 組隔離 Matrix UI 檢查通過。Combine 單獨接 X 時保持三格，顯示 `↳ X` 並帶來源提示；mat4 Replace 的 Value 與 Y 分量同時接入時，收合列精確為 `—｜↳ Y｜—｜—`，其他欄仍為四個沿用標記。數值編輯、Undo、接孔與各形狀檢查保持通過，實際 Replace 截圖已檢視。主線另以已交付 core 重驗同 15 組通過。TD 核對 31 份內嵌來源與 9 份服務資源、core 無錯誤、TOP／MAT Master current；三份使用者 Shader 保留。正式 TOE 861,518 bytes，SHA-256 `c6f87fbad7c6ecf59676c60e0294a25c3a6c619f489ed8f73d9a8d218848d655`，排除一份私人助手。交付報告為 matrix-marker-refresh／masters／audit／save-20260918。

2026-09-18 Matrix 收合位置修正（0.8.87）：`test_matrix_values.cjs` 15 組通過，無頁面錯誤。新增實際接線案例核對 vec3 只接 X 後仍有三個等寬位置、Y／Z 編輯索引正確、修改 Y 的 Undo 保留接線，以及 mat4 Replace 接入 Value 後單獨覆寫 Y 仍有四格及下方 Y 接孔。既有 18 型別、展開／收合、Split 接孔、數值手勢與座標保留案例一併通過。本批只有前端顯示修正，無需重跑 GPU 數值探針。主線以已交付 core 重驗 15 組亦通過；TD 31 份內嵌來源與 9 份資源一致，core 無錯誤。兩份 Master 僅同步 compilerBuild 至 0.8.87，無定義升級，使用者三份 Shader 保留。正式 TOE 861,142 bytes，SHA-256 `8e553842eba385df9e54e341225335fe98382b50b09a8792f6b68a1bddecfd57`，排除一份私人助手；交付報告為 matrix-slots-refresh／masters／final-audit／save-20260918。

2026-09-18 Matrix 0.8.86 第一批交付核對：最後一輪 portable checks 374 項 Python unit、656 個雙語引用、editor launch／browser metadata／既有 JS／26 項 Remote Panel 全過。刷新後 31 份內嵌來源、9 份服務資源一致，core 無錯誤、TOP／MAT Master current，三份使用者 Shader 保留。正式 TOE 860,150 bytes，SHA-256 `c1dd7bbb6b1117120fd691b3a5e789411321e59d04ae7b64f7d248298c483fb3`，私人助手排除。

來源切換過程曾輸出 `Unknown catalog identity`；先做獨立唯讀一致性檢查，確認當前 catalog 驗證及純編譯成功、core 前後均無錯誤、全部 DAT 與來源一致，才繼續模板同步。模板同步與最終 audit 均通過，非忽略錯誤後直接保存。交付報告為 matrix-batch1-refresh／catalog-audit／masters／audit／save-20260918。

2026-09-18 Matrix 第一批：374 項 portable Python unit、656 個雙語引用、editor launch／browser metadata／brand 與既有 JS／Remote Panel checks 通過。矩陣 editor JS 驗證 18 型別與接孔／值規則；隔離矩陣 UI 13 組、來源 UI 7 組、既有 numeric scrub 32 組通過。交付前以實際 GLSL Code／Subgraph／Transpose 選單驗證 mat2x3 → mat3x2 的座標保留、暫存形狀往返與單筆 Undo／Redo；修正 GLSL Code 與 Auto 輸入預設值原先按平坦陣列重排的錯位，矩陣 editor JS 10 組亦通過。

TD 2025.32820 隔離原生結果：新矩陣節點 408 records 全過；float Matrix Uniform 的九形狀 × 三載體 × TOP Pixel／MAT Pixel／MAT Vertex 共 81 項正確；圖內雙精度及 float 原生來源經 GLSL 轉 double 78 項通過。原生 double／dvec／dmat 直接 Uniform 載體另 105 項編譯成功但讀值錯誤，作為宿主限制揭露，不以攔截或隱性轉型改變能力。來源建立／手填／Expression／DAT 動態／Binding／Undo／Redo 八組通過，保留使用者 Shader 與 registry。節點測試最初的 MAT TDDither 及 Vector fixture 儲存欄位錯誤已修正，產品運算未因探針誤判而修改。

建構式能力探針 `tests/td/test_matrix_constructors.py` 的 61 案例 × 三目標／Stage 共 183 項符合 GLSL 4.50 §5.4.1／§5.4.2：159 項接受且數值正確、24 項預期拒絕。涵蓋 scalar／vector／matrix 及雙精度、擴縮與不足分量。此為第二批 Convert 設計依據，沒有因此修改現有 Convert。各探針清除臨時節點並確認既有 Shader／registry 不變；結果只代表此次 Windows／GPU／TD build。

新增驗證入口：`tests/unit/test_matrix_foundation.py`、`test_matrix_sources.py`、`test_matrix_editor.js`，`tests/browser/test_matrix_values.cjs`、`test_matrix_sources.cjs`，以及 `tests/td/test_matrix_nodes.py`、`test_matrix_transport.py`、`test_matrix_sources.py`、`test_matrix_constructors.py`。Browser 腳本自行匯出最新 catalog fixture；TD 測試以協調的開發 runner 單次串行執行，不與其他原生 job 並行。

2026-09-18 值模型／Compare／Note／偏好／整組 Value Ladder 最終 TD 交付：來源刷新更新 7 份 DAT，核對全部 31 份內嵌來源及 9 份 HTTP 資源快照與目前來源一致；core 無錯誤，TOP／MAT Master current，三份現有 Shader 的 state／graph／manifest／pixel_shader／vertex_shader 保留。TOE 保存後再次核對 Shader state，837,526 bytes、SHA-256 `eac3113c4731c5122892c8d6045014fcd002ac84cfd3609f77527bf1f99e8788`，排除一份私人開發助手並恢復現場開發環境。私人報告位於 model-consolidation 的 final-refresh／final-audit／final-save。本次交付使用開發橋接，未操作滑鼠鍵盤或刷新現有 Editor；沒有重跑無關 GPU 壓力測試。

2026-09-18 Parameter 整組 Value Ladder（main `390a1d1`）：新正式 Chromium 測試 14 組在功能分支及主線通過、零頁面錯誤；主線 JavaScript 語法、diff 及 634 個雙語鍵通過。覆蓋固定／通用型別、展開分量、未接線值、Color 不限於 0–1、共同整數界限、純預覽／一筆 Undo、取消、一般重繪、上下文切換、忙碌／唯讀，以及同節點畫布與 Parameter 草稿保護。另以獨立 probe 重驗零位移／來回零位移精度、畫布草稿與重繪後單筆 Undo，四項均通過；Ladder 畫面已檢視。

同輪測試查出並修正兩項問題：零位移對手填高精度小數多做取位數，以及整組手勢覆寫畫布未提交草稿。額外驗證 Number.MAX_VALUE 仍為有限數、聚焦但未改值的欄位在整組提交／blur／下一次手勢後保持一致，沒有假草稿或額外 Undo。此次僅背景檔案與 headless fixture，未操作 TD、使用者圖或桌面。

同一穩定功能版本的既有 headless 回歸：numeric scrub 32、numeric touch 20、numeric presets 7、Parameter values 15，共 74 組通過、零頁面錯誤；涵蓋單欄中鍵、Alt＋右鍵、左鍵／觸控長按、級距鎖定、縮放、草稿及取消，與新整組 14 組合計 88 組數值操作檢查。兩支更早期 `test_value_ladder.cjs`／`test_ladder_touch.cjs` 因舊 Uniform／Parameter DOM 選擇器在首個手勢前 timeout，不能列為通過；它們亦含已被取代的級距／單點觸控假設，應另作測試維護。沒有為了通過舊測試修改產品語意，現行六個回歸入口的 headless 瀏覽器皆已關閉。

2026-09-18 值模型／Compare／Note／偏好整合（main `1d2a3c1`）：完整 portable checks 通過，含 344 項 Python unit、633 個雙語鍵及既有 editor launch／browser metadata／JS model／26 項 Remote Panel 檢查。使用目前 core 匯出 fixture 後，主線 headless Chromium 的固定型別入口 7、型別基礎 13、Compare／If 11、Note 對齊 3、UI experiments 20、editor chrome 17，共 71 組通過、零頁面錯誤。固定入口涵蓋全部 16 型別、搜尋／實際建立、固定身分與泛型切換、複製／JSON／Undo；全螢幕時鐘涵蓋原生進入／退出、失敗、外部退出及既有偏好恢復。

分支另完成註記高度驗證：既有 node notes 3、Markdown 9、Note appearance 16、Note resize 14 組通過；私人版面探針檢查分隔線實際拖動、極矮面板最小輸入高度、窄面板長文捲動及分頁切換，截圖已檢視。Compare 的 9 項 Python control 往返、26 項 Math Auto model 與 10 項 Auto／指定型別產碼等價檢查通過；沒有更動其他節點的推導排序。

整數傳輸限制撤銷已完成第一個 TD 同步／保存檢查點：來源刷新保留兩份使用者 Shader，正式 TOE 807,132 bytes、SHA-256 `0ea53df37ef47610a56141b6da3e0e40851e1f9a69a2e1a7943b1f1e695ab819`，保存排除私人助手。後續介面整合已由上方最終 TD 交付紀錄完成；沒有重跑原生 GPU 壓力或傳輸探針。無視窗測試不操作使用者桌面，不能代替實體觸控或其他 GPU 驗證。

2026-09-18 整數傳輸限制移除，隔離 worktree 驗證：`test_typed_sources`、`test_typed_undo`、`test_spec_constants`、`test_sources`、`test_history` 共 73 項通過。覆蓋完整 int／uint 範圍、負 Spec int、大整數直接寫入與 Undo、非法型別／超界拒絕，以及 Uniform／Spec snapshot 不呼叫驗值。隔離 fixture 的 `test_type_foundation.cjs` 13 組通過、零頁面錯誤，新增原生來源欄位的完整整數上下限、精度邊界值及原始 expected 值保存；631 個雙語鍵通過。原生 TD 腳本已改成驗證合法值不被拒絕，能力探針仍記錄宿主失真；本次沒有執行原生 TD 測試、部署或保存。下方先前的傳輸限制／拒絕測試是舊版實測紀錄，不能作為目前編輯器輸入限制。

2026-09-18 純量／向量型別與介面收尾：整輪 portable checks 通過（327 Python tests 及既有 editor／metadata／JS／Remote Panel 檢查）。其後追加 `test_typed_undo.py` 的 7 項重現測試，與 typed sources／history／Spec 共 52 項通過；驗證原 Shader context、型別變更後的原生 Undo、綁定控制項及舊 exposed Uniform 歷史值，並確認不合法還原在任何写入前拒絕。原生整數快照的 integral float 與布林 0／1 仍接受；綁定新 Int／Toggle 控制項前先驗值，避免控制項靜默截斷。

TD 2025.32820 隔離原生驗證：typed values 394 項、native sources 21 項、Spec Constants 18 項及 custom parameters 18 項通過。typed values 涵蓋 16 型別、constructor、完整範圍圖內常數、If、合法數學運算、向量組拆、GLSL Code／Subgraph、動態 Uniform、原生 Undo／Redo，以及不合法寫值保留原狀。另有 330 組原生傳輸探針，190 組精確、140 組確認預期失真，用於界定 TOP／MAT Vectors 的 float32 整數精度與 MAT uint 上限；這 140 組不是宣稱可用的傳輸值。使用者 Shader 保留，本輪沒有 Metal／其他 GPU 實測。報告位於私人 `work/reports/type-expansion` 的 typed-values／uniform-transport／native-sources／spec-constants／custom-parameters。

瀏覽器 typed values 12、context menu 3、control nodes 10、Note appearance 16、selection spread 8、selection collapse 6 組通過。涵蓋型別切換與 Auto、Scalar／Convert、右鍵圖示、收合／展開按鈕與分隔線一起隱藏、完整群組外範圍的直角、排列小三角及 Note 預設純灰／自訂色／透明外觀；Note 與選區截圖已檢視。自動排列演算法保持不變。

仍有兩份舊 browser 腳本待維護，不能將本輪描述為全部 browser 全綠：`inline_vector_values` 尚使用已改名的 `data-vector-expand`（目前為 `data-value-expand`）；`glsl_code` 的可變 fixture／介面假設造成 timeout。新型別通路測試已涵蓋相應編輯與 GLSL Code 流程，這兩份旧腳本本輪未列為通過。

已同步並保存 TD：31 份內嵌來源與 9 份服務資源一致，TOP／MAT Master current、core 無錯誤，兩份使用者 Shader 保留；服務 GET 200。正式 TOE 807,516 bytes，SHA-256 `d0d28244cd83b1e2a03f73955182e5818d3f2815fb8fb727dc73b8dab30caa53`；本輪 audit／save 證據位於私人 `work/reports/type-expansion`。

2026-09-18 Math／TD helper／Noise 與選取操作：完整可攜檢查通過（313 Python tests、628 個雙語字串、editor launch／metadata／JS model／Remote Panel checks）。本機 TD 2025.32820 的基本數學 77、TD helper 97、Noise 54 項，共 228 項原生檢查通過；涵蓋 TOP Pixel、MAT Pixel／Vertex、實際數值、常數界線、Noise 品質模式。此結果不代表 Metal／AMD 硬體已驗證。

瀏覽器新增基本數學 8、TD helper 5、Noise 7、選區拉點 8、收合工具 6 組檢查。拉點涵蓋八方向、不同尺寸、對側錨點、3,200 組幾何、取消／Undo／觸控；收合工具涵蓋混合狀態、按鈕停用、設定保存、唯讀、Note／Group 及窄螢幕。既有 node collapse 9、selection toolbar 12、UI experiments 19 組在合併後通過；畫面截圖已檢視。自動排列程式未改。

新節點 browser tests 自動匯出最新 catalog fixture。選區測試與其他共用 harness 的測試應先使用 `python tests/browser/export_editor_fixture.py tests/fixtures/editor-state.json <current-state.json>`，再傳入該 current-state；舊靜態 fixture 沒有 Note 等後續節點，不能直接作為這些案例的 catalog。

各批完成都已同步並保存 TD；最終 31 份內嵌來源及 9 份服務資源一致，TOP／MAT Master current、core 無錯誤。正式 TOE 799,060 bytes，SHA-256 `74fbff4ff05e552d7947c5cc071e89cbecd5994952e0819b762f0db0accba2ed`；私人開發助手排除。私人報告位於 math-node-round。

2026-09-18 Compare／If browser projection 補正：控制節點檢查擴至 10 組，實際驗證 Logic 分類、comparison／branch／ternary 搜尋、正確說明及瀏覽不改圖／歷史；browser metadata integration、606 個雙語引用、語法與 diff 檢查通過。TD 再同步保存，31 份來源／9 份資源一致，兩份 Master current、使用者 Shader 保留。正式 TOE 775,964 bytes，SHA-256 `c78952d4de8faeeb8d2b3247493de6da4a06cfcff5f51ff52ac0645feebe9e12`；報告位於 control-node-browser-metadata-round。

本輪最終同步並保存 TD：31 份內嵌來源、9 份服務資源一致，TOP／MAT Master current，兩份使用者 Shader 保留，core 無錯誤，現有 Editor 未強制重載。正式 TOE 775,884 bytes，SHA-256 `18bea942f6cc14945a9d96fd4390ad62238c38d26e851358f2e8a9da7c434843`；私人助手排除。最終原生報告位於 clipboard-focus-round 的 refresh／audit／save；Note／排列中途保存報告位於 note-layout-round。

2026-09-18 剪貼簿焦點：新增 `test_clipboard_keyboard.cjs`，修正前以實際 Ctrl＋C 和 trusted copy event 重現「Note 文字 range 殘留後點選節點，節點複製未執行」。修正後 8 組通過，涵蓋點選、已選節點拖移、群組框、Ctrl＋V 及單次 Undo；Note／input 文字事件仍保留原生處理，navigator.clipboard 呼叫為 0。測試僅重導事件的資料至隔離 DataTransfer，不讀取主機剪貼簿。群組框 13 組、Markdown 9 組及 edit-shortcuts 10 組回歸通過，零頁面錯誤。

2026-09-18 自動排列雙方向與零散節點：auto arrange 15 組、shortcut help 7 組及選取工具列 12 組通過，零頁面錯誤。涵蓋原來源排列精確座標、逆向短支路、多末端、循環、接孔順序、邊儲存順序、兩方向共用的孤立節點換行／全孤立 3×3、實際尺寸、重複穩定、單步 Undo／Redo、唯讀及 L／Shift＋L 的輸入／彈窗隔離；選取工具列另驗證手機尺寸與 UI 縮放。606 個雙語引用通過，排列截圖已檢視。

2026-09-18 Note 尺寸優化：resize 14 組、appearance 16 組、Markdown 9 組及基本節點 8 組通過，零頁面錯誤。尺寸測試包含普通文字／H1／code／無序清單／有序清單 × 1／4／10 倍 × 四種外觀共 60 種組合，以及拖曳、取消、Undo／Redo、實際編輯提交、JSON 保存、縮放、水平與垂直捲動。10× 普通文字下限減少 90px，H1 及 code 仍容納完整一行；畫布清單最後一項去掉多餘尾端 margin，避免單行清單仍產生捲動。預設與手動高度保持，截圖已檢視。報告位於 note-size-round。

2026-09-18 Compare／If：新增 browser `test_control_nodes.cjs`，由目前 core 匯出獨立 fixture，9 組通過且零頁面錯誤；涵蓋真實新增與拖線、六種比較方式、bool 未接值、型別推導／鎖定、非法接線不改圖、整數驗證、Undo／Redo、共用 Parameter 排版及唯讀。相關 numeric scrub 32 組、numeric touch 20 組、Parameter 15 組、select menus 11 組通過；截圖已檢視。報告位於 control-nodes-round。

完整 portable checks 通過：297 項 Python unit（含新 control unit 及執行真實 JS 型別／交易模型後再由 Python 編譯的往返測試）、既有 JS model、26 項 remote-panel、604 個雙語引用、14 項 editor-launch 及 14 項 browser metadata。原有 138 個编譯指紋不變；既有兩處 legacy catalog baseline 僅排除新增 Compare／If 定義，未更改原 expected hash。

新增隔離 TD `test_control_nodes.py` 共 67 項 TOP／MAT 通過，包含六比較運算兩種結果、If 四型別兩分支、Uniform 即時改值、int／uint／bool Spec 覆寫往返且 GLSL 兩側仍保留、編譯失敗保留 last-good Shader／像素，以及 MAT Vertex Compare→If。測試區與測試 manager 已清除，兩份使用者 Shader 保全。這是 Windows／NVIDIA 上的編譯與輸出語意驗證，不是死碼消除、效能或 Metal／AMD 的實測。

TD 已同步並保存：31 份內嵌來源、9 份服務資源一致，TOP／MAT Master 的新 catalog contract 已明確同步，兩份使用者 Shader 內容不變；core 無錯誤。正式 TOE 774,484 bytes，SHA-256 `cea7f08483bdc831511ea163699cc1fe23dded0d9870a7e5bc262e5ea351041f`；私人助手排除，既有 Editor 未重載。原生報告位於 control-nodes-round 的 native／masters／audit-final／save。

2026-09-18 透明 Note 回歸補強：先以實際內文 `::before` 的 border／box-shadow 檢查重現問題，修正前即失敗；先前只檢查節點本體的透明狀態，漏掉真正繪製圓角表面的偽元素。此次加入深淺色、Professional／Excellent／Godlike，以及 hover／選取提示的檢查，Note 外觀 15 組全過，零頁面錯誤。兩個未選取透明 Note 的截圖已目視確認沒有外框與陰影，報告位於 note-transparent-fix 的 before／after。

已同步並保存 TD：31 份內嵌來源／9 份服務資源一致，TOP／MAT Master current，兩份使用者 Shader 保留。正式 TOE 767,428 bytes，SHA-256 `7aa00286ae2c72e3d8c6d8b2f3e621279c9d583653c910a4f2f7c6ac11543eec`，私人助手已排除，既有頁面未重載。

2026-09-18 Note 試用修正與字級：外觀 15 組、尺寸 11 組、群組框 13 組及選取工具列 12 組通過。涵蓋深淺色下改色／透明還原真正預設底色、原位標題與不變的內文幾何、正常圓角、設定分頁與畫布快捷同步、190×110 一般／190×90 透明 Note 的單行 H1、透明四邊留白減半且尺寸資料不被改写。字級檢查包括 1／2／10 倍、輸入上下限、原字級的標題與編輯區、滑桿半寬行程、端點反向立即調整、取消及精確一次 Undo／Redo，並確認圖檔／剪貼簿持續保存而不改 Shader；零頁面錯誤。新畫面截圖已目視，報告位於 note-correction-round，群組框報告位於 note-settings-group-palette。

共用數值操作回歸：numeric scrub 32 組與 numeric touch 20 組全過。首次執行遇到 capture loss 事件尚未派送及 blur 後非同步重建 DOM 的測試時序問題；以 HEAD／現行版相同診斷測試比對確認，再只修正測試等待方式，不變更產品的取消／觸控行為。前者釋放 capture 後送下一筆真實 pointer move，後者 canvas focus 後等待既有 settle 再量測替換的欄位。診斷證據保留於 numeric-diagnosis，最終原測試報告位於 note-correction-round。

本次同步並保存 TD：31 份內嵌來源／9 份服務資源一致，TOP／MAT Master current，兩份使用者 Shader 保留且未重載現有頁面。正式 TOE 767,460 bytes，SHA-256 `31c9dd2f8b537a658869397673885d00ccefb45d1a221970e6065549de72b78d`，私人助手已排除。JavaScript 語法、601 個雙語引用及 diff 檢查通過，原生報告位於 note-correction-round 的 refresh／audit／save。

2026-09-18 Note 外觀：新增 `test_note_appearance.cjs` 11 組通過，涵蓋標題浮層幾何不變、色盤／透明單步 Undo／Redo、深淺色、拖動隔離、收合恢復、JSON／剪貼簿、唯讀、190px 自訂名稱排版及觸控／鍵盤；沒有 Shader 或 UUID／版本變更。測試找出的 Undo 後按鈕停用問題已修正：渲染不把暫時 historyBusy 固化到 disabled，操作仍由共用 mutation guard 保護。既有節點 8 組、Markdown 9 組、尺寸 9 組、選取工具列 12 組與群組框 13 組回歸通過，零頁面錯誤；窄版及深淺色截圖已目視。報告位於 note-appearance-round 與 note-shared-palette-frames。

色盤最終補充檢查涵蓋中英文與桌面／390px 觸控 4 種組合，左下自訂色與右下透明均無溢出，透明標題色點顯示棋盤格；桌面英文依預期省略，完整名稱保留於提示及無障礙標籤。Footer 新順序在桌面與窄版保持，按鈕無重疊。報告及截圖位於 note-appearance-round/palette-final。

本輪已推送並保存 TD，31 份內嵌來源／9 份服務資源一致、TOP／MAT Master current、兩份使用者 Shader 保留。正式 TOE 765,316 bytes，SHA-256 `d4792b5e138f71dff03a1af8b94f777e09d3d57a2dcb40b401bc5b6d94e85c8d`，排除私人助手，未重新整理既有 Editor。JavaScript 語法、596 個雙語引用與 diff 檢查通過；原生報告位於 note-appearance-round 的 refresh／audit／save。

2026-09-18 Comment 共用寬度下限：resize 9 組通過，確認縮小限制為一般節點共用的 190px、繼續向內拖曳不增加歷史、既有 120px 保存值在顯示與 JSON 重載時以 190px 呈現且不重寫資料；窄版截圖已目視。更新並保存 TD，31 份內嵌來源／9 份服務資源一致、兩份使用者 Shader 保留。TOE 763,668 bytes，SHA-256 `d7059557983a054b1b239b4b159402df7abcf8648a815ab29fefb60a2eb96e10`。報告位於 comment-shared-width-round。

2026-09-18 Comment 寬度解除：`test_comment_resize.cjs` 9 組通過，涵蓋縮至 120×130 並經 JSON 重載、縮放座標換算、一次 Undo／Redo、取消／唯讀／觸控及一般節點仍只改寬度；窄版截圖已目視。報告位於 comment-width-round。沒有新增自動折行或固定預設寬度，也未改高度規則。

追加設定及寬度修正後再次刷新並保存 TD：31 份內嵌來源與 9 份服務資源核對一致，兩份使用者 Shader 保留、TOP／MAT Master current；沒有重載現有 Editor。TOE 763,636 bytes，SHA-256 `a880e451074e62d8cdc0801a74db9de78947874ac55bfe462d405866f0ad8ddf`，排除私人助手；原生報告位於 frame-outline-setting 的 refresh／audit／save。

2026-09-18 群組輪廓顯示設定：選取工具列 12 組、設定面板 19 組瀏覽器檢查通過，零頁面錯誤。涵蓋所有工具列模式、常態／互動輪廓、完整／部分／混合／跨群組、單一剩餘成員、唯讀、即時切換、偏好保存／重設、雙語及窄版觸控；圖與 Undo 不變。593 個雙語引用檢查通過。報告位於 frame-outline-setting；新增設定使窄版面板變高，外部點擊測試改為驗證後點擊面板外的視窗角落，避免誤點被面板遮住的主標題。

2026-09-18 群組成員移入：新增 `test_group_membership.cjs` 6 組全過，使用真實群組標題點擊＋Ctrl 加選外部／其他群組成員，再用按鈕或 Alt＋Shift＋G 移入。涵蓋選取 3 對 2（目的群組總人數較少且存放順序在後）、1 對未分組、同票／無目的地／已全在目的地時隱藏且不執行、未選成員保留、移空框、值／位置／接線及一筆 Undo／Redo、唯讀／文字編輯隔離。追加後群組框 13 組、選取工具列 11 組、快捷鍵列表 7 組回歸全過，零頁面錯誤。報告位於 frame-membership-round。

本輪色盤／輪廓、移出與移入均分批推送並保存 TD。最後核對 31 份內嵌來源及 9 份服務資源與工作樹一致，TOP／MAT Master current，兩份使用者 Shader 保留；未重新整理現有 Editor。正式 TOE 763,244 bytes，SHA-256 `f9f3b22fcbc9b452492685c7b81ce973e46b31effe0dc7008859aa4b46a84bd3`，排除私人助手。最後原生報告位於 frame-membership-round 的 refresh／audit／save。

2026-09-18 群組操作追加：既有群組框瀏覽器檢查擴至 13 組，包含單一／跨框成員移出、剩一人／空框、位置與接線保留、一次 Undo／Redo、唯讀／空選取，以及 Ctrl＋G／Ctrl＋Shift＋G／Alt＋G 的實際鍵盤分工與名稱輸入隔離。選取工具列 11 組、快捷鍵列表 7 組、自動排列 11 組均通過，零頁面錯誤。色盤隔離探針另有 14 組，涵蓋預設色／自訂 change、同色不增歷史、舊 session 拒絕、關閉方式、鍵盤與 Chromium 觸控、中文環境英文預設名、窄版／縮放定位；自訂系統選色器以 stub 驗證呼叫與提交，未操作實體 OS 選色視窗。

選取圓角探針 3 組通過，包含 12 組 UI 75／100／125% 與畫布 25／50／100／150% 的四邊等距及圓心一致、混合／跨群組／部分成員恢復一般輪廓、工具列 hover 共用輪廓；前後角落與色盤截圖已目視。JavaScript 語法、591 個雙語引用及 diff 檢查通過。私人報告位於 frame-outline-round、frame-controls-round、frame-palette-round。這批沒有更動 shader 產碼契約。

本輪收尾回歸：群組框 10 組、Editor chrome 16 組、自動排列 11 組全過，零頁面錯誤。包含 CDP 真實觸控拖移群組標題（全體成員同移、一筆 Undo、pan 不變）及框內空白命中穿透後的實際滑鼠平移（圖與歷史不變）。本輪相關瀏覽器檢查共 85 組；實體 iOS Safari 未測。

同輪註記入口修正：`test_node_notes.cjs` 3 組通過，逐一涵蓋 Constant、Uniform、Spec Constant、Sampler、TOP Input、一般節點及 GLSL Code 的分頁、編輯／取消／Undo／Redo、來源資料隔離、跨節點切換、唯讀、雙語及 Comment 原文內文例外。`test_parameter_values.cjs` 15 組既有輸入行為回歸通過。舊 `details` 入口已移除，沒有改註記的既有成碼語意。

本批更新並保存 TD，31 份內嵌來源及 9 份服務資源與工作樹相同，兩份 Master current、兩份使用者 Shader 保留。正式 TOE 757,884 bytes，SHA-256 `d804a2ff53030f2754d539d4b5800a35ba63d94193f70169a0c18e02934e243b`；私人助手已排除，未重新整理使用者現有 Editor。私人報告分別位於 group-frames、persistent-selection-bounds、persistent-selection-experiments、notes-tab-node_notes 及 notes-tab-parameter_values。

2026-09-18 群組框／常態多選框：完整 portable runner 通過，包含 288 個 Python 測試、591 個雙語引用、14 個 Editor Launch 測試、metadata／品牌檢查、9 支 JS 模型腳本與 26 個 Remote Panel 測試；138 份舊圖的編譯 fingerprint 保持相同。新模型測試驗證不合法成員／色碼／名稱、框 ID 重映、部分與完整剪貼簿、函式庫、子圖轉換及清理空框，UI metadata 不影響編譯或 Shader dirty。

隔離 Chromium 的 `test_group_frames.cjs` 驗證建立、名稱／改色、一次 Undo／Redo、圖與 UI 縮放下整組拖移、取消、成員移動／resize 即時跟隨、刪除後剩一個／零個、移除框保留節點、唯讀、重複成員限制、剪貼簿及子圖／Stage 隔離。獨立檢閱另外實測拖移途中切 Stage、readonly、Undo 及失效舊色彩欄位事件，均未改壞圖或新增歷史。桌面截圖已目視。

`test_selection_toolbar.cjs` 11 組與 `test_ui_experiments.cjs` 19 組通過，零頁面錯誤。涵蓋常態多選框的預設關閉、持久化、重設、繁英排序、工具列關閉時仍顯示、單選／離屏隱藏、縮放與無圖資料／歷史副作用。

2026-09-18 Comment Parameter 原文編輯：既有 Comment nodes 8 組、resize 9 組、Markdown 9 組共 26 組通過，零頁面錯誤。參數頁直接顯示原始 textarea，提交／取消後仍保留輸入欄位，畫布 Markdown 與 Undo 同步；以實際面板分隔線調大／縮回驗證輸入框自動填滿、說明留在底部且未改圖或歷史。長文可在欄位內捲動，唯讀保持可見而不可編輯；深灰類型色與深／淺色截圖已目視。582 雙語引用、JS 語法及 diff 檢查通過，未重跑無關 portable tests。

已更新三份 TD 來源並保存 TOE，30 份來源與 8 份服務資源一致、兩份 Master current、兩份使用者 Shader 保留。TOE 752,364 bytes，SHA-256 `d018f7d0c3f751f7d18443c4bef8704fe9fa2e0637e8e864e38d358ac4a37ed8`。未重新整理現有 Editor，私人報告位於 comment-parameter-source。

2026-09-18 Comment Markdown：`test_comment_nodes.cjs` 8 組、`test_comment_resize.cjs` 9 組、`test_comment_markdown.cjs` 8 組通過，零頁面錯誤。涵蓋雙介面的閱讀／編輯、失焦／快捷提交、取消、草稿重繪及改回原值後不誤重開、一次 Undo／Redo、resize 保留草稿、HTML／危險 URL 不可執行、安全連結的隔離 popup、GLSL 原文與語法色、唯讀及雙點觸控。主圖與子圖的 Comment 增刪／文字／尺寸皆不標 Shader 變更，普通節點註記仍保留語意判斷。

隔離 Chromium CDP 實測閱讀長文、textarea 垂直捲動及 GLSL pre 水平捲動，不改圖 pan／scale／Undo；一般畫布拖移與雙指縮放維持正常，visualViewport.scale 保持 1。深／淺色截圖已目視，明亮模式程式區塊正文對比 11.41:1，token 最低 5.07:1。5 項 Comment Python 測試、既有 Editor save status、582 雙語引用及語法／diff 檢查通過；原 GLSL renderer 抽共用 fragment 前後 DOM／原文字串一致。未重跑整套 portable runner，實體 iOS Safari 未測。

本批刷新五份來源並保存 TD，30 份來源／8 份服務資源一致、兩份 Master current、兩份使用者 Shader 保留，未刷新使用者既有 Editor。TOE 742,004 bytes，SHA-256 `14fa84f35efe2b4c75653af1cb85af56dc49da7cecfc6b6fa934794b2a8c4107`。私人報告目錄為 comment-markdown-round。

2026-09-18 置中選取：`test_selection_toolbar.cjs` 擴為 10 組、`test_editor_chrome.cjs` 16 組通過，零頁面錯誤。新增三態下唯一按鈕與顯示條件、選取子集合排除遠處未選節點、單選／高 Comment／收合實際尺寸、唯讀可用、零選取／選線 no-op；保留非空 Undo／Redo、圖、選取與 dirty 狀態，原 Frame all／H 不變。繁英 title／aria-label、觸控 320／390 直向與 844 橫向、100／125% UI 縮放可達；六按鈕在最窄配置依既有分組靠右換行。桌面與窄版截圖已目視，更新既有工具列按鈕名單預期及只對可見按鈕檢查同列，無放寬操作斷言。語法及 diff 檢查通過。

本批已刷新四份來源並保存 TD；30 份來源／8 份服務資源一致、兩份 Master current、兩份使用者 Shader 保留，既有 Editor 未刷新。TOE 739,532 bytes，SHA-256 `5a6821fcc49721eab88738579f9cdb8167cee009d7a88abe0b7ab6f7a46b1eec`。報告在私人 frame-selection 與 frame-selection-toolbar。

2026-09-18 自動排列 L 快捷鍵：`test_auto_arrange.cjs` 11 組、`test_shortcut_help.cjs` 7 組與共用 H 範圍的 `test_editor_chrome.cjs` 16 組通過，共 34 組、零頁面錯誤。實際按 L 沿用精確 Undo／Redo、只改座標與穩定性驗證；修飾鍵 L 未攔截，文字／contenteditable／IME、非圖面焦點、長按、唯讀／忙碌、零／單選、對話框／popover、數值／接線／移動／縮放／觸控手勢皆不誤觸。選單與快捷鍵清單中英文短名稱、title、aria-label／aria-keyshortcuts 一致；H 的實際拖曳及平移保護仍通過。語法及 diff 檢查通過。

本批已刷新四份來源並儲存 TD，30 份來源／8 份服務資源一致、兩份 Master current、兩份使用者 Shader 保留；既有 Editor 未刷新。TOE 739,364 bytes，SHA-256 `f534fcc9bf06536fa43a1398b34b8eb98b0cab4613a66f4f5090883dd89563f6`；報告位於私人 auto-arrange-shortcut 與 auto-arrange-shortcut-help。

2026-09-18 自動排列接孔順序修正：`test_auto_arrange.cjs` 擴為 9 組通過，零頁面錯誤。新增節點建立／接線插入各正反順序的組合，驗證下游 a／b Input、Split X／Y Output、跨上游鏈的順位傳遞與收合節點；各例繼續核對只改位置、一次精確 Undo／Redo、重複穩定與 Shader 語意不變。以私人舊來源副本重現原版在第一個接孔順序案例失敗，修正版通過。獨立檢閱的 1,000 組帶接孔、循環與複數接線的隨機圖亦通過穩定／無重疊／有限座標／輸入不變檢查。語法與 diff 檢查通過。

本批更新 `selection_ui_js` 並保存 TD，30 份來源及 8 份服務資源一致、兩份 Master current、兩份使用者 Shader 保留，既有 Editor 未刷新。TOE 739,124 bytes，SHA-256 `01b6fafde6e40c125b223c79e8d7f38fbd9182d155b31b347f130949d8ebf081`；報告在私人 auto-arrange-port-order。

2026-09-18 自動排列與選單分組：新增 `test_auto_arrange.cjs` 6 組、既有 `test_selection_toolbar.cjs` 8 組通過，零頁面錯誤。涵蓋選單入口、鏈／菱形／合流／多來源、實際不同尺寸、獨立區塊與高 Comment、局部選取、其他圖層／未選節點保持、只改座標與 Shader 語意不變、一次精確 Undo／Redo、重複排列穩定且不加歷史、唯讀與單選限制；純排版器另驗證循環、自接線、懸空端點及空／單節點。既有窄畫面觸控排列與視窗邊界檢查通過。獨立檢閱以 1,000 組隨機圖檢查有限座標、無選取節點重疊、重複一致與輸入資料不變，均通過；語法及 diff 檢查通過。

本批已刷新 3 份來源並保存 TD，30 份內嵌來源／8 份服務資源一致、TOP／MAT Master current、兩份使用者 Shader 保留；既有 Editor 未重新整理。TOE 738,980 bytes，SHA-256 `d652dac04be062590a7acc19f0bd73dcfd8d10d5697efa3bf8b677e4d6735cdc`。隔離瀏覽器報告及 TD 交付紀錄在私人 auto-arrange 目錄。

2026-09-18 選取工具列緊湊與上下置中：既有 selection toolbar 增補上方／下方／兩邊不足三種定位情境後 8 組通過；Comment resize 9 組通過，置中位置隨節點寬度變化的一半移動。私人 A/B 瀏覽器量測確認五顆 16×16 圖示完全相同，滑鼠工具列 205×46→163×36、觸控 245×54→203×44；截圖已目視，沒有新增正式樣式鏡像測試。原三種模式、Paste、鍵盤、觸控及窄版操作保留，零頁面錯誤。

已核對 30 份內嵌來源、8 份資源快照及修改後兩份 HTTP 內容，兩份 Master current、兩份使用者 Shader 保留。TOE 737,636 bytes，SHA-256 `d6906816b934ce7fe89fd99ba9bb0cca9ef79c0bb854570518dbb79193b4a980`；私人助手排除，既有 Editor 未重新整理。

2026-09-18 選取工具列位置／註解底色修正：選取工具列 7 組及 Comment 縮放 9 組依橫向右上規則重驗通過，含 320／390px 與 844px 橫向、100／125% UI 縮放、左右鍵導覽、群組換行、尺寸／Undo／拖曳跟隨。私人閱讀／編輯探針確認未聚焦透明底、聚焦輸入底，幾何與 graph 不變；截圖已目視。極矮視窗若上方空間不足，工具列優先限制在畫布可視區。未新增樣式鏡像測試。

最後再次核對 30 份內嵌來源、8 份服務快照及修改後 HTTP 資源，兩份 Master current、兩份使用者 Shader 保留。最終 TOE 737,476 bytes，SHA-256 `9cca12f7233921faa6f4c8831a9aea4c8b4e555ca46b44fad09e779181d1b846`。以下各次 TOE 大小與 hash 均為當時的小批次紀錄。

2026-09-18 Comment 雙向縮放追加：`test_comment_resize.cjs` 9 組、既有 `test_node_width.cjs` 15 組通過，Comment 核心 5 項再驗證通過；前述 66 組加上本批共 90 組瀏覽器檢查。新測試涵蓋兩軸手勢預覽／一次 Undo、介面及圖縮放換算、130–1200 高度限制、clamp 後無變更不建歷史、Escape／失焦／取消／capture loss、可信任觸控、文字草稿、收合恢復、剪貼簿與 JSON 往返、唯讀、一般節點仍只調寬及選取工具列即時跟隨。實際滾輪令 textarea 捲動且圖 scale 不變，保留原生預設捲動。修正 graphContent 排除 ui.height，並補主圖／子圖存檔狀態回歸；580 雙語引用、語法及 diff 檢查通過。

最終五批已推送並各自保存 TD，30 份內嵌來源／8 份 HTTP 服務資源一致，TOP／MAT Master current；最終 TOE 737,436 bytes，SHA-256 `7e992b3c88fceffa570e3369297e71a221124a2c54a31d0bfcefd82ceadb9f6f`。兩份使用者 Shader 保留、私人助手排除，既有 Editor 分頁未重新整理。報告與截圖位於私人 toolbar-round 與 comment-node；實體手機／Safari 仍未測。

2026-09-18 編輯工具列與註解節點（0.8.84）：新 selection toolbar 7 組、shortcut help 6 組、Comment 8 組；既有 experiments 19 組、edit shortcuts 10 組、editor chrome 16 組，共 66 組 Chromium 瀏覽器檢查通過且零頁面錯誤。選取工具列涵蓋三態與 0／1／多選、共用 DOM 按鈕、獨立開關、滑鼠離開後框線消失、鍵盤 Tab 不誤開 Creator、方向鍵／Escape、圖縮放與畫布定位、六種對齊、實際尺寸間距、一次 Undo 精確還原、唯讀／忙碌／選取改變及觸控。額外 24 組 viewport／UI scale／工具列底色配置通過。快捷鍵清單驗證深淺色、繁英、Mac 提示、320／390／1600px、75／125% 與短橫向畫面；關閉鈕保持可操作。

Comment 驗證畫布及 Parameter 草稿、換行、提交／取消／Undo、複製貼上／刪除、收合、唯讀、子圖擷取與可攜函式。完整 portable runner 通過：284 Python tests、579 個雙語引用、14 Editor Launch tests、瀏覽器 metadata／品牌資源、8 支既有模型腳本與 26 Remote Panel tests；保留全部 138 個歷史 compiler fingerprints。測試基礎補齊既有 touch code 需要的 document/window listener mock，更新新增 Comment 對 catalog 集合的預期；未放寬版本／安全契約。edit shortcuts fixture 清除初始 busy，沿用現有 38／34px 響應式按鈕規則；chrome 分組預期改為已確認的新結構。

四個小批次（齒輪／快捷鍵／Comment／選取與排列）各自更新 TD 並保存 TOE。選取批次核對 30 份內嵌來源、8 份 HTTP 服務資源一致，TOP／MAT Master current，使用者兩份 Shader 保留，私人助手未存入 TOE。該批 TOE 737,068 bytes，SHA-256 `45b43068a907e1a421cfa57473180dac7255b6201269751bda55c5bdd6f171b4`。未重新整理使用者現有 Editor；實體 iOS Safari 未測。後續追加高度調整的驗證與最終 TOE 記錄另列。

2026-09-18 Node／Parameter 觸控數值（0.8.84）：新增 `test_numeric_touch.cjs` 20 組通過，採隔離服務及可信任 Chromium touch dispatch。涵蓋兩處單點不 focus／雙點高精度輸入、水平預覽／一次提交及 Undo／Redo、450ms 階梯無 focus、一般 render 保留手勢、真正 capture loss、第二指與 pointer cancellation 還原、不殘留雙點狀態、已聚焦文字原生操作、垂直捲動／平移、唯讀及同裝置滑鼠行為。向量 X 文字草稿在觸控調 Y、調值中與結束後 render 時，緊湊／展開副本均保留；Y 只提交一次，X 待明確 Enter 才另建 Undo。

修正可信任觸控查出的 input 內部控制轉移 capture 到 input host 被當成取消，以及 Parameter 更新覆蓋另一分量文字草稿的問題。既有 `test_numeric_scrub.cjs` 32 組、`test_parameter_values.cjs` 15 組、`test_numeric_presets.cjs` 7 組回歸通過，共 74 組，零頁面錯誤；JavaScript 語法與 diff 檢查通過。報告位於私人 work/reports/numeric-touch 及 touch-numeric。桌面模擬不證明 iPhone 鍵盤、Safari focus zoom 或原生 pinch 的實機行為；後三者不在本輪修改範圍。

TD 更新 inspector_js／style_css／locales_json，28 份內嵌來源與三份修改後服務資源一致；正式 TOE 723,820 bytes，SHA-256 `15c0e1088046036274c058fcc25a099f78c41eaaac83595e37a491471177609e`，兩份使用者 Shader 保留、私人助手排除，既有瀏覽器分頁未重新整理。

2026-09-18 浮動工具列預設與窄版排版（0.8.84）：既有 test_ui_experiments.cjs 19 組、test_editor_chrome.cjs 16 組通過。驗證首次／缺少值／Reset 為浮動、明確 false 經重載仍保留、原 DOM 搬移、模式／草稿／圖／歷史及 focus／fullscreen／重載保護。私人 floating-toolbar/mobile-layout 5 組通過，含 320／390／430px × 繁中／英文 × Standard／Comfortable × 100／125% 的 24 種組合：每排命令齊右、Stage 與 navigation 下方同行、無重疊／水平溢出；390px 子圖路徑與 1500px 螢幕內 410px 畫布同規則。停用控制 opacity=1、背景 alpha=255 且深色比啟用按鈕暗；可信任 Chromium touch 僅觸發一次，停用控制不平移画布，圖／Undo 保持，零 API POST／頁面錯誤。三張截圖已目視。實體 iOS Safari 未測；未新增正式樣式鏡像測試。

JavaScript 語法及 diff 通過。TD 僅更新 graph_ui_js／style_css，28 份映射來源與服務一致、兩份 Master current；正式 TOE 720,780 bytes，SHA-256 5556653847c7b36023e1bf882ff4d1feb1849b7787b317e1f62d97b130fd2396，保留兩份 Shader、排除私人助手，既有瀏覽器分頁未重新整理。

2026-09-18 互動過渡清除核對（0.8.84）：確認 src/editor 無舊 --ui-glow-duration、--cool-filter-off 或子元素 shadow／filter transition。私人 ui-style/professional-error-outline 兩組檢查通過：使用同一隔離 Chromium fixture 對照 90b4d17 與目前 CSS，Professional 的 error／selected.error 可見陰影、邊框及幾何一致，操作 transition 為 0s；Cool 選取錯誤光暈與 Excellent 錯誤光暈保留，零頁面錯誤。修正僅兩條 Professional 外框規則。原六組模式／即時操作探針與測試結果保留，可重跑；這些視覺腳本位於私人 work，未加入產品執行依賴。28 份來源／服務一致，兩份 Master current。正式 TOE 720,740 bytes，SHA-256 357072fc7a423a710b80384cfa579dfcb81f580603c5f82371583451267ef6ca；保留兩份 Shader 並排除私人助手，既有頁面未重新整理。

2026-09-18 模式過渡與即時操作（0.8.84）：私人 `ui-style/mode-only-transition` 探針 6 組通過。Professional／Cool／Excellent 六方向切換在 250ms 實采模式強度約 0.408／0.592，1.1 秒已到目標；Cool 選取／取消、Excellent 按鈕開關及 Apply enabled／disabled 在同一 task 與第一 frame 已對應當下模式強度，過渡途中也無操作本身的額外淡入。實際滑鼠移入／移出接線立即更新，過渡中 alpha 等於當下 level × 33%，無 filter transition。Legendary／Godlike 兩點抽樣仍持續動態；Light 五模式相同，減動態立即切换並停止動畫。11 個節點及 10 條接線 DOM、graph／history／dirty 保持，零 API 寫入與瀏覽器錯誤；截圖已目視。只用私人探針，未新增正式樣式鏡像測試或重跑效能。

555 個雙語鍵及 diff 檢查通過；TD 的 style_css／locales_json 已同步，28 份內嵌來源與服務內容一致、TOP／MAT Master current。正式 TOE 為 720,660 bytes，SHA-256 `6cd4ad277ace852ac4c84c7474242cbe8667bd4d4af3416aee0fc421a7cd27c2`，保留兩份 Shader、排除私人助手，現有編輯頁未重新整理。

2026-09-18 光暈分級修訂與 CSS 動畫（0.8.84）：既有 `test_ui_experiments.cjs` 19 組通過，涵蓋五種風格即時切換／保存／重載／重置／舊偏好，沿用時鐘測試，且純模式／時鐘／主題切換保留節點、Parameter、工具列與接線 DOM、圖／Undo／幾何。私人 Cool 範圍與過渡探針確認只有彩色接線、選取框、葡萄圖示與 Apply 發光，普通節點／名稱／接孔保持原貌；減少動態效果和 Light 保持預期。報告分別位於私人 work/reports/ui-style/five-tiers-experiments 及 cool-scope-motion。

最後 `legendary-godlike-motion` 私人探針 5 組通過：Legendary 的減動態範圍等同 Excellent，4 秒實采 alpha 33.11–49.85%；Godlike 4.8 秒實采四象限，節點偏移半徑 7px、接線／圖示 2.8px、名稱 2.1px，固定 alpha 50%，顏色／blur／幾何不變。首秒入場及退出各模式均為 1 秒；Light 停用動畫，減動態 Legendary 33%、Godlike 50% 居中靜態。Graph／歷史／DOM 保持，零頁面錯誤／API 寫入，主頁及 About 截圖已目視。沒有新增正式樣式鏡像測試或執行效能量測。

驗證中處理兩項過渡問題：動畫先等待一秒淡入，再讓每幀陰影直接更新，避免 CSS transition 不斷追逐新值；Chromium 的 none→color-mix drop-shadow 插值會出現暗色中途影格，改用同色彩模型的透明零模糊濾鏡作關閉端點，250／500／750／1000ms 像素與參考一致。555 個雙語鍵、JavaScript 語法及 diff 通過。28 份內嵌來源與服務一致、TOP／MAT Master current；正式 TOE 720,748 bytes，SHA-256 `5e493e926e65fd99ca7339a5c1885f157c65d19d40d5b0969a0bea6b286ca924`，保留兩份 Shader 並排除私人助手，未重新整理現有編輯頁。

2026-09-18 表現能力分級、Parameter 與時鐘（0.8.84）：既有 test_ui_experiments.cjs 19 組通過，覆蓋 12 項設定／10 checkbox／2 select，三種風格的即時切換／保存／重置／舊偏好與 DOM／草稿／幾何／Graph／Undo 保留；時鐘本機 HH:mm、Fullscreen 前方位置、Focus 無副本、整分鐘與午夜切換、單一 timer、visibility 刷新及停用清理通過；320／390px、75／125% 與 Dark／Light 的時鐘及全螢幕按鈕均在 Footer 範圍內。首次 timer spy 未綁定 window 造成 Illegal invocation，修正測試後重跑通過，非產品問題。私人 Glow VISUAL_ONLY 6 組通過：Dark Cool 僅圖與品牌，Excellent 加介面，Light 三款完全一致；節點展開／收合／選取／錯誤保留，About 實際開關並驗證圖示主標題光暈，小字不亮，截圖已目視。

既有 test_parameter_values.cjs 15 組、私人 Texture2D／TOP Input／UV 排版 12 組通過（一般／長來源 × UI 75／100／125% × 面板 300／640px）：sampler2D 完整單行、欄位對齊、長來源省略及全文 title、斷開按鈕位於值欄，重複來源名去重而不同 port 標籤保留。零頁面錯誤／API 寫入，52 組總計；553 個雙語鍵、JS 語法及 diff 通過。未重跑效能。

28 份內嵌來源與服務一致，TOP／MAT Master current；正式 TOE 719,828 bytes，SHA-256 `09ff7efc305d30e5ad28b5ec7d9d52d89417c410a774937cf740ffc8528f5c06`。兩份使用者 Shader 保留、私人助手排除，未重新整理使用者現有編輯頁。

2026-09-17 整顆節點外光（0.8.84）：私人 VISUAL_ONLY 探針 5 組通過並目視 2000×1200 截圖。驗證節點整體分類色外光為 33%／20px／1px、Title 不另加陰影、灰底與幾何不變、名稱／Inputs 規則保留；展開與收合的普通／選取／錯誤／兩者並存状态均維持分類光暈及原狀態框。Light Professional／Cool 完全一致，工具列實際切換正常，零瀏覽器錯誤／API 寫入。550 個雙語鍵與 diff 檢查通過；未重跑效能。28 份內嵌來源與服務一致、兩份 Master current。正式 TOE 719,132 bytes，SHA-256 `8c6620aaf7dd958bdab5feaa7e53b6305544bb93177a7b32a45001a2a9924f68`；保留兩份使用者 Shader、排除私人助手，未重新整理現有編輯頁。

2026-09-17 Cool 外光風格（0.8.84）：既有 `test_ui_experiments.cjs` 擴為 17 組，驗證 11 項設定（9 checkbox、2 select）、Professional 原預設、Cool 即時切換、舊偏好缺少 style 時回預設、無效值、保存／重設、控制項 DOM／草稿／幾何／Graph／Undo 保留與雙語。既有 `test_vector_component_tint.cjs` 10 組回歸通過。

私人視覺探針 4 組通過，2000×1200、UI／圖縮放 100%，合法節點與接線 fixture：普通 node 本體 box-shadow 與 Professional 相同；Title／Inputs 同色同範圍外光、alpha .33、無新增 inset；主名稱發光但 small metadata 無 text-shadow；分類色衍生 accent 與淡色前景文字不同。實際點擊框選／顯示自訂名稱與切換 Vertex／Pixel 確認啟用光暈同步；所有幾何、圖、歷史及 dirty 保持。Light Professional／Cool 的陰影、filter、顏色及幾何完全一致。深淺色截圖已目視，零瀏覽器錯誤／寫入 API，共 31 組；550 個雙語鍵、JavaScript 語法與 diff 檢查通過。

早期原型另以 Chrome 152.0.7977.83 headless／1600×1000、200 個合法 vec4 Add 節點和 199 條連線，兩次交錯樣式測量真實 mouse pan／wheel 的 rAF 間隔。平移 p95 Professional 25.1ms、Cool 50.1ms；縮放 41.6／50.0ms。使用者明確接受此實驗的效能取捨；後續外光／文字／blur 調校未再次跑性能，因此上述數字只代表早期原型，並非最終樣式的裝置 FPS 保證。未測實體 iPad／Safari。

28 份映射來源與服務內容一致，TOP／MAT Master current。正式 TOE 為 719,124 bytes，SHA-256 `c1fa95e835431606eb8b93a3c003c807b38e37d32f9d46bb1ee84752fe04620f`；兩份使用者 Shader 保留、私人助手排除，未重新整理現有編輯頁。

2026-09-17 實驗功能齒輪與分量染色（0.8.84）：新增 `test_ui_experiments.cjs` 15 組，驗證全部 10 項／9 個開關、原預設、即時行為、瀏覽器保存／重設／錯誤資料、拒絕儲存仍可使用、數值／名稱草稿 DOM 與 Graph／Undo 不變、浮動工具列重用且操作只執行一次、拖動中拒絕切換、滑鼠及鍵盤開啟後焦點／Tab／Delete／Escape、雙語與可信任觸控。320／390px × UI 75／125% × 深淺色可操作；320px／125% 觸控專注模式確認右下垃圾桶位於工具列上方、不重疊。

新增 `test_vector_component_tint.cjs` 10 組，驗證 RGBA-only 原預設、新旗標獨立控制 XYZW／UV／RGBA、依索引支援既有 ST 標籤、節點及 Parameter 緊湊／展開欄位、Swizzle 與群組文字、已知單分量接孔／來源線和整體向量型別色、一般 Add 不傳遞染色、選取／hover 優先、深淺色、切換不改數值草稿／Graph／Undo。首次群組測試未給 Combine 合法 groups 參數，修正 fixture 後通過，無追加產品修正。截圖已目視。

既有 `test_graph_trash.cjs` 16 組、`test_graph_trash_disabled.cjs` 13 組、`test_type_disconnect.cjs` 4 組、`test_editor_chrome.cjs` 16 組通過；垃圾桶 fixture 明確清除初始化 busy guard，更新工具列位置與觸控第二指坐標，涵蓋拖放／取消／Undo。共 74 組，零瀏覽器錯誤；546 個雙語鍵、JavaScript 語法及 diff 檢查通過。均為隔離 Chromium fixture，實體 iPad／Safari 未測。

TD 更新 Editor 資產，28 份映射來源及服務內容一致、TOP／MAT Master current；正式 TOE 為 717,956 bytes，SHA-256 `7c02e2487d7f5175dc45c7c683a962c0c852a8955500753288c3080dd7413c03`。兩份使用者 Shader 保留、私人助手排除，未重新整理現有瀏覽器頁面。

2026-09-17 Parameter 外觀與 Value Ladder 鎖定（0.8.84）：既有 test_parameter_values.cjs 15 組通過；私人探針 21 組確認單行說明／全文 title、深淺色文字分頁與名稱欄、選單操作、連線文字垂直置中（中心差低於 0.01px）、vec4／Color 整列展開、輸入／拖曳／色票排除、鍵盤與 Chromium 觸控。涵蓋 300／600px 及 UI 75／100／125%；緊湊與展開欄界差低於 1px，數值輸入維持 24px。截圖已目視，未新增正式樣式鏡像測試。

更新既有 test_numeric_scrub.cjs 的重新選級距預期，32 組全部通過；75／125% UI 下，左右調值後跨回原列表保持精簡提示與原級距，回 anchor 恢復原值，新手勢可選 0.01，放開只提交一次 Undo／Redo；可信任 Chromium touch event 覆蓋相同行為。保留左拖連續換範圍、手填精度、界限與取消。合計 68 組、零瀏覽器錯誤，JavaScript 語法與 diff 檢查通過；實體 iPad／Safari 未測。

TD 更新 style_css／inspector_js／functions_ui_js，28 份內嵌來源與服務一致、兩份 Master current。正式 TOE 為 712,420 bytes，SHA-256 259a08cfd6b7793a5427180dc37555fa9d0a8e35f27dcc6ba4602db1970605b9；保留兩份 Shader、排除私人助手，既有瀏覽器分頁未重新整理。

2026-09-17 Parameter 共用控制列（0.8.84）：既有 test_parameter_values.cjs 15 組通過，涵蓋共用列重構後的草稿、分量同步、取消／Undo、bool／int／uint、Settings／Uniform 保持及窄版；私人幾何／操作探針 19 組通過，涵蓋 Replace／Swizzle／Tint 在 300／600px 與 UI 75／100／125% 的欄位對齊、24px 基準、無溢出，GLSL 函式改名與單步 Undo、MAT Buffer 選單、UV 設定／還原往返。44px Swizzle 選單換行後字母完整，截圖已目視，零瀏覽器錯誤。未新增正式樣式測試。舊 test_glsl_code.cjs 單擊新增項後仍停在預覽，等不到編輯器，未列入通過數；此輪涉及的函式名稱／Undo 由上述直接建立節點的隔離探針驗證。

TD 更新 style_css／inspector_js／functions_ui_js；28 份內嵌來源與服務內容一致，兩份 Master current。正式 TOE 為 724,684 bytes，SHA-256 aff8d1073fad0025f314de50a9cc1ce3057b0f0743b3352b94bd9c760e5318a2；保留兩份 Shader、排除私人助手，現有瀏覽器分頁未重新整理。

2026-09-17 Parameter 對齊與子圖命名（0.8.84）：完整 `unittest discover` 279 項通過。新增命名檢查涵蓋同名呼叫、巢狀路徑、port 後綴衝突、長名稱限制及穩定消歧，保留原圖與 sourceMap；20 個內部預設名稱的合法性、唯一性、內容版本、瀏覽器引用／本地化與個人庫往返通過。既有 138 個產碼指紋及舊函式庫指紋以移除新增名稱並重算來源版本的測試投影核對，未覆寫歷史基準。

`test_parameter_values.cjs` 15 組、`test_numeric_scrub.cjs` 32 組通過，零頁面錯誤；包括長名稱、固定三角形與欄位、連線／數值／展開分量共同起點、較窄面板和既有編輯／拖曳／Undo 行為。Add 與 Tint 對齊截圖已目視。`tests/td/test_subgraph_names.py` 驗證 TOP／MAT 的重複與巢狀 Tint：產生預期可讀名稱、編譯保持 current、沒有版本升級要求；TOP 最大像素誤差 0.000098，MAT 0.003922，均低於既有 0.006 容差。測試圖與操作區清除，既有 Shader 資料完整保留。首次原生測試因測試圖的兩個介面節點缺少位置被拒；補齊測試資料後通過，無產品修正。

TD 更新 core／style_css／inspector_js；28 份映射來源與服務資產一致，兩份 Master current。正式 TOE 保存為 724,172 bytes，SHA-256 `ab2ef04f49f43c8ed9d28176b2e7871811690d9365cf3ae47163131e925706dc`；保留兩份使用者 Shader、排除私人助手，未重新整理現有頁面。未量測名稱長度對驅動編譯時間的差異。

2026-09-17 連續拖曳範圍（0.8.84）：test_numeric_scrub.cjs 更新後 32 組、test_parameter_values.cjs 13 組通過，零頁面錯誤。驗證跨越多個正負範圍／零／返回原點、相同路徑以 1 次或 60 次實際 pointer move 執行結果相同、Ctrl 粗調與邊界切換修飾鍵、極大有限值即時反轉；保留手填精度、極小原值、界限、整數／uint、Undo、取消、UI／圖縮放及 Value Ladder／Help／觸控測試。僅 inspector_js 來源更新；28 份內嵌來源及服務內容一致，TOP／MAT Master current。正式 TOE 保存 723,468 bytes，兩份使用者 Shader 保留，私人助手排除，現有分頁未重新整理。

2026-09-17 節點收合、Parameter 與數值操作（0.8.84）：`test_numeric_scrub.cjs` 29 組、`test_ui_scale_panels.cjs` 15 組、`test_node_collapse.cjs` 9 組、`test_parameter_values.cjs` 13 組全部通過，零瀏覽器錯誤，共 66 組。新增檢查包括依實際欄寬的浮點拖曳、正負／零與十進邊界、凍結敏感度、小數位移往返、修飾鍵切換、手填精度、極小值精確回原點、最大有限值與上下限反轉；保留原整數／uint、Undo、取消、觸控与 Value Ladder 入口。階梯驗證五級／0.1 置中、UI 尺寸的目前值＋級距、Help 保持、tooltip 分行／隱藏與恢復、長數字及視窗邊緣。

收合涵蓋實際接線／單孔與摘要限制、既有線刪除、混合批次、Undo／複製／名稱、75／125% 與 fit 幾何、可信任觸控、四種旗標組合，以及缺少 ui 舊圖的無副作用 render／移動。Parameter 涵蓋同列與分量同步、草稿／preset／取消／一次 Undo、接線與 Replace 預設值、Color picker、vec2/3/4、bool/int/uint、Notes 及 Uniform／Settings 保留，另有深淺色與縮放截圖目視。收合模型、向量與型別單元回歸共 14 項通過，編譯輸出一致。新浏览器測試沿用 `node tests/browser/<test>.cjs src/editor <editor-state-json> <report-directory>` 的隔離 fixture 模式。

`tests/td/test_editor_save_status.py` 在獨立 TOP／MAT 測試元件確認 collapsed true→false、分量展開及 width=460 寫入 graph DAT／state，shaderUpdated=false、無 configure、GLSL／manifest／接線保持；真正語意改動仍更新 Shader。測試區已清除，原有使用者圖保留。520 個雙語鍵、JavaScript 語法及 diff 檢查通過。TD 更新 5 份 Editor 資產，28 份來源與服務內容一致，Master current；正式 TOE 保存為 723,028 bytes，保留兩份 Shader、排除私人助手，未重新整理使用者分頁。實體 iPad／Safari 未在本輪驗證。

2026-09-17 對話框下拉回歸（0.8.84）：先在真正的 Inputs → 新增 Uniform 重現 #sourcetype 被 dialog>div 的 flex 橫排影響，vec2／vec3／vec4 高度 52px 且排在同一橫帶。修正後 `test_select_menus.cjs` 11 組全部通過，零瀏覽器錯誤；新增來源種類／型別選單於 1600／320px × UI 75／125% 的逐列對齊、不重疊、短標籤不換行及視窗邊界檢查。Color 預設與 Uniform／vec3 選取僅更新表單，未發出寫入 API，graph／Undo 保持不變；QR 來源選單同樣驗證逐列顯示。修正前後截圖已目視。來源列陰影僅樣式微調，以深／淺色視覺檢查為準，未新增重複樣式的測試。 TD 僅更新 style_css，28 份來源與服務內容一致，TOP／MAT Master 仍 current；正式 TOE 保存為 718,844 bytes，兩份使用者 Shader 保留、私人助手排除，既有瀏覽器分頁未重新整理。

2026-09-17 共用選單與 Value Ladder（0.8.84）：新增 `test_select_menus.cjs` 10 組，涵蓋圖縮放 25/170%、UI 75/125%、實際滑鼠與可信任 Chromium 觸控事件、原 select 事件／一次 Undo、同值不提交、鍵盤／typeahead／Tab、數值草稿保護、停用選項與分組、翻譯、失效清理、QR modal 及 320px 邊界。`test_numeric_scrub.cjs` 25 組與 `test_ui_scale_panels.cjs` 15 組驗證下方展開、固定單精度標籤、回原列重新選擇不跳值、精度鎖定、取消／Undo、縮放與上下邊界；數值預設及畫布縮放選單各 7 組回歸通過，共 64 組、零頁面錯誤。全列與精簡狀態截圖已目視；實體觸控裝置仍未驗證。TD 28 份內嵌來源、10 份服務資產、8 項實際 HTTP 檢查通過，Master 保持 current，圖資料、原生連線及 session 保留；正式 TOE 保存為 718,660 bytes，保留兩份 Shader 並排除私人助手。既有瀏覽器分頁未重新整理。

2026-09-17 Combine 覆蓋接線（0.8.84）：`test_combine_replacement.cjs` 5 組實際滑鼠檢查通過，涵蓋 XYZ／YZW 替換與未受影響接線、預覽虛線／範圍、Escape 不變、單步 Undo／Redo、反向接線及 Z／W 起點越界拒絕，零頁面錯誤；預覽截圖已目視。更新 `test_vector_nodes.js` 原有 Combine 拒絕重疊的預期，驗證來源節點／fan-out／手填值保留、舊群組整線移除、既有 Redo 不被失敗操作破壞、常數與迴圈回滾、creator 及上游 Auto 邊界。`test_vector_nodes`、`test_unified_vector`、`test_type_contract` 共 26 項通過；JS 產生的圖逐份由 Python 核心編譯。TD 更新 graph_ui／locales，27 份內嵌来源及服務內容一致，Master 保持 current。來源 TOE 保存為 715,356 bytes，兩份使用者 Shader 與既有 session 保留，私人助手排除。

2026-09-17 QR 置中修訂（0.8.84）：更新既有 `test_ui_share.cjs`，9 組通過，零瀏覽器錯誤。QR 按鈕順序、modal 焦點／背景阻擋、Escape／關閉鈕／點背景、原 QR 獨立解碼與複製備援均通過；12 組視窗／縮放／主題置中偏差小於 2px，另驗證 844×390／125% 的 QR 可完整顯示於單一捲動位置，複製與關閉仍可操作。桌面與窄版截圖已目視。TD 更新 3 份資產，27 份內嵌來源、9 份服務資產及 7 項既有 HTTP 讀取檢查通過；session、Shader 資料及原生連線不變。正式 TOE 保存為 715,100 bytes，保留兩份 Shader 並排除私人助手。

2026-09-17 QR 與 H（0.8.84）：`test_qrcode_roundtrip.cjs` 5 組以獨立 jsQR 解碼器確認 135–584 字元、fragment、編碼路徑、IPv6 及旋轉；產品只有本機編碼器，解碼器為測試依賴。`test_ui_share.cjs` 8 組通過實際 SVG 解碼、來源去重與選擇、必要 token 缺失、探索失敗備援、Clipboard／舊 copy／手動選取、鍵盤與唯讀圖，以及 320／390／1600px × 75／125% × 深／淺色共 12 種配置；窄版截圖已目視。`test_editor_chrome.cjs` 16 組含 H 同等 Fit、保持圖與歷史、輸入／選單／修飾鍵／IME／實際拖曳阻擋。`test_share_links.py` 與既有 `test_lan_access.py` 合計 17 項真實 HTTP／契約測試通過。737 個雙語鍵、HTML 翻譯引用及 JavaScript 語法通過，瀏覽器零錯誤。TD 另驗證 27 份來源、9 份服務資產、兩個 Shader context 及 7 項真實 HTTP 邊界；既有 session、Shader DAT 與原生連線保留，Master current。來源 TOE 為 714,860 bytes，排除私人助手。此為 Windows Chromium 與同機 TD 網路驗證，第二台實體裝置和 Safari 尚未實測。

2026-09-17 即時回饋與重載確認（0.8.84）：共享縮放／明暗回歸 19 組、新增面板定位與拖移 13 組、數值拖曳與正負比例底 22 組、右鍵預設值 7 組、重載警告 8 組全部通過，零頁面錯誤。包含舊分別縮放值遷移、標準／舒適共用值；75／125% UI 下的雙擊／拉線／觸控建立與面板拖移；負區間、十進位邊界及最大有限數的比例顯示；預設值單步 Undo、同值不增歷史、Escape／Tab／點外關閉不提交草稿、整數／uint 及界限、欄位／階段替換、中鍵／Alt 右鍵／長按 Ladder 保留。重載警告涵蓋乾淨圖仍確認、忙碌與草稿保護、自動套用排程暫停／恢復、確認才讀取、失敗讀取保留圖與歷史，以及 390px／125% 視窗。新增面板、預設選單與警告截圖已目視；515 個雙語鍵與 JavaScript 語法檢查通過。 既有 Editor chrome 13 組回歸亦通過。25 份內嵌來源與服務資產一致，TOP／MAT Master 保持 current；正式 TOE 保存為 700,516 bytes，兩份使用者 Shader 保留，私人助手排除。

2026-09-17 UI 縮放與數值拖曳（0.8.84）：外觀 11 組（含 Chromium 原生觸控）、UI 縮放 8 組（含原生觸控）、圖面座標 11 組、面板座標 15 組、Editor chrome 13 組及數值拖曳 21 組通過，零頁面錯誤。UI 縮放涵蓋兩種基準獨立記憶、右鍵／雙擊重設、舊值與儲存失敗恢復、320／390／1600px 及 75／100／125%，保留圖、DOM、視點、草稿、Undo 及面板偏好。座標檢查包含節點移動／調寬、接線、框選／平移／pinch、新增／貼上、面板 resize／dock、Inputs 拖入、Layout／Value Ladder 定位。數值檢查包含小數指標正反拖曳、修飾鍵切換、0.0001 步進、手填高精度、整數步進與 uint 下限反轉；既有 Value Ladder 與取消／Undo 行為通過。專注模式確認同一全螢幕按鈕在圖右下角出現，退出後回到 footer，實際 Fullscreen API 可進出。新增 `test_canvas_zoom_menu.cjs` 7 組通過，涵蓋倍率端點、七段選取、畫布中央定位、鍵盤／觸控、點外關閉、UI 縮放／專注模式與雙語窄版；既有 Editor chrome 13 組回歸通過。509 個雙語鍵與 JavaScript 語法檢查通過。 額外窄版探針確認 Shader 選單依實際左端位置限制寬度，320／390px、兩種基準及三種縮放的 12 種配置皆不超出視窗。25 份內嵌來源與服務資產核對一致，兩份 Master 保持 current；正式 TOE 保存為 697,828 bytes，保留兩份使用者 Shader，排除私人開發助手。此為 Windows Chromium 驗證，實體 Safari／iPad 尚未測試。

2026-09-17 明暗幅度 1.5 倍追加（0.8.84）：既有 `test_ui_appearance.cjs` 10 組桌面與 1 組原生觸控檢查通過，零頁面錯誤與非預期 API 寫入。兩種主題明暗方向、中央精確還原、獨立記憶及原有 UI 行為保持；25 份 TD 內嵌來源與服務資產一致；正式 TOE 已保存為 694,836 bytes，保留兩份使用者 Shader。

2026-09-17 明暗調校與視窗模式（0.8.84）：`test_ui_appearance.cjs` 10 組桌面與 1 組原生觸控檢查、`test_editor_chrome.cjs` 13 組通過，零頁面錯誤或非預期 API 寫入。涵蓋主題獨立記憶、目前主題右鍵／雙擊重設、舊 tone 遷移、即時顏色更新與精確歸零、圖／Undo／Preview 不變；320／390／960／1600px 驗證新增全螢幕按鈕後的配置。原生 Chrome Fullscreen API 實測進出與外部退出，專注模式在一般與全螢幕視窗獨立還原，保留既有 DOM、面板布局和視點；另驗證不可用／拒絕時的狀態、Esc 優先權及 390px 觸控。499 個雙語鍵及 JavaScript 語法檢查通過；實體 iPad／Safari 未實測。

0.5 秒全 UI CSS 顏色過渡試驗未保留：200 節點、5,611 DOM 的隔離 Chromium 比較，連續調色的動畫版幀間隔中位數約 308–408 ms，停用動畫約 33–42 ms；設定函式本身約 0.5–0.7 ms。此為同機 headless 並行測試下的相對測量，不是通用 FPS 保證；額外成本足以觸發使用者「耗效能就不要」的條件。最終套件確認沒有此顏色動畫。深色提亮及淺色基準、桌面與窄版專注模式截圖已目視。

TD 更新 5 份 Editor 資產，25 份內嵌來源及服務資產一致，TOP／MAT Master 保持 current；正式 TOE 為 694,860 bytes，保留兩份使用者 Shader 並排除私人助手，沒有核心或編譯規則變更。

2026-09-17 明暗二級面板（0.8.84）：更新 `test_ui_appearance.cjs`，9 組桌面與 1 組 Chromium 原生觸控檢查通過，零頁面錯誤。涵蓋開啟與基準切換、滑鼠即時拖曳、減／加步進、方向鍵／Home／End、Escape 回焦與點外關閉、預設或雙擊還原、舊偏好相容與新值重載、非法值／界限／儲存拒寫，以及深淺色 × 標準／舒適在 320／390／960／1600px 的面板配置。真實 CDP touch event 在 390px 驗證滑桿雙向拖曳與面板操作；此結果不代替實體 iPad／Safari。

外觀操作保留圖、Undo、縮放、Preview 狀態及實際顏色色票，無非預期 API 寫入。程式更新外觀保留數字草稿 DOM；使用者移開焦點仍按原規則提交一次，滑桿不再新增圖歷史。另通過既有 `test_editor_chrome.cjs` 10 組與 496 個雙語鍵檢查。

獨立色票探針比對深／淺色各 1,042 個 DOM 元素，中央值與改動前的 computed colors 完全一致；五段調整值的主要表面亮度依序增加，歸零完整還原。GLSL 語法色與實際 Color RGBA 色票保持，Preview 沒有增加濾鏡。代表標題及數字文字的對比保持 5.49:1 以上；面板、窄版與兩種主題的明暗端點截圖已目視。

TD 更新 4 份 Editor 資產，25 份內嵌來源及服務資產一致；TOP／MAT Master 保持 current，兩份使用者 Shader 保留。正式 TOE 保存為 693,500 bytes，私人助手未寫入；無核心／catalog／產碼變更。

2026-09-17 Attribute 與節點標題（0.8.84）：`test_node_round.cjs` 17 組及 `test_node_rename_geometry.cjs` 7 組通過，零頁面錯誤。後者涵蓋 Split RGBA／Vector、預設／手動寬度、50%／100%／150% 縮放、Enter／blur／Escape／IME、重名與空值提示、單步 Undo，確認標題維持 41px 且接孔位置不變；Parameter 保留原名稱欄尺寸。

隔離 Chromium 另確認 TOP／MAT × 深色／淺色的 Attribute 標題、Parameter 與 Inputs 色彩一致，型別接孔保持原色；MAT Position 同組、Deform 保留原分類。UV 提示依目標顯示 vUV.st／UV 0，搜尋提示文字能取得來源且不顯示錯誤的空結果。改名及配色截圖已目視；實體 iPad／Safari 尚未回驗。

追加副標靠右的 3 組隔離檢查通過：Split／Replace 的 Auto 與指定型別、自訂名稱開關、Uniform 與唯讀標題均貼齊右側且無截字，標題維持 41px，原生選單仍可切換。最後樣式另重跑改名幾何 7 組通過，截圖已目視。

型別快捷使用 `field-sizing: content` 收緊目前選项；不支援該 CSS 的瀏覽器沿用原生較寬選單，仍以 `text-align-last: right` 將目前型別靠右。Chromium 展開選單的 Auto／vec2／vec3／vec4 均完整可讀；尚未將此結果視為 Safari 實機驗證。

TD 更新 3 份 Editor 資產，25 份內嵌來源與服務內容一致，TOP／MAT Master 保持 current。正式 TOE 保存為 690,580 bytes，兩份使用者 Shader 保留，私人助手未寫入；無核心或 catalog 變更。

2026-09-17 名稱、數值拖曳與 Auto（0.8.84）：完整可攜檢查通過（260 項 Python 單元測試、488 個雙語鍵、既有模型／整合與 26 項 Remote Panel 檢查）。瀏覽器 test_node_round 17 組、test_node_width 15 組、test_numeric_scrub 15 組、test_replace_inputs 6 組、test_type_disconnect 4 組及關閉 flag 的 test_type_drafts 15 組通過，零頁面錯誤。Auto model 26 項及 vector_nodes 7 項整合通過。數值驗證含真正 Chromium touch、原 Ladder 各入口、文字選取、縮放、取消、逐步 Undo、整數與外部同步；Replace 驗證保留手填／拆基底恢復、主輸入各維度及手動鎖定。名稱測試確認 Parameter 不受畫布名稱模式影響，來源仍禁止獨立改名。

舊 test_value_ladder／test_ladder_touch 與 test_math_auto_browser 依賴過時的 Uniform Parameter／sidebar 選擇器，未列入本次通過數；所需手勢與型別回歸已由上述現行套件覆盖。實體 iPad／Safari 尚未回驗。

TD 更新 6 份 Editor 資產；25 份內嵌來源及服務內容一致，TOP／MAT Master 保持 current，無核心／catalog 變更。正式 TOE 保存為 690,068 bytes，保留兩份使用者 Shader，排除私人助手。

2026-09-17 副標與 footer 微調（0.8.84）：既有 test_node_width.cjs 15 組、test_editor_chrome.cjs 10 組及 test_ui_appearance.cjs 7 組通過，零頁面錯誤。標準／舒適 × 深色／淺色在 320／390／960／1600px 確認 footer 左側刷新與重載、右側外觀快捷無重疊或水平溢出，四個按鈕均可命中；節點標題保留 41px 高度及可讀型別。副標基線與 About 兩行置中另以隔離 Chromium 截圖和 computed style 確認。25 份來源與服務資產一致，TOP／MAT Master 保持 current；正式 TOE 保存為 690,364 bytes，保留使用者兩份 Shader，排除私人助手。實體 iPad／Safari 未實測。

2026-09-17 節點外觀與預設寬度追加（0.8.84）：更新後的 `test_node_width.cjs` 15 組通過。檢查 Vector／Color／Split／Add／Texture Coordinates／Power 的完整標題、接孔名稱與數值；桌面與 coarse pointer 標題同高、UV 副標同行；手動縮到低於內容預設值、1200px 上限與無效拖曳不增 Undo，以及既有取消／唯讀／觸控／保存語意。JavaScript 語法與保存提示單元檢查通過。私人外觀探針另確認 Uniform／Vector 顯示 `out`、一般箭頭不改文字與調寬游標、15px／24px 把手的圓弧同圓心，以及來源 flag 關閉提示後仍能調寬；截圖已目視。此為 Chromium 驗證，不代替實體 Safari／iPad。

25 份內嵌來源與服務資產一致，Master 保持目前版本；正式 TOE 已保存為 687,708 bytes，兩份使用者 Shader 保留並排除私人橋接。

2026-09-17 節點寬度追加（0.8.84）：`tests/browser/test_node_width.cjs` 11 組通過、無頁面錯誤。包含各類 minimum、50% 畫布縮放、即時連線端點、pointer capture、一次布局 Undo／Redo、最小寬度無效操作、Escape／blur／cancel／失去 capture、唯讀、Chromium 真實 touch event、未提交數值保留、置中及透明無框型別選單；截圖已目視。此觸控檢查不取代 iPad／Safari 實機驗證。

`tests/unit/test_editor_save_status.js` 驗證 stage／Subgraph 的寬度僅顯示圖待儲存；488 個雙語語系鍵通過。原生 `tests/td/test_editor_save_status.py` 在 TOP／MAT 確認寬度 460 隨 graph 保存且 `shaderUpdated` 為 false、不呼叫 configure、不改 GLSL；真正語意修改仍更新。25 份內嵌來源及已服務資產一致，兩份 Master 已是目前版本，兩份使用者 Shader 保留。正式 TOE 已保存為 686,756 bytes，排除私人開發橋接。

重現：`node tests/browser/test_node_width.cjs src/editor <current-editor-state-json> <report-directory>`；原生保存檢查透過 `submit_job.py` 執行。

2026-09-17 節點工作流程（0.8.84）：完整可攜檢查通過，包括 256 項 Python 核心／來源／歷史測試、487 個雙語語系鍵、browser metadata、品牌資產、14 項 Editor Launch，以及 JavaScript 編輯／匯入模型與 26 項 Remote Panel 檢查。舊 UI fixture 已配合本輪共用來源與節點介面修訂。新增名稱檢查包含 GLSL 保留字／重複名稱拒絕、重複 Subgraph 展開與多輸出符號分配；Vector／Replace 檢查保留既有基本節點產碼指紋。

隔離 Chromium 的 `test_node_round.cjs` 已通過 Vector 2／3／4 直接新增、手填／展開、Split 快捷、Replace 排版、自訂名稱只改顯示、原地改名與 IME／取消／重複、複製唯一名称、標題快捷、Graph／Spec 來源及 TD Built In 等 15 組基本檢查；無頁面錯誤。`test_editor_chrome.cjs` 10 組通過。另驗證合併工具列的 1600／900／750／390px 組內不拆及無頁面溢出，以及淺色浮動工具列的透明背景與空白穿透；畫布命令仍可操作。實體 iPad／Safari 尚未回驗。

`test_type_drafts.cjs` 另有 15 組通過、無頁面錯誤：Header／Parameter 的新型別與原接線保留、Auto 推導、移動／數值編輯、Undo／Redo、缺失接孔與虛線、Swizzle 修復、分組越界、MRT buffer 縮小、間接常數失效，以及新接線／直接 Require Constant 的嚴格檢查。套用回覆使用 TD 實測的當前版本 blocked／無 changes 形態，compile 與 repair-only 回覆均保留可編輯草稿，不進版本升級；後者顯示具體缺口，截圖已目視。

原生 TD 2025.32820 的 `test_unified_vector.py` 通過 53 項檢查：TOP／MAT 實際像素、連續分組、基底覆寫、獨立 Split、斷線恢復、常數陣列界限及可讀名稱，以及各自的固定型別衝突／缺失 Z 接孔草稿。無效草稿拒絕套用後，成功像素、原生來源身分／列、OP path／id、圖、revision、GLSL 均保留，修正後能再套用。既有 `test_input_history.py` 21 組與 Master 模板檢查通過；測試元件於結束清除，使用者 Shader 保留。本輪最終同步／保存另記於下方交付記錄。

2026-09-17 Spec Constants：`test_spec_constants.py` 最終 19 項核心／來源歷史測試通過，涵蓋四種純量產碼、固定 `constant_id`、非法型別／ID／數值拒絕、特化與一般常數表達式邊界、原生改名／重排保留宣告、bool 預設與 signed int 邊界、跨原生種類誤綁拒絕、值／刪除 Undo、TD 整數輸送限制及拒絕寫入時原狀保留。最終修改後與既有 `test_history.py` 22 項合計 41 項定向檢查通過；`test_sources.py` 16 項已於完整可攜檢查通過。`test_spec_import.js` 確認既有 Spec 宣告 ID／constantId 保留、匯入新來源 ID 衝突重新配置、stage／function 引用對應、跨來源種類衝突及過期來源快照拒絕。

`tests/td/test_spec_constants.py` 在 TD 2025.32820 全新 TOP／MAT fixture 通過 18 組：同一原生 Par 的值 Undo／Redo、int／uint／bool／float 編譯與目前值、改名、引用中刪除後缺失／恢復、建立與刪除的來源 ID 及 `constant_id`，以及不支援整數寫入／預設的拒絕與原狀保留、精確大整數 `2^30` 可用、外部錯值提示與修復。新增 float 目前值 `.75` → int 失敗 → float 成功 → Undo 回 int 草稿／Redo 的案例；原生 Par、目前值與成功 GLSL 不被草稿覆蓋。只有型別／預設 metadata 且無任何原生寫入的步驟適用，非法值回放、混合寫入及身分改動仍拒絕。fixture 測後清除，既有使用者 Shader 保留。另以原生 GLSL＋GPU readback 探針確認 TOP／MAT 四種純量均接受 Constants 頁的兩次一般值覆寫；`const0value` 的原生 Par style 是 Float，宣告型別由 GLSL 決定，整數邊界限制如下。

執行：`python tools/dev/submit_job.py tests/td/test_spec_constants.py --report spec-constants --timeout 60`。原生值更新不改寫 Shader 文字。

0.8.84 最終交付：25 份內嵌來源及服務資產與磁碟一致；兩份 Master 均為 0.8.84，圖已編譯且不需升級。僅依使用者本輪例外移除開發測試 TOP 中的一顆舊統合 Vector 及相關接線，先保留私人備份，其他節點與另一份 MAT 保持；最後更新／保存前後再次確認兩份 Shader 保留。正式 `src/td/TD-Grape-dev.toe` 已保存為 685,276 bytes，排除私人開發橋接。

額外 fresh OP＋GPU 位元 readback 與跨幀探針確認 TD 2025.32820 限制：TOP／MAT 的 native int `-1` 成為 GPU `0`；MAT `16777217` 成為 `16777216`、int 最大值成為最小值、uint 最大值成為 `0`。TOP 的正 int／uint 邊界精確，兩者 float `-0.5` 正常。另在建立與讀回相隔 1005 幀後確認 TOP `-1`、MAT `16777217` 仍錯誤，排除同幀快取。來源限制依此實測加入；可接受的整數仍依型別範圍及 MAT float32 exact 判斷，沒有一律限制在 `2^24`。

2026-09-17 共同 Undo／Redo（0.8.83）：`test_history.py` 22 項與既有 `test_sources.py` 16 項通過。涵蓋固定操作差異與目前狀態分離、原生列結構回復／失敗回滾、過期／跨 Shader token、同名重建 Par 的固定 index、owned Bind、Sampler TOP 身分，以及無效草稿不損壞權威 state。`test_input_removal.cjs` 7 組與更新後 `test_native_sources.cjs` 13 組通過；來源刪除改記錄為可撤回的一步，新增來源在 Apply 後也能連同該次引用一起撤回。

`test_input_history.cjs` 在隔離 Chromium 通過混合圖／Inputs 順序、取消／同值保留 Redo、刪除／恢復、合併 Apply 的逐步回放、同来源中間改名／型別、失敗不移動游標、外部未觸分量保留，以及延遲 Apply 等待／Reload 後舊回應隔離。`test_input_history.py` 在全新、測後清除的 TD 2025.32820 TOP／MAT 組件通過 21 組：值與原 Par 身分、同來源外改 Z、其他來源外改、衝突拒絕、刪除還原順序／隱藏分量、Expression 動態結果不產生歷史、Bind 主控值與綁定恢復、同名重建主控拒絕、批次新增 A/B、請求重試去重、批次新增／改名中間態，以及 Sampler 路徑還原／同路徑新 TOP 拒絕。使用者的兩份 Shader 保存內容保持一致，未使用全域 TD Undo 回放。

實機 sequence 探針另外確認：TD 2025.32820 在刪除／插回列時可能改動鄰列值，Par handle 也不能單憑 valid 判斷原身分；結構恢復需校正交易前的鄰列設定，Export／外部 Bind 連結則須預檢，不能僅保存 eval 值。這些觀察已轉為上述原生與單元回歸，私人探針輸出不作產品依賴。

執行共同歷史測試：`node tests/browser/test_input_history.cjs src/editor <editor-state-json> <report-directory>`；原生驗證：`python tools/dev/submit_job.py tests/td/test_input_history.py`。這些瀏覽器結果不取代實體 iPad／Safari 回驗。

共同歷史瀏覽器最終共 10 組通過、零頁面錯誤，包含實際匯入／範例切換維持來源 ID、stage／function 引用對應、同名型別 metadata 修改保留目前值，以及待 Apply 時外改 Z 不被 Undo／Redo 覆蓋。474 個雙語鍵與語法／diff 檢查通過。25 份 TD 內嵌來源及提供中的資產與磁碟一致；正式 TOE 已保存為 655,612 bytes，保留使用者兩份 Shader、排除私人開發橋接。未修改 catalog／產碼契約，沒有要求 Master 升級。

2026-09-17 Inputs 刪除修復（0.8.83）：`test_sources.py` 16 項通過，涵蓋零引用清理、所有 stage／function 的引用保護、過期 revision／原生身分拒絕、鄰列驅動保留、最後原生列清名、metadata 失敗回復與重試；清理不要求重新編譯。`test_input_removal.cjs` 7 組通過，涵蓋取消／確認刪除、連續清理 missing 項目、其他缺失來源造成 Apply 失敗後仍可修復、Undo 不補回已刪除來源、本地草稿不被輪詢覆蓋，以及 Constant／Sampler 的缺失零引用刪除。`test_native_sources.py` 在 TD TOP／MAT 通過 21 組，驗證原生移除、缺失記錄清理、輪詢不再生、既有 Expression／Bind／COMP 控制與編譯失敗回復，保留使用者 Shader。語系鍵檢查通過。來源修正已同步 24 份內嵌資源；針對使用者先前刪除的記錄，先備份並重新核對引用，只清理仍無引用的三筆，保留已重新引用的來源與全部節點、接線、GLSL。

執行刪除回歸：`node tests/browser/test_input_removal.cjs src/editor <editor-state-json> <report-directory>`；原生驗證：`python tools/dev/submit_job.py tests/td/test_native_sources.py`。

2026-09-17 淺色畫布調整（0.8.83）：在隔離 Chromium 以新版及上一個已提交版本的 CSS 分別載入同一份圖，確認代表元素的深色 computed styles 一致。淺色模式的畫布、節點、型別接孔／接線、RGBA 提示、數字欄位、選取／錯誤／接線提示及 Value Ladder 通過目視；1600px 與 390px 無新增水平溢出。淺色／深色切換保留節點及 Parameter 尺寸、圖資料、Undo 與 pan／scale，沒有新增 POST 或 JavaScript 錯誤；取消 Value Ladder 保留圖狀態。實際滑鼠驗證 RGBA 線的 hover／selected 與刪除提示覆蓋順序。代表 RGBA 數字對比至少 4.80:1，實線對畫布至少 4.48:1；次要節點標籤再加深，對各分類標題底色為 4.60–4.72:1。未變更 Shader 語意或預覽像素；實體 iPad／Safari 仍待人工回驗。TD 同步僅更新 style_css，24 份內嵌來源與提供中的資源一致，保留兩份既有 Shader 並保存來源 TOE。

2026-09-17 第一版介面大小／外觀切換（0.8.83）：隔離 Chromium 的 `test_ui_appearance.cjs` 通過 7 組檢查，涵蓋標準／舒適與深色／淺色四種組合、雙語提示與鍵盤操作、本機設定重載／失效回復／儲存拒寫、唯讀圖可切換，以及不改變圖／Undo／縮放／預覽狀態。未提交數字草稿保持同一 DOM；離開欄位沿用既有一次提交，外觀切換不產生額外 Undo 或寫入。320／390／960／1600px 的 16 組 footer 幾何確認控制置中、左右不重疊且仍可點擊。

既有 `test_editor_chrome.cjs` 10 組檢查通過，保留 header 收合、刷新與草稿保護。Light 主題另通過 3 組隔離檢查：圖內節點／接孔／接線／數字框樣式保持、Inputs／浮動新增與來源對話框可讀、沒有圖／歷史變更及 JS 錯誤。此初版的淺色外框仍保留深色畫布；已由上方記錄的淺色畫布調整取代。語系檢查通過。本輪未改型別、編譯契約或 Master；實體 iPad／Safari 仍待人工回驗。

執行外觀回歸：`node tests/browser/test_ui_appearance.cjs src/editor <editor-state-json> <report-directory>`。

更新 TD 的 4 份 Editor 來源後，全部 24 份內嵌來源與目前服務資產均與磁碟一致。正式 TOE 保存為 639,732 bytes；更新及保存均確認使用者 TOP／MAT 兩份 Shader 保留，私人開發橋接未寫入。

2026-09-17 Inputs／工作區 UI 批（0.8.83）：203 項 Python 測試及完整可攜檢查通過；最後文案修訂後另確認 468 個雙語語系鍵。瀏覽器通過 Native sources 13 組、workspace 7 組、header／footer／重載保護 10 組，另完成 TOP Inputs 建立／搜尋／收合／拖放／引用重用、Personal 投放與觸控捲動驗證。獨立 review 覆蓋對話框按 Tab 後仍保留草稿、取消清除草稿、寫入中禁止整頁重載，以及來源切換只產生一次 Undo。最後工具列 CSS 修正另驗 320／390／960px，組內不拆、控制等高、無水平溢出。後續使用回饋另通過 5 項來源提示檢查：Inputs 無頂部狀態段、僅原生 Uniform 操作提示限制、輪詢不覆蓋操作或編譯錯誤、Constant／TOP 引用正常、限制解除可恢復編輯。Add Node 中性背景／圖示、Inputs 淡色列與兩側標題一致另以 4 項視覺檢查確認；Refresh 在 footer 最左端以四種寬度的 saved／pending／error 狀態檢查。頂欄開關置中另驗 1600／960／390／320px：中心誤差小於 0.6px、長路徑不重疊、收合及再開啟正常，位置列與 footer 高度維持。這些為隔離的 Chromium fixture 測試，尚未代替實體手機／iPad／Safari。

TD 2025.32820 更新 6 份 Editor 來源，確認全部 24 份內嵌來源與磁碟、服務資產一致，正式 TOE 最終保存為 632,948 bytes；最後更新與保存均比對保留使用者的 TOP／MAT 兩份 Shader，私人開發橋接未寫入正式 TOE。此批未修改型別／catalog／編譯規則，沒有執行 Master 升級。


## 0.8.82 整合 Vector 與節點內數值

完整可攜檢查通過：201 項 Python 核心測試（包含透過 Python fixture 執行的 JavaScript 接線規劃檢查）、456 個雙語語系鍵、既有整合檢查及 26 項 Remote Panel Node 檢查。138 份歷史 GLSL 指紋保持一致。新增選單 metadata 檢查確認 Vector 分類與 vec2／vec3／vec4 搜尋可用，內嵌分類與 catalog 相同。

Chromium fixture 測試 34 項通過、零頁面錯誤：16 項 inline 值／Vector 接線案例，以及 18 項既有節點互動案例。涵蓋自動移除衝突線與 Undo、基底／手填值顯示、Enter／blur／Escape、失效草稿、MMB Value Ladder、實際 Chromium touch tap／hold／swipe／cancel、唯讀及雙擊隔離。截圖已檢視並修正固定 Vector 值的留白；驗證尺寸為 1600 × 1100、畫布縮放 80%。這不代替實體手機、iPad 或 Safari 回驗。

TD 2025.32820：新 Vector 39 項、既有向量 27 項原生檢查通過。包括 TOP／MAT 八種 vec4 分組、完整基底與 YZ 覆寫、最終分量输出、斷線後恢復、重疊替換、無效依賴不產生 Uniform、常數陣列長度，以及只改 UV 的 V。新測試在取得 CAS revision 前先同步原生來源，避免前一案例刻意保留的 Uniform 列重新接納後使 fixture 使用舊 revision；未因此修改 runtime。

Master 同步、新建 TOP／MAT、舊模板拒絕未確認升級均通過。Catalog 版本前進至 0.8.82，不改舊定義 fingerprint、ABI 或 shell。兩份 Master 無語意升級差異，保存使用者的一份 Shader 與人工 OP 位置；24 份內嵌來源及目前服務資產與磁碟一致，臨時原生測試元件已移除。正式 TOE 已保存為 604,348 bytes，排除私人開發橋接。

```text
python tools/dev/run_tests.py
node tests/browser/test_inline_vector_values.cjs src/editor <current-editor-state-json> <report-directory>
node tests/browser/test_node_interactions.cjs src/editor <current-editor-state-json> <report-directory>
python tools/dev/submit_job.py tests/td/test_unified_vector.py --report vectors-unified --timeout 60
python tools/dev/submit_job.py tests/td/test_vector_nodes.py --report vectors-regression --timeout 60
```

0.8.80：179 項 Python 測試、既有可攜檢查及 26 項 Remote Panel Node 檢查通過。新向量處理測試涵蓋各維度合法分割、八種 vec4 組合、固定分量值、斷線／Undo、重疊與截斷拒絕、Swizzle 重排／重複、Subgraph 常數傳遞、UI 常數要求回退與接線選單計畫。舊節點定義及 138 份 GLSL 指紋保持不變。

TD 2025.32820 原生 27 項檢查通過：TOP／MAT 各八種組合的像素結果、Split → Combine → Swizzle、Fract／Mix／Smoothstep 常數鏈、兩種鏈各自作為陣列長度，以及 Runtime Uniform 違反常數要求時保留上次輸出；TOP 額外驗證只修改 UV 的 V、其餘分量與解析度不變。

以 Chromium 連到實際 TD，完成 UV → Split → 修改 V → Combine 的操作；確認向量候選前三項為 Split／Swizzle／Combine、Swizzle YXY 輸出 vec3、Vector 4 有四個數值欄位。常數來源可啟用常數要求，UV 衍生結果啟用時立即拒絕並恢復原圖。刷新後資料保持，SVG 快捷圖示已載入，無 JavaScript 錯誤。這是桌面滑鼠驗證，未代替 iPad／手機／Safari 實機回驗。

兩份 Master 已同步 0.8.80；更新內嵌來源與保存 TOE 各自確認使用者 Shader 資料保留。測試場景與註冊已清除，測試預覽返回使用者 Shader。

```text
python tools/dev/run_tests.py
python tools/dev/submit_job.py tests/td/test_vector_nodes.py --report vectors --timeout 30
```

0.8.79 儲存提示修正：172 項 Python 測試及既有可攜檢查通過。新增瀏覽器處理函式測試涵蓋位移、Undo／Redo、接線／參數混合、延遲回覆、失敗、Subgraph 與實際後端回報；TD TOP／MAT 測試確認位置保存不呼叫 configure，且 GLSL／manifest 不變，真正的 Shader 更新回報另行區分。實際網頁拖曳顯示「圖待儲存 → 圖已儲存」，修改 Color RGBA 數值則顯示「Shader 已套用」；原提示位置保留，r 僅在滑鼠提示中呈現。

0.8.78：168 項 Python 單元測試、445 個雙語語系鍵、既有可攜檢查與 26 項 Remote Panel Node 檢查通過；TD Master 既有六項檢查通過。兩份 Master 同步版本時確認 OP 身分、位置及使用者 Shader 保持不變；內嵌來源更新也逐次比對保存中的 Shader 資料。

透過 Codex 瀏覽器連到實際 TD，驗證說明區拖曳由 240px 改為 320px，切換 Mix／Smoothstep 與重新載入皆維持高度，內容可獨立捲動。End 抵達上限時，節點清單保留 140px；1280 × 480 的短視窗把兩區限制為各 116px，回到 1280 × 720 後恢復原先 332px 偏好。420 × 820 的窄視窗無橫向溢出。雙擊恢復 240px；方向鍵可微調 8px，收合重開保留高度，Inputs／新增節點分頁切換後仍可操作，瀏覽器沒有 JavaScript 錯誤。手機／iPad 真實觸控與 Safari 尚未回驗。

本次測試分頁暫停自己的預覽連線，避免接管使用者正在操作的共用 Viewer；未調查或修改已暫緩的 TD active panel 限制。

正式 TOE 已保存為 581,644 bytes，保存作業確認三份 Shader 資料保持不變，排除私有開發橋接。使用者在本輪期間也持續編輯 Shader，驗證依各更新／保存作業當下的前後比對，不以整輪開始時的舊圖覆寫。

0.8.77：168 項 Python 單元測試、444 個雙語語系鍵、既有可攜檢查與 26 項 Remote Panel Node 檢查通過。新增預覽控制行為測試涵蓋停止／啟動、保存偏好、主動接管、連線請求等待中取消，以及失敗後可重試。TD 模板既有六項檢查通過。

以 Codex 瀏覽器工具連到真實 TD，確認 14px 透明無框圖示、24px 合併列、停止後重載仍維持關閉、重新連線重新啟用、路徑點選展開及 Esc／點外關閉。1280 × 720 與 420 × 820 畫面沒有橫向溢出；完整路徑浮層在窄畫面內可讀。中英提示與綠燈正常，Open Viewer 仍隱藏，解析度角標不攔截事件。瀏覽器未報 JavaScript 錯誤。粗略指標尺寸依 CSS 配置，手機／iPad 實機與 Safari 尚未驗證。既有 `test_preview_controls.cjs` 已配合按鈕更新，本輪以 Codex 瀏覽器實測，未另行執行該腳本。

正式 TOE 已保存；保存前後比對確認使用者圖、GLSL、身分及 TD 節點位置保持不變；Master 只有版本／部署紀錄更新。


0.8.76：168 項 Python 單元測試、既有可攜檢查與 26 項 Remote Panel Node 檢查通過。TD 2025.32820 完成 Master 同步與既有模板檢查，新建 MAT 編譯成功、舊模板未經接受不能升級，實際 Master 保持不變。純 UI 調整未新增模仿實作的測試；既有 `test_native_viewer.cjs` 改為隱藏入口的預期，該瀏覽器腳本本輪沒有另外執行。

使用 Codex 瀏覽器工具連到真實 TD，在 Chromium 驗證：本機與 Tailscale 入口都不顯示 Open Viewer；取消即時預覽可斷線，按圖示可重連；第二頁接管後，原頁仍可取回預覽。解析度位於影像內，角標命中測試穿透至預覽本體，下方提示列不存在；中英文切換保留功能，瀏覽器未回報錯誤。節點 Settings 沒有刪除按鈕，畫布刪除按鈕仍可用。Mix／Smoothstep 說明卡在相同面板尺寸下高度與清單邊界相同，鍵盤 PageDown 可捲動內容，點選項保持可見。1280 × 720 與 420 × 820 版面無橫向溢出；420px 是桌面 Chromium 視窗尺寸檢查，不代表手機、iPad 或 Safari 實機驗證。

0.8.75／Remote Panel 0.1.4 新增 9 項尺寸狀態檢查（Remote Panel Node 共 26 項），原生元件檢查擴為 31 項。可攜檢查通過。實際 Chromium＋TD 2025.32820 驗證 Graph 預覽從 306 × 164 改為 444 × 64、獨立 MAT 預覽從 500 × 300 改為 700 × 400；两者保持原 WebRTC peer，影片以新尺寸繼續播放。Graph 拖曳結束後更新一次，滑鼠中心點座標與後續播放正常，現有 Shader 資料保持不變。按住拖曳／隱藏／舊連線拒絕等邊界由 Node 和原生測試涵蓋；瀏覽器回歸腳本新增長按拖曳情境，這輪瀏覽器操作由 Codex 工具執行。手機／iPad 實機回驗尚未執行。

0.8.74／Remote Panel 0.1.3：168 項 Python 單元測試、既有可攜工具檢查，以及 17 項 Node Remote Panel 檢查。TD 2025.32820：25 項元件測試、25 項 MAT 預覽／編譯回復測試、38 項 MAT／TOP Sampler 取樣檢查，以及 TOP／MAT 模板新建、命名與相容性檢查。瀏覽器以實際 WebRTC 驗證 TOP → MAT → TOP 接管、舊頁面不搶回、語言／面板重排保留同一個 peer，以及操作事件到達正確 OP。`test_preview_controls.cjs` 已改為目前的即時預覽回歸腳本；本轮瀏覽器驗證透過 Codex 瀏覽器工具執行。手機／iPad 實機回驗仍由使用者進行。


## TD Remote Panel 0.1

Remote Panel 0.1.2（2026-09-16）：15 項 Node 手勢／事件轉接檢查與 24 項 TD 原生元件檢查通過。涵蓋單指點按／拖曳、雙指平移／捏合、手勢切換、取消／失焦釋放、影片留白座標、舊手勢清除與滑鼠路徑保留。Node 測試已納入 `tools/dev/run_tests.py`。

以實際 `TouchGestures` 產生的 mouse 訊息，在 TD 隔離元件中回放：按鈕由 0 切至 1、滑桿由 0.5 變為約 0.833；3D SOP Viewer 的旋轉、平移、捏合均有像素變化，捏合張開會拉近視角。捏合使用中鍵拖曳；本次單次 wheel 轉送在隔離 Viewer 中沒有造成可見變化。新建的隔離 OP Viewer COMP 先經原生繪製再回放，以免把未初始化的 Viewer 當成手勢失效；此項初始化限制保留後續評估，未更動正式擷取架構。

Chromium 連到更新後的正式元件，已回驗桌面拖曳、焦點與控制事件釋放。上述手勢與轉接檢查是無畫面 Node 模擬及 TD API 回放，**尚未經手機／iPad 真實觸控事件驗證**。

```text
node --test tests/unit/test_remote_panel_touch.mjs tests/unit/test_remote_panel_input.mjs
python tools/dev/submit_job.py tests/td/test_remote_panel.py --report remote-panel
```

2026-09-15：Windows TouchDesigner 2025.32820 通過 15 項原生檢查，涵蓋獨立建立／重建、TOX 重載、內嵌資源、來源模式、LAN 停用邊界與既有 Shader 狀態保留。

另以本機 Chromium 瀏覽器連到真實 TD，驗證按鈕、滑桿及 MAT 原生 Viewer 旋轉；第二個瀏覽器顯示使用中，來源無效後可恢復，斷線會清除 peer 並停用 Video Stream Out。獨立 TOX 移到 Grape 外後也完成影像與按鈕／滑桿往返。靜止面板持續送影格後觀察到 960 × 540 接收影像；WebRTC 仍可依條件調整畫質。

同一台 Windows 電腦的 loopback 與 Tailscale IP 均完成連線；這不代表已在 iPad、另一台電腦或 macOS 實測。觸控及鍵盤尚未加入本元件。來源與使用方式見 [Remote Panel](../../src/remote_panel/README.md)。

2026-09-16 依使用者回報重現 MAT 深度顯示問題：相同 MAT 經過 OP Viewer COMP 再擷取時，圖像有三角形遮蔽錯誤；直接以 OP Viewer TOP 擷取則正常。TOP 的 Allow Panel Interaction 開關不解決這項問題。現在直接擷取 Target OP，COMP 只接收滑鼠；實測直接擷取的影像仍跟隨 COMP 互動旋轉。更新後 16 項原生檢查及瀏覽器旋轉回驗通過，TOP 棄用警告消除。這是目前 TD 2025.32820 的本機重現與避開方式，尚未定位 TD 內部根因或適用的其他版本。

Remote Panel 0.1.1（2026-09-16）補充：20 項原生檢查通過，新增指定 Viewer 重設、舊端／舊來源訊息失效與 Panel 模式不提供 Viewer 重設。Chromium 連到真實 TD 後，已驗證點入面板出現焦點框、H 送達目標、Shift+H 與 Tab 離開後的 H 不增加 TD 控制事件。第二分頁連線時第一分頁顯示 Taken over；舊端操作不再增加事件，第一分頁按 Connect 可重新接管，原生 peer 數維持 1。

`resetViewer()` 不是原生 H/Home 的等價替代：實測 MAT 的顯示選項重設，但旋轉視角保持；此限制已告知使用者並記錄在元件說明。直接讀取本機 TD 2025.32820 的 Panel COMP／OP Viewer COMP 方法，確認沒有 `interactKeyboard`。官方範例的同名呼叫是預留內容，其 README 也標示鍵盤尚不支援。原生快捷鍵與次要 Viewer 拖曳更新時機仍待後續。

## 不需要 TD 的檢查

在根目錄執行 `python tools/dev/run_tests.py`。需要 Python 3.11+ 與 Node.js；來源與 fixtures 都由本 checkout 提供。

檢查包括核心／來源模型、GLSL 與既有圖相容、HTTP 本機／LAN 邊界、Editor Launch、語系鍵、品牌來源，以及編輯／匯入模型。

## 瀏覽器

安裝 Playwright 及 Chromium，或以 `PLAYWRIGHT_MODULE`、`CHROME_EXECUTABLE` 指定本機工具位置。這些設定不要寫入產品來源。

```text
node tests/browser/test_native_viewer.cjs src/editor tests/fixtures/editor-state.json <report-directory>
```

測試使用攔截的 fixture API，不修改使用者的 TD 圖。其他 browser harness 的參數列在檔案開頭；需要特定歷史情境的驗證，不應直接套用目前使用者的專案。

## TouchDesigner

開啟開發 TOE 並啟用開發橋接後：

```text
python tools/dev/submit_job.py tests/td/test_native_sources.py --timeout 60
python tools/dev/submit_job.py tests/td/test_custom_parameters.py --timeout 60
python tools/dev/submit_job.py tests/td/test_glsl_annotations.py --timeout 60
python tools/dev/submit_job.py tests/td/test_sampler_split.py --timeout 60
```

這些測試建立獨立臨時元件，完成後清理，並比較使用者 Shader 的保存內容。報告與測試 TOX 都寫入私人工作目錄。

遷移驗證另要求：在沒有舊資料夾與私人工作區依賴的位置，重新啟動 TD，檢查內嵌來源、圖、編譯結果及 Editor API。未完成的跨平台驗證要明確列出，不能以同一台機器上的不同網址代替不同裝置實測。

## 獨立重開 TOE（Windows）

先保存已更新內嵌來源的開發 TOE，再準備一個 repository 外、尚不存在的測試資料夾：

```text
python tools/dev/prepare_cold_start.py <new-test-directory> --td-bin <TouchDesigner-bin-directory> --original-pid <current-TD-process-id>
```

以新的 TouchDesigner 程序開啟工具輸出的 TOE 路徑。探針會比對保存狀態、GLSL、24 份內嵌來源、各 Shader 的 state／shaders／preview API 與 Editor 資源。成功後寫入 `cold-result.json` 並關閉測試程序；原程序 ID 是避免關錯工程的保護。

沒有報告不能視為成功：先確認 `started.json`、TD 的 Textport 與實際開啟的副本。全域 Cooking 或其他阻塞也可能讓探針無法完成；不要僅憑無回報判定原因。`.toc` 必須使用 LF，且需檢查 `toecollapse` 的缺檔警告，不能只看回傳碼。

## MAT 原生預覽

```text
python tools/dev/submit_job.py tests/td/test_material_preview.py --report mat-native-preview
```

此測試分幀執行，runner 回報 `started` 只代表開始；請讀取回報目錄中的 `native-result.json` 並確認 `passed: true`。測試保留使用者的圖，臨時元件在成功或失敗後自行清除。


## 0.8.73 手寫節點與圖互動

```text
node tests/browser/test_glsl_code.cjs src/editor <current-editor-state-json> <code-report-directory>
node tests/browser/test_node_interactions.cjs src/editor <current-editor-state-json> <interaction-report-directory>
python tools/dev/submit_job.py tests/td/test_glsl_code.py --timeout 60
```

瀏覽器 fixture 的 catalog／typeContract 需與測試 checkout 一致；harness 使用獨立 HTTP API，不寫入 TD。互動測試涵蓋預設全節點及 header-only 兩種程式設定。輸出的 `code-graph.json`、`subgraph-graph.json` 可交給 `compile_graph` 再驗證序列化結果。

本輪已通過核心／介面 8 項新增單元測試、9 項 GLSL Code 瀏覽器檢查、18 項節點／Subgraph 互動檢查，以及 Windows TD 13 項原生檢查。瀏覽器事件包含 Chromium 真實觸控派送；iPad／macOS 實機回驗不計入此數字。

回歸另通過：19 項既有觸控操作、Chromium 7 項及 WebKit 6 項接線定位、6 項 TD 原生 GLSL 註解／錯誤定位檢查。正式 TOE 已保存更新來源，四份使用者 Shader 的 state／graph／manifest／GLSL 保留。

## Master 預設圖

`tests/td/test_native_naming.py` 經由原生建立按鈕驗證 TOP／MAT、TDFam 名稱查找、目前編譯紀錄與不需升級的預設圖，也檢查開啟 Master Editor 後身分仍保留。`tests/td/test_master_templates.py` 驗證全新 MAT 只有一張預設 Sampler 圖與一個編譯 Info DAT，並以舊 shader shell 的隔離 fixture 重現模板升級需求，確認更新明確報錯且原圖不被改寫。

2026-09-15 兩項 TD 檢查及 53 項相關 Python 單元測試通過。原生 Master 清理前後的 TOP 輸出與 MAT 驗證 Render 像素相同；TD OP 身分、既有人工位置與參數值保留。檢查為 Windows TD 原生實測，不計為跨平台驗證。

## MAT 即時預覽套用掛起（0.8.81，2026-09-16）

TD 2025.32820、Windows 上可重現：MAT 的 Pixel 圖保留 Texture Coordinates →
Texture 2D，以及同一個 UV → Combine（vec4，XY=vec2，Z/W=0）。開啟即時預覽，
把 Color Output Buffer 0 從 Texture 2D 改接 Combine。0.8.80 已在獨立測試 MAT
與不同 TD process 重現。套用、候選/實際 Render 驗證與 candidate 清理均成功；
下一次 Remote Panel `panel_image.cook(force=True)` 不返回，未進入 Video Stream
Out 的 forced cook。直接建立相同 UV/W0 圖再預覽正常；TOP 同圖與原生編譯正常。
改成 threadedprevious 仍無法避免此掛起。這些證據定位到既有 MAT 更新後的
原生 viewer 擷取時機；沒有 native stack 證據可指認 TD／驅動內部的鎖。

0.8.81 在 commit/rollback 前鎖定當前 capture，暫停 stream cook，保留最近影像；
三個完整 callback 後解除。回歸必須確認 **畫面已改成 UV 色彩且後續擷取仍持續**，
不能只看 API 回報成功、綠燈或舊影片。反向接回 Texture、再接 Combine，以及
原生 GLSL 錯誤與注入 commit 失敗也要檢查預覽恢復、原圖與上一份成功 Shader 保留。

`tests/unit/test_remote_capture_update.py` 覆蓋獨立元件的暫停／恢復、重疊更新、
resize、來源/連線切換及 inactive 狀態；圖語意與 catalog 沒有更新，不新增升級門檻。
私人逐階段紀錄與故障重現截圖保存在開發工作目錄，不納入產品。

實測結果：修正後在同一個 WebRTC peer 上反覆切換 Texture ↔ UV 成功，捕捉
cook 次數持續增加；原生無效 GLSL 的節點定位與上一份成功內容保留通過，
注入 commit 失敗後圖／state／manifest／兩份 GLSL 完整還原，capture 自動解除。
TOP／MAT 向量原生 27 項案例與 Master 檢查通過。可攜完整檢查通過，Remote Panel 相關行為測試共 15 項通過（本次新增 10 項）。兩份使用者圖與產碼對原始備份完全相同；
Master 已同步、正式 TOE 已保存；沒有修改任何 catalog 定義或圖結構。


## 節點緊湊顯示（0.8.83，2026-09-16）

```text
node tests/browser/test_inline_vector_values.cjs src/editor <current-editor-state-json> <inline-report-directory>
node tests/browser/test_vector_presets.cjs src/editor <current-editor-state-json> <preset-report-directory>
node tests/browser/test_node_interactions.cjs src/editor <current-editor-state-json> <interaction-report-directory>
python tools/dev/submit_job.py tests/td/test_editor_save_status.py --report compact-save-status
```

本輪 203 項 Python 單元測試與完整可攜檢查通過。瀏覽器共 43 項檢查：21 項數值／Vector 互動、4 組維度入口、18 項既有節點／Subgraph 操作；零頁面錯誤。檢查包含預設收合、左右接孔對齊、展開後寬度不變、已接入或接出的分量保持可見、YZ 分組與獨立 Z 輸出共存、float-only inline，以及欄位不重疊、不越界與標籤不截短。實際截圖已檢視。

TD 2025.32820、Windows 原生 TOP／MAT 的展開與收合均確認：保存 UI 狀態、`shaderUpdated: false`、不呼叫 configure、manifest／Shader DAT 不變；語意編輯仍正常更新。Master 模板同步、建立入口與舊模板拒絕檢查通過。本輪未改編譯節點定義，138 份既有 GLSL 指紋維持一致。瀏覽器觸控事件測試不代表手機／iPad／Safari 實機驗證。

0.8.83 的 24 份內嵌來源與服務資產於保存前再次核對一致；正式開發 TOE 已保存，保留當時的使用者 Shader，私人開發助手不寫入來源檔。

2026-09-16 收合摘要微調：inline／Vector 瀏覽器套件共 24 項通過，包含 Vector 2／3／4、部分分組覆寫、基底遮蔽與斷線恢復、分量別名、長數字完整提示、Parameter 與 inline Enter 提交同步、焦點及 Undo。摘要 render 不修改圖或歷史；截圖與欄寬檢查通過，零頁面錯誤。另通過 459 個雙語字串檢查及圖面保存狀態檢查。

2026-09-16 Color RGBA 微調：inline／Vector 瀏覽器套件共 31 項通過、零頁面錯誤。新增四框同列與命中區、HDR／負值、Alpha 保留、節點與 Parameter 雙向同步、數字切換調色盤的焦點、Undo／Redo、唯讀及不誤拖節點檢查；100% 縮放截圖確認緊湊排列。調色盤以原生 color input 的事件驗證數值流，未代替各平台原生彈窗實機測試。既有 Color／Label 套件前 11 項通過，其後因已過時的 Expose 選擇器停止，未計為整套通過，也未修改該舊測試。JavaScript 語法與圖面保存狀態檢查通過；24 份內嵌來源／服務資產一致，正式 TOE 已保存且保留使用者圖。
