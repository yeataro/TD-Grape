# 專案與私人工作區

TD-Grape 是唯一維護中的產品來源。可以獨立放在任何可寫位置，也可以置於私人工作區之下：

```text
workspace/
  TD-Grape/       # 唯一產品 Git repository
  private/        # 本機設定、私人交接、原始紀錄與歷史備份
  work/           # 開發橋接、一次性 jobs、測試輸出與暫存
```

`private/` 與 `work/` 都不是產品 repository 的子目錄。公開整份 TD-Grape 時不會順帶包含它們。專案不依賴私人資料夾才能執行。

產品所有本體在 `src/`。正式 TOE 為 `src/td/TD-Grape-dev.toe`，不是 `dist` 中的歷史檔案。增量存檔與 Backup 檔不加入 Git，保存前應確認目前檔名。

`tools/dev/paths.py` 可選擇讀取相鄰的 `private/development.json`：

```json
{"workDirectory": "../work"}
```

没有此設定時，開發輸出會使用系統暫存目錄中依專案位置區分的 TD-Grape 子目錄。這是執行時產生的路徑，不需要把任何使用者名稱或安裝位置寫入來源。

設計與開發文件集中於 `docs/`；通用 Agent 入口集中於 `agent/`。私人交接可以包含實際機器路徑，公開文件則使用相對位置及可重現的操作方法。

本次建立乾淨的產品 Git 起點。遷移前的完整 Git 歷史、原始文件、歷史工具與交付檔在私人區保留，沒有刪除或改寫原始歷史。打包與安裝策略不在本次目錄整理範圍。
