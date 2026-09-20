# 開發狀態

2026-09-20 來源第二輪卡片檢查點 0.8.126：Common 六項時間預置以 TD Python 名稱顯示；未建立卡片保留類型色並降低亮度，首次引用才初始化。同名相容來源重用、不覆寫值／模式；衝突不偷偷建立改名副本。Custom Uniforms 分 Values／Matrices／Arrays，保留 Colors 原生頁標示。來源卡片可收合，右鍵與觸控操作共用選單、刪除沿用產品 overlay；缺失警告收合後仍可見。來源 DOM 依 ID 與 metadata 更新，選取／數值不重建卡片，改名只替換該卡片；一般新增不再混入時間預置。原生 TOP／MAT 六項初始化回歸、來源卡片 8 組、既有來源 13 組、即時控制 10 組、缺失 5 組、刪除／Colors 5 組通過。完整 portable checks：474 Python 測試及 JS／整合檢查、716 雙語鍵驗證通過；已檢視窄面板截圖。同步與 TOE 保存另記。下一輪為 Texture Buffer／POP Buffer，不插入 GLSL OP 狀態卡筆記。

2026-09-20 0.8.125 交付檢查點：refresh／master 同步／唯讀 audit 成功，36 份嵌入來源、9 個主要網頁資源與版本一致，TOP／MAT master revision 73；三份使用者 Shader 保留。TOE 保存 944966 bytes，SHA256 `47ccc3a948546444860b3d22f9dd15f06351d442de98d3f2e94f659cfc79695c`。報告 `work/reports/source-multi/`。master 第一次送出前遇到工作佇列檔案暫時鎖定，尚未執行，單獨重送成功；未強制刷新使用者網頁。

2026-09-20 來源第二輪即時控制檢查點 0.8.125：图內 Uniform scalar／vector 引用共用 Parameter 數值元件與 TD 實體；可見控制依來源 ID 去重訂閱，離開視野退訂，值訊息合併到一幀更新且不保存圖。批次訂閱只讀一次圖；原生每輪只評估宣告的分量。保留值／模式／Parameter 身分衝突檢查及 Bind、手勢合併與 Undo。訂閱失效通知若碰到忙碌或已在請求，會保留刷新需求；沒有提高全清單輪詢頻率。474 Python 與 JS／整合 portable checks、原生 13 組及瀏覽器 10 組、刪除／Colors 5 組通過，已檢視圖內控制截圖。200 來源初始化約 14.21 ms、一次全來源 tick 約 4.86 ms（本機單次量測），成本拆解見[即時 Uniform 紀錄](../discussions/UNIFORM_LIVE_EDITING.md)。完整 Common／Custom 卡片尚在第二輪主線，非宣稱本輪已完成。同步與保存另記。

2026-09-20 0.8.124 交付檢查點：refresh／master 同步／唯讀 audit 全部成功，36 份嵌入來源與 9 個主要網頁資源一致，TOP／MAT master 為 revision 72；三份使用者 Shader 保留。TOE 已保存（943710 bytes，SHA256 `14882dc15bfda4bc4ccde5c41c1e498332e58dcdcbfc602e76e6887036ce40f0`），沒有強制刷新使用者網頁。報告 `work/reports/source-review/`。

2026-09-20 來源第二輪審查檢查點 0.8.124：來源刪除改為頁面內 overlay 確認卡，取消／Esc 不送出請求，確認保留原生 edit token；切換圖或引用數變更時不執行過期刪除。Colors 新建／編輯只提供 float／vec2／vec3／vec4，分量使用 R／RG／RGB／RGBA 語意，既有其他型別原樣保留並提示調整，不自動改接線。新瀏覽器驗證 5 組、既有來源 13 組、705 個雙語鍵驗證通過；已檢視 overlay 截圖。Ucc 殘留回報已確認仍在 TD Colors，使用者撤回同步問題。另記 GLSL OP 狀態卡為五輪完成後的獨立待辦。本檢查點沒有改輪詢、WS、原生值／模式、GLSL 產碼或使用者圖；Common 卡片與多來源即時控制接續第二輪。同步與保存另記。

2026-09-20 0.8.123 交付：`13dd2f0` 已同步 9 份 DAT；36 份來源、9 份服務資產、TOP／MAT Master（revision 71）及三份使用者 Shader 保留核對通過。原生來源 6 組、Spec 回歸 26 組均通過；舊測試的拒絕結果判讀已在 0.8.122 對照確認。正式 TOE 943,206 bytes，SHA-256 `ee03e559772d9db62452189371877d64f53633e7da1056bb759c15e184dc24e1`，已保存並排除私人助手；未重新整理使用者 Editor。第一輪完成，第二輪接續 Common／Custom 卡片與 Uniform 引用 UI。

2026-09-20 0.8.123 來源檢查點：完成來源計畫第一輪。原生陣列型別與 constructor／預設值展開上限分開，一萬元素 TOP／MAT Uniform Array 匯入及產碼通過，不保存 CHOP 樣本。新 TD Constants 列以 float 匯入，既有型別／constant_id 保留；來源驗證、GLSL 編譯、一般套用失敗分開標示。拒絕匯入的原生項目可搜尋並顯示原因，缺失卡片保留且不再新增引用；使用到的缺失來源阻擋套用，未使用的既有無效資料不阻擋無關有效 Shader。來源快照仍不做 Spec 值驗證掃描。完整 portable checks（474 Python 及 JS／整合）、既有來源瀏覽器 13 組、新狀態 5 組、TOP／MAT 原生 6 組通過。Spec 原生回歸中一項舊測試只接受例外；已在 0.8.122 證明原流程回傳 `ok:false / blocked:true`，修正測試接受明確拒絕並核對原生值／state／GLSL 不變，沒有放寬產品驗證。報告 `work/reports/source-inventory/`；同步 TD 與保存 TOE 另記。Texture Buffer 完整能力仍待第三輪。

2026-09-20 來源審查／探測檢查點：記錄[五輪接續計畫](../discussions/SOURCE_COMPLETION_PLAN.md)，區分已交付的共用來源表／Parameter 分量控制與未完成的卡片、圖內控制、Buffer、MAT Attribute、結構 UI。原生實測 float Spec Constant 可用；固定 float Uniform Array 1024–10000 個元素的五組測試均編譯成功並抽查到正確值。已定位新 TD Constants 一律匯入 int、Uniform Array 被產品 1024 上限拒絕、Texture Buffer 缺少引用／讀取支援。新增重現探測腳本，詳見計畫；產品修正尚未實作。缺失來源的視覺、引用及恢復規則標示為提案，來源管理與圖上引用暫維持分開。本批僅文件及探測腳本，產品／TOE 仍為 0.8.122，未操作使用者圖或刷新網頁。

2026-09-20 0.8.122 交付：`cd4d2b5` 已同步 5 份 DAT；36 份來源、9 份服務資源、TOP／MAT Master（revision 70）與三份使用者 Shader 保留核對通過，刷新沒有模組錯誤。TOE 942,110 bytes，SHA-256 `c5d67b92689cd135ecc0eb55f9fe07b05ecfca754608ea45d4c85c2856331837`，已保存。首次保存請求在外部橋接 request.json 替換時遇到 Windows 檔案占用、尚未送入 TD；重送成功。詳細紀錄 `work/reports/source-controls/`；沒有重新整理使用者 Editor，也沒有改動 Uniform 寫入權限或訂閱協定。

2026-09-20 0.8.122 Uniform 分量 UI 檢查點：Parameter 依宣告顯示 1–4 格，使用一般數值元件的共同分量排版；隱藏的原生分量不修改。Expression／CHOP Export 不再顯示數值滑桿，改顯示模式（窄格 Export，提示完整 CHOP Export）；Constant 與原本允許寫入的 Bind 保留控制。值更新不重建控制、靜態模式文字或驅動說明；模式改變只替換自己的格子。完整 portable checks、來源互動 13 組、即時通道 8 組與新分量顯示 6 組通過。來源互動測試中舊 Uniform 出口名稱預期在既有版本也已失效，調整為目前 out 出口規則後全數通過。本批尚未擴大 Bind 寫入支援，也未加入來源卡片或圖內控制；後续需一併整理可見來源即時訂閱。

2026-09-20 0.8.121 交付檢查點：`0fbbcca` 與熱更新修正 `9784c97` 已同步 TD。首次熱更新因新 DAT 晚於引用模組建立而載入失敗；已修正依賴順序並在刷新後檢查 type contract，按依賴順序重載恢復。之後 36 份 DAT／9 份 HTTP 資源、TOP／MAT Master（revision 69）、core 無錯誤與三份使用者 Shader 保留均通過。正式 TOE 941,414 bytes，SHA-256 `4eae8a6fdee465daefe7932dea0b437d1be4355a2cee3c40bdaf762d912ba38b`。報告 `work/reports/source-catalog/`；未重新整理使用者網頁。

2026-09-20 0.8.121 來源表檢查點：新增共用 `source_catalog.json`，編譯器、TD 初始化與 UI 由同一份表讀取預置。既有四個時間來源保留 ID／名稱，新增 Delta Time（`absTime.stepSeconds`）與 Frame Step（`absTime.step`），只在新來源建立時填入 Expression；既有 TD 值／模式不重設。內建結構、來源陣列與長度巨集搬入同表，舊型別與產碼維持相容。完整 portable checks（470 個 Python 測試及 JS／整合檢查）與隔離 TOP／MAT 六項原生檢查通過。這一批完成共用資料入口；來源卡片、結構編輯面板、圖內 Uniform 控制、MAT Attribute 與 Buffer UI 仍接續實作。

2026-09-20 討論檢查點：已記錄[來源建構、型別與 MAT Attribute](../discussions/SOURCE_ARCHITECTURE_REVIEW.md)，區分 UI 分類與建構方法、首次初始化與引用／修改、結構完整／欄位雙出口、資料可擴充的型別檢查及產碼責任。MAT Attribute 回到來源主線，常用預置是否預建、清單與原生配置的區別仍待確認；Matrix 與 Attribute 的來源歸屬及配置接續整理。官方文件已核對 Name／Type／Array Size 與內建 accessor，沒有 TD 實機驗證。延伸的 [Loop／控制流程](../discussions/LOOPS_DISCUSSION.md) 已補入既有筆記，明確區分子圖／函式、bool 停止條件與待決的執行順序；不插入本輪實作。本批只有文件，版號維持 0.8.120。

2026-09-19 分類審查檢查點：完成 [來源選單分類表](../discussions/TD_SOURCE_MENU_REVIEW.md)，提出六大入口與二級用途／Texture 維度分組；時間預置保留六項、Timeline Rate 移出，低頻 Clock／CHOP 時間細項等記為使用者自行新增。Project Rate／System Time 等助手建議另標待確認。原始研究總表保留，38 筆時間列新增審查欄；CSV 的 311 筆全部補上分類、項目性質與審查決策，原 13 欄資料不變。集合欄位、運算／取樣、可寫資料、歷史與未支援 stage 分開處理，不把每列當成來源入口。本批只更新文件，尚未改產品分類、命名或支援能力，版號維持 0.8.120。

2026-09-19 0.8.120 交付檢查點：來源 `9c71185` 已整合 main，同步 6 份 DAT；34 份來源及 10 份核對的服務資源一致，TOP／MAT Master current（revision 68），core 與 Uniform WebSocket 無錯誤，三份使用者 Shader 保留。頁首、About、TD runtime 實際服務版號均為 0.8.120。正式 TOE 925,846 bytes，SHA-256 `e95529a82104bbdbcb125140ceaa41149a40109dc09bcbefe7b9529699bd26a2`，排除一份私人助手。私人報告 `connection-card-{refresh,masters,audit,version,save}-20260919`；未重新整理使用者既有 Editor。

2026-09-19 0.8.120 來源檢查點：TD 連線提示改為畫布上方、工具列下方的半透明浮動卡片，加入靜態警告三角形；一般／專注編輯皆可見，不佔版面或推動工具列。沿用工具列 ResizeObserver 的高度資料定位，卡片文字、捲動、按鈕與觸控不觸發畫布操作。連線判斷、重試、同步與編輯規則未變。修正頁首與 About 長期停留 0.8.90 的版號，與 runtime 統一為 0.8.120，將三處核對納入交付流程。完整 portable checks、既有連線恢復 8 組、隔離版面與互動 7 情境通過；TD 同步與 TOE 保存另記。

2026-09-19 研究檢查點：完成 [TD 來源分類與命名總表](../discussions/TD_SOURCE_NAMING_RESEARCH.md) 與 CSV，涵蓋 GLSL TOP／MAT 公開來源家族、結構欄位、函數附表及既有版本差異。命名與分類為審查稿；沒有產品程式、UI、版本或 TOE 變更，也未執行新 Shader 驗證。產品仍以以下 0.8.119 交付狀態為準。

