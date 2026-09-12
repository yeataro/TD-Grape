# PNG 節點圖與 Graph 資料交換

點選工具列「匯出」可選 PNG 下載，或沿用 JSON 存入 TD 專案資料夾。PNG 畫出目前 Graph 層的所有節點，不受畫布平移與縮放裁切；在 Function 內匯出時，圖片呈現該 Function 層，metadata 仍保存完整 Shader Graph，包含全部 Function、宣告、介面、連線與節點位置。這是 TD-Sgrape 格式，不是 ComfyUI workflow 格式。

圖片使用現有節點／型別配色，不帶選取、hover 或拖線提示。超大圖按比例縮小，每邊最多 4096 px；metadata 不因圖片縮小而截斷。繪製與 PNG 壓縮只在使用者匯出時發生，不讀取 TD Preview、不增加 Shader 的逐幀 cook。關閉正在產生的匯出視窗會取消下載。

「匯入」接受 JSON 或 PNG，依檔案 signature 辨識 PNG，即使副檔名更名也能識別。PNG 先檢查結構／CRC／metadata，再進入現有 Graph 檢查與接受流程；不會直接部署。接受可 Undo／Redo；檢查期間圖有變動時拒絕覆蓋。原始下載保留 PNG 的完整位元組，包括沒有可用 metadata 或損壞的檔案。

## 格式與限制

使用標準 iTXt、關鍵字 TD-Sgrape、未壓縮 UTF-8。JSON envelope 的 format 為 td-sgrape.graph-png，version 為 1，graph 為完整圖，view 記錄圖片對應的 stage／functionIds。metadata 解讀不會解碼影像或解壓任意文字；重複 Graph 記錄、壞 CRC、截斷、較新 envelope、無效 UTF-8 與壓縮 metadata 都會拒絕並保留原檔。PNG 取代此工具自己已有的記錄時只保留一份。

PNG 檔案上限 16 MB，Graph 延用 512,000-byte 上限與 TD 原有檢查規則。外部 TOP／檔案仍是參照，這不包含貼圖資產。部分圖片軟體或社群平台會移除 metadata；保留原 PNG 檔才能可靠匯入。沒有 metadata 時不會嘗試從圖像辨識節點。

格式依 [W3C PNG：iTXt](https://www.w3.org/TR/png-3/#11iTXt) 與 [PNG chunk／CRC](https://www.w3.org/TR/png-3/#5Chunk-layout)，圖片由 [Canvas toBlob](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) 產生。codec 與 UI 放在原有 import_ui.js，仍是 19 個內嵌來源、6 份 JavaScript 資源；無新服務路由或私人 gateway 設定變更。

## 驗證

- 10 項 codec 情境，另以 Python zlib／JSON 獨立核對三份 PNG 的 CRC、UTF-8 和影像資料流。
- 12 項 Chromium 操作：真正 PNG 下載／影像解碼、整圖 metadata、Function 層、匯入預覽、原檔下載、接受／Undo／Redo、併發編輯、更名辨識、损壞／無 metadata、取消編碼、圖片尺寸上限與英文窄視窗。
- 5 項真實 TD 瀏覽器檢查。MAT／TOP 各由不同初始 Graph 匯入同類型 PNG，接受／Undo／Redo 正常，最終圖一致、GPU 像素差均為 0。
- 原有匯入與編輯回退測試、224 個雙語鍵通過。私人 Tailscale gateway 的 PNG 下載／完整圖資料通過，測試仍是同機，非第二台設備。

正式 Shader、revision、ID、GLSL、Uniform 值與控制模式保留。乾淨 TD-Sgrape-v01-test.42.toe 保存於 2026-09-10T05:18:04.504956，私人 helper 排除並恢復，bridge 保存檔停用，測試區已清理。本次為 0.7.0 封存後的前端開發檢查點，未新程序重開 .42.toe；0.7.0 ZIP／TOX／tag 保持不變。
