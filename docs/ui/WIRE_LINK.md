# Wire／Link 接線樣式

0.8.180，依 2026-09-23 作者確認實作。

## 操作

- 在接線上按右鍵，選擇 **Wire** 或 **Link**。Wire 保留原有曲線與型別色；Link 為直線細灰虛線。選取／hover 保留醒目回饋，錯誤或垃圾桶操作保留狀態提示。
- 有 Link 的接孔旁顯示箭頭。左鍵選取並 Frame 該接孔透過 Link 連接的所有對端節點；右鍵列出對端，選一個後選取並 Frame。輸入與輸出兩端均可操作，不包括 Wire 對端，也不沿圖遞迴搜尋。
- 同一對端只列一次。收合節點的合併接孔使用同側所有接孔的 Link 對端。
- UI 設定的「色彩與顯示」加入 **顯示 Link 線**，預設開啟。關閉時隱藏 Link 線與其命中區，接孔箭頭仍可使用。

## 資料與邊界

Wire／Link 是同一種圖接線的顯示樣式，不改變 GLSL、型別、計算、接線合法性或一般上下游選取。新接線預設 Wire。Link 記為 `edge.ui.style = "link"`；切回 Wire 移除這個顯示欄位。

樣式跟隨圖保存，支援 Undo／Redo、Duplicate、剪貼簿、Function 內部接線及函式庫交換。從節點抽出 Function 時，既有邊界合併規則仍成立；多條邊合併為單一邊界接線時，合併邊使用第一條邊的樣式，各內部支線保留各自樣式。

樣式編輯走既有 layout 編輯路徑；後端語意指紋排除 edge UI，不因樣式變更改變 Shader 語意。顯示 Link 線是瀏覽器偏好，不寫入圖或 Undo；導覽是選取與 Frame，唯讀圖亦可使用。右鍵清單若所屬圖已替換，不執行過期選項。

## 驗證

- `tests/browser/test_link_navigation.cjs`：實際右鍵切換、Undo／Redo、雙向箭頭、分支清單、隱藏線與命中區、唯讀、折疊接孔、複製／貼上及斷線復原。
- `tests/unit/test_link_presentation.py`：TOP／MAT 與 Function 的 GLSL／語意指紋不變，圖與函式庫往返保留样式。
- 既有接線命中測試核對一般 Wire 的 6px 命中區、重疊優先序及 Group／節點層次。