2026-09-19 0.8.119 交付檢查點：來源 `b5295d2` 已整合 main，同步 runtime／live 兩份 DAT；34 份來源與 10 份服務資產一致，TOP／MAT Master current（revision 67），三份使用者 Shader 保留。正式入口保存前後均確認 WebSocket ready／來源訂閱成功、無頁面錯誤。TOE 已保存 924,694 bytes，SHA-256 `5e7feaf088364a714269eb9299d250eeadecf1466000723caf0adf082229b649`，排除一份私人助手。本批只改後端，既有 0.8.118 網頁可自動重連；沒有強制重新整理使用者頁面。

2026-09-19 0.8.119 來源檢查點：使用者回報 Uniform 仍放開才同步，完整真實網頁入口重現票證 200、WebSocket 立即關閉。HTTP 的 `runtime._live` 存在而回呼 DAT 的 `service` 為空；改由 runtime 統一持有，HTTP／WebSocket／metadata 回呼共用同一實例。完整 portable checks（466 Python 單元測試）與 10 組 TD 回歸通過；新增完整網頁／TD fixture，在 loopback 與 Tailscale 位址各驗證按住時連續更新、TD 改值推送、單次 Undo／Redo、reload 重連。值更新不寫圖或 Shader，三份使用者 Shader 保留。同步與 TOE 保存另記；未宣稱偶發卡頓已解決或已完成 iOS 實機驗收。

2026-09-19 0.8.118 交付檢查點：來源 `83dfec0`、連線生命週期 `7e859b1`、延遲取消／Undo `78bb716` 已整合 main。34 份內嵌來源與 10 份核對的服務資源一致；core／Uniform WebSocket 無錯誤，TOP／MAT Master current（revision 66），三份使用者 Shader 保留。正式 TOE 924,550 bytes，SHA-256 `771e20e2363cccfc6a64aee5ad8e59b4a17069eeae4bde91ea6f2377817f317f`，排除一份私人助手。最終 portable checks 通過；回歸與範圍見下文。未強制重新載入使用者頁面。

2026-09-19 Uniform 即時數值（0.8.118，來源檢查點）：先交付 scalar／vector／Color Uniform 的數值通道，保留 HTTP 圖提交與其他設定。TD 原生 Web Server DAT、一次性 ticket、按需來源訂閱；連續拖曳合併為最多一個在途更新，結束只記一筆 Undo。值不進圖／版本／產碼；控件不作全域 busy 切換。名稱／型別改用 Parameter Execute 通知，排除實測約 26 ms 的 200 來源定時掃描；改後訂閱讀取與 sequence 數檢查約 0.07 ms。原生 9 組、真實 WebSocket 4 組、既有 TD 來源／history 42 組、瀏覽器 38 組通過；完整 portable checks 通過。功能與限制見 [Uniform 即時數值](../features/UNIFORM_LIVE_VALUES.md)。修改前版本固定於 `checkpoint/pre-uniform-live-0.8.117`。來源提交後再同步與保存 TOE；iOS 實機仍待使用者 review。

2026-09-19 0.8.117 交付檢查點：來源 `8ff5708` 已整合 main；32 份來源更新 7 份、9 份服務資源一致，core 無錯誤。TOP／MAT Master current（revision 65），三份使用者 Shader 保留。正式 TOE 915,318 bytes，SHA-256 `05f116db86f22413034b86e49072f5d0eeaa63a22c94ecbc98545420e8779629`，排除一份私人助手。完整 portable checks、65 組瀏覽器檢查、45 組原生條件通過。此次 A／B-C／E 分別有來源與 TOE 檢查點，修改前可回到 `checkpoint/pre-sync-performance-0.8.114`。未強制重新載入使用者頁面；新磁碟暫存與高頻值通道仍延後。

2026-09-19 同步效能 E 首批（0.8.117，來源檢查點）：普通 Uniform／原生值寫入沿用 HTTP、互斥、版本與 expected 值核對及現有 Undo；短暫鎖定改以 inert 保持無關控制項原外觀，真正唯讀／不可用及結構修改仍保留 disabled 樣式。來源與歷史快照逐批建立唯一名稱索引，消除每一來源再讀完整 TD 來源表，reconcile 同時改用名稱計數／索引；不跨請求保留 native 值。值更新在 1／100／200 來源測試均零產碼、零 state／graph DAT 寫入。200 來源仍約 203–221 ms，保留完整快照／歷史保護的線性工作與 TD API 成本尚在，不宣稱達成高頻即時值通道；WebSocket／連續手勢、單值歷史專用協定另行評估。新磁碟暫存仍未實作。

2026-09-19 0.8.116 交付檢查點：來源 `91040dd` 已整合 main，32 份來源更新 2 份、9 份服務資源一致，core 無錯誤；TOP／MAT Master current（revision 64），三份使用者 Shader 保留。正式 TOE 914,750 bytes，SHA-256 `3dd1d6cd908f270acaa247df0a7393eb05e95074c5fd3b90791d074ed56b20bf`，排除一份私人助手。未重新載入使用者頁面。

2026-09-19 同步效能 B／C（0.8.116，來源檢查點）：保持原 API、650 ms 排程、成功 state／DAT 與原生套用保護，僅重用同編譯器／節點庫下已通過的純圖產碼結果，以及單份完全相同的成功 state 檢查。有限布局欄位不進產碼鍵；Label／註解、未知 UI、來源、函式與數值仍在鍵內。冷啟動／失效會完整檢查；沒有常駐 worker／輪詢或新增存檔。快取上限 8 份／序列化鍵與結果合计 4 MiB，另單份成功 state 最多 1 MiB 原文；不是 Python heap 大小保證。原生來源、版本競爭、manifest／shader DAT 核對照常執行。原生 TOP／MAT 的 16／101 節點布局同步暖態均由 6 次 Python 產碼降到 0，未新增 native compile／cook；完整 portable checks 通過。

2026-09-19 0.8.115 交付檢查點：來源 `f6d2b68` 已整合 main，32 份嵌入來源更新 6 份、9 份服務資源一致，core 無錯誤；TOP／MAT Master current（revision 63），三份使用者 Shader 保留。正式 TOE 913,294 bytes，SHA-256 `d8d148be42e4ffe51b631ea8e4bbdbd504861e70654a4deba4945e3641c1f37f`，排除一份私人助手。完整 portable checks 與 74 組瀏覽器檢查通過；未重新載入使用者 Editor。後端同步效能接續處理。

2026-09-19 同步效能 A（0.8.115，來源檢查點）：修改前完整版本固定於 `checkpoint/pre-sync-performance-0.8.114`（`3d78314`），TOE 雜湊與 0.8.114 交付相同。純位置／尺寸／收合／分量展開與選取排列經有限布局欄位比對後，不再做 Auto／常數檢查或重建無關節點庫及來源側欄；普通標籤、註解、數值、型別及未知差異仍走原路徑。保留既有 Undo 快照、立即 sessionStorage、650 ms 同步與 API。74 組瀏覽器檢查通過，詳見 TESTING。後端重複產碼及同步路徑接續處理，尚未宣稱整體效能工作完成；TD 同步保存另記。

2026-09-19 0.8.114 交付檢查點：來源 `225c737` 已整合 main；32 份來源更新 6 份、9 份服務資源核對一致，core 無錯誤。TOP／MAT Master current（revision 62），三份使用者 Shader 保留。正式 TOE 912,918 bytes，SHA-256 `4206780ecc62611d10e98771d4af1499d6fff651061ec759c7223ad9ce447278`，排除一份私人助手。44 組瀏覽器檢查通過；未強制重新整理使用者頁面。

2026-09-19 0.8.114 來源檢查點：依操作 review 將平移／縮放預設改為 150 ms、Frame 過渡改為 333 ms，兩組仍預設關閉並保留已有瀏覽器偏好。設定名稱採 Frame 過渡（F）／Frame transition (F)。H、Home 按鈕與右鍵 Home 一律立即顯示整圖並結束待執行過渡；F 無選取時共用整圖目標但保留 Frame 過渡設定。有選取／未選取、四種開關組合、快捷鍵輸入隔離及保存／Reset 的驗證見 TESTING。其他效能回報只記錄，不在此批修改。

2026-09-19 0.8.113 交付檢查點：來源 `99b4ac2` 已整合 main；32 份來源更新 7 份、9 份服務資源與來源一致，core 無錯誤，TOP／MAT Master current（revision 61），三份使用者 Shader 保留。正式 TOE 912,830 bytes，SHA-256 `ae17106ae44474ac45943ae876e232c27d583bb4a3a35f4d10d5c51cecf2cfba`，排除一份私人助手。71 組隔離瀏覽器檢查及 971 組雙語鍵通過；未強制重新整理使用者分頁。等待此次插值與 H／F 的實際操作驗收。

2026-09-19 0.8.113 來源檢查點：修正連續平移反覆重設插值起算時間的停頓；改為保留上一顯示幀時間，只更新目標與結束時間。平移／縮放與 Home／Frame 共用動態更新程式，各自開關／時間、預設關閉／250 ms、10–1000 ms 共用數值編輯器；已有儲存值保留。H=Home 全圖，F=Frame 選取或無選取回退 Home，沿用文字／組字／手勢隔離。載入與 Stage／子圖導航仍立即；未修改圖內容或 TD Viewer。隔離瀏覽器驗證見 TESTING；完成後交由使用者確認實際手感，不擴大到其他效能筆記。

2026-09-19 0.8.112 交付檢查點：`b1e1bb5` 已整合 main，32 份來源更新 7 份、9 份服務資源一致，core 無錯誤；TOP／MAT Master current（revision 60），三份使用者 Shader 保留。正式 TOE 912,366 bytes，SHA-256 `82cfb72dba75ebc71a935f5444bc6e84433a2fc3335c2af79460fc8e1e156daf`，排除一份私人助手。未強制重新整理使用者頁面；阻尼預設關閉，100 ms 設定待實機驗收。

2026-09-19 畫布平移／縮放阻尼（0.8.112 實作檢查點）：依使用者最後規則，實驗功能「色彩與顯示」新增左側勾選框與右側共用數值滑桿，10–1000 ms、預設 100 ms 且不勾選。啟用時單一短暫 rAF 只更新顯示 pan／scale，滑鼠／觸控／滾輪／縮放預設共用；快速輸入保留累積目標，座標與網格同步。停用時取消回呼、清掉目標與專用 listeners，回到立即更新，沒有 CSS 過渡；設定只在本機保存，不改圖／Undo／Shader。9 組新測試與 93 組既有設定、縮放、選取、數值操作檢查通過。H 多選置中另記待決，未實作。TD 同步保存另記；實機手感待使用者驗收。

2026-09-19 0.8.111 交付檢查點：`79cbcb9` 已整合 main，32 份來源更新 3 份、9 份服務資源一致，core 無錯誤；TOP／MAT Master current（revision 59），三份使用者 Shader 保留。正式 TOE 910,982 bytes，SHA-256 `9df82a4c7c6ca35a7715604182f9659d3949085b7025d9d83f8b1886c6682d29`，排除一份私人助手。實際 TD Shader 頁面獨立瀏覽器點擊空白畫布，16 個節點 DOM 保留、graph 不變、零完整 render／POST／JS errors。未重新整理使用者目前的頁面。

2026-09-19 畫布放開掉幀（0.8.111 實作檢查點）：空白畫布 pointerup 無條件呼叫 render，連無選取變化也重建節點／接線並刷新側欄；隔離 16 節點量測 20.5–23.1ms、101 節點 124.4–138.6ms，均在放開時。改為無選取時直接返回；取消單／多節點或接線選取、完成滑鼠框選時只更新選取 class、Parameter 與操作狀態，保留節點／wire／群組框 DOM；触控空白點擊共用取消流程。修正後同探針 16／101 節點均零完整 render／renderCards／wires／library／來源面板呼叫。7 組新 browser、12 組 selection toolbar、15 組 Parameter 與 syntax 通過；真實硬體整體 FPS 尚不據此保證。保存交付另記。

2026-09-19 0.8.110 交付檢查點：`df999fb` 已整合 main，32 份來源更新 2 份，9 份資源一致，core 無錯誤；TOP／MAT Master current（revision 58），三份使用者 Shader 保留。正式 TOE 910,790 bytes，SHA-256 `5fad9243009e949328e90f91ef327a74c5c3225fbf21aeb8e099cf06997cc40a`，排除一份私人助手。實際 Shader 頁面獨立 Chromium 連續載入／reload 10 次，均有兩個語言選項與 16 個節點，零失敗請求／JS errors。未重新載入使用者目前的 Editor。

