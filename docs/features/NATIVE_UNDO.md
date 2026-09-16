# 原生參數 Undo／Redo

## 網頁的共同操作歷史

畫布與 Inputs 共用一條依操作時間排序的 Undo／Redo。每次節點拖曳、接線、來源宣告編輯，以及原生來源的值、改名、驅動、刪除或恢復，都各自成為一步；Shader 自動套用與來源輪詢不是使用者操作，不新增步驟。自動套用合併的新增來源仍可逐個撤回。

來源 ID 是 Inputs 清單、圖內引用與原生來源記錄的共同身分。歷史保存先前的宣告／原生設定，撤回時依 ID 修改同一份來源，再回傳清單供 UI 同步。普通數值回寫同一個 Par；已刪除來源需要重建原生列並接回原 ID。屬於 Grape 的 Bind 會改回既有主控參數，不能為了 Undo 把綁定拆成 Constant。

恢復以單一步驟涉及的來源與欄位為範圍，先核對目前配置再修改。時間 Expression 的逐幀結果不算外部編輯；無關來源的新值不能被舊快照覆蓋。若涉及的值、驅動、主控身分或圖已被其他操作改變，拒絕恢復並保持歷史游標。失敗、取消與未改變的值不占一步，也不清除 Redo。

刪除／插回原生 sequence 列可能影響後面的列，所以結構恢復會保存及校正目前鄰列，並預先檢查 Export／外部 Bind。無法保證原連結的結構操作會停止，不能只還原畫面或將驅動變成數值。尚不能編譯的圖仍可作為網頁草稿恢復，不寫成損壞的權威 state，也不強制替換最後成功 Shader。

前端保留有限步驟，後端復原 token 也有數量／容量限制。這些資料只存在目前工作階段的記憶體，不保存到 TOE；重新載入 Editor 或切換 Shader 開始新歷史。過期 token 會明確拒絕，不猜測來源配置。請求帶有重播識別碼，同一次已完成的還原不因回應遺失而執行兩次。

## TD 全域 Undo 的既有能力

網頁修改 Exposed Uniform 的「目前值」或 Exposed Texture 的目前 TOP 來源，現在會記錄在 TouchDesigner 原生 Undo 歷史。TD 的 Edit → Undo／Redo 可撤銷或重做這些值，保持 Graph 預設、revision、GLSL 與公開參數不變，不重新編譯 Graph。

## 使用界線

- 網頁的共同 Undo／Redo 不轉送到 TD 的全域 Undo，也不跳過別的 TD 操作；兩者不是同一個歷史游標。
- 數字輸入及 Value Ladder 完成一次提交後才記錄。TD 會把同一 callback 中的多次寫入合為一組，按正確先後次序撤銷。
- 被既有併發檢查拒絕的值、未改變的值不新增這項記錄。使用者關閉全域 Undo 時仍可正常調參，不變更該設定。
- 網頁開啟時沿用已有參數同步，讀回撤銷後的實際值；不新增每幀 Graph 檢查、材質編譯或預覽編碼。

## 避免撤銷覆蓋後來的工作

撤銷前核對原 OP、Shader ID、參數名稱與 index、控制模式、目前值、啟用狀態及數值限制。刪除後同名重建的 OP／參數、已改成 Expression／Export／Bind、值已被改動或已關閉 Expose 等情況會跳過該記錄。TD 狀態列會說明跳過原因；該記錄的後續 Redo 也不會突然回寫。

貼圖還會核對當時參照的 TOP 身分與允許位置，避免把已刪除或同名重建的 TOP 當成原來源。空白值仍表示使用 Shader 目前的預設來源。

這是對當前狀態的保護，不是所有外部 Script 操作的完整事件追蹤。自訂參數 index 若因結構編修改變，會保守跳過；不清除使用者其他 Undo。把整份 Graph 納入 TD 全域 Undo，以及跨 Editor 共用歷史，仍未實作。

## 真實 TD 驗證

Windows／TouchDesigner 2025.32820；獨立程序，不操作原工作程序的 Undo。一般數值與貼圖的 Undo／Redo、控制模式、外部改值、OP／參數重建、改名、停用、數值限制、貼圖來源重建／刪除、混合原生歷史、同 callback 多次寫入及主元件移除均納入驗證。正式 Graph／GLSL 保留；數值與貼圖 Undo 的 GPU 最大像素差均為 0。

原型測試曾發現：普通原生 parameter block 會覆蓋外部 Expression 或同路徑的新 OP；僅用 Par.valid／isSamePar 也不能區分同名重建參數，必須另比對 index。測試全域 Undo 開關會影響研究程序後續的自動記錄狀態，因此該測項放到程序最後，不改正式程序的開關。

測試來源保留於 tests/integration/test_native_undo_probe.py。它只應放在指定 originalPid／reportFolder 的獨立研究程序執行，會清理该程序的 Undo 並在結束時退出，不可直接在工作工程啟動。

## 參考

[Derivative Undo Class](https://derivative.ca/UserGuide/Undo_Class) 說明 block、callback 與巢狀停用記錄；[Par Class](https://derivative.ca/UserGuide/Par_Class) 說明 valid、index 與 isSamePar。實際行為以上述指定 build 的測試為準。
