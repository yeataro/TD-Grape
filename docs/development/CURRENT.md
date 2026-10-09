# 目前現況

最後更新：2026-10-10。每輪收尾時覆寫本頁；完整交付紀錄見 [STATUS](STATUS.md)。標 ✅ 者已用 git／測試核對。

## 做到哪裡

**路線：** [B 案](REFACTOR_REACT_FLOW_PLAN_B.md)——一次一條真實產品能力，正式 React UI、核心與 TD 同輪打通，逐步擴大到接管全產品後關閉舊入口。A 案（[REFACTOR_UI_UPDATES](REFACTOR_UI_UPDATES.md)）只留作比較。

**進行方式（人類 2026-10-09）**：先把基本能力定下來；標準功能都做完之後，會有一段多輪測試調整的時期（外觀、手感這類比較不確定的東西在那時一起調）。在那之前，外觀只求可用、結構乾淨，不追細節。

**最新：Refactor.60.5**（2026-10-10）。最近一次 Deliver 是 Refactor.59.4（`TD-Grape-dev.94`，TOE 已提交）；TD 目前在開發模式（外部資料夾）跑 60.5。逐版內容見 [STATUS](STATUS.md)。

**最近幾輪的大塊（R.53–59）：**
- 編輯器外框（R.53）、新增節點的入口（R.54）、數值輸入 widget（R.55）、共用來源面板與卡片（R.57）、拖線預告與拔線還原（R.56–57）。
- 貼圖輸入的預設圖預覽（R.58）；Samples 改為 Clone 主組件那份、出口用 label 找（R.58.9）。
- 外觀面板：陰影與光暈試驗、可調數值（R.58.2–58.6）；試驗定案等人類最後給 CSS。
- 分量樣式與分量染色（R.59）；邏輯色組、Compare 一個選單（R.59.1）；列與選單的間距、Retry 倒數圓餅、面板開關圖示亮暗（R.59.2–59.5）；Logo 等待動畫元件、分頁標題、檔名提示、載入中畫面（R.59.6–59.7）。

**更早：** Refactor.1–14 建立 TS 接線規劃、前端 compiler、節點模組、Editor Service、新 Manager 與原生 Grape TOP；R.15–32 第一條正式 React 路徑、TD 不在時照常編輯（Q28）、圖格式 grape-graph 1（Q44）、清掉舊入口與舊 Python 核心；R.33–52 Grape OP 新結構、在地化、來源（常數、Uniform、TD 內建值、貼圖輸入）、選取、固定入口、連線身分。權威規則摘要在 AGENTS.md。

## 待處理

> **自訂參數頁（10-08 盤查第 3 條，仍未處理）**：舊 GrapeManager `parameters` 在關閉舊入口時沒搬，現在沒有地方編輯 Grape OP 的自訂參數。人類傾向：屬舊架構，之後照 Q41 重做、不搬舊的；重做時 Grape 自動產生的參數（所有公開來源）在這頁不能編輯或刪除（Q44）。

> **清殘留的判斷規則**（design-interview Q48）：每段殘留問「形狀符合新架構嗎？產品現在需要嗎？」再決定留、刪或暫留；10-08 清理清單第 1–8 條已全部完成（Refactor.27–31），盤查紀錄 workspace `../work/refactor/legacy-audit-2026-10-08.md`。

> **子圖那一輪開工時先改形狀（清理第 7 條，照 Q48 判「留」但形狀未對齊 Q46，2026-10-08）：** (1) 節點類型 `sgrape.function.call／input／output` → `sgrape.builtin.subgraph_call／input／output`，參數 `functionId` → `subgraphId`（Q46 7.7；目前沒有任何存檔含子圖，改名不需轉換）；(2) `SubgraphData.stages` 目前必填、`targets` 可存——Q46 定為由內容推算，只在存成定義時寫入；(3) 核心內部網路代號前綴 `function:`（不存檔）改名；(4) 每邊 16 個介面的上限寫在 `subgraph_interface.ts`、`subgraph_operations.ts`、`subgraphs.ts` 三處，搬進 `config.ts`（Q47 補充 8）。子圖程式本身（建立、群組、實例化、在地化、複製、刪除、產碼）都有呼叫者與測試，保留。

