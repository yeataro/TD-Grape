# Sidebar 與 Parameter 佈局

左右側欄各有可拖曳的細分隔線，hover／鍵盤 focus 以紫色標示。左欄最小 180px、右欄最小 300px；預設 220px／340px，最大 520px／640px。設定集中在 style.css 的 sidebar CSS 變數。

- 寬度存於此瀏覽器 localStorage，只屬於檢視偏好。拖曳不修改 Shader、Undo、畫布 pan 或 zoom；連線位置按動畫影格重新計算。
- 視窗縮小時暫時壓縮側欄，桌面畫布保留至少 280px；放大後恢復偏好寬度。800px 以下沿用單一側欄 overlay，在可用畫面小於最小寬度時才受螢幕寬度限制。
- 雙擊分隔線恢復該欄預設；鍵盤左右鍵移動 8px，Shift 加速為 32px，Home／End 到可用最小／最大。Esc、失焦及 pointer cancel 取消尚未完成的拖曳。
- 使用 Pointer Events，觸控可拖側欄；實體 iPad 手感仍待使用者確認。
- Parameter／Live／Help 的獨立捲動與收合保留。

Vector2／3／4 的分量改成一行；X／Y／Z／W 放入各數字框左緣，保留無障礙標籤。在最小右側欄寬度下 Vector4 仍不折行，原本的預設值、目前值及唯讀規則不變。本轮不新增 Color 顯示模式。

Value Ladder 原已有實作，本輪增加中英操作提示，沒有更改拖動提交規則：可編輯數字按住中鍵，上下選級距，左右調整；放開提交一次、Esc 取消。觸控數字 Ladder 另列後續。

## 驗證

13 項新增 sidebar 瀏覽器檢查、22 項既有 Value Ladder 手勢檢查、12 項右側三區檢查通過。涵蓋最小寬度下單行 Vector4、鍵盤／觸控、取消、reload 記憶、窄視窗暫時限制與還原、雙語，及 Shader 圖／history 不變。Ladder 寫入在獨立 fixture 內測試，其餘實際 TD 網頁測試阻擋全部非 GET 請求。

接入現用 TD 時只更新五個 UI 資源並重建靜態內容；需核對現有 Shader state／graph／manifest／GLSL 與 port 保留。未另存 TOE、未封新版，後續正式封版收錄。
