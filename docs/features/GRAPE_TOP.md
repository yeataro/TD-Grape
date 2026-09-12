# Grape TOP

現行產品名稱為 Grape TOP。下方保留 0.6.2 的功能紀錄；歷史版本的操作名稱與路徑不能視為最新版 UI。

---

# Sgrape TOP — 0.6.2

Sgrape TOP 是帶有原生 TOP 輸入口／輸出口的 Shader 元件。它使用 TD 的 GLSL TOP 和預設 Vertex Shader，網頁只編輯 Pixel 圖。MAT 與 TOP 各有獨立 Shader ID、Graph 和 Open Editor；TOP 圖不能套到 MAT，反之亦然。舊版 MAT Graph 缺少 target 欄位時仍按 MAT 解讀。

## 使用

1. 在 TD_Sgrape 主元件按 Create Sgrape TOP，或在 TD 原生 Tab 的 Sgrape 分類選 Sgrape TOP。
2. 將 Movie File In、Noise 等 TOP 接到 Sgrape TOP 左側，右側直接連接下一個 TOP。
3. 在 Sgrape TOP 自己的參數頁按 Open Editor。Texture 2D 預設讀取「TD 輸入 1」；未接線時使用 Parameter 的預設來源，初始為 TD 隨附 Banana。可 Expose 為原生 TOP 參數；完整說明見 SAMPLER_EXPOSE.md。
4. 像 MAT 一樣加入 Invert／Contrast／Tint／Color Clamp Function，或用基本節點建立效果。Uniform Expose 在右側 Parameter 設定，TD 元件出現 Uniforms 頁；網頁與 TD 目前值雙向編修，受控 Expression／Bind 不被覆寫。

Generated TOP 指向內部 out1。沒有主元件也能維持渲染、原生參數及輸入變化；繼續編圖時才需要主元件。

## Output 參數

| 項目 | 行為 |
| --- | --- |
| Resolution | 預設 Match Input；跟隨 Input 1 接線，或明確設定的 Input 1 備援。舊圖隱含 Banana 且無目前值時保留 Width／Height；Custom 固定手動尺寸，詳見 SAMPLER_EXPOSE.md |
| Width／Height | 預設 512×512，TD 版本、授權及 GPU 仍限制可用尺寸 |
| Pixel Format | 預設 RGBA 16-bit float；可選 8-bit 或 32-bit float |
| Input Extend UV | 預設 Hold；可選 Zero、Repeat、Mirror，適用此 Shader 的貼圖取樣 |

預覽在可見時約每秒更新，最長邊不超過 512；收合或不在顯示頁時停止輪詢。預覽顯示自己的尺寸，TD 原生輸出不受此預覽尺寸限制。PNG 預覽限制到 0–1，不能用它判斷 HDR 值；已使用 TD 浮點讀回驗證超過 1 的數值。

貼圖取樣保留來源通道值，不自動預乘／反預乘 alpha 或轉換色彩空間。Function 的數學運算沿用原本定義；Invert、Contrast、Color Clamp 保留 alpha，Tint 乘上全部 RGBA。處理透明影像時，圖的作者需留意來源的 alpha 表示法。

## 編譯保護與範圍

改圖先建立短期候選 GLSL TOP，利用 Select TOP 讀取當前原生输入或外部來源，通過實際編譯後才更新正式節點。候選只存在於一次部署中；不保留兩套持續運算的輸出。檢查 Info DAT 的成功標記及 ERROR，因為 TOP 的一般 errors() 在編譯失敗時可能仍為空。提交中途失敗會恢復之前的圖、綁定及目前值。

本版支持一個原生 TOP 輸入口，圖內最多 16 個使用中的 sampler2D 來源，按 Shader 的 binding 順序接入。可用外部 TOP 路徑增加來源；不支持自身內部 TOP／自身輸出的回饋、3D／array sampler、Compute、多重 render buffer 或迴圈。TDFam 註冊及新增已驗證，Update／Stub 仍關閉等待遷移工作。

## 0.6.2 驗證

新增 sampler、共享槽、舊版更新、Expression／Bind、來源失效、濾鏡串接及瀏覽器設定，共同通過 96 項 TD 檢查與 47 個本地測試；明細見 SAMPLER_EXPOSE.md。

## 0.4 初始驗證

23 個本地測試包含舊 MAT 三個示例完整產碼相容、TOP Stage、Function 及 sampler 排序。26 項 TD 原生檢查涵蓋無輸入 fallback、原生接線、解析度、32-bit、Uniform 雙向值／Expression、候選使用當前輸入、錯誤保護、HDR、多來源、四個 Function 及 TOX 搬移重載。另有 57 組 MAT 像素回歸全部通過。

實際瀏覽器完成貼圖來源切換、新增並接線 Invert、英文／中文 Help、Pixel-only GLSL 檢視、動態來源變更及預覽上限。原生 Open Editor Pulse 已核對其取得的是自己的 Shader URL。TDFam 公開 PlaceOp 建立兩個不同 ID 的 TOP，主元件 Pulse 也建立正式示範。這輪未宣稱用滑鼠重新驗證原生 Tab 選單；註冊資料與公開建立 API 已核對。

封裝及完整工程重開的驗證狀態見 VERIFICATION.md；這些是功能數值檢查，不是 GPU 效能基準。

## 官方參考

- [GLSL TOP](https://derivative.ca/UserGuide/GLSL_TOP)
- [Write a GLSL TOP](https://derivative.ca/UserGuide/Write_a_GLSL_TOP)
- [Out TOP](https://derivative.ca/UserGuide/Out_TOP)
- [TDFam manifest reference](https://github.com/dotsimulate/TDFam/blob/main/docs/manifest-reference.md)