2026-09-19 重新整理缺少介面（0.8.110 實作檢查點）：在實際 TD HTTP 服務的獨立 Chromium 頁面重現部分腳本 `ERR_CONNECTION_REFUSED`，缺少 app.js／依賴時初始化中斷，留下未翻譯的空介面。六次同條件對照，HTTP/1.0 有五次載入不完整，HTTP/1.1 六次資源完整；尚未據此判定 Windows／TD 內部拒絕連線的機制。改為重用 HTTP/1.1 連線，沿用 5 秒 idle timeout、Content-Length、Host／Origin／token 邊界；錯誤回覆與帶有未讀 body 的靜態 GET 關閉連線，避免下個請求邊界混淆。21 項 LAN／share 測試通過，包含重用、拒絕寫入不改狀態及重啟後舊連線拒絕寫入。連線 backlog 的試驗沒有改善，已還原，未納入產品。保存交付另記；畫布放開滑鼠的全圖重建問題接續修正。

2026-09-19 0.8.109 交付檢查點：`a3b675f` 已整合 main，32 份來源中更新 6 份、9 份服務資源一致，core 無錯誤；TOP／MAT Master current（revision 57），三份使用者 Shader 保留。正式 TOE 保存 910,558 bytes，SHA-256 `eb75c7c78080ef46488b6f0641542a4369798fd7c4f6d42bf43cc254df92edf6`，排除一份私人助手。未重新載入使用者 Editor；圖／參數／連線保留。

