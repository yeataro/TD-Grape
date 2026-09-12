# TD-Sgrape：TD Pane 內嵌編輯器

更新：2026-09-10。這是已確認的後續實作里程碑；本次整理需求與查核官方接口，尚未建立 Panel 範本、Web Render 或修改 TD 選單。既有核心相容性工作順序維持不變。

## 用語對齊

| 用語 | 本項目的意思 |
| --- | --- |
| Pane／窗格 | TD 工作區的一塊可分割、可調整大小的區域。 |
| Panel 類型的 Pane | 把窗格切到 Panel，用它顯示某個 Panel COMP。 |
| Editor Panel COMP 範本 | 共用的內嵌編輯器介面與邏輯；不是 Shader 圖本身。 |
| Editor Panel COMP 實例／Clone | 各窗格使用的編輯器視圖元件，跟隨範本更新。 |
| Shader | Sgrape MAT／Sgrape TOP 等使用者工作元件，持有自己的 Graph 與本地 Function。 |
| Pane 類型選單 | 切換 Network Editor、Panel 等內容類型的選單。 |
| Panel COMP 選擇入口 | 已是 Panel 窗格時，指定它顯示哪個 Panel COMP 的入口；不等於 Pane 類型。 |
| Pane Layout 選單 | 選擇整組窗格版面配置；不等於某個窗格的內容類型。 |

TD 的原生 Browser Pane 是網路樹狀瀏覽器；此處的內部網頁瀏覽器是用來承載 TD-Sgrape Web UI，兩者不混稱。

## 使用者已確認的方向

- 可選擇外部瀏覽器，或在 TD Pane 裡編輯。兩種入口使用同一套編輯器與 Shader 資料。
- 準備一個 Editor Panel COMP 範本，多個窗格可使用其 Clone。
- 窗格可選擇要顯示的 Panel COMP，編輯器隨窗格大小自適應。
- 與原生 Network、Parameters、Viewer 並排，由使用者安排，提供類似 Blender 的同一工作版面體驗。
- 後續每次載入 TOE 工程時，在 Pane 類型選單（目前切換 Network Editor、Panel 等類型的位置）加入 Sgrape Editor 入口，讓它更接近內建操作。使用者已回答並確認這個位置；尚未驗證選單擴充機制。
- 解析度是主要問題，尤其 4K／高 DPI 螢幕，必須列為核心驗收條件。

## 提議的實例與資料關係

每個獨立窗格使用一個 Editor Panel COMP 實例。Clone 共用的是介面結構與程式；不因新增編輯器窗格而複製 Shader 或 Function。

建議每個實例各自保存目標 Shader、圖內路徑、平移／缩放、選取與視窗大小；這是實作提案，尚未宣稱完成。多個視圖開啟同一 Shader 時，Graph 變更仍屬同一份資料，沿用版本衝突保護與編譯失敗保留上次成功結果。實例內手動切換不直接改寫其他實例的目標；後續若採用跟隨選取模式，是否一起回應 TD 選取由各實例的模式決定，見下方保留提案。

TD Clone 的根元件 custom parameter 定義可以跟隨範本，而參數值可各自保存；可作為每個實例目標與設定的承載方向。子節點狀態與 Clone Immune 的實際安排需驗證，避免更新範本時覆寫視圖狀態。不能僅把同一 Panel COMP 指向不同大小的 Pane，就假設已有互相獨立的網頁 viewport。

Clone 減少維護重複程式的負擔，不代表瀏覽器或 GPU 畫面只運行一份。若每個實例含 Web Render，必須測試多個 CEF／Web Render 的累積成本；若設定 User Cache Directory，各個 Web Render 必須使用不同目錄。隱藏或關閉實例時的更新與資源釋放策略留待實作驗證。

## Pane 目標定位：跟隨與固定（2026-09-10，保留提案）

使用者提出 Pane 可定位到「最後一個選取的 Sgrape」，並明確保留這個想法、先參考 Blender。此處暫理解為選擇 Pane 要編輯哪個 Sgrape MAT／TOP，不先擴成移動 TD Network 視角、圖內 Frame Selected 或回選 TD 節點的功能。這是未定案的互動提案；內嵌編輯器本身仍是已確認的後續功能。

