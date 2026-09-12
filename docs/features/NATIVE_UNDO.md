# 原生參數 Undo／Redo

網頁修改 Exposed Uniform 的「目前值」或 Exposed Texture 的目前 TOP 來源，現在會記錄在 TouchDesigner 原生 Undo 歷史。TD 的 Edit → Undo／Redo 可撤銷或重做這些值，保持 Graph 預設、revision、GLSL 與公開參數不變，不重新編譯 Graph。

## 使用界線

- 網頁畫布的 Undo／Redo 仍管理 Graph；不轉送到 TD 的全域 Undo，也不跳過別的 TD 操作。
- 數字輸入及 Value Ladder 完成一次提交後才記錄。TD 會把同一 callback 中的多次寫入合為一組，按正確先後次序撤銷。
- 被既有併發檢查拒絕的值、未改變的值不新增這項記錄。使用者關閉全域 Undo 時仍可正常調參，不變更該設定。
- 網頁開啟時沿用已有參數同步，讀回撤銷後的實際值；不新增每幀 Graph 檢查、材質編譯或預覽編碼。

## 避免撤銷覆蓋後來的工作

撤銷前核對原 OP、Shader ID、參數名稱與 index、控制模式、目前值、啟用狀態及數值限制。刪除後同名重建的 OP／參數、已改成 Expression／Export／Bind、值已被改動或已關閉 Expose 等情況會跳過該記錄。TD 狀態列會說明跳過原因；該記錄的後續 Redo 也不會突然回寫。

貼圖還會核對當時參照的 TOP 身分與允許位置，避免把已刪除或同名重建的 TOP 當成原來源。空白值仍表示使用 Shader 目前的預設來源。

這是對當前狀態的保護，不是所有外部 Script 操作的完整事件追蹤。自訂參數 index 若因結構編修改變，會保守跳過；不清除使用者其他 Undo。原生 Graph 歷史的歸屬與跨編輯器同步仍未實作。

## 真實 TD 驗證

Windows／TouchDesigner 2025.32820；獨立程序，不操作原工作程序的 Undo。一般數值與貼圖的 Undo／Redo、控制模式、外部改值、OP／參數重建、改名、停用、數值限制、貼圖來源重建／刪除、混合原生歷史、同 callback 多次寫入及主元件移除均納入驗證。正式 Graph／GLSL 保留；數值與貼圖 Undo 的 GPU 最大像素差均為 0。

原型測試曾發現：普通原生 parameter block 會覆蓋外部 Expression 或同路徑的新 OP；僅用 Par.valid／isSamePar 也不能區分同名重建參數，必須另比對 index。測試全域 Undo 開關會影響研究程序後續的自動記錄狀態，因此該測項放到程序最後，不改正式程序的開關。

測試來源保留於 tests/integration/test_native_undo_probe.py。它只應放在指定 originalPid／reportFolder 的獨立研究程序執行，會清理该程序的 Undo 並在結束時退出，不可直接在工作工程啟動。

## 參考

[Derivative Undo Class](https://derivative.ca/UserGuide/Undo_Class) 說明 block、callback 與巢狀停用記錄；[Par Class](https://derivative.ca/UserGuide/Par_Class) 說明 valid、index 與 isSamePar。實際行為以上述指定 build 的測試為準。
