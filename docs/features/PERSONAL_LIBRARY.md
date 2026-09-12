# 個人 Function 調色盤 — 0.5.0

「個人」分類在 TD-Sgrape 編輯器內，也能在 Tab／雙擊／拉線開啟的建立視窗篩選。資料讀取主元件 Personal Folder 指定的同一個資料夾，不另做雙向同步。

## 保存與取用

選取 Function，在右側按「存入個人調色盤」，或將一個 Function 的標題拖到左側「個人」區塊。保存帶上全部巢狀依賴，原節點位置和圖保持不變。相同內容再次保存會重用快照；內容或名稱改變則建立另一份，保留原檔。同名快照顯示短版本標記。可先進入 Function，在 Function Input 的參數中修改名稱，方便辨認。

個人項目可點擊或拖入畫布；拉線到空白處後也可選「個人」，按相容的 Input／Output 建立並自動接線。重複取用同一快照，會共用 Shader 內既有的來源定義。

第一次內容編修建立 Shader 本地 Function，需要修改的唯讀巢狀呼叫者一起本地化。同一 Shader 的相關調用一起更新，其他 Shader 和磁碟來源保持不變。純位置編修不本地化。已保存的 Shader 內含完整快照，來源資料夾暫時不在時仍可渲染與重載；重新讀取清單不替換現有 Shader 的快照。

## 資料位置

預設為 TD 的 app.userPaletteFolder 下 TD-Sgrape/Functions，也能用主元件的資料夾選擇器指定位置。只有保存或 Open Personal Folder 才建立資料夾，單純讀取不建立。TD Palette 和 Sgrape 個人分類是不同 UI，共用的是儲存位置。

副檔名為 .sgrape-function.json。可將交付包 examples 中的個人 Function 範例複製進資料夾，再按「重新讀取個人調色盤」。可用檔案管理器搬移、備份或整理；編輯器目前不提供刪除或覆寫來源按鈕。

每份上限 256 KB，最多讀取 64 檔、總共 4 MB，不遞迴掃描。載入檢查格式、校驗碼、節點／型別、階段和循環。壞檔顯示於「來源資料夾與讀取狀態」，不擋住其他項目或 Shader 編輯。清單在開啟頁面、按重新讀取或保存後更新，沒有持續背景掃描。

保存以同資料夾暫存檔原子發布，避免半份檔案和覆蓋。需要支援 hard link 的檔案系統，已測本機 NTFS／Dropbox 工作資料夾；其他檔案系統或網路磁碟未測。不支援時會回報錯誤並保留原檔。

## 可攜性界線

Function 若直接含 Uniform 或 Texture 2D，會提示把它們放在 Function 外，經 Function Input 傳入數值或取樣後顏色；巢狀依賴也檢查。不把原 Shader 的 declaration ID 或本機貼圖路徑帶到其他 Shader。UV／TD Built-ins 仍按 Vertex／Pixel 階段驗證。

Sampler 型別 Function 介面、連同 declarations 的資產封裝、來源版本升級、雲端同步衝突處理仍後續設計。

## 已驗證

31 個核心測試（新增 8 個個人庫）、舊／新 JavaScript Function 模型、13 項原生個人庫、26 項 TOP、18 項更新回歸通過。瀏覽器完成按鈕與拖放保存、位置保留、拖回畫布、Tab 個人分類、拉線篩選與自動接線、中英文及同名版本標記。巢狀編修後實際像素符合預期，同 Shader 兩個調用一起更新，另一 Shader 和磁碟來源不變。缺少來源檔時 TOX 重載像素相同。測試資料夾隔離於開發區，預設使用者調色盤未放入測試檔。
