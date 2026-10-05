# Editor Service

目前在 `/TD_Grape/GrapeEditor` 提供真正的 HTTP 靜態資產服務。前端版本維持 **0.8.276 Refactor.13**；Manager API 尚未接通，`/api/*` 回報 `manager_not_connected`，此提交不是完整編輯器或離線 Sketch 的交付。

## 使用與建置

在 refactor 根目錄執行：

```text
npm run build:editor -- --out ../work/refactor/editor-service/web
```

這會組成完整網頁資料夾：現有 `src/editor` 的瀏覽器資產，加上 `src/remote_panel` 的 `remote-panel.js`、`touch-gestures.js`、`panel-size.js`。Remote Panel 的示範、測試與 TD 程式不進入網頁包，也沒有另做產品 catalog。TypeScript 有修改時仍先執行 `npm run build:core`，本命令組裝已有的瀏覽器产物。

`build-info.json` 是生成的版本／內容清單，版本讀自實際頁面的品牌版本。重新建置只清除上一份清單所擁有、現在已移除的檔案。直接修改資料夾內的 JS／CSS 後仍可 Reload，版本會標示 `(modified)`；不偽裝成原始建置。

| 參數 | 行為 |
| --- | --- |
| Rootfolder | 外部建置資料夾，相對路徑以目前 TOE 資料夾解析 |
| Useexternal | 開：讀外部資料夾；關：讀此組件專用的 `virtualFile` VFS |
| Reload | 完整讀取所選來源，再一次替換記憶體快照；不寫入 VFS |
| Updateembedded | 完整讀取外部資料夾，更新專用 VFS；不切換來源 Toggle。需保存 TOE／TOX 才持久保留 |
| Active / Port / Allowlan | 控制 HTTP 啟停、固定 port、是否監聽 `0.0.0.0`；port 占用明確報錯，不換網址 |
| Openeditor | 開啟顯示的本機網址；現阶段不代表 Manager 已可用 |
| Servicestate / Serviceerror | 狀態與原因，僅在操作／狀態改變時更新 |
| Actualsource / Frontendversion / Assetcount | 正在供應的實際來源、版本及檔案數 |
| Localurl / Lanurls | 實際 HTTP 入口；LAN 位址列出網卡地址，不保證其他裝置的防火牆／路由可達 |

載入失敗時保留上一份有效快照。沒有上一份且外部來源失敗時，嘗試整份內嵌 VFS，清楚顯示原因；不逐檔混用不同版本。打包失败保留／復原原 VFS。`virtualFile` 是網頁專用，Update Embedded 會移除舊版資產，不放置其他用途資料。

## 責任

`runtime/editor_service.py` 只負責資產快照及 HTTP，沒有 TD／圖模型／compiler 依賴。背景執行緒只讀普通 bytes，不讀 OP、VFS 或硬碟。`EditorServiceExt` 在 TD 主執行緒處理來源載入、VFS 更新及可見狀態，Parameter Execute 和 start/create/exit callback 控制生命週期，沒有 TD 每幀 callback 或每幀資料夾掃描。HTTP 自身仍有背景等待迴圈；尚未量測整個宿主的待機成本，不能宣稱零開銷。

Editor build 持有 Remote Panel 的瀏覽器端檔案；宿主的擷取、RTC 與互動留在 `remote_panel`。接續 Manager 需提供真實 API 與 Remote Panel 連線設定，不能為使測試頁載入而加入虛構狀態或舊 Python 前端核心。

資產包可供一般靜態服務使用，但目前頁面有 `/api/state` 與根路徑相依；獨立 Sketch、GitHub Pages 子路徑及 PWA 實際操作仍是後續工作。

## 驗證

- `python -m unittest discover -s tests/unit -p test_editor_service.py -v`：10 項資產／真實 HTTP 測試。
- `tests/td/test_editor_service.py`：在獨立副本驗證外部 bytes、明確 Reload、來源失敗保留、VFS 切換、移除舊資產、保存 TOX 後無外部資料夾的恢復。fixture 不替換正式入口。
- 開發現場：41 份完整產品資產在外部／VFS 兩種來源經 HTTP 逐份核對；網址保持。額外保存 Active 啟用的隔離 TOX，重新載入後自動從 VFS 提供 HTTP，外部路徑失效仍可用。
- `IconGen → icon` 51 個 OP 與檢查點核對無差異；Editor 子樹無 TD 錯誤。證據放 workspace `work/refactor/editor-service/`。

main／固定 Legacy 不改動。人類可能另開 Legacy TD；遇到 port 衝突回報，不自動關閉其程序。
