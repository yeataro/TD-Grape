# Agent 工作入口

先閱讀根目錄 README、`docs/development/STATUS.md` 與本次任務涉及的功能文件。設計文件記錄原意；遇到實作偏差，查明原因並與使用者討論，不把舊規格當成不可修改的規則。

- 產品程式只在 `src/` 維護。來源檔與 TD DAT 的對應由 `src/td/source_files.json`、`src/td/embedded_sources.json` 定義。
- 本機絕對路徑、連線憑證、截圖、原始測試紀錄與一次性腳本放在私人工作目錄。使用 `tools/dev/paths.py` 的 `work_path()` 找到它；不把私人文件當成建置或執行的必要條件。
- 持久的設計決策與可重現驗證方法寫入 `docs/`、`tests/`。避免在工作筆記重複維護第二份規格。
- 更新正在運行的 TD 程式必須保留使用者的圖、參數關聯、Shader ID 與連線狀態。`refresh_sources.py` 不等同保存 TOE，也不等同升級 Shader。
- 移除私人資料時，檢查檔案內容、TOE 內的 DAT／參數／storage 及 Git 歷史。`.gitignore` 不會移除已提交內容。
- 根目錄的 Markdown 僅保留 README。產品版本只能向前；本次遷移維持 0.8.5。
- 交付打包、安裝方式、Web 資源外部化與公開發佈需要另行處理。

私人工作區可以另設機器設定與交接文件；新加入的開發者不需要取得它們即可開啟並驗證此專案。
