# MAT Pixel Color Buffers

2026-09-11 開發版。選取 Pixel stage 的 Color Output 節點，在 Parameters 的 Color Buffer 數量選擇 1–8；畫布提供對應的 Buffer 0 … Buffer 7 vec4 接口。

- 未接線且未手動填值：`vec4(0.0, 0.0, 0.0, 0.0)`。既有明確保存的輸入值繼續保留，接線優先於保存值。
- 減少數量前，須先移除即將關閉 Buffer 的接線；不暗中刪線。關閉接口的手動值保留，再開啟時恢復；支援 Undo／Redo。
- MAT 的 buffer 分配由使用該 MAT 的 Render TOP 決定。Grape 不猜測某個 Render TOP 為唯一來源，也不更動外部 Render TOP；請設定其 `# of Color Buffers`，使用 Render Select TOP 的 Color Buffer Index 讀取額外輸出。
- 產碼使用 `layout(location=0) out vec4 fragColor[TD_NUM_COLOR_BUFFERS]`，先清零所有實際配置的輸出；額外寫入以 `#if TD_NUM_COLOR_BUFFERS > index` 保護。1-buffer 原生預覽仍可編譯 8-output 圖；Render 配置比圖多時，多出的 buffer 保持零值。
- Buffer 0 的有效色彩沿用既有 TDAlphaTest／TDDither／TDOutputSwizzle；空白預設不經抖動，確保精確零。額外輸出只做 TDOutputSwizzle，避免改動資料值。原生 Alpha Test／discard 對整個 fragment 的作用維持 TD 行為。
- Settings 可編輯每個 Buffer 的辨識名稱，保存於 `ui.bufferLabels`。名称不改內部 port ID、buffer 索引、宣告或 GLSL；關閉再開啟 slot、Undo／Redo、JSON／PNG 皆保留名稱。Buffer 名稱在 GLSL 的位置仍保留決策。
- JSON／PNG 內嵌圖仍保存完整資料；額外接口也參與 Subgraph 展開、型別檢查與匯入，第一個接口的內部 ID `color` 保持相容。此批未擴充 TOP 多輸出。

實作分布：`sgrape_core.py` 定義動態接口及产碼；`sgrape_document.py` 驗證匯入接口；瀏覽器從 type contract 取得相同接口表，`inspector.js` 處理數量編輯。未新增外層 COMP 參數分頁。

Catalog 0.6.4、targetShellVersion 2 記錄此次明確的輸出行為差異。既有 Shader 仍保留上次成功結果，沿用 Editor 現有版本差異確認流程；不靜默重新產碼所有工程。

## 驗證

- 73 項核心／Subgraph／匯入／型別／診斷／升級測試通過。歷史 138 圖的指紋比較只扣除已確認的清零與空白透明預設差異；其餘計算保持。
- 6 項實際瀏覽器操作：數量、拖線、受保護縮減、值恢復、Undo／Redo、JSON 下載、浮動 Add Node 與中英文字。
- TouchDesigner 2025.32820：4 個輸出中間缺線、8 個圖輸出搭配 1 個預覽 buffer、Render 數量大於圖、全空白、只接 Buffer 7，五組原生編譯與 RGBA32F 像素讀回通過。零值精度檢查容差 1e-6。
- 測試使用獨立臨時元件並清理，既有四個 Shader 的 Graph／state／GLSL／manifest 未變更。

參考：[Derivative — Write a GLSL MAT / Multiple Render Targets](https://derivative.ca/UserGuide/Write_a_GLSL_MAT#Multiple_Render_Targets)、[Render Select TOP](https://docs.derivative.ca/Render_Select_TOP)。