Blender Shader Editor 的 Object 模式編輯目前 active object 的材質；Pin 可讓編輯器維持顯示目前材質，即使其他位置選了別的物件或材質。這提供「跟隨目前選取」與「固定目標」兩種狀態的參考，不把 Blender 的 active material 說成任意最後選取節點。[官方 Shader Editor 說明](https://docs.blender.org/manual/en/5.2/editors/shader_editor.html)

TD-Sgrape 可考慮的對應方式，尚未採為預設或實作：

- Follow Selection：跟隨 TD Network 最近成為作用中目標的有效 Sgrape Shader；不是編輯器圖內最後選到的 Constant／Function。
- Pin：每個 Editor Panel 實例各自固定目前 Shader，因此可一個 Pane 跟隨、另一個固定做比較。Clone 範本不強制共享 Pin 或目標狀態。
- 選取非 Sgrape 節點時，可考慮保留最後一個有效 Shader，避免編輯器突然變空；這是針對使用者「最後一個選取」想法的提案，不是已核對的 Blender 同等行為。

到此里程碑再決定預設模式、開啟時一次定位或持續跟隨、多個 TD Network Pane／多選時的作用中目標規則，以及直接 Open Editor 與 Pin 的關係。切換前須保留尚未提交的編輯／草稿，處理目標刪除、改名與保存重開，避免過期回應寫到另一個 Shader；先用具體流程驗證，不在此時增加輪詢或選取監聽。

## 自適應、解析度與 4K

分別處理 Pane／Panel 的可用尺寸、網頁的 CSS viewport 與 DPI、Web Render TOP 的實際像素尺寸。隨窗格調整網頁布局與輸出尺寸，不能只放大一張固定大小的網頁影像。

如果以 Web Render TOP 承載整個網頁畫面，Non-Commercial 的一般 TOP 影像上限 1280×1280 仍需遵守。版面自適應或 DPI 縮放不會產生超過此上限的真實細節；把較低解析度影像放大至大窗格可能使文字、節點與線條模糊。4K 螢幕上的較小窗格未必超限，需依窗格的實際像素需求判断，不能只按螢幕標籤判定。

保留外部瀏覽器作為高解析度編輯入口：瀏覽器自己的 DOM 介面不受 TOP 影像上限限制，來自 TD 的預覽影像仍受自身解析度限制。內嵌模式的縮放／尺寸折衷需以實測決定，不承諾僅靠 Clone 或自適應即可解決 Non-Commercial 的 4K 清晰度。

## 工程載入時的選單入口：位置已確認，機制待驗證

使用者已明確選擇 Pane 類型選單，也就是目前切換 Network Editor、Panel 等類型的位置。預期在此看見 Sgrape Editor，選取後顯示對應的 Editor Panel COMP 實例。需求是這個原生選單中的便利入口；底層仍可使用 Panel，不因此預設必須新增一個 TD 原生 Pane 類型。

官方 Pane Python API 已提供切到 Panel 類型、設定 owner COMP 與分割等能力；目前查閱的文檔沒有列出自訂 Pane 類型註冊接口。這不等於證明選單擴充不可行，可維護的選單擴充方式仍需調查。若只能依靠 TD 內部未公開機制，先評估跨版本更新的可靠性，再決定具體實作；不能把普通 Panel 選擇入口當成已完成這項需求。

載入初始化應能重複執行且不產生重複項目；在 TD-Sgrape 與服務準備好後取得有效入口，能處理 port 改變。保留使用者其他窗格與選單配置，驗證保存重開、元件更新、主元件不存在時的行為。未驗證前不直接改寫 TD 安裝內容或宣稱動態注入原生選單已可用。

## 驗收順序

1. 一個 Panel 實例：打開指定 Shader，自適應尺寸，鍵盤焦點、滑鼠、拖放、快捷鍵與中文輸入可用。
2. 兩個不同大小的 Pane：各看不同 Shader，也可同看一份；視圖狀態獨立，資料更新正確，錯誤保護與衝突處理仍生效。
3. 解析度與成本：一般 DPI／高 DPI、4K 大小窗格、Non-Commercial 上限；比較一個／多個可見實例及隱藏時的成本與可讀性。
4. 生命週期：保存重開、範本更新、服務 port 改變後恢復正確目標；驗證 Pane 類型選單入口自動註冊、選取後打開正確實例與不重複。

Preview 與宿主分開決策。已有原生 Viewer 時，可避免另一份持續網頁預覽；MAT 原生 Viewer、按需快照、GPU 直通與串流仍依既有討論處理，不因本項目擴大實作範圍。

## 官方依據

- [Pane：窗格與內容類型](https://derivative.ca/UserGuide/Pane)
- [Getting started：Pane 分割、類型與配置入口](https://derivative.ca/UserGuide/Getting_started)
- [Pane Class：owner、changeType 與分割 API](https://derivative.ca/UserGuide/Pane_Class)
- [Clone：範本與根元件參數的關係](https://derivative.ca/UserGuide/Clone)
- [Web Render TOP：CEF、DPI 與 Cache Directory](https://derivative.ca/UserGuide/Web_Render_TOP)
- [Non-Commercial：1280×1280 影像限制](https://derivative.ca/UserGuide/TouchDesigner_Non-Commercial)
