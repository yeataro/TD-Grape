# Shader 升級確認（0.8.2）

新版運算先呈現差異，接受後才由 TouchDesigner 驗證並更新。取消、稍後處理、確認過期或編譯失敗都保留目前 Shader；這是繼續執行原 GLSL，並非凍結預覽圖。

## 行為與版本資料

- Graph 和 manifest 保存 catalogSnapshot：節點介面、預設值、revision、emitter、共用產碼與輸出框架版本。這是版本證據，不含可執行 archive；hash 僅檢查內容完整性，不宣稱來源身分認證。
- 對已保存的圖與欲套用的圖都檢查，包含未被呼叫的圖函式。只比較用到的定義；未使用節點的改動不觸發升級。相容歷史及可證明目前 catalog hash 的舊 manifest 可沿用；缺資料、未知 revision 或不同運算需要確認。
- 移除的定義、無法對應的舊 port 或其他無法安全遷移的結構會阻擋候選，不自動刪線。現有一般匯入修復與版本確認分開；舊 port 不被當成可任意清除的無效線。
- 唯讀 Function 及需要更動的唯讀呼叫者，在目前 Shader 建立本地定義並重接本地引用；不寫共用或個人函式庫。舊內容保存在成功升級後的 upgrade_backup DAT，不留在仍須編譯的 active Function 列表。

## 接受與回復

既有 inspect／apply 入口提供確認流程，沒有新增遠端路由。確認憑證限制為最多八筆、十分鐘、單次使用；綁定精確候選、TD 數字 OP ID、Shader ID、已保存 state／graph／manifest／GLSL 及目前 catalog。重新啟動服務後必須重新檢查。

開啟／註冊保留既有 GLSL；Version 參數顯示實際已編譯版本。Update Shaders 回報需要 review 的數量。一般套用也有同樣保護，不能用替換整張圖繞過目前已保存圖的版本檢查。TDFam 的整個 COMP Update／Stub 仍由既有 callback 停用。

候選必須通過 TD 編譯，才配置正式 Shader；提交失敗恢復原 Graph、GLSL、manifest 和 state 原文。成功後保留前一份版本的 upgrade_backup DAT；該 DAT 是復原參考，尚無一鍵重播任意舊 emitter。備份名已被其他 OP 使用時拒絕覆寫。這不是原始 archive 執行或全歷史版本播放器。

Graph 的 catalogSnapshot 不計入運算 hash；普通參數與版面編輯可繼續使用原流程。PNG／JSON 原有完整 Graph 交換會攜帶版本資料。圖函式庫檔只含子图的既有來源格式不因此升級為可執行封存。

## 驗證

15 項新增 Python 測試，連同既有共 79 項通過；四個獨立 JS 模型套件與由 Python 執行的型別對照通過，258 個雙語引用完整。

18 項原生 TD 測試：MAT／TOP 未確認與取消保留、候選／state／GLSL 變更拒絕舊確認、真實編譯拒絕、提交失敗原文回復、成功備份、跨 Shader 隔離、唯讀來源本地化、動態 Uniform 與 Expression 保留；正式工程資料不變。這批 MAT／TOP 測試像素最大差皆為 0。

8 項真實 TD＋瀏覽器檢查：取消、本機草稿變更、跨編輯器過期確認、重新載入、TOP 接受與後續普通編輯／Undo；360 px 英文視窗無橫向溢出，寬版與窄版影像已人工檢視。詳見 research/upgrade082-native-results.json 與 research/upgrade082-native-browser-results.json。

測試環境 Windows／TouchDesigner 2025.32820／Chromium。三個產品 TOX 已在獨立程序 43512 重載，19 來源一致，並在重載後的 MAT／TOP 重新驗證升級接受與備份。乾淨 .69.toe 並未以逐位元相同的檔案冷開；驗證使用另存 driver 重新載入實際匯出 TOX。重載像素最大差：{"Sgrape_MAT1": 0.003921598196029663, "Sgrape_TOP1": 0.0}。詳見 VERIFICATION.md。
