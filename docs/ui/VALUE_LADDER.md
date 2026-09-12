# Value Ladder

在可編輯的數字欄位按住中鍵，向上或向下選擇級距，再左右移動調整數值。提供 100、10、1、0.1、0.01、0.001；每移動 8 個 CSS 像素增加或減少一級。換級距保留目前數值並重新計算水平起點，避免突然跳值。

操作參照 [TD 官方 Value Ladder 說明](https://docs.derivative.ca/Value_Ladder)，0.001 是這裡針對 Shader 微調補上的級距。浮層沿用紫色系、顯示目前結果與 Esc 提示，配色集中於 CSS。中英文說明在 locales.json。

## 提交與取消

拖動中只更新輸入框，不修改 Graph、不提交 Uniform，也不因這個手勢要求編譯／PNG。放開中鍵才提交一次；原本其他原因觸發的同步／Preview 機制保持不變。

- Graph 的常數、未接線 Input、Uniform 預設值與 Function 介面預設值沿用一次編輯、一筆 Undo。函式庫副本也只在真正提交時本地化，Undo 可恢復來源參照。
- Expose 的目前值沿用既有 Uniform 寫入檢查；一次手勢送出一次參數寫入，不更改 Graph 預設值／revision／GLSL。這項目前值操作尚未加入 Graph Undo，TD 原生 Undo 整合仍是原有待辦。
- Esc、Tab、失焦、縮放視窗、捲動所在區、取消指標、失去 capture、欄位被重建或變成唯讀都會取消，恢復開始時的欄位值。中鍵點一下而未調整不產生編輯。
- 已接線 Input、唯讀圖，以及 TD Expression／Export／Bind 控制的欄位不接受 Ladder 編輯。伺服器仍會拒絕拖動期間發生的外部值衝突。

鍵盤輸入方式保持可用。這次沒有加入觸控數字拖曳、長按左鍵、無限滑鼠捲動或連續即時渲染；可在實際手感 review 後另做調整。

## 驗證與保存

22 項實際 Chromium 手勢測試通過，涵蓋級距、單次提交／Undo、多種取消、精度、唯讀、外部衝突、窄畫面、雙語與 Function 本地化；14 項 Shader 切換及既有編輯回退檢查也通過。

獨立 TD TOP 工程透過實際瀏覽器驗證常數與 Expose Uniform。常數 R 由 0.2 到 0.3 可 Undo／Redo；Uniform R 調整一次且沒有重新編譯，G 的 Expression 及 B 的 Bind 保持。GPU 結果分別接近 `[0.3, 0.3, 0.4, 1]`、`[0.3, 0.25, 0.7, 1]`；差異在 TOP 浮點格式精度內。測試區已清理，正式 Shader／服務入口保留。

已保存 `TD-Sgrape-v01-test.32.toe`，時間 2026-09-10 04:10:56。私人 helper 排除並恢復、bridge 在保存檔停用。此檢查點尚未以新 TD 行程重開。既有封存版本不變。

## 2026-09-10 Sidebar 回歸

Vector 分量改成一行後，22 項既有 Ladder 操作檢查重新通過。Parameter 上方加入可見雙語中鍵提示，避免使用者誤以為尚未提供。手勢、級距、提交與取消規則未改。
