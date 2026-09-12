# Texture Expose — 0.6.2

Sgrape TOP 可作為原生濾鏡接進 TD 線路。選取 Texture 2D，在右側 Parameter 設定來源、預設貼圖與 Expose；Sgrape MAT 也支援把獨立貼圖來源暴露成 TD 的 TOP Parameter。

## 使用方式

1. 在 Texture 2D 的 **Source mode／來源方式** 選 **COMP Input 1 + default**。外部接線優先；沒接線才使用預設來源。
2. **Default source／預設來源** 可選 TD 隨附 Banana、Jellybeans、白／黑貼圖或指定外部 TOP。這是儲存在 Graph 的預設設定。
3. 勾選 **Expose as TD parameter**，在 Shader 的 TD **Textures** 頁建立 TOP Parameter；公開顯示名稱也在右側設定。
4. **Current TOP parameter／目前 TOP 參數** 是實際 TD 參數值，可在網頁或 TD 編修。空白表示使用 Graph 預設。接線存在時，編修的是拔線後生效的備援；右側會顯示實際使用來源。
5. 若這個 sampler 應固定取用另一張貼圖，改選 **Texture source／貼圖來源**；這個 sampler 就不使用 COMP 接線。Sgrape MAT 使用這種方式。

未 Expose 時直接使用 Graph 預設。取消 Expose 保留原 TD 參數在停用的 **Inactive Textures** 頁；再啟用會恢复目前值與 Expression／Bind。修改 Graph 預設或公開顯示名稱，保留目前參數值和原參數身分。TD Reset 回到最新預設；內建預設以空白 TOP 參數表示。

Expression／Bind 由 TD 管理，網頁顯示其求值及來源狀態，避免覆蓋控制關係。網頁目前值寫入有 revision、舊值和參數模式檢查，避免另一個編輯器或 TD 已改值時被舊畫面覆寫。相對 TOP 參數路徑從 Shader 所在的外層網路解析，與 TD 一致；Graph 指定的外部 TOP 預設使用絕對路徑。

## 共用 Input 1 與尺寸

目前仍是一個原生 COMP 輸入槽。多個 Texture 2D 宣告若都使用 Input 1，就共用該槽的預設、Expose、公開名稱和同一個 TD Parameter；在任一張卡修改會同步至其他引用。匯入互相矛盾的同槽設定會被拒絕，不依宣告順序暗中覆寫。

**Match Input** 跟隨外部 Input 1；未接線但有明確設定 Input 1 預設，或有目前 TOP 參數值／控制時，跟隨有效備援尺寸。保留舊圖的相容性：原本只有隱含 Banana、沒有明確預設或目前值的圖仍使用 Width／Height，單純勾選 Expose 不會改變輸出尺寸。**Custom** 永遠使用 Width／Height。

獨立的 Texture source 不會自動成為輸出尺寸基準。即使某 sampler 不讀外部接線，Output 的 Match Input 仍按 Input 1 決定尺寸。增加更多原生輸入槽是後續功能。

## 原生路徑與效能

`TOP Parameter → Select TOP → In TOP 內部預設輸入 → 固定輸出節點 → GLSL TOP`

In TOP 原生處理外部接線優先。新 Shader 使用 Null TOP 作固定引用；更新旧 Shader 時保留原有 input_router 的 OP 身分，改為單一路徑，避免破壞已有引用。來源參數變化不改寫 GLSL DAT，不增加逐幀 Python 輪詢。網頁沿用既有可見頁面的參數同步與預覽機制，關閉編輯器仍可在 TD 運作。這是功能驗證，沒有宣稱零求值成本或 GPU 效能基準。

編圖時仍以短期候選 Shader 在 TD 實際編譯，候選會讀到當下接線／參數來源；通過才套用。正在使用的 Graph 來源失效，或網頁目前 TOP 輸入無效時，會在套用前被拒絕。有效外部接線可暫時覆蓋失效的備援，但右側仍提示備援錯誤。已部署後由 TD Expression、刪除外部 OP 等造成來源失效，會標示錯誤並使用內建備援，**不等於凍結上次畫面**。存在有效外部接線時，它仍優先生效。禁止指向自身內部或編輯器內部 TOP；任意外部循環依賴、所有重新命名情境不在本輪保證範圍內。

兩個 Sgrape TOP 直接串接已驗證。以路徑選來源時，本版接受 TOP OP；若要引用另一個生成元件，可用其 Generated TOP 指向的 out1，或直接原生接線。

## 驗證與版本

TD 2025.32820：42 項 sampler 原生檢查、18 項舊版更新／共享槽／Bind／錯誤保護、26 項 TOP 回歸、6 項數值 Uniform 回歸及 4 項濾鏡串接，共 96 項通過。47 個本地核心／文件／型別測試包含 138 張圖的既有產碼及 496 組跨語言 port 規則；205 個雙語鍵通過。

實際瀏覽器操作 Expose、目前 TOP、預設、來源模式與中文／英文。五個來源切換由 TD 像素讀回核對，最大誤差 0.00224609375，來自測試源的 8-bit 量化。Formal MAT／TOP Graph 與 Shader ID 保留，測試元件已清理。封裝、TOX 重載及工程保存的最終結果見 VERIFICATION.md。

本版沿用 Graph schema 1，sampler 新增可選 defaultSource／expose／exposeName；既有 Shader 更新需使用 0.6.2 主元件的 Update Shaders。未新增 WebSocket 或更動私人遠端入口。
