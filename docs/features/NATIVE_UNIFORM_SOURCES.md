# Native Uniform sources — 2026-09-12

目前交付的是來源重構第一階段，版本維持 0.8.5。

- Uniforms 為獨立工具面板，可與其他面板互換左右側欄、合併分頁。既有四面板 Layout 保留原配置，將 Uniforms 加入 Parameter 所在分組。
- 可新增 float／vec2／vec3／vec4、改名、編輯四分量、建立畫布引用、移除／重建來源。不再要求先 Expose 才能讀寫原生數值。非作用中分量淡化顯示並保留。
- Grape UI 寫入實際 GLSL OP 的數值欄位；原生新增、刪除、改名、改值會同步回來。Vectors 的型別仍為 Grape 宣告資訊，Colors 新項目先按 vec4 參考；不臆造原生不存在的 Type 欄位。
- 重新產碼保留既有數值、四分量、Expression／Bind／Export 模式以及不屬於 Grape 輸出設定的原生進階參數。受控數值目前呈現唯讀，避免移除其控制方式。
- 原生列移動按所屬 OP 中的唯一名稱對應。單一明確改名保留 ID；複合歧義不猜配，保留缺失項目。TD Par 物件按欄位位置存在，不作永久來源身份。
- 移除畫布引用不刪來源。移除使用中的來源保留圖與接線，顯示缺失並阻止產碼流程暗中重建。使用者可明確重建或重新指定引用。原生缺少 Uniform 時的實際值仍遵循 TD，沒有新增數值保底策略。
- API 以 Shader 身份、revision 及原生欄位快照檢查過期編輯；失敗產碼回復列、來源對應與圖狀態。來源操作與畫布 Undo 分開，外部結構更新不重播舊圖 Undo。
- 新增「GLSL 原生參數」入口；Add Node 節點數移至画布左下。
- 舊 Shader 在首次套用時建立來源對應；既有舊版升級審閱仍有效。單純更新 Editor 資產不自動改寫使用者 Shader。

- 舊 Expose 控制在遷移期間仍可編輯；開啟 Expose 會連接既有原生列，解除則保留最後有效數值。

## 驗證

81 項 Python 檢查；19 項 TD MAT／TOP 原生案例；5 項瀏覽器操作案例；中英文文字鍵檢查。原生案例涵蓋未使用／未 Expose 項目、移動改名、刪除重建、接線保留、受控值、失敗回復、Bind 及同產碼雜湊的舊專案遷移。

原生測試入口 `tests/td/test_native_sources.py` 需在 TD 執行環境提供 `GRAPE_TEST_SOURCE`（本版 src）及 `GRAPE_TEST_OUTPUT`（測試輸出目錄）。它會建立並清理獨立 fixture，不覆寫其他 Shader。瀏覽器測試入口 `tests/browser/test_native_sources.cjs` 依序接收 src、state fixture、sources fixture、輸出目錄。

## 連線與部署

本機 Editor 與執行中的管理元件已更新，原連線位址／憑證、四份使用者 Shader 的 state／graph／manifest／GLSL 保持原樣。TD 重載會清空模組狀態，因此以短暫重啟 Editor 服務並回復工作狀態的方式部署。未另存 TOE。遠端預覽代理的既有允許清單尚未包含新來源 API（回傳 404）；本輪未修改私人代理。請從 TD 的 Open Editor 使用來源編輯。

## 接續工作

這一階段尚未替換舊 Expose／COMP 控制：獨立多頁自訂參數編輯器與相容遷移接續實作。Attributes、Sampler、Buffer、Constants 的完整圖中引用、彙總節點、int／uint 與不相容接線處理另依已定案決策推進。原生 MAT Viewer、跨 stage 傳輸、Subgraph 外層來源政策、GLSL 上下註解也尚未因本項而完成。最終資訊排列的待決策項目維持不變。

參考：[GLSL MAT Vectors](https://derivative.ca/UserGuide/GLSL_MAT)、本機 TD 2025.32820 Sequence 實測。

區網補充（2026-09-12）：啟用主元件的 Allow LAN Connections 後，可使用 [LAN URLs](LAN_ACCESS.md) 直接使用全部原生來源／控制 API。舊私人代理仍不轉送這些新入口，兩者網址不同。
