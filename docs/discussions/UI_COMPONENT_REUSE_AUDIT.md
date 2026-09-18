# UI 元件共用調查

2026-09-19；基準：Array Create 已交付的 **0.8.104 / `42992e6`**。

**狀態：調查完成，待使用者審查。本文所有重構建議尚未實作，也不代表已獲批准。**

結論：目前不是每個節點各寫一套 UI。數值拖曳、下拉彈出、Parameter 排版、節點欄位樣式已有共用機制。主要缺口是「數值草稿／提交的底層邏輯」仍分成幾份，且已造成可重現差異；其次是少數欄位沒有進入共用樣式，以及幾組相似的來源綁定、選單組裝程式。

## 調查方法與邊界

- 靜態追查 `app.js`、`inspector.js`、`select_ui.js`、`selection_ui.js`、`graph_ui.js`、`shortcuts_ui.js`、`style.css` 的元件建立、事件、提交及樣式入口。
- 用隔離的 Chromium 編輯器 fixture 操作 Array 節點與 Parameter，另直接建立既有通用 INT 元件，核對 Escape／失焦行為及 computed style。未連接 TD，不修改使用者圖。
- 這輪沒有重構產品 JS／CSS、沒有改英文文案，也沒有為調查新增 TD 監控或同步。原始重現程式及 JSON 留在私人 `reports/array-create-round/ui-audit`，不包入產品。
- 下面明確區分「瀏覽器已重現」與「程式碼中的重複」。未宣稱已驗證 iOS、所有 UI 模式或所有欄位組合；也沒有從程式碼長度推算執行效能。

## 已經共用的部分

| 能力 | 目前入口 | 判斷 |
| --- | --- | --- |
| 基本文字／數值輸入 | `src/editor/app.js:324` 的 `input`，`inspector.js:443` 的 `typedScalarInput` | 可繼續作基礎，但草稿能力不完整，見 A。 |
| 數值滑桿、Value Ladder、預設值選單 | `inspector.js:53` 的 `beginValueLadder`、`:137` 的 `installValueLadder` | 節點、Parameter、通用數字欄已共用手勢引擎。沒有必要再新做 Array 專用拖值器。 |
| 向量／矩陣數值 | `numbers`（`:455`）、`parameterValueRow`（`:540`）、`inlineNumericFields`（`:1193`）、`matrixValueInput`（`:1251`） | 同一呈現環境內已有共用；Matrix 將欄／分量交給數值編輯器，而非自製每格輸入。不同環境的提交邏輯仍重複。 |
| 下拉選項／彈出選單 | `app.js:323` 的 `select`，`select_ui.js:2` 的 `installSelectMenus` | 原生 select 保存值與 change 回呼；共用事件代理把適用的選單移出圖的縮放座標。手動 `el('select')` 也會經過這層，不等於另寫彈出機制。 |
| Array 與 Array Create | `inspector.js:1050` 的 `arrayElementSelector`、`:1090` 的 `arrayLengthSelector`、`:539` 的 `nodeInputOptions` | 共用型別選項；Array 的上下排列是容器，Array Create 使用一般接孔欄。此次 Array Create 沒有新增 CSS。 |
| Parameter 欄位格線與節點 body 欄位 | `parameterControlRow`（`:491`）；`style.css:1082`、`:1500` 附近 | 布局有共同入口。節點 body 的 input/select 已共同定義 24px 高、11px 字級及底色。 |
| 排列動作、快捷鍵、工具列收合 | `selection_ui.js` 的 `ARRANGE_ACTIONS`；`shortcuts_ui.js:3`；`selection_ui.js:408` | 動作清單／提示已有共用。收合搬動原按鈕，保留事件與狀態；不需要複製一套按鈕。 |

## 待審候選

### A．數值草稿與提交核心：優先處理

位置：`app.js:324`；`inspector.js:443`、`:540`、`:1193`。三條路徑分別管理 committed value、Enter、blur、驗證、Escape、手勢中的提交保護；Parameter 與節點另有圖身分／拓撲變更保護。

**已重現：** Array 固定長度原值 4，輸入 9 → Escape → 離開欄位：

| 入口 | 實際結果 |
| --- | --- |
| 節點 body 的長度欄 | 保持 4，草稿取消。 |
| Parameter 的同一長度欄 | 改成 9，Escape 沒有取消，失焦仍提交。 |
| 通用 `typedScalarInput` 的 int 欄（3 改為 7） | Escape 後失焦提交 7。這項是獨立元件探測，不能外推每個呼叫端都沒有補處理。 |

原因：Array Parameter 在 `arrayLengthControl`（`:1097`）使用 `input(...,'number')`；`input` 僅處理 Enter，沒有數字草稿的 Escape 還原。節點則使用 `inlineNumericFields`，有自己的 restore。**共用外觀不等於共用編輯行為。**

建議抽取一個小型數值草稿控制器，統一解析／型別界限、committed／draft、Enter／Escape／blur、非法值、手勢期間不重複提交。保留三個外層呈現器；以回呼接入「是否可寫、目前圖身分、提交、同步讀值」。不要把 graph `change()`、TD expected token／回讀、Undo 全部塞進通用 input。