> **新舊框架的圖不共通（design-interview Q40）：** 不做轉換功能，舊圖之後由匯入器處理。tag 區分已於 Refactor.27 拿掉（TD 讀到舊格式即拒絕）；遷移期便利行為（下段）仍待移除。

> **遷移期便利行為，非產品行為（人類 2026-10-07）：** 新舊入口並存才有的功能——版本衝突覆寫、拒絕開圖的不支援說明與載入預設圖、返回舊入口——只是遷移途中方便測試，做最小可用即可，不寫進產品規格；安全底線（版本核對、不靜默丟資料）照守。舊入口關閉時移除。

> **Uniform 剩下的（design-interview Q51）**：A–D 已做（Refactor.44–48）；剩 E（TD 值的 Undo）、幫手（自訂參數）、預設值欄位等，見 workspace `uniform-d.md` 第三節。陣列、矩陣、Attribute、POP Buffer、Spec Constant 等進階來源未做。

## 已發現、尚未處理

依狀態分組（2026-10-10 整理；已處理的拿掉，紀錄在 STATUS）。每條一兩行，詳細看出處。

### 一、待人類決定

- **自動轉型要不要引入**（R.54 起）：核心規則「接線不改既有輸出」（`wire_planning.ts`），所以 vec4 接不上預設 float 的 Add；拉線新增時 Vector Split、Combine、Replace、Swizzle 不在 vec4 清單（新增時預設 vec2）。人類：不自動轉型是舊框架時代因成本定的舊決策；Compare 很適合自動轉型；Convert 也需要「依接線選型別」（10-07：一定要做，但不是現在）。新架構成本要重新評估。
- **節點的複製貼上要不要排一輪**（10-09）：新產品沒有（舊產品 `graph_ui.js:2769`）。要先想：新 ID、共用來源跨 Grape OP、剪貼簿格式、子圖（`subgraph_copies.ts`）。
- **重設瀏覽器設定**（10-09）：重設後要不要重新整理頁面（助手傾向照舊產品重新整理）、語言要不要一起重設、要不要分組。workspace `reset-settings.md`。
- **訊息紀錄一直增加**（10-09）：離線時每 5 秒重試、每次都記同一句（`ReportLog` 不合併）。合併計數、只記「斷線／恢復」或其他——人類：要嚴肅思考（牽涉 Q35「紀錄是事件、只增不減」）。
- **什麼訊息可以出現在畫布上方**（10-09，還在想）：判準草案「只放先別編輯、先處理這件事的」（現在只有版本衝突）；新產品 TD 沒回應放底列，人類覺得簡潔不錯。
- **分量色**（R.59）：維持現在的或改回舊產品較淡的（接線多半用舊的）；看過 R.59 再談。`component-style.md`。
- **TD 上新增／刪除 Uniform 列，編輯器要不要跟著**（10-09，最後回頭看）：助手建議按一下才同步。workspace `uniform-d.md` 第三節。
- **節點上限**（10-08）：繼承舊產品（每張網路 256 節點，子圖展開後 2048），不是最終上限；Worker、結構共享、上限待決定。子圖定義數上限 64 沒依據，人類：先留著。
- **決策文件的存放位置**（10-07，人類暫不決定）：design-interview 等在 workspace、不在 git。

### 二、已決定、待做

- **核心打開圖時不檢查宣告內容**（R.60 發現）：存著不認得的預設圖（例如已拿掉的 `custom`）照樣打開、選單空白；應該打開時擋下或標成 Ghost（同看不懂的節點）。

