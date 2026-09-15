# 測試

## TD Remote Panel 0.1

```text
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
