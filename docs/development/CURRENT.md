# 目前現況

最後更新：2026-10-07。每輪收尾時覆寫本頁；完整交付紀錄見 [STATUS](STATUS.md)。標 ✅ 者已用 git／測試核對。

## 做到哪裡

**路線：** [B 案](REFACTOR_REACT_FLOW_PLAN_B.md)——一次一條真實產品能力，正式 React UI、核心與 TD 同輪打通，逐步擴大到接管全產品後關閉舊入口。A 案（[REFACTOR_UI_UPDATES](REFACTOR_UI_UPDATES.md)）只留作比較。

**最新交付：Refactor.17.2**（2026-10-07）——補開放 Vector／Combine／Replace／Swizzle／Convert（舊圖最常見的節點），新增選單不再提供已淘汰的 `float`／`vec2`／`vec3`／`vec4`（仍能打開舊圖）。固定入口待討論。

**Refactor.17.1**——測試便利小修正：右鍵拖曳框選（[RightDragSelect.tsx](../../src/editor-react/RightDragSelect.tsx)）、右鍵拖曳後不跳瀏覽器選單、Body 拖曳預設開啟。

**Refactor.17**——新入口開放 47 個常用節點（原 5 個），每個都經自動測試接到輸出並產碼、真實 TD GPU 編譯通過；**待人類實機確認**。外觀未整理（同 Math，Q22 後續處理）。

**前一輪：Refactor.16**——**人類實機確認通過**（TD 最小化編輯／自動續送、Math 新增輸入）：
- TD 不在時的編輯（Q28）：TD 無回應／連不到時照常編輯、只在未連線期間重試、回來自動續送；衝突浮動提示「編輯端（建議）／TD 端」，TD 端可一次 Undo 叫回。
- Math 動態輸入：拖線到「＋ 新增輸入」新增接孔並接線，一次 Undo（React 只認模組 `spare` 契約，Q29）。

**更早：Refactor.15 / `7b52579`** ✅——第一條正式 React TOP 路徑（Float、Color RGBA、Add、Color Output）。入口與責任表見 [React 入口](../../src/editor-react/README.md)。

**Refactor.15 人類 UX 驗收：已有結論（2026-10-07）。** 遷移期間不要求外觀／行為與舊入口一致。補上的遷移期便利行為：
- 開不了圖時列出不支援的具體內容（`f803dca`）。
- 開不了圖時可「載入預設圖」恢復測試環境；編輯器內衝突時可「用編輯器草稿覆寫 TD」（`4017f53`）。

自動測試：core 97 + session 27 項通過；14 組 browser 情境通過 ✅（2026-10-07）。

**同日其他：** `GrapeManager` 依去向分組並加 Legacy 標注，新增 [舊 Python 現況清單](LEGACY-PYTHON.md)（`5a08665`）；重構歷史已查證，寫在該文件。

**權威與 TD 不在時的編輯：2026-10-07 定案**（[訪談 Q28](../../../work/in-place-refactor-design/design-interview.md)、[target-architecture](../../../work/in-place-refactor-design/target-architecture.md)「權威的範圍與 TD 不在時的編輯」）。規則摘要已寫入 AGENTS.md 必守規則。

**更早完成（Refactor.1–14）：** TS 接線規劃、TOP 前端 compiler、56 個節點模組、Editor Service（VFS 資產服務，port 65465）、新 Manager `/TD_Grape/GrapeManager` 與原生 Grape TOP、Grape OP 對 Manager 只有編輯依賴。

## 待處理

> **新舊框架的圖不共通（design-interview Q40）：** 以 Grape OP 上的 TD tag 分群，新編輯器只編輯有 tag 的 OP、存新格式（`ui.groups` 等）；無 tag 的舊圖在新編輯器只能唯讀對照（ghost 可見、`frames` 忽略、永不寫回）；不做轉換功能。**舊入口關閉時要做的事：** 移除遷移期便利行為（下段）與 tag 區分，舊圖改由匯入器處理。

