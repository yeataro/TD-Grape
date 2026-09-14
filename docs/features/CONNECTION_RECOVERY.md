# 連線提示與啟動驗證

0.8.71 保留既有 TD 主執行緒與 HTTP 佇列架構，Inputs 操作設計維持上一版。

## Editor 行為

- HTTP 401 顯示有效憑證指引；403 顯示網址／連線條件指引。這兩者不顯示成 Shader 編譯失敗。
- HTTP 503 顯示「TouchDesigner 暫時沒有回應」。網路失敗、其他服務端錯誤或 20 秒未完成的要求顯示連線逾時／服務無法連線。都不推斷 Cooking 已停止。
- 畫面上方提供「重試連線」及可展開的「如何恢復」。指引包括還原 TD 視窗、檢查全域 Cooking、等候耗時工作、檢查 LAN／Tailscale，以及 TD 重開後取得最新網址。
- 自動恢復檢查只在頁面可見、暫時連線失敗時進行，最多每 5 秒發出一次，且不重疊。憑證、拒絕連線及版本差異改由使用者處理。
- 重試只讀取 TD 狀態，保留畫布、選取、視角與 Undo。套用回應遺失時不自動重送寫入；若 TD 圖版本已改變，保留草稿並提示先匯出、再視需要重新載入已套用內容。
- 真正的圖／GLSL 驗證錯誤仍使用編譯診斷。版本衝突另行提示。預覽讀取失敗不會把已確認成功的套用改成編譯失敗。

主時間線停止、全域停止 Cooking 與最小化造成的停止更新是不同情況。這一輪不修改時間元件、全域偏好或執行架構，也不增加在背景執行 TD API 的執行緒。Editor 逾時時只能提供檢查方向，無法保證從網頁恢復已停止回應的 TD。TD 的相關說明見 [Cooking Flag](https://derivative.ca/UserGuide/Cooking_Flag) 與 [Execute DAT](https://derivative.ca/UserGuide/Execute_DAT)。

## 驗證

`tests/browser/test_connection_recovery.cjs` 使用隔離 HTTP fixture 驗證初始憑證失效、503、真實編譯錯誤、版本衝突、已完成寫入卻遺失回應、403、窄版介面與逾時。測試不寫入使用者的 TD 工程。

```text
node tests/browser/test_connection_recovery.cjs src/editor tests/fixtures/editor-state.json <report-directory>
```

獨立重開測試由 `tools/dev/prepare_cold_start.py` 複製 `src` 到新的測試目錄，僅在副本加入 `tests/td/cold_start_probe.py`。正式 TOE 不包含探針。執行方法見 [測試說明](../development/TESTING.md)。

0.8.7 上輪缺少冷啟動回報的原因已查明：Windows 文字寫入將新增 `.toc` 清單的換行轉成 CRLF，`toecollapse` 將 CR 當成檔名一部分，略過驗證探針；工具仍可能回傳成功代碼。修正為明確寫入 LF、檢查缺檔警告後，獨立程序驗證通過：4 個 Shader 保存狀態與程式碼一致、24 份內嵌來源一致、12 次 API 讀取與 Editor 靜態資源比對成功。這個原因屬於測試副本製作，不是正式工程 Cooking 設定。

0.8.71 保存後亦用新的獨立程序通過相同冷啟動驗證。148 項 Python 單元測試、14 項 Editor Launch 測試、語系與四組 JavaScript 模型檢查、新增 8 組連線情境及既有 8 組 TD 預覽控制實測通過。

Windows／TouchDesigner 2025.32820 實測。macOS／iPad 的本輪實機確認仍待進行，瀏覽器窄版測試不等同實體裝置驗證。
