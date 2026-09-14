# MAT 原生預覽（0.8.72）

網頁 Material Preview 使用內部 `grape_material_preview` OP Viewer TOP 擷取同一個 `material` GLSL MAT 的原生 Viewer，輸出 512 × 512 RGBA PNG，開啟 Preserve Alpha。Grape MAT 的 COMP Viewer 也直接指向 material。TOP 仍使用既有的限尺寸 TOP 預覽。

預覽幾何、視角及光照由 TD 原生 Viewer 決定，可能與使用者 Render TOP 的場景不同；它不代表指定 Render 的所有輸出。MAT 的 Viewer 有自己的渲染成本，本輪未宣稱全面降低 GPU 使用量。

## 保存與驗證邊界

- 已有 MAT 註冊時補上專用擷取 TOP，不重建 material、Shader ID、圖、參數或 Bind。擷取 TOP 的相對引用隨組件保存／載入。
- 保留原 `preview_geometry`、`preview_camera` 與 `preview` Render TOP，繼續供 `validate_material` 與候選 Shader 驗證使用。網頁取圖不讀取或強制 cook 這個 Render；本輪不移除可能被既有工程引用的內部 OP。
- 不將捕捉的 PNG 寫入 TOE／storage；每次快照仍依既有 API 讀回並編碼。
- 冷啟動或材質更新時，OP Viewer 可能先產生空白或預設材質。MAT HTTP 預覽在同一條請求中等待兩次絕對幀推進，再讀回影像；等待期間照常處理其他要求。TD API 仍只在主執行緒執行，沒有新增執行緒或阻塞等待。
- 請求取消或逾時後不再讀圖；等待期間來源被刪除／替換時回報錯誤，不改讀其他 Shader。停止 Cooking 時沿用連線提示及原本的 HTTP 逾時。

## Editor 行為

自動更新仍在套用或偵測到參數變動時取快照。手動 Refresh、背景切換、關閉自動更新及面板／瀏覽器分頁隱藏時暫停要求的規則維持。說明面板已交代原生 MAT Viewer 與 Render 場景的差別。

本輪未加入串流、相機控制、Window COMP 或 Always on Top，也未更動 Inputs 操作設計。

## 驗證

- `tests/unit/test_material_preview.py`：跨幀等待、同時處理其他要求、取消、來源刪除／替換、讀圖失敗、TOP 即時回覆。
- `tests/td/test_material_preview.py`：隔離 MAT／TOP、首次實際色彩與透明度、兩個 MAT 分別取圖、Uniform 更新、失敗回復、多 Buffer 編譯、TOX 重載，以及既有 Shader 保存內容不變。測試透過臨時 Execute DAT 跨幀執行，完成後清除元件；以 `native-result.json` 的最終結果為準。
- Windows / TD 2025.32820：22 項新原生預覽檢查、6 項既有 GLSL 註解／錯誤定位檢查、MAT 與 TOP 各 8 組真實 HTTP 瀏覽器檢查通過。148 項既有 Python 回歸與 7 項新增佇列檢查、14 項啟動檢查、語系及 JavaScript 模型檢查通過。macOS 與 iPad 本輪實機回驗尚未完成。

原生功能參考：[OP Viewer TOP](https://derivative.ca/UserGuide/OP_Viewer_TOP)。
