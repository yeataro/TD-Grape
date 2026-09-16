# 測試

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
