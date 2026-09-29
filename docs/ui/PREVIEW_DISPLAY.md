# 預覽與 Viewer 參數

目前 Editor 透過管理元件的 Remote Panel 串流 TD 畫面，MAT 與 TOP 分別使用
`mat_viewer`、`top_viewer`。畫面標示實際來源、連線狀態與收到的解析度。
同時只有一個接收端控制預覽；被接管的頁面需手動重新連線。

點選預覽會讓既有「參數」面板顯示該 Viewer 的自訂參數，同時顯示預覽說明。
支援停駐與浮動參數面板；選回節點即恢復節點參數。Viewer 設定不修改節點圖、
選取、Undo 或 Shader 編譯資料。

欄位沿用 TD 的標籤、選單、分量、唯讀狀態與 `startSection` 分段。
標籤／控制項共用固定比例的兩欄；一般列間距 8px，分段水平線上下各留 12px。
水平線跨越兩欄，第一列不額外加分隔線。窄版仍保留控制項寬度，不出現
因節點接孔預留空間造成的空欄。自動引用 Target OP 的來源欄保持唯讀。

參數修改直接送到當前 Viewer，收到 TD 回讀後更新；定期回讀不覆蓋尚未完成的
輸入。來源切換、參數被 TD 改動或接收端被接管時，舊寫入會被拒絕。這些參數
由 TD Viewer 保存，不是每一份圖自己的設定。

新預覽來源會 Home 一次；調整面板大小、環境光或其他參數不會再次 Home。
預覽取得焦點後按 **H**，與參數中的 **Home All** 呼叫相同的 Home。
MAT／TOP 的遠端導航由外層轉接器呼叫既有 cameraViewport 操作方法；按下先以
畫面內 0～1 座標建立起點，再根據後續座標移動。這避免 `interactMouse` 與本機
游標共用 Panel UV，使原生 whileOn 在拖曳中讀到外部座標而跳動。
一般 Panel／其他原生 Viewer 仍用 `interactMouse`。

MAT 左鍵拖曳旋轉、右鍵平移、中鍵 dolly；TOP 沿用其正交 Viewer 的導航設定。
兩者支援既有雙指平移／縮放轉譯。實體 iPad／Safari 操作仍需裝置驗證。

擷取鏈為 **所選 Viewer Panel → OP Viewer TOP (`opview1`) → video_out**。
不以 Switch TOP 選取渲染結果。橋接更新保留作者整理的兩個 Viewer 內部階層、
參數關聯與相機設定；遠端導航轉接器位於 Viewer 外層。

實作與通訊契約見 [Remote Panel](../../src/remote_panel/README.md)。驗證入口：
`tests/td/test_remote_panel.py`、`tests/td/test_remote_viewers.py`、
`tests/browser/test_viewer_parameters.cjs`、`tests/browser/test_viewer_parameters_live.cjs`。