> **遷移期便利行為，非產品行為（人類 2026-10-07）：** 新舊入口並存才有的功能——版本衝突覆寫、拒絕開圖的不支援說明與載入預設圖、返回舊入口——只是遷移途中方便測試，做最小可用即可，不寫進產品規格；安全底線（版本核對、不靜默丟資料）照守。舊入口關閉時移除。

**2026-10-07 晚的討論排出的隊（皆未動工；決策在 workspace `work/in-place-refactor-design/design-interview.md`）：**

- **A. 路徑重建（人類定：路徑需重新構建；設計見 design-interview Q38，2-1～2-5 已定）**：要點——修改完成即由圖判斷分流、不加停手等待；產碼指紋（分支鏈路）＋必跑性質測試；結果分兩包、送 TD 分「執行用（GLSL＋綁定，成對）／保存用（圖，可晚到）」；TD 不擁有圖的知識（圖為不透明字串，只做不看內容的校驗）；產碼搬進 Worker；同步器負責讀寫 TD；TD 保存最新圖＋Last Known Good 一組。原記錄：**產碼目前綁在送出裡**——`deliver()` 才呼叫 `compiler.compile`（session.ts:188-217），所以 TD 離線（送出被擋）時不產碼，GLSL 顯示與錯誤停在舊結果，產碼錯誤要等送出才看到，違反 Q28「編輯不等 TD」。成因：舊產品時代產碼在 TD（送出時顯示 material.compiling），新架構把產碼移到前端卻沿用「送出時產碼」的路徑。新路徑：修改完成（停手後）即產碼，結果（GLSL、目前問題＝狀態；回報＝事件）由編輯協調者分送；同步器只拿已產好的結果送 TD、送不出就排隊。現行完整路徑：transact→document.change（不產碼）→等 0.65 秒→flush/deliver→compile→state.glsl→applyRequest→host.call(apply, HTTP 20 秒逾時)→Editor Service 佇列→HostAPI.dispatch→NativeFamily.apply（核對版本與校驗→GPU 試編→設參數寫 pixel_shader→再驗 GPU→存圖；失敗全還原）→回覆→確認版本。`session.ts` 有七項權責，「與 TD 同步」約佔一半且改變理由不同（連線方式），建議拆成獨立單位（暫名 `HostSync`），其餘依角色改名（「session」聽起來像臨時狀態）。行為不變、測試照舊。建議排在 B 之前。
- **B. 在地化骨架＋回報（Q34、Q35）**：全專案「原文＋代號」`tr('代號','原文',參數)`、只打包不翻譯，顯示時才翻；節點文字只寫原文、代號由 `nodeText()` 推導；卡片預設全英文；翻譯檔跟著原文擁有者分開存放。回報 `report(等級, tr(...))`，來源等自動填，回報紀錄獨立模組，事件（紀錄）與狀態（目前錯誤）分開、程式不准依紀錄判斷。
- **C. 互動小修補（Q33；修飾鍵最終定案見 Q39：完全對齊 TD 實測——Ctrl＋點擊切換、Shift＋點擊只加選、Shift＋框選加選、右鍵＋Ctrl 同右鍵；關掉 RF 內建框選，左右鍵框選都走自己的）**：主要選取（session 記一個 ID、主次不同色、點空白全清、框選後不換人、需換時取第一個碰到的）、Shift＋單擊加選、節點與接線不混選、有接線的 input 拉到空白處斷線。**待定**：框選保留原選取用 Ctrl／Shift／兩者；Shift＋左鍵框選是否改走自己的（人類先讀 RF 文件）。`RightDragSelect.tsx` 已部分修改，**未測試、未提交**。
- **D. 設定來源（Q36，討論中）**：個人偏好／這次開啟的環境／專案屬性三種；判斷標準已入 AGENTS.md；TD 內嵌開啟時先帶「在 TD 裡」這個事實參數。

