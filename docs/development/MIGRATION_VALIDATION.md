# 獨立目錄遷移驗證

產品版本維持 **0.8.5**。此記錄只代表來源目錄與開發 TOE 的搬遷驗證，不是新版本發佈。

- 可攜檢查：136 項 Python 核心測試、14 項 Editor Launch 測試、388 個雙語鍵、節點身分與品牌來源檢查，以及四組 JavaScript 模型檢查通過。
- 原生 TD：Uniform 19 項、自訂參數 18 項、Sampler 38 項、GLSL 註解 6 項檢查通過；測試保留使用者 Shader。
- 瀏覽器：本機／遠端 Viewer 入口的 7 項檢查通過；測試資料清除私人資料夾後再次通過。
- 獨立重新開啟：將產品目錄複製到另一處，以新的 TD 程序開啟 TOE。4 個 Shader 的保存圖與 GLSL 一致，24 份內嵌來源一致，TDFam 正常，12 個狀態／產碼／預覽 HTTP 檢查及編輯器資源比對通過。
- 正式 TOE 沒有私人代理、開發助手或既有連線憑證。產品與 TOE 展開內容的本機路徑／憑證掃描通過；舊 Git 歷史完整封存在產品 repository 外。
- 舊目錄封存後，正在工作的正式工程仍使用新來源，4 個 Shader 無 TD 錯誤，原編輯器連線保留。

環境：Windows、TouchDesigner 2025.32820、Python 3.14、Node.js 與 Chrome。獨立 TD 的首次受限程序無法讀取已安裝金鑰，改在既有使用者環境啟動後通過；未修改 TD 授權。macOS 與第二台裝置尚未實測。

測試方法見 [Testing](TESTING.md)。私人完整報告與原始紀錄由維護者保存在 repository 外。

## 固定開檔入口

每輪交付更新 `src/td/TD-Grape-dev.toe` 作為固定開發入口。開發工具 `save_source_project.py` 會排除私人助手並更新該檔。

Grape UI 的「儲存 TD 工程」沿用 TD 原生 `project.save()`。TD 的 **Create Link Filename when Saving** 開啟時，不帶編號的 TOE 會保持對應最新保存版本，可以保留增量檔並固定開啟原檔。這是 TD 原生功能，無需另外實作啟動器。

本次實際查詢的 Windows TD 偏好為 `general.inc = 2`、`general.link = 1`。其他工作機器依其 TD 偏好；換裝置開啟前先完成保存與 Dropbox 同步。尚未存檔的現場變更不會因同步而自動保存。

參考：[TD Preferences](https://docs.derivative.ca/Dialogs%3APreferences_Dialog)、[TD Getting started：Save your work](https://docs.derivative.ca/Getting_started)。
