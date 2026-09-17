# 測試

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