2026-09-19 FPS 精簡指標（0.8.109 實作檢查點）：使用者將歷史改為 10 秒，並同意 FPS／1% Low／Min 三個數字。FPS 為最近約 1 秒的回呼數除以實際經過時間；Low／Min 使用最近 10 秒的原始幀間隔，每秒更新。Low 取最慢 ceil(N×1%) 幀間隔平均後倒數換算 FPS（1000×K／sum(dt)），不足 100 個樣本先顯示「—」；Min 為 1000／最大單幀間隔，不是最小的一秒平均 FPS。參考 [FrameView 的慢幀平均概念](https://images.nvidia.com/content/geforce/technologies/frameview/frameview-1-4-user-guide-web-version.pdf)，不混用 percentile 或時間權重定義。圖仍為 10Hz 繪製的區間尖峰，縮為 100 格，統計不從這些降採樣格反推。原始樣本固定 16,384 格循環緩衝，取樣 O(1)，只在每秒統計時複製至重用 scratch 並以原生 typed-array 排序；三個 Float64Array 共 384KiB，仅開啟時分配，若極端回呼率使 10 秒樣本超容量則顯示「—」，不偷偷縮短窗口。背景／關閉既有清理行為保留。4 組 FPS、20 組 experiments、693 雙語鍵及 JS syntax 通過；實機 iOS／其他硬體尚未量測。同步保存另記。

2026-09-19 0.8.108 交付檢查點：`9fcc471` 已整合 main，32 份來源中更新 6 份，9 份服務資源一致，core 無錯誤；TOP／MAT Master current（revision 56），三份使用者 Shader 保留。TOE 保存 909,526 bytes，SHA-256 `ef6c44be30bd493926170287b994fced0878752c5a1150561ff2f3542bd56a9b`，排除一份私人助手。曲線為圖編輯區左下的小型 overlay，不佔節點布局，窄版避開底部操作鍵。未強制重新載入使用者 Editor。

2026-09-19 FPS 歷史曲線（0.8.108 實作檢查點）：依使用者最後確認，只保留 FPS 數字及一條幀間隔曲線，不加入卡頓計數／最長間隔等統計面板。沿用原實驗開關、預設關閉；每幀取樣，每秒更新 FPS，曲線最多 10 Hz，300 個 100ms 時間格保存最近 30 秒的區間尖峰。固定 typed arrays、每幀 O(1) 寫入，不搬移歷史、不查節點、不連 TD；繪圖只掃固定 300 格。停頓缺口不補造樣本，尖峰仍留下；關閉釋放 canvas，背景停止並於恢復時重建歷史。390／320px 避開底部操作鍵。FPS browser 3 組、既有 experiments 20 組、690 雙語鍵與 JS syntax 通過。7,200 個合成 120Hz callback 的本機 Chromium JS／Canvas 提交耗時平均約 0.002ms、最大約 0.30ms；非 GPU 完成時間，也不能代表實機 iOS 或總電力／幀率影響。同步與保存另記。

2026-09-19 0.8.107 交付檢查點：`de87400` 已整合 main，32 份來源中更新 7 份，9 份服務資源一致，core 無錯誤；TOP／MAT Master current（revision 55），三份使用者 Shader 保留。TOE 保存 908,470 bytes，SHA-256 `47dc7be5e26619105e8cc77ce1ced86d44c3b3d2fe53c0e0f79b2fdadd5f6f49`；排除一份私人助手。沒有強制重載既有 Editor 頁面。

2026-09-19 實驗 FPS（0.8.107 實作檢查點）：「實驗功能 → 色彩與顯示 → 顯示 FPS」預設關閉，偏好只保存在該瀏覽器。開啟後於圖編輯區左下角顯示 requestAnimationFrame 回呼頻率，以實際經過時間計算，每秒更新一次文字；不是 TD cook／預覽影片 FPS，也不是 GPU 呈現完成率。關閉不啟動採樣，背景分頁暫停並於回前景重新計時；不發送 TD 請求，不更動 graph／Undo 或重畫 wires。`test_fps_display.cjs` 2 組及既有 experiments 20 組通過，涵蓋真實幀、停頓、重複開啟、暫停恢復、預設與 390px 位置；690 locale keys 通過。同步與 TOE 保存另記。

2026-09-19 0.8.106 交付檢查點：`5319560` 已整合 main，32 份來源中 6 份更新，9 份服務資源一致，core 無錯誤；TOP／MAT Master current、revision 54，三份使用者 Shader 保留。TOE 已保存 907,878 bytes，SHA-256 `0929cdebe607ddcc2b1ac07dde6fbb794f925f269e62acf0165cdb96f98f4a2e`，排除一份私人助手。分層型別選單與矩陣四則均已在 TD 0.8.106。使用者既有 Editor 頁面未強制重載，避免丟失未套用草稿。

2026-09-19 矩陣四則（0.8.106 實作檢查點）：既有 Add／Subtract／Multiply／Divide 新增 mat／dmat 異型輸入簽名，補 double／dvec；Auto 依輸入順序與矩陣形狀推導結果。手動選單鎖定輸出型別；核心、接口與拉線搜尋共用有限型別表，沒有值求解或 TD 輪詢。一般圖的 138 組編譯基準不變。完整 portable（451 項 Python）通過；352 組簽名編譯與存檔往返、4 組新瀏覽器操作、11 組搜尋回歸通過；360 項 TOP／MAT Pixel／MAT Vertex GPU 檢查通過，使用者 Shader／registry 保留、fixture 清除。101 節點清單開啟 24.8–37.9 ms，查詢 1.3–11.1 ms，文字變更零 planner 呼叫。同步與保存另記。[矩陣規格](../features/MATRIX_NODES.md)

2026-09-19 0.8.105 交付檢查點：`d66a575` 已整合 main，同步 32 份來源中的 8 份變更；Master 為 0.8.105、core 無錯誤、三份使用者 Shader 保留。保存 TOE 905,854 bytes，SHA-256 `49c73dacac644ca6f4c33ab76263fa262552ae98c06d5a5eaa3b27c45d085b9f`，排除一份私人助手。沒有重載使用者目前的 Editor 頁面；矩陣四則運算接續進行。

2026-09-19 型別選單（0.8.105 實作檢查點）：依 Final Check 統一 Floating／Integer／Boolean／Matrix，Double 收到第三級。Auto、signed/unsigned 及方形/非方形矩陣用水平線分組，Matrix 方形優先。共用選單涵蓋節點／Parameter／來源／Function／GLSL Code 與型別篩選，維持原有合法選項與提交路徑。16 組瀏覽器檢查通過，涵蓋完整型別、三級、Undo、草稿、320px、UI 縮放與鍵盤／觸控；同步與保存另記。接續已授權矩陣四則異型簽名與 Auto，尚未宣稱已完成。[規格](../ui/TYPE_MENUS.md)

2026-09-19 UI 元件共用調查完成：[報告](../discussions/UI_COMPONENT_REUSE_AUDIT.md) 基於已交付 0.8.104，重現 Array 節點 Escape 取消、Parameter 同欄位 Escape 後失焦仍提交的差異，以及 Parameter INT 欄未套共用底色。建議先審數值草稿核心與欄位樣式，再考慮來源綁定／選單重複。只新增文件；未修改任何調查項目的產品 UI。

2026-09-19 0.8.104 交付檢查點：`b16d22c` 已整合 main，刷新 32 份來源中的 9 份變更，核對 TOP／MAT Master compilerBuild=0.8.104；三份使用者 Shader 及 Master 身分保留。TOE 已保存為 903,830 bytes，SHA-256 `0136db635b6e221c5616973fbe1f11f1636b6af76694be020a97b1e71735628d`，排除一份私人助手。未重載使用者編輯器頁面。接續 UI 共用只讀調查。

2026-09-19 Array Create（0.8.104，實作檢查點）：新增 length／value 接孔，沿用既有數值及型別控制；允許整數 Graph／Spec Constant 與常數運算鏈作長度、Uniform 作填值。未知長度顯示 N，以來源身分產碼，不建立 CPU 求值器或 TD 值鏡像。補齊型別更新、長度相依裁切、剪貼簿及子圖邊界；同一 Function 多實例不同長度來源明確拒絕而非誤用第一份長度。445 項 Python 與完整 portable 檢查通過；6 組新增瀏覽器檢查、12 組既有陣列檢查、42 項 TD TOP／MAT Pixel／Vertex GPU 檢查通過。隔離測試清理成功，既有 Shader／registry 保留。同步／保存另記。後續只調查 UI 共用問題，不修改調查項目。

2026-09-19 最新工作順序：0.8.103 共用控制已交付，接續 Array Create；完成後進行[UI 元件共用調查](../discussions/UX_BACKLOG.md)。後者僅調查與提出建議，不修改 UI，須另經使用者審查。

2026-09-19 0.8.103 交付檢查點：`841b6d3` 已整合 main，刷新 runtime／style_css／inspector_js 並核對 32 份來源；三份使用者 Shader 保留。TOE 已保存為 899,238 bytes，SHA-256 `70518fa17c4c8c01f930c3aed4e74d767db5f6a55677b263d89b63979c574601`，排除一份私人助手；未重載使用者目前的編輯器頁面。

2026-09-19 Array 控制共用修正（0.8.103 實作檢查點）：節點長度改用既有 `inlineNumericFields` INT 編輯器，僅提供長度範圍及型別變更提交選項；長度來源下拉與 Parameter 共用來源建立器。節點 body 的下拉共用數值欄位底色、高度及字級，移除 Array 專用尺寸 CSS，維持上下排列。12 組陣列、15 組 Matrix 及 15 組 Parameter 瀏覽器檢查通過，涵蓋明暗樣式、非法整數、草稿保留、Escape、型別傳遞及 Undo。Array Create 依使用者最新指示暫緩，未完成草稿已移出產品工作樹，未混入此次交付。同步／保存另記。

2026-09-19 0.8.102 交付檢查點：`c849f42` 已整合 main、同步 32 份來源中的 5 份變更並保存 TOE；三份使用者 Shader 保留，未重載目前網頁。TOE 898,326 bytes，SHA-256 `aee99e69f5179bdb2b359b52a100e1a1d8c4ce360e06ec19b89e9e9cbd89cb99`，排除一份私人助手。

2026-09-19 Array 節點長度控制（0.8.102 實作檢查點）：將 Parameter 的長度来源控制共用到節點 body；下拉在上、固定數字欄在下，選常數來源時隱藏數字欄。兩處編輯、型別與 Undo 同步，10 組陣列瀏覽器檢查及 685 個雙語鍵通過。唯讀核對發現使用者的 Graph Constant 是 float、Spec Constant 是 int，前者因長度要求整數而未列入，已補說明。Array Create 的長度接線與填值為後續進行中工作，未包含在此檢查點；同步／保存另記。

2026-09-19 英文介面文案調查已列入[操作體驗待辦](../discussions/UX_BACKLOG.md)。使用者尚未 review，僅批准記錄，未批准實作；之後詢問可做事項時可提出審查此項。63 項候選包含精簡名稱、術語／狀態區別與過期說明；本次未修改產品、語系檔或同步 TD。

2026-09-19 0.8.101 交付檢查點：全螢幕短標籤 `59a1906` 已整合 main、同步 TD 並保存。32 份來源／9 份服務資源一致、core 無錯誤、Master current，三份使用者 Shader 保留。TOE 897,918 bytes，SHA-256 `2332639221b6e00da9e14cc6ccc49b8d3fdf651505f0598abf839a5b7e6e9c9b`，排除一份私人助手；未重新載入使用者網頁。

2026-09-19 全螢幕選單短標籤（0.8.101 實作檢查點）：右鍵選項使用「全螢幕／Fullscreen」或離開標籤，不支援時維持短標籤並停用；原因僅放 title 提示，避免手機英文選單被長說明撐寬。10 組右鍵瀏覽器檢查、684 個雙語鍵與 JS 語法核對通過；窄視窗 fixture 等待 resize 完成再開選單，避免測試被延後到達的 resize 關閉。同步／保存另記。

2026-09-19 0.8.100 交付檢查點：模式切換／逐元素光暈修正 `c165aa4` 已整合 main、同步 TD 並保存。20 組 UI preferences、16 組 Note 與 4 組計算樣式檢查通過；32 份來源／9 份資源一致，core 無錯誤、Master current，三份使用者 Shader 保留。TOE 897,894 bytes，SHA-256 `0209d35c31faa0f35842be38938efbef06b8524c3b506d5fba3096d79ba0eea0`，排除一份私人助手。未操作使用者滑鼠鍵盤或重新載入現有網頁。

2026-09-19 表現模式即時切換（0.8.100 實作檢查點）：依手機 review 移除模式間的一秒過渡與對應入場延遲；逐元素限定光暈規則，Professional 全部、Cool 的非光暈元素及 Excellent 以上不使用的選取光暈，均不保留透明 drop-shadow／零強度陰影。原本邊框、基本陰影及 Note 外觀保留；Legendary／Godlike 持續動畫仍維持，本次未全面取消動畫。同步／保存與最終驗證另記，未宣稱實機 iOS 效能量測。

2026-09-19 0.8.99 交付檢查點：空收納入口修正 `4a0162b` 已整合 main、同步 TD 並保存。32 份來源／9 份資源一致、core 無錯誤、Master current，三份使用者 Shader 保留。TOE 898,278 bytes，SHA-256 `e0cfe7ed46355d0e849e86b6854dbc8b8ea41381aca36350da59880cfb103cb1`，排除一份私人助手。

2026-09-19 工具列空收納入口修正（0.8.99 實作檢查點）：全部工具放得下時隱藏下拉按鈕，不預留其寬度／間距；只有實際收納工具才出現入口。移除「所有工具已顯示」空提示；恢復全展開時關閉空選單並確保焦點可達。7 組工具列檢查通過，包括剛好容納工具的臨界寬度與縮放／動作回歸。同步／保存另記。

2026-09-19 0.8.98 交付檢查點：右鍵檢視操作 `727ba9d` 已整合 main、同步 TD 並保存。32 份來源／9 份資源一致、core 無錯誤、Master current，三份使用者 Shader 保留。TOE 894,150 bytes，SHA-256 `ccfe6f3581c16323d5b5fc51bb31dd1ed78a3bbc32b5e661b67583f3d0a34b9d`，排除一份私人助手。

2026-09-19 右鍵檢視操作（0.8.98 實作檢查點）：新增置中整張圖、專注編輯／恢復版面、瀏覽器全螢幕，與置中選取歸為獨立水平分組。共用現有行為及全螢幕狀態；無選取／唯讀也可操作檢視，不新增圖編輯或歷史。9 組隔離 Chromium 檢查通過（含原生全螢幕進出、busy、鍵盤、觸控尺寸及既有操作）；尚未決定的 Undo／Redo、自訂名稱、GLSL 右鍵入口先不加入。同步／保存另記。

2026-09-19 0.8.97 交付檢查點：工具列收納 `9837bb4` 已整合 main、同步 TD 並保存。32 份來源／9 份資源一致、core 無錯誤、Master current，三份使用者 Shader 保留。TOE 893,934 bytes，SHA-256 `f9dbae1a300ff402028eb33ed3a59a0aee4504bd7e80858c23d3d771b5a0a367`，排除一份私人助手。右鍵選單 7 組回歸亦通過；未操作使用者桌面或重載目前網頁。

2026-09-19 Network Editor 工具列收納（0.8.97 實作檢查點）：Stage、子圖路徑與下拉入口常駐；空間不足時依明確順序收納完整功能組，Undo／Redo 不拆開。沿用原按鈕及操作，未套用到浮動選取工具列或狀態列。7 組專項與 12 組既有選取工具列瀏覽器檢查通過，涵蓋 320–1900px、75–125% 縮放、觸控尺寸、鍵盤、Undo／Redo、GLSL、子圖導航、唯讀與無閒置排版迴圈；685 個雙語鍵及 JS 語法通過。Chromium 隔離驗證，未稱為實機 iPad 測試。同步與保存另記。

2026-09-19 0.8.96 交付檢查點：分組實作 `cdbe439` 已同步 TD 並保存。32 份來源／9 份資源一致、core 無錯誤、Master current，三份使用者 Shader 保留。TOE 891,998 bytes，SHA-256 `40787addc85ccf354de92d8a774545079ecfa75d88733754fc9752568e2833b8`，排除一份私人助手。

2026-09-19 右鍵選單分組（0.8.96 實作檢查點）：依使用者 review 以水平線分為新增、編輯、收合／排列／置中、群組框／Subgraph、刪除五組。空組不留下分隔線，既有操作及二級選單保留；7 組既有瀏覽器檢查通過並核對畫面。同步／保存另記。

2026-09-19 0.8.95 交付檢查點：右鍵選單 `36afa02` 已整合 main、同步 TD 並保存。32 份來源／9 份服務資源一致、core 無錯誤、Master current，三份使用者 Shader 保留。TOE 891,942 bytes，SHA-256 `3a520e480b98c2a46b2ad251063d50e082714f9c5212e12b0560b23751ac46f6`，排除一份私人助手。

2026-09-19 右鍵選單補齊（0.8.95 實作檢查點）：排列採二級選單，包含現有全部排列動作；選取區域置中及群組框建立／移入／移出共用既有操作。7 組隔離 Chromium 檢查通過：鍵盤、滑鼠、觸控尺寸、窄視窗、過時選取攔截、排列及群組框 Undo、唯讀與圖示一致。同步與保存另記；未宣稱實機 iPad 驗證。

2026-09-19 0.8.94 交付檢查點：搜尋排序實作 `54a9ea1` 已整合 main、同步 TD 並保存。32 份來源與 9 份資源一致、core 無錯誤、Master current，三份使用者 Shader 保留。TOE 891,030 bytes，SHA-256 `90d6fd1c30c414f13531f9fe1e364d1662ad09fd2605687bfca5e01b655fd0b0`，排除一份私人助手。

2026-09-19 搜尋排序試行（0.8.94）：名稱前綴、名稱包含與別名部分命中分級，完整名稱／完整別名維持最高優先。搜尋 mat 時 mat／Matrix 在 dmat 與 Determinant 等部分別名前；無節點特例，原本可搜尋項目仍可找到。3 組排序與 11 組拉線效能／交易回歸通過，輸入文字不做整圖模擬、不改圖；101 節點合成圖開啟約 15–25ms。待使用者實際體驗回饋；交付另記。

2026-09-19 0.8.93 交付檢查點：實作提交 `97efae2` 已整合 main 並同步 TD。32 份內嵌來源、9 份服務資源核對一致，core 無錯誤、TOP／MAT Master current；三份使用者 Shader 保留。保存 TOE 891,054 bytes，SHA-256 `0a6b12efa0a7365d6ff060630d6957525b0350af01a8b93fc577ff3d465b8c83`，排除一份私人助手。本機無 Git 遠端，未做遠端推送。

2026-09-19 符號長度陣列（0.8.93，實作檢查點）：Array 長度可引用整數 Graph Constant／Specialization Constant，未知顯示 N，內部保留來源 ID；Get／Replace／Length、Subgraph、GLSL Code、剪貼簿與來源引用追蹤已接通，不新增 CPU 求值器或持續 TD 長度同步。48 項 TD GPU 檢查、10 組瀏覽器操作通過；435 項 Python 與完整 portable 檢查通過，後補原生宿主巨集診斷以 11 項符號陣列單元測試驗證。TD 2025.32820 的 specialization 長度 CHOP Uniform Array 已重現「長度正確、資料為零」，目前明確拒絕該 native 組合，不把圖內 specialization 陣列一起禁用。任意常數運算鏈長度接孔、Array Fill 與 SSBO 尚未提供。同步／保存另外記錄。[使用方式](../features/ARRAYS_AND_STRUCTURES.md)、[宿主觀察及重現](../features/TD_ARRAY_SOURCES.md)。

2026-09-19 Open Editor Viewer 修正（0.8.92，已同步並保存）：Open Editor 不寫入或更動既有 OP 的 Viewer 開關，沒有記住再還原的流程；新建仍使用原預設。TOP／MAT 的開、關、再關共 6 項原生檢查通過，使用者 Shader 與 registry 保留。32 份來源刷新完成、兩份 Master current，Master 編譯檢查通過；保存的 TOE 為 887,534 bytes，SHA-256 `a0107ccbd8a9c6e48e5c1833bd22ace935e9002dccf739540c19000f05f81d40`，三份使用者 Shader 保留、排除一份私人助手。實作提交 `432beed`，獨立於進行中的符號長度陣列。這是目前未證明開啟 Viewer 有必要的判斷；若未來實測特定操作需要觸發 cook，再針對該操作處理，不視為永久禁止。[開啟流程及其他既有副作用](../ui/EDITOR_LAUNCH.md)。

2026-09-19 陣列／結構第一輪已完成並交付 0.8.91：已整合 main、同步 TD 並保存正式 TOE。新增 Array、Array[i]、Array Replace、Array Length、Field；讀取 Clamp、Replace 越界不修改，建立數值／向量／矩陣／結構陣列採零初始化。共用型別契約承接 Function、Subgraph、GLSL Code、剪貼簿與個人函式库；TD 既有結構引用宿主定義，圖內自訂定義按依賴宣告。TOP／MAT CHOP Uniform Array 支援固定長度的 float／vec2／vec3／vec4 與原生綁定，快照不讀取樣本、不更改 Uniform 即時通訊。自訂結構作者 UI、迴圈與一般 SSBO 作者介面仍為後續範圍。操作及責任見 [Arrays and structures](../features/ARRAYS_AND_STRUCTURES.md)，宿主來源限制見 [TD array sources](../features/TD_ARRAY_SOURCES.md)。

本輪最終 425 項 Python unit、完整 portable 檢查與專項瀏覽器檢查通過；TD 2025.32820 的 277 項 GPU 檢查通過。2026-09-19 已完成掛起修正後的 TOP／MAT／Light 共 8 組來源檢查，另有 6 組 TOP 接線回歸通過；三份使用者 Shader 與 registry 保留、fixture 移除。外部 Python stack 將掛起定位在新增 Uniform 時不必要的 In TOP 重接線；改為保留未變更的接線及名稱，仍允許來源更換、重排與缺線修復。TD 內部阻塞機制尚未證明，不宣稱已定位到原生鎖或驅動。交付已核對 32 份內嵌來源、9 份服務資源一致，core 無錯誤、TOP／MAT Master current。正式 TOE 889,438 bytes，SHA-256 `fb8b99f706b93881204131d759022d2e0e29272b1414a67dc565dc11f57de648`，排除一份私人助手；本機 Git 無遠端設定，未稱為遠端推送。

2026-09-18 第二批既有運算擴充已依同意的試行方案完成並交付 0.8.90：Convert 輸出 scalar／vector，新增 Matrix Convert 輸出 matrix，完整保留 1,109 個合法 constructor 配對；If 支援矩陣／double，19 種 double 數學多載維持 Auto 主路徑及手動指定。完整 portable 與隔離 UI 檢查通過，TD TOP Pixel／MAT Pixel／MAT Vertex 的 237 項原生 GPU 檢查全過，既有 Shader、registry 保留，臨時 fixture 移除。拉線搜尋修正已先以 0.8.89 交付；此批整合最新搜尋規則並已以 0.8.90 同步 TD、保存正式 TOE。31 份內嵌來源與 9 份服務資源一致，core 無錯誤、兩份 Master current、三份使用者 Shader 保留。Matrix 四則異型簽名仍是後續工作。試行決議見 [最新 review](../discussions/CONVERSION_AND_RUNTIME_NEXT.md)。

2026-09-18 拉線新增搜尋效能（0.8.89，已同步並保存）：以共用型別契約做局部候選配對，搜尋文字沿用同一上下文的結果，不再對每個候選複製／規劃整張圖；實際建立仍沿用完整交易驗證。新舊普通圖候選一致，常數或下游限制可延至選定時拒絕，拒絕不改圖、不新增 Undo。10 組專項瀏覽器檢查通過，101 節點正反向開啟約 12.5–23.1ms；獨立量測往下游開啟由 773ms 降至 14ms、搜尋 mat 由 635ms 降至 5ms。這些是隔離合成圖的本機量測，非所有設備的上限。搜尋排序未改；Matrix Convert 分流及運算擴充保留獨立交付。規則見 [Node Browser](../ui/NODE_BROWSER.md)。本筆提交 9106140；31 份內嵌來源／9 份服務資源一致、core 無錯誤、TOP／MAT Master current，三份使用者 Shader 保留。

2026-09-18 Matrix 覆寫標記試行（0.8.88）：使用者同意先試收合格內的 `↳ X／Y／Z／W`，辨識該分量有獨立接線；沿用 Matrix／Column 的格子維持橫槓，分量接口仍保留，來源節點可由提示查看。15 組 Matrix UI 檢查在分支及主線通過，已同步 TD、核對來源與資源並保存 TOE；三份使用者 Shader 保留。這筆視覺試行提交為 20fc6f2，與格數修正、既有運算擴充分開。

2026-09-18 Matrix 收合顯示修正（0.8.87）：Combine／Replace 的 Column 收合列始終保留完整分量位置，已接線子分量在原格顯示橫槓，下方接口仍可見，不再將 vec3 顯示為兩格。15 組隔離 Matrix UI 檢查在分支及主線通過；已獨立提交為 180c109、同步 TD 並保存 TOE，三份使用者 Shader 保留。31 份內嵌來源、9 份服務資源核對一致，core 無錯誤、TOP／MAT Master current。這筆修正獨立於尚未交付的第二批既有運算擴充。覆寫／沿用來源的視覺區別仍待設計，未套用討論中的新符號。[搜尋命中分級](../discussions/INPUTS_UI_NEXT_ROUND.md) 已依使用者同意列為高優先試行待辦，尚未改排序。

2026-09-18 Matrix／double 第一批（0.8.86）已獨立提交、同步 TD 並保存 TOE：新增 18 種 mat／dmat、double／dvec 與 Matrix、Combine、Replace、Split、Get／Set、Transpose、Inverse、Determinant、Matrix Comp Mult、Outer Product。涵蓋 Column／分量介面、固定與通用建立入口、來源／宣告、Subgraph／GLSL Code、保存與剪貼簿。既有算術、Compare、If、Convert 的能力擴充留第二批獨立提交，不因型別表增加而直接放寬舊簽名。規則及 TD 雙精度 Uniform 原生載體實測限制見 [Matrix 能力](../features/MATRIX_NODES.md)。

本批交付已核對 31 份內嵌來源、9 份服務資源與主倉一致，core 無錯誤，TOP／MAT Master current；三份使用者 Shader 與模板身分保留。正式 TOE 860,150 bytes，SHA-256 `c1dd7bbb6b1117120fd691b3a5e789411321e59d04ae7b64f7d248298c483fb3`，排除一份私人助手。未操作桌面或強制重新整理現有 Editor。新能力提交為 `ed31700`，獨立調查筆記為 `03da4d3`；舊運算擴充仍未交付。

Uniform 連續編輯／雙向通訊另為[調查評估](../discussions/UNIFORM_LIVE_EDITING.md)。已記錄多處控制項一起閃動的成因與未來持續同步的驗收要求，尚未修改 Uniform 提交流程或來源控制權；Sources 名稱／引用圖示留介面後續設計。

2026-09-18 Parameter 整組 Value Ladder 已合併並同步保存 TD：本地數值列的名稱或型別文字按中鍵，可對所有分量施加相同增量，保留相對差值；支援 Scalar／Vector、固定型別、Color 及未接線輸入的數值型別（bool／bvec 除外），展開分量列則調整該分量。共用既有階梯手勢，拖動只預覽、放開一筆 Undo；取消完整還原，一般重繪保留手勢，同節點畫布／Parameter 未提交草稿阻止整組操作。整數邊界限制共同增量，不逐欄截斷；沒有位移不改變精度或建立歷史。

原生 Uniform／Spec 的目前值及來源定義表單仍沿用原有單欄操作。它們沒有這次的共用名稱／型別數值列；原生多分量功能還需要一次請求、全組驗證／失敗回復及整組 TD Undo，不以多次單欄請求替代。整組 Value Ladder 這筆修改沒有修改 Python、原生參數模式或增加常駐監看。詳見 [Value Ladder](../ui/VALUE_LADDER.md)。

2026-09-18 值模型與介面整理已合併並同步保存 TD：新增 16 種固定型別建立入口（float／int／uint／bool 及各自 2–4 分量向量），與可選型別的 Scalar／Vector 並存。固定型別身分隨保存／複製／Undo 保留，Scalar／Vector 標題固定；搜尋具體型別可同時找到固定與通用入口，查詢文字不改變通用入口的建立預設。Color RGBA 保留。規則集中於 [值模型](../architecture/VALUE_MODEL.md) 與 [用語表](../GLOSSARY.md)；接線轉換／Convert 與背景工作政策仍是 [待決提案](../discussions/CONVERSION_AND_RUNTIME_NEXT.md)，未藉此次整理變更。

Compare 預設標題固定，Header 選 Auto／型別，Body 首列選完整比較式，與 Parameter 共用設定。僅無輸入接線的 Auto 預設採 int；有線推導排序及 bool 接線規則保持。Note 設定新增左／中／右文字對齊，畫布 Markdown 套用、程式區塊及編輯輸入保持靠左。一般節點註記頁改為隨 Parameter 面板填滿可用高度，說明留在底部，極矮面板可捲動。

新預設採單選與複選工具列、常態多選框、所有向量分量染色，關閉展開時的收合三角提示；已明確儲存的瀏覽器偏好保留。全螢幕期間自動顯示系統時鐘，退出恢復平常偏好，不覆寫設定。這些前端修改及下述整組 Value Ladder 已分筆提交並完成隔離驗證。

本批已完成 TD 來源刷新、核對及 TOE 保存：更新 core 與六份前端 DAT，31 份內嵌來源、9 份服務資源與工作樹一致，core 無錯誤、TOP／MAT Master current。保留目前三份使用者 Shader；正式 TOE 837,526 bytes，SHA-256 `eac3113c4731c5122892c8d6045014fcd002ac84cfd3609f77527bf1f99e8788`，排除一份私人開發助手。未操作桌面或重新整理使用者現有 Editor；重新整理編輯器即可載入這批 UI。整數精度限制撤銷仍保留，本批沒有重新加回。以下兩份 Shader 與舊 TOE 大小均為較早檢查點的紀錄。

2026-09-18 純量／向量型別基礎完成：共用契約接通 float／int／uint／bool 與各自 2–4 分量向量，共 16 種值型別。新增 Scalar 與 Convert，既有 Float 保留；Graph Constant、Uniform、Vector／Combine／Split／Swizzle／Replace、共用值編輯、Auto、Subgraph／GLSL Code 及保存路徑同步。數學節點按合法簽名開放型別，Compare 維持 scalar 比較與 bool 輸出，If 的結果支援全部 16 型別。Auto 優先保留輸入家族；同維度數值與 numeric scalar splat 可接線轉換，bool／numeric 使用 Convert，不默默丟棄向量分量。矩陣、陣列、Switch Case 與 UV 數字顯示留後續。

2026-09-18 後續隔離修正（已於本輪第一個檢查點部署並保存）：依使用者決定移除額外整數傳輸限制；Uniform／Spec Constant 接受完整 GLSL int／uint 32 位範圍，包含負 Spec int 與 UINT_MAX。保留明確寫入的有限值、型別、範圍及 bool／bvec 0／1 檢查；snapshot 不驗值。傳輸精度依 TD 原生行為，大整數可能失真；Graph Constant／Scalar／Vector literal 保持精確。原生 Undo 仍回到原 Shader 並依目前型別驗證。詳見 [數值型別計畫](../discussions/NUMERIC_TYPES_PLAN.md) 與 [測試紀錄](TESTING.md)。本機結果不代表 Metal／其他 GPU 已驗證。

同輪介面收尾：右鍵功能加入圖示；選取工具列全展開時只顯示收合、全收合時只顯示展開、混合時顯示兩者；關閉該組設定時連同分隔線一起隱藏。完整群組的多選外範圍保留並使用直角；排列入口增加小三角。Note 預設標題及暗色模式 body 改為純灰，色盤預設同步；既有自訂背景及透明設定保留。自動排列演算法未改。

本輪已同步並保存 TD：31 份来源／9 份服務資源一致、TOP／MAT Master current、core 無錯誤，兩份使用者 Shader 保留；正式 TOE 807,516 bytes。測試數量、宿主限制及兩份舊 browser 腳本的維護待辦見 [TESTING.md](TESTING.md)。

2026-09-18 實作前順序確認（型別批已由上方紀錄完成）：先完整整理型別與既有數學運算支援，再做 Switch Case／條件分支、UV 數字顯示等快捷功能；能力完整優先，再求簡潔 UI。數字顯示的定位選單／int 接孔／bool 開關僅為討論候選，不是強制規格，按便利性與通用性設計。詳見 [數值型別計畫](../discussions/NUMERIC_TYPES_PLAN.md)。

2026-09-18 邏輯類色彩再調整：依實際觀感將 Compare／If 的深色標題由藍灰降為接近黑的微紫灰（#17151b），移除偏綠／偏藍的灰調並加深；亮色主題同樣調整為較深的對應灰。沿用共同型別色，畫布、Parameter 與新增入口同步，選取框維持原有規則。

2026-09-18 開發原則更新：Alpha 前現有圖均為可重建的功能測試資料，優先整理架構與行為，不為未發布格式增加相容層；Alpha 後逐步考慮相容，正式版後嚴格維持。詳見 [UPGRADE_POLICY.md](../architecture/UPGRADE_POLICY.md)。此時整數等型別仍在前置評估，後續完成情況見上方紀錄；解開子圖尚未實作。

2026-09-18 選取收合／展開初版（按鈕可見性已由上方同輪修訂取代）：右鍵選單同時列出收合與展開，混合選取可明確選方向；選取工具列最初使用兩個固定位置按鈕，全部已達成該狀態時停用。齒輪「工具列與入口」新增顯示開關，預設開啟。共用原收合交易，一次 Undo，不修改 Note 尺寸／內容或群組成員。

2026-09-18 多選框節點分布：四角及四邊共八個拉點，只按比例調整節點中心位置，尺寸與字級不變；對側外緣固定，缩小避免新增重疊。沿用多選框顯示設定，群組框跟隨成員，不新增旗標或群組尺寸資料。拖曳只預覽，放開一次 Undo；取消、失焦、換圖與觸控取消還原。自動排列算法保持不變。

2026-09-18 TD 色彩／範圍／Noise：新增 RGB to HSV、HSV to RGB、Remap、Range From、Range To、Loop、Zigzag、Perlin Noise、Simplex Noise。沿用原生 TD helper；Range From 保留相等端點回傳輸入，Range To 允許外插；向量 Loop／Zigzag 逐分量呼叫。Noise 座標 vec2／vec3／vec4、輸出 float；Simplex 品質由 TD 宿主控制。TD helper 不視為 GLSL 常數表達式，不限幅或聲稱跨設備一致值域。本機 TOP／MAT 原生測試分別 97 與 54 項通過；搜尋、Auto／鎖定與參數行共用既有機制。

2026-09-18 基本數學補齊：新增 Sign、Sqrt、Floor、Round、Ceil、Truncate、Modulo，支援 float／vec2／vec3／vec4 與既有 Auto／鎖定型別。採 GLSL 原生語意，不暗中更改負數 Modulo、截斷、半值 rounding 或未定義輸入的處理。七個節點的搜尋、共用參數及常數產碼已驗證；TD 2025.32820 本機 TOP／MAT 原生數值與 Vertex 編譯 77 項通過，使用者 Shader 保持不變。

2026-09-18 邏輯類石墨灰：Compare／If 共用中性的深石墨灰標題，畫布、Parameter 與新增節點入口一致；亮色主題使用相應中性灰。接孔／連線依原有資料型別色，Auto／鎖定型別與公式標題保持。

2026-09-18 Compare 畫布標題：一般顯示模式直接以 A > B／A ≥ B 等公式顯示目前比較方式；開啟自訂名稱時沿用原本名稱。右上選單、標題字級、預設 Compare 命名、Parameter 及連線來源標籤不變，公式不存入圖資料或 GLSL 識別字。Output 左側的提示位置先列為後續觀察，不增加第二套顯示。

2026-09-18 Compare／If 搜尋補正：新增節點的 catalog metadata 尚未投影到實際編輯器索引，補齊 Logic 分類與 comparison／branch／ternary 等別名；既有節點搜尋資料不變。POP Math 能力對照仍在範圍整理階段，詳見討論紀錄，尚未新增該批節點。

2026-09-18 Ctrl＋C／Ctrl＋V 修正：在 Note／說明選取文字後，點選或拖動節點仍可能殘留文字 range，使原生複製繼續處理文字而非節點。明確進入畫布操作時統一交回畫布焦點並清除舊文字選取，涵蓋節點、群組框與畫布手勢；Note 內文與輸入欄位保留文字複製／貼上。快捷鍵仍走原生 clipboard events，不新增 Clipboard API 權限要求。

2026-09-18 自動排列雙方向：原排列命名為「自動排列：由來源」（L），新增「自動排列：由結果」（Shift＋L），從各連通鏈路的末端往回計算層級，讓短支路更接近使用位置，多個末端可共存；接線方向仍由左至右。沿用接孔上下順序、實際節點尺寸、間距、循環防護及單次 Undo，選單與快捷鍵列表同步。兩者都將沒有選區內連線的零散節點放在連線圖下方，由左至右換行；全為零散節點時採近方形格狀排列，有連線的獨立鏈路維持各自排列。

2026-09-18 Note 尺寸優化：縮小下限改為量測實際首行文字，加上標題、內距、邊框及捲軸，不再將大標題的保守估計套用到所有文字。10× 普通文字的最小高度一般為 263px、透明為 243px，比原本減少 90px；標題及程式碼依自身行高計算。保留 190px 最小寬度、180px 初始高度、手動保存的尺寸與隱藏標題時的內文位置；既有 Note 可再向上縮小，不自動覆寫原尺寸。畫布長行不折行，保留明確換行及水平捲動；編輯輸入行為不變。

2026-09-18 Compare／If：Logic 分類新增 Compare（A、B；float／int／uint；六種比較方式；bool 輸出）與 If（Condition／True／False；float／vec2／vec3／vec4 結果）。沿用 Auto／鎖定型別、接線轉換、手填值、Undo 與共用 Parameter 列。Compare 標題直接選比較方式，Parameter 提供型別及比較方式；畫布的 bool 輸入使用 true／false 選單，int／uint 以整數欄位與範圍驗證輸入。

GLSL 產生明確比較及 `condition ? trueValue : falseValue`。全常數鏈保留 const，Spec Constant 仍走真正的原生特化覆寫，不依預設值剪枝；兩側上游沿現行依賴順序產生，未承諾延後或跳過整條未選支路。原有節點定義與版本識別不變。Switch、Discard、整數／布林結果擴充及 Metal／AMD 最佳化實測未納入；Uniform 架構與命名目前只是討論，流程保持。

2026-09-18 透明 Note 外框修正：隱藏標題時的內文補角層因 CSS 優先順序蓋過透明設定，造成未選取時仍有外框與陰影。降低基礎補角樣式的優先順序，使透明外觀能正確覆寫。使用者確認這是錯誤，不保留為新模式；既有 hover／選取提示維持。

2026-09-18 Note 試用修正：Note 色盤第一格改為目前主題的預設背景色，選取可一次清除改色與透明設定；其餘 11 色、自訂色及透明入口保留，群組框色盤不變。隱藏標題改為保留原本標題／內文的配置，只藏掉未選取時的標題與該區底色，剩餘內文表面採一般節點圓角；選取後在原位顯示，移除前次外加浮動標題與對應選取範圍例外。

Note「設定」分頁提供標題顯示、背景色及字級倍率，畫布標題快捷入口同步；「參數」保留內文編輯。字級倍率預設 1×、範圍 1–10×，只放大畫布閱讀內文，標題／文字編輯區維持原字級。透明 Note 的內外留白各從 10px 減為 5px；1× 下最小高度一般為 110px、透明為 90px，足夠一行 H1，並依字級提高可容納一行的高度下限。初始高度仍為 180px，外觀切換不改寫保存的尺寸。

2026-09-18 Note 外觀：獨立 Comment 節點的介面名稱改為 Note，既有定義 UUID／版本與自訂名稱保留，一般節點的 Comment／註記不變。標題右側提供「僅選取時顯示標題」及背景色兩個入口；前者在選取時把標題浮於內文上方，不擠動文字，收合時仍保留展開入口。Note 只由標題拖動，內文保留選取／閱讀／編輯。背景色共用群組框的圓形色盤，只影響內文，右下新增透明選項；透明保留所選色，重新選色以一次 Undo 恢復底色。外觀隨圖與剪貼簿保存，不影響 Shader。新增前已建立 Git 檢查點 `db6fdaa`。

Footer UI 快捷入口依最新要求調整為齒輪、鍵帽、分享、明暗、文字大小；時鐘及全螢幕維持原位置。

2026-09-18 Comment 寬度下限調整：依實際試用回饋，取消註解節點的獨立寬度下限，直接共用一般小節點的 190px 下限；取代上一版允許縮至 0 的行為。既有過窄尺寸載入時依共用下限顯示，內容量測、高度及文字呈現規則不變。

2026-09-18 Comment 寬度：依使用者最新縮限要求，只解除註解節點原有的 260px 最小寬度，最小值解析支援明確的 0。保留既有內容量測預設寬度、180px 預設高度／130px 高度下限、內距及文字換行／捲動；先供使用者觀察縮窄行為，再決定是否調整其餘尺寸或文字呈現。

2026-09-18 群組選取顯示設定：齒輪在「常態顯示多選框」旁新增「選取群組框時隱藏多選框」，預設關閉。開啟後，選取剛好是一個完整群組時不顯示虛線框，包含常態與工具列 hover／鍵盤互動；加選外部節點、多個群組、部分成員仍依一般規則。工具列維持顯示，設定僅存於瀏覽器，不修改圖、歷史或 Shader。

2026-09-18 群組框移入：選取工具組提供「移入群組框」，以這次選到的群組成員數決定唯一最多的目的群組，提示直接顯示其名稱；未分組節點不參與競爭。支援一個成員加未分組節點、完整群組加外部節點，以及移入另一群組的部分成員。同票、沒有群組成員或全部已在同一群組時不顯示按鈕，快捷鍵不執行。只搬選取成員的關係，保留位置、值、接線與未選成員，移空的框自動移除；一筆 Undo／Redo 還原整批。移入採 `Alt＋Shift＋G`，移出保持 `Alt＋G`。群組框 body text／comment 仍待使用者思考位置與自動尺寸規則，尚未實作。

2026-09-18 群組框操作補齊：標題色點開啟 12 色圓形預設色盤，下方彩虹入口提供原生自訂顏色；沿用一次 Undo、唯讀及圖切換保護。新建名稱固定為英文 `Group N`，既有名稱保留；鉛筆與雙擊改名維持。選取工具組新增「移出群組框」，可一次解除單一／多個選取節點在各群組中的成員關係，節點位置、值與接線不變；一個成員保留框，零成員移除空框，一次 Undo 可還原整批操作。

群組快捷鍵本批採 `Ctrl / Cmd＋G` 建立群組框、`Ctrl / Cmd＋Shift＋G` 轉換子圖、`Alt＋G` 移出群組框；取代下方歷史紀錄中 Ctrl＋G 轉子圖的配置。按鈕提示與快捷鍵列表共用設定；文字編輯、對話框／彈出選單、進行中手勢、唯讀及忙碌狀態不執行。成員移入由同日後續追加，規則見上段。

2026-09-18 群組選取輪廓：保留常態多選框及工具列互動時的虛線顯示。選取恰好等於單一完整群組時，外框圓角依群組的實際圓角、畫布縮放與 6px 介面外距計算，讓兩層曲線同心；群組加外部節點、多個群組與部分成員仍沿用一般多選輪廓。不新增 Flag，也不改圖、群組成員或選取行為。

2026-09-18 節點註記入口統一：Constant、Uniform、Spec Constant、Sampler、TOP Input 等來源引用節點也使用與一般節點相同的「註記」分頁。移除參數／設定頁底部的舊收合入口，保留既有註記內容、保存及 Undo；來源編輯流程不變。Comment 註解節點仍是獨立例外，參數頁直接編輯其內文。

2026-09-18 群組框基本版：選取兩個以上尚未分組的節點，可由選取工具組建立群組框；可命名、改色、拖標題整組移動，框自動包住成員實際尺寸。移除框保留節點；移動外部節點進框不自動加入。圖、剪貼簿、複製與子圖轉換保存框及成員關係，各操作沿用 Undo；只有完整選取的框隨複製或子圖一起帶入。以圖層 `ui.frames` 儲存，不增加運算節點、不改 GLSL 或編譯指紋。成員加入／移出、合併與快捷鍵重配仍待後續，Ctrl＋G 保持轉換子圖。

齒輪追加預設關閉的「常態顯示多選框」。開啟時只要選取至少兩個節點，就顯示選取虛線框，不受選取工具列開關影響；關閉維持工具列 hover／鍵盤操作時顯示。完整選取群組框時，選取範圍及置中將框的標題與留白算入。

2026-09-18 Comment Parameter 回饋修正：參數頁直接顯示原始文字輸入框，不再轉成 Markdown 閱讀模式，也不需雙擊才能編輯。輸入框填滿參數面板剩餘高度，操作說明留在底部，隨既有面板分隔線調整尺寸；極矮面板保留最小輸入高度並可捲動。畫布仍顯示 Markdown，兩處共享草稿／提交／Undo 與同步流程。Comment 類型色統一改為暗灰色。

2026-09-18 Comment Markdown：畫布與 Parameter 平時呈現基本 Markdown，双擊／觸控點兩下或聚焦後 Enter 編輯；只有輸入狀態有欄位底色。標題、粗體／斜體、單層清單、連結、inline code、fenced code 可用，`glsl` 區塊共用原 GLSL tokenizer 高亮；沒有新增套件或模式選單，HTML 保持文字。失焦／Ctrl／Cmd＋Enter 提交並回閱讀，Esc 取消；保留草稿、一次 Undo、寬高縮放與捲動。Comment 節點的任何修改只顯示圖面待保存，不再誤報 Shader 待套用；普通節點既有註記不變。群組框與 Select 節點仍待後續。

2026-09-18 置中選取：選取工具列新增四角取景框圖示，可依單一或多個選取節點調整視角；沿用既有工具列三態，關閉時顯示於頂部。與原置中共用尺寸、邊距與縮放計算，只改視角，不改圖或歷史；唯讀可用。原置中／H 仍顯示全部。Comment 的 Markdown 與 GLSL 內文高亮由後續同日一輪補上，見上方紀錄。

2026-09-18 自動排列快捷鍵：新增圖面範圍的 `L`，沿用 H 的輸入／對話框／手勢隔離，另排除唯讀、忙碌與長按重複；只排列兩個以上選取節點。選單提示與快捷鍵列表由同份快捷鍵資料呈現。名稱依最新要求簡化為「自動排列」，Ctrl＋L 保留瀏覽器用途。

2026-09-18 自動排列接孔順序：上下排序納入下游 Input 與上游 Output 的顯示順序，修正同一節點不同接孔被視為同順位而退回建立順序的情況。收合節點仍採展開時的邏輯接孔順序；維持只改選取位置、一次 Undo 及重複排列穩定。

2026-09-18 排列補齊：新增「自動排列 · 依連線」，只移動目前選取節點，依接線由左往右分層、分支上下留距，不相連的區塊分開；沿用一次 Undo 與既有圖面保存。採小型本地演算法，沒有新增依賴。選單以淡水平線分成自動、水平對齊三項、垂直對齊三項、等距／格狀三項。

2026-09-18 選取工具列試用調整：縮小外圍留白、按鈕底座及分組間距，16px 圖示保持；滑鼠五按鈕工具列由 205×46 縮至 163×36，觸控由 245×54 縮至 203×44。位置改為選取範圍上方置中，上方放不下時改下方置中；兩邊都放不下則優先上方並限制在可視畫布。依最新決定保留貼上。已推送、儲存 TD；這取代前次靠右的試作。

2026-09-18 最後回饋修正：選取工具列依使用者指定改為橫列、放在選取範圍上方並對齊右緣，避免常態遮擋輸出接孔；極窄時整組換行，組內保持橫排。Comment 內文平時融入 body，只在聚焦編輯時出現輸入底色。追加修正已推送、儲存 TD 並納入本輪提交。

2026-09-18 本輪追加完成：Comment 是唯一可雙向縮放的節點，右下把手同時調寬高，尺寸隨圖保存，一次拖曳一筆 Undo。文字區填滿剩餘高度並原生捲動，不把滾輪傳給畫布縮放；收合忽略高度，展開恢復。保留文字草稿與焦點，普通節點仍只調寬。高度和寬度同屬圖面變更，不顯示 Shader 待套用。五個小批次均已推送並保存 TD，30 份來源及 8 份 HTTP 資源與工作樹一致，兩份 Master current、兩份使用者 Shader 保留。Markdown／GLSL 自然內文支援仍留後續；註解節點本身不進入生成碼。

2026-09-18 編輯工具列與註解節點（0.8.84）：齒輪依工具列與入口／節點與接線／色彩與顯示分組；「顯示工具列底色」反向對應原 floatingToolbar 儲存值。新增選取工具列三態（關閉／僅複選／單選與複選，預設關閉）及獨立頂部編輯工具列開關。Undo／Redo 固定頂部；編輯組只含複製／貼上／刪除。選取工具列橫排於選取範圍上方並對齊右緣、保持介面像素尺寸並限制在畫布內，僅 hover 或鍵盤操作顯示範圍虛線框；複選才顯示轉換子圖及排列。六種對齊、兩種等距及格狀排列依節點實際尺寸計算，每次一筆 Undo。框選改虛線矩形圖示、轉換子圖改向內箭頭，自訂名稱保留文字。

Footer 鍵帽按鈕開啟快捷鍵列表，X／Esc／點外部關閉；按鈕與右鍵選單共用動作及快捷鍵提示。Comment 是無接孔的中性灰純文字節點，畫布／Parameter 編輯，失焦或 Ctrl／Command＋Enter 一次套用、Esc 取消；沿用 ui.comment、剪貼簿與子圖資料路徑，不參與 GLSL、編譯 hash 或未接線警告。既有完整版本證據的圖不需強制升級，原 138 個 compiler fingerprints 保留。

群組框成員／合併規則與快捷鍵重配仍待討論，Ctrl＋G 維持轉換子圖。Markdown 與 GLSL 內文高亮依最新確認留下一輪，採單一內文自然支援的方向，不設文字／Markdown／GLSL 模式選單。註解節點雙向尺寸為本輪追加，見上方交付紀錄。

2026-09-18 Node／Parameter 觸控數值（0.8.84）：共用數值控制器依實際 touch pointer 分流；單點不 focus，同欄位 350ms／24px 內雙點進文字編輯，水平越過 8px 門檻沿用既有 scrub，450ms 長按開 Value Ladder。初始垂直移動保留 Parameter 捲動／畫布平移；已進文字編輯時保留原生游標及選字。滑鼠／觸控筆沿用原操作。手勢預覽不改圖、放開提交一次，第二指、真正 capture loss 或取消均還原；無焦點手勢仍保留編輯狀態與 DOM，另一分量的文字草稿及緊湊／展開副本不被同步覆寫。

20 組新觸控、32 組 numeric scrub、15 組 Parameter、7 組預設值檢查通過；28 份來源與服務資源一致，正式 TOE 723,820 bytes，保留兩份 Shader 並排除私人助手，現有頁面未重新整理。手機頁面縮放、輸入放大、Creator autofocus 與 visualViewport 定位僅記錄待辦；本輪未改，desktop 仍優先。實體 iPhone／Safari 未驗證。

2026-09-18 浮動工具列預設與窄版排版（0.8.84）：floatingToolbar 預設開啟，明確保存的關閉偏好保留。浮動停用按鈕以不透明暗底與較暗前景呈現，避免節點透出；操作群組換行齊右，工具列可用寬度不超過 700px 時 Stage 與子圖位置一起置於命令列之下，長路徑保留橫向捲動。CSS container query 依實際工具列寬度反應，沒有新增 JavaScript 排版；兩份重複規則合併為一份。既有 experiments 19 組、Editor chrome 16 組及私人窄版 5 組通過。28 份來源／服務一致、兩份 Master current；正式 TOE 720,780 bytes，保留兩份使用者 Shader，現有頁面未重新整理。

2026-09-18 互動過渡清除核對（0.8.84）：確認按下／選取／hover 的光暈過渡已刪除，沒有停用分支或備用開關；模式切換過渡仍獨立保留。額外還原 Professional 錯誤節點被新版透明光暈規則連帶增加的紅色外環，保留原錯誤邊框及選取環。與過渡前 90b4d17 樣式直接比對的兩組檢查通過，沒有改動 JavaScript 或圖／Undo／GLSL。28 份來源與服務一致、Master current；正式 TOE 保存 720,740 bytes，兩份使用者 Shader 保留，現有編輯頁未重新整理。

2026-09-18 過渡限於表現模式（0.8.84）：依使用者澄清，只有切換 Professional／Cool／Excellent 等表現模式時才以 1 秒漸亮／漸暗。節點選取、接線 hover、框選／自訂名稱按鈕及 Apply 的啟用狀態立即回應，切換模式的過程中亦同。純 CSS 改由 root 模式強度控制過渡，移除元件 shadow／filter 的過渡與舊濾鏡插值補丁；既有 Legendary 呼吸及 Godlike 環繞保持。此輪未新增或修改 JavaScript、DOM 與圖資料結構。

6 組瀏覽器檢查通過，含模式過渡期間的即時操作、Light 與減動態；555 個雙語鍵與 diff 通過。28 份來源與服務一致、兩份 Master current；正式 TOE 保存 720,660 bytes，兩份使用者 Shader 保留，現有編輯頁未重新整理。

6 組瀏覽器檢查通過，含模式過渡期間的即時操作、Light 與減動態；555 個雙語鍵與 diff 通過。28 份來源與服務一致、兩份 Master current；正式 TOE 保存 720,660 bytes，兩份使用者 Shader 保留，現有編輯頁未重新整理。

2026-09-18 光暈分級修訂與 CSS 動畫（0.8.84）：Cool 改為僅彩色接線、選取框、葡萄圖示與 Apply Shader 發光，未選取節點與名稱／接孔保持原貌；Excellent 加入整顆節點分類色外光與既有介面重點。新增 Legendary 的 4 秒慢呼吸（33–50%），Godlike 為 50% 外光以 4.8 秒環繞方向流動，只有陰影偏移，元件位置與型別色保持。五級切換以 1 秒過渡，僅 Dark 生效；減少動態效果時採靜態光暈。動畫只用既有 CSS 光暈與 registered properties，未增加 DOM、繪圖層、ID 分组或 JavaScript 動畫系統。純外觀切換保留接線 DOM，圖與 Undo 不變。

既有實驗功能測試 19 組、最後 Legendary／Godlike 動態檢查 5 組通過，另完成 Cool 範圍及過渡檢查；555 個雙語鍵、JavaScript 語法與 diff 通過。28 份來源與服務一致、兩份 Master current；正式 TOE 保存 720,748 bytes，兩份使用者 Shader 保留，現有編輯頁未重新整理。

2026-09-18 表現能力分級、Parameter 與時鐘（0.8.84）：齒輪風格改名「表現能力」，Professional 維持原貌；Cool 保留節點／接線／接孔外光，Excellent 再加 Inputs、Parameter、工具列及 Apply。兩級葡萄圖示與產品主標題發光，含 About，仍限 Dark。一般 Parameter 名稱欄 17%、型別欄 9ch，名稱／型別單行省略，sampler2D 不再拆行；相同來源／輸出名去重。新增預設關閉的 systemClock，Footer 全螢幕左邊顯示本機 HH:mm，整分鐘更新，停用清除 timer。52 組相關瀏覽器／視覺檢查與 553 個雙語鍵通過。28 份來源與服務一致、兩份 Master current；正式 TOE 保存 719,828 bytes，兩份使用者 Shader 保留，現有編輯頁未重新整理。

2026-09-17 整顆節點外光（0.8.84）：依最新回饋，Cool 的分類色光暈從 Title 移到整個節點外圍，維持 33%／20px blur／1px spread；灰底與名稱保留。選取／錯誤維持狀態細框，外光仍為分類色；收合亦套用。5 組隔離視覺檢查通過，Light 不變；28 份來源與服務一致，兩份 Master current，正式 TOE 保存 719,132 bytes。兩份使用者 Shader 保留，現有瀏覽器頁面未重新整理。

2026-09-17 Cool 外光風格（0.8.84）：齒輪新增「耍帥程度 / Swagger」Professional／Cool 選單，Professional 為原貌及預設；Cool 僅在 Dark 套用，Light 保持原貌但記住偏好。主要改動集中在 35 行獨立 CSS，沿用既有 flag／瀏覽器保存機制，未新增繪圖層、動畫或圖資料。

依試用回饋改為 33% 彩色外光：普通節點灰色本體不加 Glow，Title 與 Inputs 同分類色外光 20px，主名稱 12px；接線 6px（操作狀態 8px）、選取框與 Apply 20px、啟用工具列按鈕 24px／2px spread，active Pixel／Vertex 也有光。移除新增內光，小型別文字不發光。31 組相關瀏覽器／視覺檢查及 550 個雙語鍵通過；28 份內嵌來源與服務一致，兩份 Master current。正式 TOE 保存為 719,124 bytes，兩份使用者 Shader 保留，現有瀏覽器頁面未重新整理。

2026-09-17 實驗功能齒輪（0.8.84）：footer 在 QR 左側新增小齒輪，列出目前 10 項 UI 行為設定（9 個開關與箭頭／移動游標選项），保留既有預設、即時套用、只存瀏覽器並可還原預設。浮動工具列切換重用原 DOM；數值及名稱草稿、Graph／Layout／Undo 不因切換改寫。垃圾桶維持預設關閉，開啟時位於畫布右下、專注等工具列上方，桌面及窄版觸控均留間距。

新增獨立「所有向量分量染色」，預設關閉；依索引套用既有四色至 XYZW／UV 等數值、標籤、已知單分量接孔與來源線，也包含 RGBA。原 RGBA 開關保留；整體向量接孔維持型別色，不新增 GLSL 型別或改變編譯語意。74 組相關瀏覽器檢查及 546 個雙語鍵通過；28 份內嵌來源／服務內容一致，兩份 Master current。正式 TOE 保存為 717,956 bytes，兩份使用者 Shader 保留、私人助手排除，現有頁面未重新整理。

2026-09-17 Parameter 外觀與 Value Ladder 鎖定（0.8.84）：一般參數列說明改單行省略並保留全文 tooltip／既有 Help；內部分頁改淡分隔線的文字分頁，自訂名稱欄改淡亮底，選單入口與數值欄同底無常駐框，連線來源垂直置中。展開圖示放大並靠左；點名称、型別與空白可展開，數值／色票操作排除，三角形於 hover／鍵盤焦點顯示，無 hover 時保持可見。Uniform 數值及来源流程仍待後續整理。

Value Ladder 開始左右調值後鎖定級距，原列表不再命中或重現；下一次手勢才重新選擇。68 組相關瀏覽器檢查通過，28 份來源／服務內容一致，兩份 Master current；正式 TOE 保存為 712,420 bytes，兩份使用者 Shader 保留、私人助手排除，現有瀏覽器頁面未重新整理。

2026-09-17 Parameter 共用控制列（0.8.84）：數值、展開分量、主要型別／Buffer 選單、Swizzle 控制組、子圖名稱與操作按鈕、GLSL 函式名稱及一般說明共用欄位結構。無型別保留空欄，控制區起點固定；單行控制以 24px 為基準，窄版群組可在欄內換行。程式碼編輯器及介面定義表保留專用排版，Settings／來源流程保持。34 組相關瀏覽器檢查通過；28 份來源與服務一致，正式 TOE 保存 724,684 bytes，兩份使用者 Shader 保留，現有頁面未重新整理。Swizzle 的存在、逐分量來源選單與節點內快捷仍待討論。

2026-09-17 Parameter 對齊與子圖命名（0.8.84）：一般 Parameter 統一固定三角形、名稱、型別、值／連線欄，展開分量與連線來源沿用相同起點，數值欄縮至 24px；Settings／Uniform 流程保持。Tint、Invert、Contrast、Color Clamp 的 20 個預設內部節點補上用途名稱，新來源快照獨立版本，既有使用者快照不覆寫。GLSL 保留 `sg_n_`，具名子圖展平時加入呼叫路徑與內部名稱，例如 `sg_n_Tint_Apply_Tint`、`sg_n_Outer_Tint_Apply_Tint`，保留既有消歧、運算、節點 ID 與 sourceMap；未命名的舊呼叫維持原命名路徑。

279 項完整單元測試、47 組 Parameter／數值瀏覽器回歸與 TOP／MAT 重複、巢狀 Tint 原生編譯／影像驗證通過。28 份內嵌來源與服務一致，Master 保持 current；正式 TOE 保存為 724,172 bytes，兩份使用者 Shader 保留，現有瀏覽器分頁未重新整理。

2026-09-17 連續拖曳範圍修正（0.8.84）：依最新回饋，浮點拖曳在按住期間即時跟隨目前 slider 範圍，跨越 1／10／100 或反向拖回皆更新速度與增量；取消固定首次範圍的規則。分段連續換算保持數值連續，單次快速位移與多次小位移結果相同。32 組數值操作與 13 組 Parameter 回歸通過，28 份來源／服務一致；僅更新 inspector_js，正式 TOE 保存為 723,468 bytes，兩份使用者 Shader 保留，現有分頁未重新整理。

2026-09-17 數值操作與節點／Parameter 整理（0.8.84）：左鍵浮點拖曳依起始十進 slider 範圍及實際欄寬換算，一個欄寬約一個範圍、增量為範圍千分之一；Ctrl ×10、Shift ÷10、Ctrl＋Shift ÷100，手勢期間固定基準以免跨位數加速。保留手填精度、整數與取消／一次 Undo。Value Ladder 改為五級、0.1 列對齊按下位置，調值提示同時顯示目前值與級距、不受圖縮放影響；欄位說明分行，Help 保持節點內容。一般 Parameter 改為名稱／型別／值同列，可展開分量並保留完整值列同步；Notes 獨立分頁，Uniform／來源與 Settings 內容保持。節點支援三角形與右鍵批次收合；每側單孔保留接線、多孔只匯集既有線，兩個獨立三角形 flag 預設開啟。收合隨圖保存，保留展開寬度與 Undo，不改 GLSL。

66 組相關瀏覽器檢查、14 項收合／向量／型別單元回歸及 TOP／MAT 原生保存驗證通過，520 個雙語鍵與語法檢查通過。28 份內嵌來源及服務內容一致、兩份 Master 仍 current；正式 TOE 保存為 723,028 bytes，保留兩份使用者 Shader，排除私人助手。未重新整理使用者現有瀏覽器分頁。

2026-09-17 對話框選單回歸修正與 Inputs 陰影（0.8.84）：對話框的通用橫排樣式曾誤套到共用選單，造成來源種類橫向溢出及 vec2／vec3 等標籤換行；選單現在明確使用獨立直向排版與內容寬度，對話框結構樣式排除 popover。Inputs 的有色來源列與 TD Built In 列加入比節點輕、小的陰影，維持原色與尺寸。實際新增 Input 的種類／型別選單及 QR 來源選單已補上排列檢查；完整選單回歸 11 組通過。TD 28 份內嵌來源與服務資產一致，正式 TOE 已保存並保留兩份使用者 Shader。節點收合、Value Ladder 五階／中央定位及 Parameter 改版仍為待辦，本批不實作。

2026-09-17 彈出選單與 Value Ladder（0.8.84）：一般單選清單改為圓角共用選單，14px 字級／32px 列高，粗指標 40px；不受圖縮放影響，沿用 UI 縮放。保留原 select 值及變更處理，支援鍵盤、觸控、分組／停用與對話框。Value Ladder 在游標／欄位下方展開精度列，水平調值時只留欄位上方固定精度標籤，沒有標題、說明、重複值或亮邊；原步進、取消與一次 Undo 保持。64 組相關瀏覽器檢查通過，TD 28 份來源、10 份資產與 8 項 HTTP 檢查一致；正式 TOE 已保存，兩份使用者 Shader 及連線保留。導覽／工具列微紫已確認來自共用底色 #1c1b23；本輪只調查、不改配色。

2026-09-17 Combine 分量接線修正（0.8.84）：Combine 共用 Replace 的明確接線替換規則，新向量線取代占用範圍重疊的整條舊線；來源節點、不重疊接線與手填值保留。XYZ／YZW 範圍與將移除的線在拖曳中預覽，取消不改圖、放開以一次 Undo 提交。反向接線與從接孔建立節點一致；未放寬上游 Auto、迴圈、超出維度、常數限制或編譯器規則。5 組實際拖曳與 26 項模型／型別／編譯回歸通過，27 份 TD 來源與服務資產一致；來源 TOE 已保存，兩份使用者 Shader 保留。

2026-09-17 QR 面板位置修訂（0.8.84）：QR 圖示保持，入口移至 UI 大小（Aa）左側。分享改為整頁置中對話框，面板寬 360px、QR 基準 288px，窄版與低高度依視窗收限，方便其他裝置掃描。關閉鈕、Escape、點背景均可返回入口；分享網址與複製行為保持。9 組瀏覽器檢查通過，TD 27 份來源與服務內容一致；來源 TOE 已保存，兩份使用者 Shader 保留。

2026-09-17 QR 分享與 H 置中（0.8.84）：右下角加入網址來源選擇、本機 QR Code 與複製網址；保留 Shader 路徑及必要的分頁連線碼，不新增外部 QR 服務或 Chrome 專用傳送入口。沿用現有 LAN／驗證設定，純本機與缺少可攜憑證的限制會說明。圖內一般 H 與置中共用行為，避開文字輸入、選單、對話框、IME 及進行中的操作。QR 編解碼 5 組、分享介面 8 組、Editor chrome／H 16 組、HTTP／分享後端 17 項通過；實機另通過 7 項 HTTP 檢查，27 份內嵌來源與服務資產一致，兩份 Master 保持 current。正式 TOE 已保存為 714,860 bytes，保留兩份使用者 Shader；未重新整理現有瀏覽器分頁。重新整理後保留 Undo／Redo 只記為可選改善，未改現行歷史結構。

2026-09-17 即時操作回饋追加（0.8.84）：UI 縮放改為標準／舒適共用百分比，切換基準保持倍率；深色／淺色的明暗值仍獨立，現有亮暗比例獲使用者認可而保持。新增節點面板對齊滑鼠的水平中央／標題中段，支援拖曳標題列，原始新增位置及拉線語意不變。數值右鍵提供依型別與上下限過濾的預設值，選取才提交，一步 Undo；關閉選單保留草稿。比例底依 1／10／100 等範圍映射，負數採負範圍至 0，始終左亮右暗、左減右增。重新載入已套用圖一律先顯示用途與清除 Undo／Redo 的確認面板，預設取消，未完成欄位及寫入期間阻擋重載。 82 組相關瀏覽器檢查通過，25 份內嵌來源／服務資產核對一致；正式 TOE 已保存，兩份現有使用者 Shader 保留。

2026-09-17 UI 縮放與數值手勢（0.8.84）：Aa 開啟和明暗相同配置的二級面板；標準／舒適各自保留 75–125% 的全介面縮放，右鍵或雙擊重設目前基準。畫布座標及拖曳換算配合縮放，圖與操作歷史不變。數值底色比例更清楚，浮點拖曳採固定 0.01 增量及修飾鍵精度，避免小數座標造成長尾；手填高精度、整數步進及 unsigned 下限保持。專注編輯在網路圖右下角提供全螢幕快捷；畫布百分比加入向上展開的常用倍率選單，沿用 25–170% 範圍。網址初始 UI 旗標、齒輪設定入口、數值右鍵預設值與重載已套用圖前的操作／歷史警告均只記入後續筆記。 86 組瀏覽器檢查與窄版 Shader 選單補充驗證通過；25 份內嵌來源及服務資產一致，兩份 Master 保持 current，正式 TOE 已同步保存並保留兩份使用者 Shader。

2026-09-17 明暗幅度追加（0.8.84）：深／淺主題往亮與往暗的曲線強度統一放大至前版 1.5 倍，中央原配色及各主題獨立值維持。11 組外觀檢查通過，已同步 TD 並保存正式 TOE。

2026-09-17 明暗調校與視窗模式（0.8.84）：深色提亮加入暗部保護，淺色往暗的範圍加大；Dark／Light 各自保留數值，滑桿右鍵或雙擊只還原目前主題。0.5 秒全 UI 顏色過渡經 200 節點測試有明顯動畫成本，依使用者條件移除，保留即時更新。Footer 最右新增瀏覽器全螢幕，置中右側新增專注編輯／還原介面；專注模式保留圖與工具列、重要圖內診斷，可與全螢幕獨立搭配。進出及視窗大小變化保留縮放／平移、面板配置與 Undo。11 組外觀／觸控與 13 組 Editor chrome 檢查通過；25 份內嵌來源及服務資產一致，正式 TOE 已同步保存，兩份使用者 Shader 保留。

2026-09-17 明暗二級面板（0.8.84）：右下角月亮／太陽按鈕改為開啟小面板，上方深色／淺色基準，下方減號、滑桿與加號。中央保持原配色，左右即時微調，選基準或雙擊滑桿可還原；設定延伸既有本機外觀偏好。UI 色票調整不影響 Preview、實際顏色色票、GLSL 語法色或圖操作歷史。介面大小仍維持原標準／舒適切換。 10 組外觀與觸控、10 組 Editor chrome 檢查及色票基準比對通過；25 份來源一致，正式 TOE 已同步保存，兩份使用者 Shader 保留。

2026-09-17 Attribute 與節點標題（0.8.84）：Texture Coordinates／TD Position 共用低飽和暖灰褐 Attribute 色系，明亮模式對應淡米灰；接孔及接線型別色保持。TOP UV 副標為 vUV.st，MAT 為 UV 0，Inputs 來源提示與搜尋同步。畫布原地改名不再增加標題高度或移動接孔，錯誤訊息浮出；Parameter 維持原尺寸。副標及型別快捷的目前值統一靠右。此批不改成碼規則。

17 組節點流程、7 組改名幾何及 3 組副標對齊檢查通過，另驗證兩種目標及主題的來源色彩。25 份內嵌來源與服務資產一致，TOP／MAT Master 保持 current；正式 TOE 已同步保存，兩份使用者 Shader 保留。

2026-09-17 名稱、數值拖曳與 Auto（0.8.84）：工具列改為「顯示自訂名稱」，畫布副標只在需要時補回原始用途；Parameter 固定原始名在左、名稱在右。各分量數字欄位支援左鍵水平拖曳、Shift／Ctrl 精度與淡色 0–1 比例底，每次一次 Undo；原 Value Ladder 保留。Replace 僅新增依主輸入推導的 Auto，手填預設分量完整保留。autoDisconnectInvalidEdges 預設開啟，明確改節點型別時只移除新失效線，與型別共用一次 Undo，關閉可保留原草稿流程。260 項可攜單元檢查及 72 組瀏覽器檢查通過；25 份來源一致，正式 TOE 已保存，兩份使用者 Shader 保留。

2026-09-17 副標與 footer 微調（0.8.84）：節點副標的歸屬、中點、型別統一字型與亮度，依基線對齊；footer 左端依序為網頁重新整理、重新載入已套用圖，再接狀態，UI 大小與明暗快捷移至右端。About 紀念文字與年份置中。32 組既有瀏覽器檢查通過，另確認兩行置中；25 份內嵌來源同步，正式 TOE 已保存並保留兩份 Shader。重新載入清空 Undo 的風險已記錄，行為留待討論；Value Ladder、左鍵數值拖曳及分類調整未納入。

2026-09-17 節點外觀回饋（0.8.84）：移動游標改為一般箭頭並保留設定；調寬提示改為同圓心圓弧，可用 flag 隱藏。Uniform／Vector 輸出統一為 `out`。標題副標顯示歸屬與型別，選單不再截斷文字，也不因選單或 UV 副標多出標題高度。寬度分開為原有最小值、依整顆節點內容計算的預設值，以及寬鬆的 1200px 上限。15 組瀏覽器回歸通過，已同步 25 份內嵌來源並保存正式 TOE，保留兩份使用者 Shader。

2026-09-17 節點寬度追加（0.8.84）：標題型別快捷改為透明無框；右下角可水平調寬，以各類原先寬度為最小值。寬度隨圖保存，拖曳放開只記一筆 Undo，屬圖面修改而不重編 Shader；置中及錯誤定位使用實際節點尺寸。11 組隔離瀏覽器檢查與 TOP／MAT 原生保存驗證通過，25 份內嵌來源一致，正式 TOE 已同步保存，兩份使用者 Shader 保留。改型別自動拆除失效線仍待決議，未混入此次修改。

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

0.8.84 已實作 Specialization Constants、Vector／Replace 職責分開與上述節點工作流程。後續補一般數值型別、TOP 的其他貼圖維度，以及 Parameter／Inputs 來源值介面。Array／Matrix 希望至少型別與合理初始化可用，初版範圍仍需評估，完整值編輯介面後補。節點收合已完成；多選工具延伸、中途預覽與 Canvas Backdrop 分輪處理。詳細已決議／延後範圍見 [本輪清單](../discussions/NODE_WORKFLOW_ROUND.md)；较早筆記保留於 [Inputs 面板與工作區設計](../discussions/INPUTS_UI_NEXT_ROUND.md)。空白畫布設定頁與資源庫獨立 panel 仍未定案。

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
