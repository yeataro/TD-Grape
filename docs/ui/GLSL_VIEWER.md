# Generated GLSL 顯示

GLSL 按鈕沿用原本唯讀彈窗，開啟時向既有 /validate 取得目前圖生成的程式碼。新增本機語法高亮，識別註解、預處理指令、型別、關鍵字、數值、字串、函式呼叫與 gl_ 內置名稱。TD 函式呼叫沿用函式色，不維護容易過時的完整函式名稱清單。

配色集中於 style.css 的 --glsl-* 變數，沿用紫色 UI；無新套件、資源路由、字型或網路依賴。GLSL 原文與空白逐段以 Text node／span.textContent 建立，不作 HTML 解析。這是顯示分色，不取代核心或 TD 的合法性與編譯檢查。

9 項瀏覽器檢查通過，涵蓋真實生成碼相等、可見色彩、彈窗關閉後 Graph／revision／Undo 及 TD state 保留、CRLF／Unicode／HTML 類文字、數值與多行註解、選取複製、窄畫面及無外部依賴。測試只允許 GET 和既有唯讀 POST /validate 到 TD，其他寫入一律阻擋。

## 後續討論

使用者暫時保留彈窗位置，沒有要求以程式碼替換 Network 畫布。未來若可從選取節點定位程式碼，或反向跳回節點，再評估與画布並排的閱讀區；目前不加入可編輯程式碼面板。

此批載入現用 TD 僅更新 HTML／CSS／app.js 與靜態資源，核對即時 Shader state／graph／manifest／GLSL 和 port 保留；未另存 TOE、未封新版本，正式封版時收錄。
