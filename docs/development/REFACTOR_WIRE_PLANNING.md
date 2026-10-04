# 第一個 TypeScript 模組：接線規劃

原畫布、Creator、浮動接孔、取消及 `change`／History 保留。`src/core-ts/wire_planning.ts` 的 `GrapeWirePlanning.plan(graph, capabilities, intent, previous)` 接收唯讀規劃資料，回傳 edges、型別／operand 選擇或診斷，不修改作品、History、DOM、storage 或 TD。`infer` 與 `wire` 使用同一個規劃入口與簽名選擇。

模組處理輸入替換、循環偵測、拓樸排序、Auto／Locked scalar/vector 算術簽名、單輸入 Multiply 預設、既有簽名保留、新增型別錯誤及 downstream 損壞拒絕。拓樸排序不依賴 JS 遞迴深度。呼叫者必須提供節點 ID 唯一的有效結構與對應能力表；回傳內容是當次預檢，不能成為日後修改的授權。

`graph_ui.js` 的 `scalarVectorPlanning` 是過渡 Adapter：讀既有 catalog/type contract，投影到模組的結構，翻譯診斷。產品定義目前仍由既有系統供應，未宣稱 Python 型別契約或 compiler 已搬完。每次規劃僅在呼叫內共用 signature 投影，不快取可編輯圖。

## 目前接入範圍

- TOP 根圖：Scalar／Vector／固定 float、vec2–4 常數、Pixel Output，以及 Add／Subtract／Multiply／Divide；使用既有 scalar/vector 型別與 conversion 資料。所有節點須在本次可處理的範圍，否則規劃前選原路徑。
- Creator 局部預檢仍使用既有 boundary 試算及快取，不為每個候選重跑整张圖。預檢與正式提交均經 `plan` Interface；正式提交仍以目前整張圖重新規劃。
- MAT、子圖、矩陣、動態埠、未知節點等走既有路徑。沒有「新模組出錯後改跑舊版」的 catch-all。新模組載入失敗不是可靜默忽略的狀態。
- `finishWirePlan` 仍檢查常數限制、調整手填值的 shape；`change` 仍負責交易回復、History、整份文件的編輯驗證、dirty 與排程。未新增保存欄位或第二份可持續編輯的圖。

## 建置與重跑

在 checkout 執行 `npm ci`，然後 `npm run build:core`。TypeScript 5.9.3 固定於 lockfile，strict、noUncheckedIndexedAccess，標準 library 不含 DOM。沒有 bundler 或 UI framework。

`src/editor/wire_planning.js` 是提交的生成資產，不手改。既有頁面先載入它再載入 graph UI；`source_files.json`、`embedded_sources.json` 及 runtime 的 asset route 一起登記。`npm run check:core` 驗證 strict type check 與生成資產一致，`npm run test:core` 執行純模型案例。portable runner 已加入這兩項檢查，首次執行前需 `npm ci`。

既有 Python wrapper：設定 `PYTHONPATH=src/core;src/td/runtime;tests/unit` 後執行 `python -m unittest test_wire_validation test_matrix_arithmetic test_functions test_core test_share_links`。它涵蓋新模組實際接入、過期預檢、Auto 預設、矩陣未覆蓋路徑及內嵌資產 route。`test_auto_operand_defaults.js` 包含巢狀子圖的回歸。

瀏覽器沿用 `tests/browser/test_glsl_code.cjs` harness。`test_wire_refactor.cjs`、`test_parameter_input_ports.cjs`、`test_matrix_arithmetic.cjs` 與 `benchmark_wire_planning.cjs` 都接受 `SOURCE_DIR STATE_JSON REPORT_DIR`。設定 `PLAYWRIGHT_MODULE` 與 `CHROME_EXECUTABLE` 指向測試環境；使用固定且由對應 Legacy 匯出的 fixture。Host API 是隔離 fixture，不能算真實 TD 驗證。

## 退回及下一步

停止手勢、保存目前工作圖後，可 revert 本批接入提交：建置資產、載入順序及呼叫入口須一起退回。保存格式未變，不需要轉換作品；不可只刪除 JS 資產而留下其呼叫者。固定 Legacy 不跟隨 main 更新。

下一個里程碑依 workspace 正式流程書：人類檢視此操作體驗後，再做前端產碼到隔離 TD 的閉環。此提交沒有更新運行中的 TD，也未保存 TOE。
