# Sources 面板整理

2026-09-23 使用者確認後授權由簡到難分批實作。所有卡片與搜尋列的調整都在 Sources／來源面板，不是 Add Node 面板，也不改畫布節點的顯示模式。

## 第一批：0.8.176

- Input／Inputs 面板正式改名 Sources／來源。
- 搜尋框置頂、占滿整行；TD／共同名稱下拉選單移到第二行，同列提供顯示備註。
- 預設最上方依序為 Uniform、Graph Constants、Specialization Constants。
- 一般卡片的 Output 放在 Body 最上方。
- 節點的「編輯來源」按鈕移到設定；數值與數值來源操作保留在參數頁。

顯示備註是瀏覽器偏好，不修改圖、來源、接線或 Undo。切換時保留數值控制 DOM。Sources 仍沿用既有 workspace panel ID，已保存的面板位置不受改名影響。

## 接續實作

- 分類可手動排序，保存為瀏覽器顯示偏好；不改宣告順序。
- Graph Constants 在來源卡片 Body 中直接編輯數值；Specialization Constants 沿用原生數值寫入路徑，Uniform 沿用既有即時寫入路徑。
- 第二行加入最小化顯示切換。對有數值控制的卡片保留控制，先試名稱橫排在左、控制在右，隱藏 Output 文字與接孔。其他來源折疊，不丟失編輯／建立引用入口。恢復一般模式時保留原先折疊偏好。
- 以較小占用面積為驗收目標；不實作旋轉 90° 標題，等待視覺 review。

未增加新的來源或產碼能力。畫布 Float／Vector 常量節點不屬於本輪 Graph Constants 要求。