- **外觀試驗定案**：人類等所有東西出來，最後整理 CSS 給助手寫進主題（workspace `floating-panels.md` 44、45）；同時：畫布左下說明不能有陰影、選取相關樣式、連線身分的版面（R.52 頁首檔名、草稿與衝突浮窗偏擠）、Swizzle 分量列與 Math 卡片的樣式。
- **切換 Grape OP 時的閃動**（R.51.1）：載入中畫面已做（R.59.7，Logo 等待動畫 `<BrandMark loading />`，九種候選與調用名稱見 workspace `work/refactor/loading-animations.html`，元件改了要同步）。剩：載入中時網址列仍寫「選擇 Grape OP」、共用來源面板仍是「打開一個 Grape OP 後…」；排查時先錄下那幾幀。待談：作業系統要求「減少動態」時（舊產品三處都停住動畫；人類的 Windows 可能關了動畫效果）停住或只淡入淡出。

### 三、等某一輪一起做

- **參數面板**：分量樣式的切換選單；卡片不畫標頭、面板畫標頭，控制項只宣告一次（Q67 補充）；Math／Swizzle／Convert 的控制項搬過去；數值 widget 的互動區與純量開頭文字（`value-input.md` 四：同一個入口、階梯圖示、面板用分量名稱）；自訂參數頁（見待處理）。
- **錯誤回報與連線**：「TD-Grape 拒絕」說成真正拒絕的那一方、技術代號不直接露出（記憶 messages-name-the-real-actor）；TD 編譯錯誤指回節點（只在失敗時才做）；換了 port 時把草稿帶到新視窗（R.52 只做了並排資訊）；草稿只存一份、「找到先前草稿」時畫布被鎖（違反編輯不等 TD）；衝突選 TD 端後編輯端版本只能 Undo 叫回（人類選 A）。
- **貼圖輸入後續**：R.60 已做「顯示實際收到的圖」與接線通知（`texture-input-actual.md`）；剩數量上限（7.17）；In TOP 照位置命名、輸入名稱在 Label；R.43 之前建的 Grape OP 裡沒歸屬的 `input1`；Input Extend UV 預設 Zero 使邊緣 alpha 偏低（TD 原生，要不要改預設再問）。workspace `texture-inputs.md`。
- **多選框與 group**：選取工具列、拉框調大小、自動排列（legacy `selection_ui.js` 85–413，只搬純計算）；有 group 時多選框比 group 的框再大一點（`floating-panels.md` 46）。
- **子圖與陣列**：見「待處理」的子圖形狀；陣列長度引用 `sg_extent_` 含 `fn_` 前綴會存進圖，陣列那一輪改成有結構的引用；catalog 欄位名 `definitionUuid` 未改。
- **更新機制**：workspace `update-mechanism.md`（Clone＋TDUpdater 是方向不是定案）；主組件「TD-Grape」頁還留著舊產品參數（`Updateshaders` 等），做時一起處理，刪除要先問。
- **Router**：核心功能是「不參與產碼」且「不觸發產碼」，外觀見人類截圖；舊產品只做到一半。
- **Grape OP 選擇與切換**：選 Grape OP 的畫布（假節點＋縮圖，未決定，`grape-op-chooser-canvas.md`）；網址列的 Grape OP 標籤頁（一開始一個、按＋加，功能同下拉選單）。
- **外觀面板 Preset**（`floating-panels.md` 45）。
- **命名整理**：程式中「graph」一字多義（`Graph` 是整份文件、子圖的 `graph` 是單一網路）；`groupSubgraph` 與 Group 撞名。

### 四、【後續版本／發布後】

- **3D、Cube 等貼圖輸入**（人類：第一版不做）：是貼圖輸入的子類；TD 要回報實際維度。design-interview Q66 補充。
- **多窗格編輯**（人類：最後再決定）：之後的輪次不把「只有一張圖」寫死（Q47 第 4 點）。
- **TD 從網頁資產讀共用表**：網頁託管若離開 TD，共用表要另找地方；讀取處要註解這個依賴。
- **節點實作改版時舊圖的產碼會悄悄改變**：需求在（先提示差異、確認後才升級），舊實作已拿掉，要在新架構重做（每個模組自帶版本號）。
- **最終產品不顯露瀏覽器特徵**（Q30）：移植大致完成後才做。
- **沒有對應 Grape OP 時也能寫草稿、舊 `POST inspect` 匯入**：部署到網路與匯入器的議題。

