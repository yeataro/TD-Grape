## 更新到 0.6.2

Update Shaders 保留舊 Shader、input_router OP、Graph、ID、公開數值與 TOP 參數的身分和控制模式。Shader 內嵌 texture_sources 讓預設輸入與 Expose 在沒有主元件時也能運作；相同 Graph 的 helper 版本改變亦會觸發更新。從已封存 0.6.1 MAT／TOP TOX 更新的像素差為 0，正式圖保持不變。TDFam Update／Stub 仍未開放。

# 0.5 啟動補充

新 TD 程序驗證發現 TDFam extension 為延後初始化，主元件現在會在啟動時觸發並等待註冊。每秒檢查，最多 10 次；必要時重建 extension 的機會有限，成功後停止檢查。TDFam Status 顯示 Ready 或可處理的錯誤，Register TDFam 可再試。未修改 TDFam 內部來源，也不啟用全元件 Update／Stub。

第一次獨立程序測試失敗的證據保留在開發 research；修正後的新程序驗證通過，並檢查了認證 API、預覽、圖與參數。詳見 VERIFICATION.md。

# Shader 更新與啟動恢復 — 0.4.1

主元件的 **Update Shaders** 會使用目前 TD-Sgrape 編譯器，重新檢查並更新它所管理的 Shader 已保存圖。**Last Update** 顯示更新、已是目前版本與失敗數量；某一個 Shader 失敗，不阻止其他 Shader 完成。

先讓網頁草稿成功套用，或先匯出需要保留的草稿，再在 TD 主元件按 Update Shaders。它只處理 TD 目前保存的圖，不讀取瀏覽器尚未套用的草稿。更新會增加該 Shader 的 revision，已開啟的編輯器請按「重新載入已套用圖」；舊 revision 的提交會被拒絕，避免覆蓋較新的狀態。

## 保留什麼

更新在現有元件內重新配置生成的 Shader，不替換 Shader COMP、GLSL MAT／TOP、TOP 輸出口或公開 Uniform Par 物件。已有 Expression、Bind、外部參數引用與原生 TOP 接線得以保留。舊 0.3 MAT 與 0.4 TOP 已實際測試；本版不是任意舊版內部結構的通用遷移器。

編譯指紋同時記錄 Vertex／Pixel 程式及綁定，另外記錄編譯版本。因此，即使圖本身沒有變，更新編譯器或生成結果仍能觸發重新檢查。相同版本、圖和生成程式不會重編，也不增加 revision。

候選驗證先於正式更新；提交失敗時，恢復之前實際使用的 GLSL 與 manifest，不用新編譯器重算所謂的「舊結果」。高於目前支援版本的 Shader 會保留原控制項與資料，編輯器在可理解的圖格式下以唯讀顯示，仍能查看預覽。

## 主元件與 TDFam

同一工程維持一個 TD-Sgrape 主元件。移除主元件不影響已生成 MAT／TOP 的渲染；重新載入該主元件後，Shader ID、圖和參數仍能重新接上服務。已測試的主元件替換使用相同管理身分。

**Update Shaders 不是 TDFam 的整個 COMP 替換功能。** TDFam Update／Stub 仍拒絕操作，避免未經驗證的元件替換破壞關聯。跨管理身分的主元件採用、自動選擇新安裝元件及任意版本內部結構遷移仍待後續處理；不應同時載入兩個主元件試圖自動合併。

## 已驗證

- 18 項隔離更新檢查：0.3 MAT、0.4 TOP、保留 OP／Par、Expression／Bind、外部引用、原生線路、無變化時不更新、同圖不同編譯結果、更新失敗精確恢復、新版本保護、批次隔離。
- 正式主元件 Update Shaders Pulse：MAT revision 20→21、TOP 2→3，圖、身分和 Uniform 相同，兩者像素差為 0。
- 26 項 TOP 工作流回歸、23 個核心測試通過；57 組 MAT 像素的上一版基線保留在 reports。純核心產碼本次未改。
- 0.4.1 完整開發 TOE 在同一 TD 行程內重開，服務與 TDFam 自動恢復，私人遠端書籤不變。TOP 像素相同；使用 TDDither 的 8-bit MAT 差異最多一個色階。不是重新啟動 TD 可執行檔的冷啟動測試。
- 瀏覽器確認较新版本的 Apply 與四個 Uniform 欄位停用，嘗試 Add 不改變圖，預覽仍可見。

交付包排除私人遠端 helper，開發 bridge 在交付 TOE 中停用；開發 TOE 的完整重開證據與交付 TOE 保存證據分開記錄。每次發版保留前一個 ZIP 與 Git tag，不覆蓋它們。
