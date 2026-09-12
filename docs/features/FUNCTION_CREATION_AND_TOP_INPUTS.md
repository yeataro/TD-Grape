# Function 建立與 Sgrape TOP 預設輸入

2026-09-10；左側 UI 整理與 Texture Expose 已納入 0.6.2。使用者最新指示確認活用 In TOP 預設輸入，來源優先順序不再等待回覆。

## 左側 Function 區域

已將現有 Group as Function／New Function 兩個入口移到左側可收合的建立卡片；畫布上方不再放這兩個按鈕。既有節點／Functions／個人分類改為各自的區域，仍共用搜尋。沒有更改 Function 的引用、本地化、分組或新增語意。

實際瀏覽器在獨立 TOP 圖驗證：選取 Color RGBA 從左側分組、新增另一個 Function、搜尋兩個 Function、切換中英文。TD 套用到 r3，3 個節點、2 個本地 Function、1 條對外連線；輸出色彩維持原值。

使用者後續已撤回「兩種建立」這項待確認問題，不再把它當成新增建立模式的需求。現有分組與新增行為保留，已確認方向仍是 Function 相關操作集中左側，搭配分類與搜尋。後續可在左側把 Shader 本地定義、Sgrape 來源庫、個人來源庫分得更清楚，避免增加全局上方操作區。

## TOP 預設輸入已實作

原型的 16 項隔離測試已推進為正式 Texture Expose。外部 Input 1 優先，沒有接線才使用 Parameter／Select TOP 預設；右側可切換成獨立貼圖來源。共享槽、錯誤來源狀態、Expose 保存、候選、舊 Shader 更新、尺寸和效能界線見 SAMPLER_EXPOSE.md，最終保存驗證見 VERIFICATION.md。