### 五、注意事項與教訓

- **驗證**：TD 2025.33230 的 `TOP.sample()` 在浮點格式把 R 當 alpha；讀像素用 `numpyArray()`（workspace `td-issues/top-sample-float-alpha.md`，人類決定何時回報）。
- **教訓**：開放節點前先查舊產品新增清單是否刻意排除；調查走產品實際路徑。
- **已定不做**：「啟動編輯服務」對話框置中（TD 的 `ui.messageBox` 開在滑鼠位置，抓錯螢幕更糟）。

### 六、要人類同意才能動

- **刪除 `/project1/r54_probe`**：R.54 的測試複本，裡面有人類加的節點，所以沒照慣例刪。

## 未完成／未驗證

- Refactor.17（開放 47 個常用節點）標「待人類實機確認」後沒有紀錄；人類若已確認，刪這一條。（R.32 從 Tab 選單建立：人類 10-09 已用它建出 `Grape_TOP1`。）
- **Human Takeover Test**：人類不靠 AI 完成一項維護（如新增 unary 節點），未執行。見 [B 案](REFACTOR_REACT_FLOW_PLAN_B.md#human-takeover-test)。
- **完整 TOE 冷啟動**：未驗證。
- **未遷移**：MAT／ISF、TOP 貼圖輸入後續（3D／Cube、調整順序、輸入狀態）、陣列與進階來源、舊 `expose` 旗標、pixel preview、Personal Library。

## 程式目錄現況 ✅

| 目錄 | 身分 |
| --- | --- |
| `src/core-ts/` | 核心（TS）：圖、節點模組、型別、接線、TOP compiler |
| `src/generated/` | `build:core` 產生的 `grape_core.js`、`editor-bootstrap.json`（勿手改） |
| `src/editor-react/` | 編輯器（React／React Flow），唯一入口 |
| `src/td/runtime/` | TD 宿主 Python（Manager、`next_family`、`host_api`、編輯服務等）；檔案位置記在 `src/td/source_files.json` |
| `src/library/` | 共用表（Uniform 預設等）與內建子圖來源 |
| `src/static-site/` | 沒有 TD 時的靜態網站素材（Grape 預覽圖） |
| `src/remote_panel/` | Remote Panel |

舊入口 `src/editor/`（R.25）與舊 Python 核心 `src/core/`（R.29）已刪；`src/core/` 只剩未追蹤的 `__pycache__`。

## 現場 TD（使用前以 TD MCP 重新確認）

- 主組件 `/TD_Grape`（全域捷徑 `TDGrape`，程式一律用捷徑找）。Grape OP：`/project1/Grape_TOP_test`、人類的樣板 `Grape_TOP_REF`、`Grape_TOP1`（人類用 Tab 選單建立）、測試複本 `r54_probe`（等人類同意刪）；範本 `/TD_Grape/masters/grape_top`。每個 Samples 都 Clone `/TD_Grape/Samples`（R.58.9）。
- 編輯服務 port 65465（被佔用時往後找，R.36）；例：`http://127.0.0.1:65465/shader/6cb6a90247c140bea7df98a2f11c1858/`（r54_probe）。
- `GrapeEditor`：最近一次 `Deliver()` 是 Refactor.59.4（存 `TD-Grape-dev.94`，TOE 已提交）；之後切回 `DevMode()`，目前從外部資料夾跑 60.5。提交 TOE 前 `Deliver()`，見 AGENTS.md。TD 2025.33230。
- 開發 TOE：`src/td/TD-Grape-dev.toe`（TD 顯示 `.94.toe` 這類是遞增存檔的正常狀態）；未提交的修改可能是人類的，須保留。
- 保護區：`/TD_Grape/IconGen → /TD_Grape/icon` 及其依賴。