1. **【重中之重，但暫不實作】純版面修改不觸發產碼（人類 2026-10-07）**：可節省大量 TD 效能，屬協定、越晚越貴。是待實現的一大塊功能：規模變大（300／1000 節點、子圖攤平）時，整張圖產碼、打包傳送、TD 主執行緒解包核對都隨圖成長，需分層攔截（瀏覽器依 `GraphChanges` 只改 `ui` 即不產碼並只送改了的部分／TD 比對產碼結果跳過 GPU 驗證／完整流程）。**人類決定先把其他功能做完，再做真實狀況的效能盤點後才設計實作**（design-interview Q31 及補充）。現況與舊產品做法見 [LEGACY-GAPS](LEGACY-GAPS.md) 第一批 #1；Router「不觸發產碼」建立在此之上。
2. **Uniform 支援（決策已完成 2026-10-07，見 design-interview Q41；以下為當時盤點）：** 要點——來源（Source）與全域常數（Constant）歸作品（`document.sources`／`document.constants`，面板「共用來源」）；結構只在編輯器改；編輯器送 JSON，TD 寫入 Grape OP 內只被寫入的綁定表，以 DAT Export 驅動 GLSL OP Uniform 參數（已實測）；公開的才有 Grape OP Custom Parameters（名稱與 GLSL 名分開），值的權威在 TD；拖數值走即時通道、放開才記；一條共同歷史、一個 Ctrl+Z 只退編輯器做的；第一階段 float／vec／color＋預設 Uniform＋公開＋全域常數。舊盤點： 牽涉宣告、TD 原生參數與綁定，不只節點本身，**不可當成小切片直接做**。2026-10-07 盤點：
   - **TS 新核心已有**：Uniform 節點模組（引用宣告、輸出其值）、compiler 產生 `uniform` 宣告與綁定清單、宣告名稱／型別／值檢查；只支援一般數值與顏色（`nativeSequence` vec／color）。
   - **仍在舊 Python（新 Manager 使用中，GrapeManager 黃框）**：宣告新增／改名／刪除（`sgrape_sources.edit`）、建立與同步 TD 原生參數（`configure`）、改值（`write_value`）、原生值 Undo（`sgrape_history`）、原生參數遺失偵測。
   - **完全沒有**：React 的 Values 面板與 Uniform 節點選擇宣告的 UI；時間等預設驅動、陣列、矩陣、Attribute、POP Buffer、Spec Constant；拖曳即時更新。
   - **待決策**：(1) 宣告管理放哪——依 Q29「誰需要」，宣告屬作品→核心，建立原生參數只有 TD 能做→宿主，目前兩者混在 `sgrape_sources.py`；(2) 新入口的 Values 面板與節點選單；(3) 支援範圍先做數值／顏色，或一次對齊舊產品。
3. **固定入口（方向已定 2026-10-07：入口由模組宣告，design-interview Q37 1-5；未實作）**：新增清單直接提供「vec2」等 16 個固定型別（同 Vector／Scalar 模組 + `fixedType`），卡片顯示固定名稱、鎖定時不顯示型別選單。入口清單該放哪裡（舊產品寫在畫面程式）待定。
4. **下一切片候選：** 其他舊產品功能（Q29：舊產品是功能基準，不是模仿對象）。
5. **Legacy 盤點續作：** `src/core/` 其餘 6 檔與 TOE 內其他 Python（見 [LEGACY-PYTHON](LEGACY-PYTHON.md)「尚未整理」）。

## 已發現、尚未處理