風險與驗收：Escape 不建立歷史、一次輸入只提交一次、失敗提交不更新 committed、切 Shader／Subgraph 不把舊草稿寫進新圖、TD 回讀不覆蓋使用中草稿。先遷移 Array 長度作小批驗收，再擴大；不做全域直接替換。

### B．數字欄的共用樣式有遺漏：第二優先

位置：`style.css:1082`、`:1532`、`:1534`；`inspector.js:1097`。

**已量測（此 fixture 的暗色設定）：** Array 節點的長度下拉及 INT 欄都是 24px／11px、底色 `rgb(57,56,67)`。Parameter 的長度 INT 欄也是 24px／11px，但底色為 `rgb(25,25,32)`。

原因：Parameter 一般數值共用樣式限定 `.parameter-value-group input[type=number]`；舊的 Array 長度控制放在 `.components`，没有進入同一條規則。這是 selector 覆蓋範圍／元件分類的差異，不是 Array Create 新增了一套色彩。

建議明確定義數值欄的共同 class／尺寸與色彩變數，讓節點／Parameter 容器只負責排列、寬度與縮放。不加 Array 專用補丁，也不把整個 inspector 的所有 input 無差別改色。節點 4px、Parameter 5px 圓角等差異可一併審查，不能未審先統一。

### C．Array／Matrix 的 TD 來源綁定編輯器重複：第二優先

位置：`inspector.js:2049` 的 `nativeArrayFields`、`:2086` 起的 Matrix 綁定區。

**靜態確認：** 兩處各自建立 CONSTANT／EXPRESSION 下拉、文字欄、Apply；各自維護 generation＋declaration ID 的草稿 map、expected token、Enter／Escape、成功後清除草稿與刷新。差別主要是名稱、placeholder、hint、`arrayBinding`／`matrixBinding` action，以及 Matrix 額外的數值區。

建議只抽取「來源路徑／表達式綁定編輯器」；由呼叫端提供標籤、binding 資料及提交 action，Matrix 數值區保留。尚未因此重現特定 bug，價值是減少往後一邊修、另一邊漏修。

不得把這項變成 Uniform 即時通訊重構。expected token、TD 拒絕回覆、驅動模式的唯讀保護、異步回讀與圖內常數提交具有不同責任，必須保留。

### D．排列選單列重複：小範圍候選

位置：`selection_ui.js:319` 與 `graph_ui.js:2085`。

**靜態確認：** 兩處都遍歷共同的 `ARRANGE_ACTIONS`，但又各写一次分隔線位置、圖示／標籤、快捷鍵提示、兩／三節點的啟用條件。動作本身已共用 `arrangeSelection`，不是兩份排列演算法。

建議共用「排列選單列建立器」或動作項 metadata；開啟位置、子選單左右鍵、返回焦點及 same-context 檢查留給各容器。優先度低於 A／B，目前沒有驗證到顯示或行為不一致。

### E．彈出介面的定位／鍵盤基礎可共用：較低優先

位置：`select_ui.js:60` 起、`inspector.js:5` 起的 numeric presets、`selection_ui.js:319`／`:402`、`graph_ui.js:2099`、`app.js:378`。

**靜態確認：** 各處重複螢幕邊界 Clamp、UI scale 換算、上下鍵／Home／End、關閉後焦點處理。CSS 已在 `style.css:1636` 統一 popup 色彩、行高與分隔線，不能說「所有選單都沒共用」。

可先共用純函數形式的可視區定位與可用項目鍵盤導覽；保留 listbox／menu／menuitemradio 的語意差異、二級選單、數值預設選單保護草稿的特殊 outside-click。不要直接換成一個全能選單管理器；也不新增全頁長駐 MutationObserver／輪詢來做到共用。

## 不建議因此合併的東西

- **節點與 Parameter 的版面**：節點受圖縮放、接孔、連線／覆寫、局部重繪影響；Parameter 有 compact／expanded 同值欄與群組拖值。共享數字核心，不強迫同一個 DOM 樹。
- **圖內值與 TD 原生來源**：都能顯示數字，但後者有 expected token、驅動／唯讀模式、異步請求。不能為了「共用」把每次本機輸入都送往 TD，或讓 TD pending 禁用所有本機欄位。
- **一般 select 與右鍵二級選單**：選值與執行動作的語意、焦點、關閉條件不同。共用低層工具，不共用錯誤的行為假設。
- **所有工具列的自動收合**：仍只適用明確 opt-in 的工具列，保持分組及恆常項目規則；不擴散到所有面板。
- **圖示按鈕的不同尺寸**：已有 `.ui-icon`／`.icon-button`。主工具列、浮動選取工具列、觸控及 Preview 的大小不一樣，有各自密度需求，不能只因數字不同就判定重複錯誤。

## 建議的下一個可審工作批次

先審 **A＋B**：以 Array 節點與 Parameter 的同一長度欄為對照，補齊同一數值編輯契約與樣式覆蓋；通過草稿、Undo、觸控、唯讀及型別變更驗收後，再決定是否遷移其他欄位。C、D、E 分開處理，不作為此批前置。

實作成本原則：只為已出現的重複抽取小元件；透過傳入 callbacks／options 使用。共用層不得為每格額外掃描整張圖、查詢 TD、模擬接線或維持長駐同步。每批都要能獨立回退，不能用一次大規模搬檔把功能修改和純整理混在一起。