| 發現日 | 情況 |
| --- | --- |
| 2026-10-07 | **程式中「graph」一字多義（命名整理待辦）**：`core-ts/model.ts` 型別 `Graph` 指整份圖文件，子圖資料的 `graph` 欄位與各處 graph 又指單一網路；應以不同字區分（如 `document`／`network`）。違反 GLOSSARY 命名對齊原則；連同 `groupSubgraph`（意為包成子圖，與 Group 撞名）等一起整理。 |
| 2026-10-07 | **決策文件的存放位置（人類暫不決定）**：design-interview、target-architecture 等在 workspace（不在 git，Q17 定到重構收尾再整理），今天新增 Q33–Q40 後風險變大：無版本紀錄、不與 commit 連結、別的環境（換電腦、雲端 agent）讀不到、單檔近千行難讀。曾提：僅在 `work/in-place-refactor-design/`（492 KB、18 檔）做本機 git、不設遠端不 push；精簡決策寫進 repo（repo 公開，原始討論一律不進）。人類顧慮：Dropbox 同步 `.git`、日後想轉雲端會有問題——先不動。 |
| 2026-10-07 | **新入口沒有 Shader 選單（舊能力漏接）**：舊產品標題列 `#shaderpicker` 列出 TD 內所有 Grape OP，選取後 `location.assign('/shader/<id>/')` 整頁換網址，有未送出修改先確認（legacy `app.js:679-705`）。換網址＝重新向 TD 讀圖、Undo／選取消失，TD 最小化時打不開；替代為多開分頁，或日後同頁多 session。可與 Q32 的 Grape OP 清單一起考慮。 |
| 2026-10-07 | **新入口介面文字寫死（越晚越貴）**：`src/editor-react/`（`session.ts`、`main.tsx` 等）的提示與按鈕文字直接寫中文。舊產品已有 `src/editor/locales.json`（預設 `en`；繁中／英／日／法／韓；1,617 則訊息、`technicalTerms`）與 `t()`。人類要求 localization 做得越乾淨越好，文字應放在 JSON 之類的資料檔，不寫死在程式。**人類定：英文為首選；缺翻譯一律回退英文**（舊 `t()` 已是「所選語言 → 預設 en → 訊息代號」；但 `languages` 清單順序是繁中在前，要改成英文在前）。**方向已定（design-interview Q34）**：代號式、格式對齊 React 慣例（一語言一 JSON）、核心只送代號；現在起以最小規模維護。最小骨架已提案，人類要求先記下、之後一起動手。 |
| 2026-10-07 | 衝突時選「TD 端」後的編輯端版本，目前只能以 Undo 叫回（人類選 A），重新整理頁面即失；持久保存需多版本快照，人類判斷目前太大。 |
| 2026-10-07 | 現有草稿機制每個 Grape OP 只存一份（sessionStorage，關分頁即失）；「找到先前草稿」提示出現時畫布被鎖住，違反「編輯不等 TD」。 |
| 2026-10-07 | 被擋在「無法在此入口開啟」畫面時，瀏覽器內未送出的草稿無法取回（遷移期人類接受）。 |
| 2026-10-07 | 沒有對應 Grape OP 時也能先寫草稿——屬之後部署到網路（可能另開倉庫）的議題，先不做。 |
| 2026-10-07 | 舊編輯器匯入草稿用的 `POST inspect` 新 Manager 未提供（已斷）。 |
| 2026-10-07 | **【已定 2026-10-07：ghost wire，見 design-interview Q37 1-3】** **改型別後變不合法的線怎麼處理**：舊產品自動拔線（同一次 Undo，開發設定可關）；新編輯器目前留紅線、產碼失敗、TD 保留上次成功結果；人類構想「留紅線當參考、產碼時當作斷開」——類似已確認意圖「缺失節點與線保留可見但不參與運算」，但斷開後輸入用什麼值、使用者是否察覺結果改變等邏輯未想通。紅線由核心 `edge.connection().valid` 判斷、projection 決定顏色，RF 只負責畫。 |
| 2026-10-07 | **教訓**：開放節點前要先查舊產品新增清單是否刻意排除（17 曾放出已淘汰定義）；調查要走產品實際路徑（17 盤點繞過 `insert` 補預設而誤判）。 |
| 2026-10-07 | 最終產品不顯露瀏覽器特徵（原生右鍵選單等，可留一處允許）——**移植大致完成後才做**（design-interview Q30）。選單用 JS 攔截，其他痕跡多為 CSS。 |
| 2026-10-07 | **Grape OP 身分與撞號（方向已討論，須試過才定案，design-interview Q32）**：身分改為唯讀參數；撞號由 Grape OP 內 Execute DAT `onCreate`「有重複才換號」處理（剪下貼上保留原號）；圖內 ID 跟著參數走、由主組件改寫並重算校驗值；隱藏脈衝 `Regenerateid`；啟動搜尋成本必量。屬存檔格式與協定，越晚越貴。Q5：沒指定目標時畫布灰掉、可從 OP 清單選擇，不跳錯誤頁。Q6：編輯服務未啟動也必須能從選單建立 Grape OP——現行 `InitializeFamily` 會擋，屬設計缺陷。 |
| 2026-10-07 | **從 TD 選單建立 Grape OP 可能已壞（依程式判斷，未實測）**：`/TD_Grape/family_callbacks` 的 `onPostPlaceOp` 與 `masters` 舊式範本的 Open Editor 都呼叫舊 `runtime`（`sgrape_runtime`），TOE 中已不存在；現有新式 Grape OP 由安裝程式轉換而來。TD 已加暗紅框標記（未存 TOE），細節見 [LEGACY-PYTHON](LEGACY-PYTHON.md)。待人類決定是否實測與何時處理。 |
| 2026-10-07 | **版面類修改不觸發產碼（產品功能，重構漏接；相對舊產品的效能退步）**：舊產品 0.8.115–0.8.116（2026-09-19「同步效能」，[GRAPH_SYNC_SAVE_PLAN](../../../TD-Grape-legacy/docs/discussions/GRAPH_SYNC_SAVE_PLAN.md)）以 `graphContent()` 去掉 `ui` 座標／展開與 Notes、GLSL 顯示節點後比較，純版面修改不產碼（6→0 次）。重構文件（target-architecture、設計訪談、B 案、HANDOFF、REFACTOR-WORKFLOW）均未列為要求。新架構目前任何修改（含純移動）都會前端產碼＋TD 端 `_validate_candidate` GPU 驗證＋`_verify_gpu`，GLSL 相同時只略過改寫 Shader。 |
| 2026-10-07 | **Router 未完成**：**核心功能是「不參與產碼」且「不觸發產碼」**（人類 2026-10-07），外觀只是表面。舊產品只做到一半：Router 不產生 GLSL、移動 Router 屬版面，但新增 Router 或改走 Router 會改變 `graphContent` 而觸發產碼（Router 不在排除名單）；新產品應做完整。外觀（人類截圖）：單一目的地為線上一顆空心圓；輸出增加時成往右擴大的三角形（1／2／3／4 顆），輸出從最右層依目的地高低排序，最多 4 層 10 顆，超過 4 個目的地分 4 組共用出口；Wire／Link 為線本身屬性（Link 顯示箭頭按鈕與帶箭頭虛線，之後再談）。現為 `typedNode` 的普通傳值節點——型別需自選（預設 float，vec3 接 float Router 被拒）、產碼多一行區域變數、顯示為一般卡片。舊產品／ComfyUI／Blender 的 Reroute 是整理接線的轉接點：型別跟隨來源（含矩陣／Sampler／陣列／結構）、不引入轉型或 GLSL 區域變數、顯示為圓點並分層（[ROUTER.md](../features/ROUTER.md)；外觀手冊記有 Router 專屬把手／接孔、modifier 點選、連通選取穿過 Router）。需另做定義（方向：模組宣告「我是轉接點」，核心與畫面只認宣告；手冊亦載明不依節點名字 special-case）；RF 可自訂節點畫成圓點，型別跟隨／不產碼屬核心。新增選單暫不調整（現行選單非最終形）。 |
| 2026-10-07 | **Convert 缺「依接線自動選型別」（一定要做，但不是現在）**：先前產品選擇暫時拿掉 Auto（一般節點不帶 Auto），目前多數型別轉換發生在接孔上，Convert 無法依實際接上的來源／去向自動選 from／to 型別，現況等於不太有用。需要的是依 cast 命中自動選型別的便利能力；做的時候屬新能力，先與人類確認做法（AGENTS.md）。非 17.2 錯誤。 |
| 2026-10-07 | **Combine／Replace 拖線預覽（想法，未實作）**：舊產品拖線時標出將被涵蓋的分量與被替換的線，新入口沒有。核心 `plan()` 已回報 `displaced`（將被替換的線）；涵蓋的接孔可用丟棄候選文件比對前後接孔取得。畫面只畫核心給的結果，不含節點專用邏輯，Replace 與日後節點自動適用。**人類方向：只在命中這類節點時才檢查，不對所有節點檢查**——「這類」由模組宣告（同 `spare`，例如「接線會改變我的接孔」），畫面只認宣告；被替換的線由判斷可接性時已算出的 `displaced` 免費取得，只有宣告的節點才做候選預演。適合與外觀／互動整理同輪規劃。屬新能力，做時先確認。**分層（人類同意方向）**：合併規則已是 SDK 共用能力 `vectorAssembly`（Combine／Replace 共用）；宣告放節點、由 `vectorAssembly` 自動帶上，用它建的新節點天生具備；預覽是畫面層一個只讀宣告的通用元件。 |
| 2026-10-07 | 新入口的 Swizzle 分量列（4 個分量＋「−／＋」）超出卡片寬度，按鈕落在卡片外（人類實機觀察，17.2 截圖）。非 17.2 錯誤，屬顯示樣式尚未定義；做法先不評論，與 Math 卡片一併於外觀整理處理。 |
| 2026-10-07 | 新入口的 Math 卡片樣式很亂（人類實機觀察）。不是本階段重點；面板／外觀統一處理時一併整理（Q22：UI 美觀是產品品質，不可省略）。 |

## 未完成／未驗證

- **Human Takeover Test**：人類不靠 AI 完成一項維護（如新增 unary 節點），未執行。見 [B 案](REFACTOR_REACT_FLOW_PLAN_B.md#human-takeover-test)。
- **完整 TOE 冷啟動**：未驗證。
- **未遷移**：MAT／ISF、TOP texture／array／進階來源、舊 `expose` 旗標、Uniform 拖曳即時更新（目前放開才送值）、pixel preview session、Personal Library、離線 Sketch、阻尼、面板（待人類討論）。

## 程式目錄現況 ✅

| 目錄 | 身分 |
| --- | --- |
| `src/core-ts/` | **新核心**（TS）：節點模組、型別、接線、TOP compiler |
| `src/editor-react/` | **新正式 React 入口** |
| `src/editor/` | **舊前端入口**，仍服務未遷移能力；含 `build:core` 生成的 `wire_planning.js`、`editor-bootstrap.json`、`editor-library.json`（勿手改） |
| `src/core/` | 舊 Python 核心；部分仍由新 Manager 使用，見 [LEGACY-PYTHON](LEGACY-PYTHON.md)；新路徑不得 fallback 到舊 compiler |
| `src/td/runtime/` | 新宿主 Python（host_api、native_family、Manager 等） |
| `src/library/` | 內建子圖 Library 來源 |

## 現場 TD（使用前以 TD MCP 重新確認）

- 主組件 `/TD_Grape`；測試用 Grape TOP `/project1/Grape_TOP_React`（2026-10-07 已換成預設圖）
- 新入口 `http://127.0.0.1:65465/react-editor.html?target=3ffb8d81896943c8bf90bec56791a33b`
- `GrapeEditor` 的 `Use External Folder` **開啟**（2026-10-07 `DevMode()`，服務 Refactor.17）；提交 TOE 前先執行 `Deliver()`，見 AGENTS.md
- 開發 TOE：`src/td/TD-Grape-dev.toe`（TD 顯示 `.23.toe` 是遞增存檔的正常狀態）；未提交的修改是人類的，須保留。2026-10-07 已存 TOE：含 GrapeManager Legacy 分組、`/dev_tools`、Refactor.16 內嵌網頁
- 2026-10-07 TD MCP 確認 ✅：server 1.1.55／port 13316，TD 2025.32820
- 保護區：`/TD_Grape/IconGen → /TD_Grape/icon` 及其依賴
