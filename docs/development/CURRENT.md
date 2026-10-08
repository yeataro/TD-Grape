# 目前現況

最後更新：2026-10-09。每輪收尾時覆寫本頁；完整交付紀錄見 [STATUS](STATUS.md)。標 ✅ 者已用 git／測試核對。

## 做到哪裡

**路線：** [B 案](REFACTOR_REACT_FLOW_PLAN_B.md)——一次一條真實產品能力，正式 React UI、核心與 TD 同輪打通，逐步擴大到接管全產品後關閉舊入口。A 案（[REFACTOR_UI_UPDATES](REFACTOR_UI_UPDATES.md)）只留作比較。

**最新交付：Refactor.42**（2026-10-09）——Color Output 什麼都能接、自動補齊（Q46）；vUV.st 可直接接到輸出。下一件：貼圖輸入（next-rounds.md 第 3 項）。**Refactor.41**——TD 內建值 `td_value`（60 筆的表、TOP 可用 15 筆、面板一區）。來源的基礎三輪完成。**Refactor.40**——宣告＋引用宣告節點（全域常數）＋共用來源面板（固定右側）。下一件：TD 內建值 `td_value`（sources-foundation.md 第三輪）。**Refactor.39**——Ghost：看不懂的節點與接不上的線保留、標示、不參與產碼，開圖不再因此整張拒絕。下一件：宣告＋引用宣告節點（全域常數先），開工前要人類確認引用宣告節點與面板形式（`../work/in-place-refactor-design/sources-foundation.md`）。**Refactor.38**——在地化骨架＋回報：`tr()`／`localize()`、編輯器訊息全部改成代號＋英文原文、繁中語言檔、沒設定語言跟著瀏覽器、`ReportLog`、狀態列只顯示第一行。下一件照 workspace `work/in-place-refactor-design/next-rounds.md`：來源的基礎＋Ghost。**Refactor.37**——Grape 頁（Q45）：Open Editor（App 視窗）、Open in Browser、GLSL Parameters、Grape Editor Version、Generated TOP；服務沒開時先問。**人類驗收通過**。議題檔：workspace `work/in-place-refactor-design/grape-page.md`。**Refactor.36**——編輯服務的 port 被佔用時往後找空的，實際 port 顯示在參數頁與狀態列（為了在第二個 TD 測非根目錄）。**Refactor.35.1**——清掉主組件的舊 tag `sgrapeManager` 與 Remote Panel 失效的 `Targetop`。**Refactor.35**——排查舊的笨行為（一）：工具與測試一律用全域捷徑 `TDGrape` 找主組件，安裝 Manager 不再寫死測試 OP；非根目錄驗收待討論（`../work/refactor/dumb-behavior-audit.md`）。**Refactor.34**（2026-10-09）——GLSL 在 TD 編譯失敗時圖照存、Shader 停在上次成功版；編輯器如實顯示 TD 的編譯紀錄、不重送同一個失敗的程式；「TD 拒絕」改說「TD-Grape 拒絕」；`graph_meta` 改 `grape-meta-2`（GLSL 只存一次）；大小上限寫明理由。**Refactor.33.1**——預設圖「平面法線」改正為 (0.5, 0.5, 1.0)。**Refactor.33**（2026-10-09）——Grape OP 新結構，照人類樣板 `Grape_TOP_REF`：外層 `graph` 是圖的唯一正本、`graph_meta` 放證明與執行部分、`status` 在右上；範本四象限（程式／編輯器產生的內容／輸入與預設圖 `Samples`／Shader 與輸出）、英文說明框；值得注意的狀態與錯誤顯示在 TD 狀態列；Edit 用全域捷徑 `TDGrape` 找主組件；既有 4 個 Grape OP 已搬遷。**待人類看**。下一件：「排查舊的笨行為」案，之後完整 Grape 頁（Q45）。議題檔：workspace `work/in-place-refactor-design/grape-op-structure.md`。

**Refactor.32**（2026-10-08）——從 TD 選單（Tab）建立新格式的 Grape TOP：範本自帶預設圖與 GLSL，不需編輯服務；身分改成 Grape 頁唯讀參數 Grape ID，複製時自動換號（Q32 實作與量測）；Grape MAT 先從選單拿掉。**待人類實機驗收**。下一輪：完整 Grape 頁（Q45）。

**Refactor.31**（2026-10-08）——清殘留第 8 條：核心套件 `wire_planning.js` 改名 `grape_core.js`、拿掉 `GrapeWirePlanning`。**清理清單第 1–8 條全部完成。**

**Refactor.30**（2026-10-08）——清殘留第 6 條：刪核心的 `transact()`（直接改呼叫者的圖、繞過容量與結構關卡）；所有修改只剩 `GraphDocument.change()` 一條路。

**Refactor.29**（2026-10-08）——清殘留第 5 條：刪舊 Python 核心 `src/core/` 與只測它的測試、舊工具；`build:core` 不再替舊 Python 產生檔案；新舊產碼對照改用凍結快照。repo 裡的 Python 只剩新 TD 宿主、Remote Panel 與開發工具。

**Refactor.28**（2026-10-08）——清殘留第 4 條：刪舊產品留在 TD 的執行程式（`sgrape_runtime` 等 7 檔與其測試、Manager 內舊 Python DAT、測試 OP 的舊綁定與 storage）；`masters`／`family_callbacks` 暫留到「建立 Grape OP」那一輪；Manager 的 `sources` DAT 待人類手動刪（權限檢查擋下）。

**Refactor.27**（2026-10-08）——清殘留第 2、3 條（照 Q48，人類看過清單後同意）：刪 TD 舊協定（host_api 舊分支、NativeFamily、host_document、native_values、host_artifact、`InitializeFamily`、舊遠端預覽 `Preview`）與新舊區分（`?editor=next`、兩種 409、`grapeNextEditor` tag）；TD 一讀到舊格式的圖就拒絕、不開也不寫；Manager 不再載入 history、parameters、`editor-library.json`。**目前沒有建立 Grape OP 的方法**（舊的本來就建出新編輯器打不開的 OP），等新的建立功能（Q6、Q16）。

**前一輪：Refactor.26**（2026-10-08）——圖格式 grape-graph 1（Q44）：`format`＋`version` 識別、`subgraphs`／`structDefinitions`／`nodeType`、筆記搬到節點 `comment`、接線 id 必填且隨機、未知欄位與 `extensions` 原樣保留；編輯器不開舊格式與較新版本；測試 OP 已轉成新格式（舊→新對照表見 [GRAPH_FORMAT](../architecture/GRAPH_FORMAT.md)，轉換工具 `tools/dev/old_graph.cjs`）。前一版 **Refactor.25**（2026-10-08）——解除對舊入口的依賴並移除舊入口：核心產物在 `src/generated/`、新編輯器頁面為 `src/editor-react/index.html`（靜態檔在 `static/`）、產品版本只在 `src/version.json`；`src/editor/` 與只測舊入口的測試已刪。其後 `e50e656` 已刪 `tests/browser/` 的舊入口測試（212＋匯出工具）。尚未處理：舊 Python 核心與其測試、TD 端舊入口程式（見下方「進行中」）。前一版 **Refactor.24**（2026-10-08）——新編輯器成為唯一入口（Edit 與首頁都打開它）；舊入口停用，檔案先標記不刪（`src/editor/README.md` 列出仍在使用、要先搬走的共用檔案）。前一版 **Refactor.23**（2026-10-08）——Color Output 身分固定：核心結構規則（頂層剛好一個、子圖內不准有；刪除、複製、放進子圖都整筆拒絕；開圖不擋只警告），新增選單不提供、Delete 跳過並提示。refactor 裡的舊入口不再保證能用（看舊行為改開另一個 TD）。前一版 **Refactor.22**（2026-10-08）——Color Output 標題改綠（顏色系統第一步：`theme/dark.css`＋`colorGroup`）、框選碰到即選（右鍵拖／Shift＋左鍵拖、Shift 加選、RF 內建框選關閉）、從輸入拉到空白處斷線。前一版 **Refactor.21**（2026-10-08）——編輯時就檢查上限（核心單一關卡、開圖不擋只擋變大、狀態列警告）。前一版 **Refactor.20.1**（2026-10-08）——核心設定 `config.ts`（上限集中、約定寫在開頭，數值不變）。前一版 **Refactor.20**——路徑重建 A3：產碼指紋＋必跑的性質測試；純版面修改不產碼、TD 不做 GPU。待人類決定：Worker、結構共享、節點上限（需先實測子圖展開的大圖）。A2b（唯讀打開舊圖）延到 ghost 完成後。前一版 **Refactor.19**（2026-10-08）——路徑重建 A2a：新編輯器協定（TD 把圖當不透明文字、執行用部分成對套用、產碼失敗只送圖、Last Known Good、拿掉送出等待）；新舊 OP 以 TD tag `grapeNextEditor` 分流，測試 OP 已轉換。下一步 A2b（新編輯器唯讀打開舊圖），再 A3（指紋、Worker）。前一版 Refactor.18（A1：Editor／HostSync 拆分、產碼不等送出）。前一版 **Refactor.17.2**（2026-10-07）——補開放 Vector／Combine／Replace／Swizzle／Convert（舊圖最常見的節點），新增選單不再提供已淘汰的 `float`／`vec2`／`vec3`／`vec4`（仍能打開舊圖）。固定入口待討論。

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

## 進行中（2026-10-08 交接；換 session 從這裡接）

**主題：清除會限制新架構的舊架構殘留（人類的核心價值）。** 兩份工作文件（workspace，不在 git）：
- 盤查結果：`../work/refactor/legacy-audit-2026-10-08.md`（核心／新編輯器／TD 端／舊 Python 與測試、文件四區，含嚴重度）。
- 圖結構議事錄：`../work/in-place-refactor-design/graph-structure.md`——**決議 1–17 與待決 A–E 已全部定案（2026-10-08）**，已寫回 design-interview **Q44**（並更正 Q41 的程式／存檔名、GLOSSARY）。**格式本身已實作（Refactor.26）**；延後到各功能那一輪的：每種宣告 kind 由模組規定欄位與 `extensions` 外的警告（Uniform／貼圖）、內建值 kind、`defaultTexture`、公開參數名稱＋標籤、「是不是顏色」、子圖「攤平／函式」、作者與分類。**插隊（人類 2026-10-08）：先做舊產品需求盤點，再確認四類原則。** 盤點需求不是做法；文件只當索引，舊程式、舊產品操作、人類記憶才是依據，永不假設完整。檔案在 `../work/refactor/requirements-inventory/`（判斷標準 `criteria.md`）。**已完成：01 來源與 Uniform（134 條）、02 TD 宿主（117 條）**，寫回 design-interview **Q45**；**核心四區 03 節點與型別（92）、04 編輯指令（88）、05 子圖（54）、06 Stage（49）**，寫回 **Q46**（修改 Q41 子圖可放不用宣告的、Q44 子圖 Stage／target 改推算；子圖存檔名稱改 `subgraphId`／`sgrape.builtin.subgraph_*`；沒用的子圖定義刪掉；Math 與 Add 等都留；自動轉換只做不遺失資料的；Color Output 什麼都能接）。**畫面五區 07 節點外觀（48）、08 面板與版面（56）、09 新增選單與 Library（33）、10 匯入匯出（31）、11 設定語系圖示（42）也已完成**，寫回 **Q47**（低牽連的介面細節擱置到加回來時再定；Log 的「怎麼來」要早做；畫布暫不做成面板但狀態要能支援多份、編輯器同時持有多張圖；浮動面板自由擺放吸附邊緣；參數面板通用化）。03–11 的 C 類人類已逐條確認，補充寫在 Q47 後的「C 類確認時的修正」。**需求盤點全部 11 區完成；清殘留判斷規則已定（Q48）。清理清單第 2、3 條已做（Refactor.27）、第 4 條已做（Refactor.28）、第 5 條已做（Refactor.29）、第 6 條已做（Refactor.30）、第 7 條判為留、第 8 條已做（Refactor.31）。**清理清單全部完成。** Refactor.32 做了「建立 Grape OP＋身分」，Refactor.33 做了「Grape OP 新結構」（更新機制 Clone＋TDUpdater 方向已談、未實作）。「排查舊的笨行為」案子**已結案**（2026-10-09，Refactor.35–36；`../work/refactor/dumb-behavior-audit.md`；人類在空白專案把主組件放非根目錄跑完檢查清單，沒有問題）。之後：完整 Grape 頁（Q45：Open Editor 用 App 視窗、服務沒開時問、Open in Browser、GLSL Parameters、Grape Editor Version、Generated TOP）。**

**盤查最重要的發現：**
1. 新圖格式＝舊格式（`schemaVersion 1`），與 Q40 衝突 → 已由議事錄定案（Q44），待實作。
2. ~~沒有方法建立新格式的 Grape OP~~（Refactor.32 已做：從 TD 選單建立）。
3. **自訂參數頁（GrapeManager `parameters`）**：LEGACY-PYTHON 標「關閉舊入口前要先搬」，Refactor.24／25 關閉時漏看——目前無處可編輯 Grape OP 自訂參數。人類傾向：屬舊架構，之後照 Q41 重做，不搬舊的。重做時要守（Q44）：Grape 自動產生的參數（所有公開來源，含 MAT 貼圖）在這個頁面不能編輯或不能刪除。
4. ~~TD Manager 啟動仍強制載入舊 Python 模組…~~（Refactor.27–29 已處理）原記錄：TD Manager 啟動仍強制載入舊 Python 模組（history、parameters）與 `editor-library.json`；`test:core` 以舊 Python 編譯器當對照組；`build:core` 仍替舊 Python 寫 `node_catalog.json`／`frontend_capabilities.json`，且擋住刪 `float`／`vec2`…。
5. 新測試 OP 內仍有舊 `GrapeControls/parameter_links` 在跑、存著 `grapeV1DocumentBackup`。
6. 17 個長期失敗的 Python 測試全屬舊架構。約 20 份現行文件有已不正確的敘述（清單見盤查檔）。

**清殘留的判斷規則（人類 2026-10-08 定，design-interview Q48；取代原「甲乙丙丁四類」）**：每段殘留程式問兩題——形狀符合新架構嗎？產品現在需要嗎（從產品入口走得到才算）？符合＋需要→留不標；符合＋不需要→有決議或下一輪會用才留，否則刪；不符合＋需要→暫留，必須寫明「換成什麼、哪一輪換」；不符合＋不需要→刪。判斷不了放「待問」；以函式為單位；刪除前列清單等人類同意。另提議在暫留程式的註解加固定字樣（如 `LEGACY(暫留: 換成…, …輪)`）並把 LEGACY-PYTHON.md 擴成殘留地圖——人類未確認。人類的問題是問題、不是指示（記憶 questions-are-questions）。

**已排的清理清單**（第 1 條已做 `e50e656`；第 2 TD 舊協定、3 新舊區分機制已做 Refactor.27；4 舊產品 TD 執行程式已做 Refactor.28；5 舊 Python 核心與其測試已做 Refactor.29；6 GraphDocument 直接改原物件已做 Refactor.30；7 子圖操作照 Q48 重判為「留」（2026-10-08，不改程式；與 Q46 不一致的形狀列在下方「待處理」，出口：子圖那一輪）；其餘照 Q48 逐條判斷，一張表、只問一題，刪除前列清單）：4 舊產品 TD 執行程式、5 舊 Python 核心與其測試、6 GraphDocument 直接改原物件模式、7 子圖操作（原判乙類，留；照 Q48 重判）、8 舊名 `wire_planning`／`GrapeWirePlanning`（已做 Refactor.31）。

## 待處理

> **子圖那一輪開工時先改形狀（清理第 7 條，照 Q48 判「留」但形狀未對齊 Q46，2026-10-08）：** (1) 節點類型 `sgrape.function.call／input／output` → `sgrape.builtin.subgraph_call／input／output`，參數 `functionId` → `subgraphId`（Q46 7.7；目前沒有任何存檔含子圖，改名不需轉換）；(2) `SubgraphData.stages` 目前必填、`targets` 可存——Q46 定為由內容推算，只在存成定義時寫入；(3) 核心內部網路代號前綴 `function:`（不存檔）改名；(4) 每邊 16 個介面的上限寫在 `subgraph_interface.ts`、`subgraph_operations.ts`、`subgraphs.ts` 三處，搬進 `config.ts`（Q47 補充 8）。子圖程式本身（建立、群組、實例化、在地化、複製、刪除、產碼）都有呼叫者與測試，保留。

> **新舊框架的圖不共通（design-interview Q40）：** 不做轉換功能，舊圖之後由匯入器處理。tag 區分已於 Refactor.27 拿掉（TD 讀到舊格式即拒絕）；遷移期便利行為（下段）仍待移除。

> **遷移期便利行為，非產品行為（人類 2026-10-07）：** 新舊入口並存才有的功能——版本衝突覆寫、拒絕開圖的不支援說明與載入預設圖、返回舊入口——只是遷移途中方便測試，做最小可用即可，不寫進產品規格；安全底線（版本核對、不靜默丟資料）照守。舊入口關閉時移除。

**2026-10-07 晚的討論排出的隊（皆未動工；決策在 workspace `work/in-place-refactor-design/design-interview.md`）：**

- **A. 路徑重建（人類定：路徑需重新構建；設計見 design-interview Q38，2-1～2-5 已定）**：要點——修改完成即由圖判斷分流、不加停手等待；產碼指紋（分支鏈路）＋必跑性質測試；結果分兩包、送 TD 分「執行用（GLSL＋綁定，成對）／保存用（圖，可晚到）」；TD 不擁有圖的知識（圖為不透明字串，只做不看內容的校驗）；產碼搬進 Worker；同步器負責讀寫 TD；TD 保存最新圖＋Last Known Good 一組。原記錄：**產碼目前綁在送出裡**——`deliver()` 才呼叫 `compiler.compile`（session.ts:188-217），所以 TD 離線（送出被擋）時不產碼，GLSL 顯示與錯誤停在舊結果，產碼錯誤要等送出才看到，違反 Q28「編輯不等 TD」。成因：舊產品時代產碼在 TD（送出時顯示 material.compiling），新架構把產碼移到前端卻沿用「送出時產碼」的路徑。新路徑：修改完成（停手後）即產碼，結果（GLSL、目前問題＝狀態；回報＝事件）由編輯協調者分送；同步器只拿已產好的結果送 TD、送不出就排隊。現行完整路徑：transact→document.change（不產碼）→等 0.65 秒→flush/deliver→compile→state.glsl→applyRequest→host.call(apply, HTTP 20 秒逾時)→Editor Service 佇列→HostAPI.dispatch→NativeFamily.apply（核對版本與校驗→GPU 試編→設參數寫 pixel_shader→再驗 GPU→存圖；失敗全還原）→回覆→確認版本。`session.ts` 有七項權責，「與 TD 同步」約佔一半且改變理由不同（連線方式），建議拆成獨立單位（暫名 `HostSync`），其餘依角色改名（「session」聽起來像臨時狀態）。行為不變、測試照舊。建議排在 B 之前。
- **B. 在地化骨架＋回報（Q34、Q35）**：全專案「原文＋代號」`tr('代號','原文',參數)`、只打包不翻譯，顯示時才翻；節點文字只寫原文、代號由 `nodeText()` 推導；卡片預設全英文；翻譯檔跟著原文擁有者分開存放。回報 `report(等級, tr(...))`，來源等自動填，回報紀錄獨立模組，事件（紀錄）與狀態（目前錯誤）分開、程式不准依紀錄判斷。**回報紀錄要有畫面**：舊入口下方的浮動 Log 面板（狀態歷史，Q13）是遷移後要放回新編輯器的能力（人類 2026-10-08），由這個回報紀錄提供。
- **C. 互動小修補（Q33；修飾鍵最終定案見 Q39：完全對齊 TD 實測——Ctrl＋點擊切換、Shift＋點擊只加選、Shift＋框選加選、右鍵＋Ctrl 同右鍵；關掉 RF 內建框選，左右鍵框選都走自己的）**：**已做（Refactor.22）**：框選碰到即算、Shift 加選、Shift＋左鍵框選、RF 內建框選關閉、有接線的 input 拉到空白處斷線。**未做**：主要選取（Editor 記一個 ID、主次不同色、點空白全清、框選後不換人、需換時取第一個碰到的）、Shift＋單擊只加選、節點與接線不混選的其餘情況。
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
| 2026-10-09 | **【已處理 Refactor.34】GPU 編譯失敗時圖也沒存（與 Q38 原意不符）**：`next_family.apply` 在 TD 編譯失敗時整筆拒絕，Shader 停在最後成功版，但這次的圖也沒寫進 `graph`。Q38 原意是圖照存、只有 Shader 停在最後成功版。要改需編輯器配合（收到「GPU 失敗」後改送只含圖的請求，或 TD 回覆時已存圖），屬協定，做 Grape 頁或錯誤回報那一輪一起處理。機制：`apply` 先換 Shader、最後才存圖，GPU 失敗時 `raise` 跳出，存圖那步沒走到；原作者把整筆當成全有或全無，Q38 只要求執行部分成對。**訊息也要如實（人類 10-09）**：編輯器現在對所有 422 都顯示「TD 拒絕套用：…」——但 GPU 失敗時 TD 沒有拒絕，是 GLSL 編譯失敗；真正拒絕的是我們的宿主程式（格式、版本、ID、手改的圖）。修正後分開說：「GLSL 在 TD 編譯失敗：<原因>。圖已存到 TD，TD 繼續執行上次成功的 Shader」；宿主的拒絕寫「TD-Grape 拒絕：<原因>」，不說成 TD。 |
| 2026-10-09 | **警告對話框置中（人類：希望在畫面正中央；評估中）**：指「編輯服務沒有啟動，要啟動嗎？」那個對話框（`ui.messageBox`），不是 App 視窗——助手一開始誤解成 App 視窗，已更正。`ui.messageBox` 沒有位置參數。TD 官方的對話框元件 `op.TDResources.PopDialog` 預設也是開在滑鼠位置（其視窗 `justifyh`／`justifyv` = `mouse`，2025.33230 查得）。**人類 10-09 定：先不做。** 理由（人類）：要指定位置得先抓到焦點在哪個視窗／螢幕，抓錯就會開到錯的地方（「有時候會有錯誤」指的就是這個）；這也是 TD 原生開在滑鼠位置的原因。 |
| 2026-10-09 | **port 位移的憂慮（人類 10-09 筆記，待談）**：編輯服務 port 會自動往後移（Refactor.36）之後，使用者關掉 TD 再打開，原本開著的編輯器分頁（舊 port）還能不能把圖送到？人類要求先記下。**助手查程式（10-09）**：(1) TD 重開拿回同一個 port（平常情況，因為先試設定的 port）：舊分頁斷線期間顯示「連不到 TD」、修改留在瀏覽器；TD 回來先核對版本——TD 有存檔就續送，沒存檔（TD 回到舊版）就跳衝突讓人選，行為正確。(2) TD 換了 port：舊分頁一直連不到；修改還在該分頁，但草稿依 port（origin）分開存，從 TD 新開的分頁看不到，目前只能在舊分頁「下載草稿」。(3) 舊 port 被另一個 TD 拿走：請求帶 Grape ID，對方找不到就拒絕、不會寫錯；例外是同一個 TOE 同時開兩份（同 Grape ID）且版本剛好相同，可能寫進錯的那一份。可能的補法（未定）：編輯器記住連的是哪一個 TD（專案檔路徑＋程序），重連對不上就明講；提供「把這分頁的修改帶到新視窗」。**人類：先記著，做到連線那塊再處理。** |
| 2026-10-09 | **【已處理 Refactor.38】TD 編譯紀錄塞進狀態列太長**：GLSL 在 TD 編譯失敗時，編輯器狀態列顯示整段 TD 編譯紀錄，變成三行、把畫布往下推（Refactor.34 實測）。該放哪裡（錯誤面板、可展開的訊息）跟下一條一起在錯誤回報那一輪定。 |
| 2026-10-09 | **編輯器更新後，開著的舊分頁被說成「TD 的圖被改了」（人類截圖，Refactor.41 後）**：核心識別碼（catalogHash）隨每次改核心而變；舊分頁送出時 TD 回「Conflict: catalog changed; reload the editor」，`host_api.py` 只要訊息含 conflict 就回 409 `revision_conflict`，編輯器因此跳出「TD 的圖似乎被改了，選編輯端／TD 端」——**說錯了原因**，而且兩個選項都沒用（再讀一次時才發現「TD 的建置已變更」）。應分開：TD 對建置不同回自己的代號，編輯器說「TD-Grape 已更新，重新整理這一頁（未送出的修改會留成草稿）」，不出版本選擇。同一種「訊息要說出真正原因」的錯（記憶 messages-name-the-real-actor）。**人類 10-09：使用者很少撞到**（只在更新 TD-Grape 時剛好開著編輯器，或 port 位移後舊分頁連到別的版本），不丟資料、重新整理即可還原 → **併到連線那一塊處理**，不插隊。 |
| 2026-10-09 | **【已處理 Refactor.42】Color Output 還沒照 Q46「什麼都能接、自動補齊」**：`vUV.st`（vec2）、vec3 接不上 Color Output；float 現在補成 `vec4(v)`（Q46 定為 (v,v,v,1)，vec2→(x,y,0.5,1)、vec3→(r,g,b,1)）。Q46 已定、不是新能力；Refactor.41 時發現，用 TD 內建值最先會撞到。 |
| 2026-10-09 | **TD 編譯錯誤指回節點（先記下，人類 10-09）**：GLSL 在 TD 編譯失敗時，原因取自試編譯用 GLSL TOP 的 Info DAT（行號是產生出來的 GLSL 的行號，使用者不知道是哪個節點）。要指回節點需要「GLSL 行號 → 節點」對照。**人類方向：只在編譯失敗時才觸發**，不要每次產碼都做（平常執行會耗額外效能）。可能做法（未定）：TD 只回行號與訊息（TD 不懂圖，Q38）；編輯器手上有圖與產碼器，失敗時才重產一次帶對照的版本來查。新架構目前有沒有對照、做到哪裡，未查。錯誤回報那一輪處理。 |
| 2026-10-09 | **驗證注意**：TD 2025.33230 的 `TOP.sample()` 在浮點格式（16／32-bit float）把 R 當 alpha 回傳；讀 Grape OP 輸出像素改用 `numpyArray()`。TD 的 bug，記在 workspace `work/refactor/td-issues/top-sample-float-alpha.md`，人類決定何時回報。 |
| 2026-10-08 | **【後續版本／發布後】節點實作改版時，舊圖的產碼會悄悄改變（現在不處理；人類 10-08 概念 review）。** 出處：最早規格 legacy `docs/specs/shader-graph-handoff-v2.md`（09-12）節點身分分兩層 uuid／revisionHash；人類 09-10 決定（legacy `docs/architecture/UPGRADE_POLICY.md`）「先提示差異，確認後才升級；確認前保留上次成功輸出」；舊實作（bootstrap 的 `revisionHash`、`node_catalog.json`）已於 Refactor.29 拿掉，需求還在、要在新架構重做。已談方向：概念身分沿用 `nodeType`；每個節點模組自帶整數版本號、手動 +1；輸出變動由**測試**偵測（不放建置期；目前沒有涵蓋全部節點的輸出指紋，屆時新做）；圖頂層記「用到的節點類型→版本」；參數轉換由節點模組自己提供；圖比編輯器新的節點版本→Ghost、不寫回；確認前 TD 跑 Last Known Good（Q38）。**未定**：尚未確認升級時編輯其他節點，會讓舊節點跟著用新實作產碼——保留舊實作（舊規格做法）還是先擋住，做的時候再談。參考：Houdini HDA（大改版版本進名字、小改版就地同步）、Unity `FormerlySerializedAs`（只管改名、漏寫悄悄丟、沒有資料版本號）。 |
| 2026-10-08 | ~~**清理第 5 條發現、待人類判斷**~~ **人類 2026-10-08 定：保留現在的樣式，不回舊樣式**（現在的才是正確行為，且暫不影響體驗）。原記錄：integration `test_math_module_migration` 與 legacy 對照時，產生的 GLSL 註解不同——legacy 把節點註解寫在同一行（`float sg_n_fold = (1.0 + 2.0); // Fold`），現在寫成下一行 `// Comment: Fold`，另一個註解反而少了 `Comment:` 前綴。自 Refactor.26（筆記搬到節點 `comment`）起；是否要回到舊樣式由人類決定。 |
| 2026-10-08 | **Refactor.26 收尾時記下、未處理（不在 Q44 範圍，需人類決定或屬清殘留）**：(1) 節點目錄（catalog）的 `definitionUuid` 欄位名未改——`build:core` 仍替舊 Python 寫 `node_catalog.json`，與清理清單第 5 條一起處理；(2) 核心內部的網路 id 仍叫 `'function:'+id`（不存檔），而陣列長度引用的 `sg_extent_` 代號內含 `fn_` 前綴**會存進圖**——已定：做陣列那一輪改成有結構的引用（graph-structure 議事錄；Q46 確認不另問）；~~(3) 編輯器「不支援」訊息仍寫「請使用舊入口」~~（Refactor.27 已改）；~~(4) `InitializeFamily` 走舊 NativeFamily 路徑~~（Refactor.27 已刪）；(5) TD MCP 的 `view_operator` 在 `src/td/.claude/cache/` 留下快取圖檔（未追蹤、未提交）；(6) 「節點實作改版時舊圖產碼會悄悄改變」→ 已獨立成上方「【後續版本／發布後】」一條（10-08 概念 review）。 |
| 2026-10-08 | **產碼器的節點上限（繼承自舊產品，不是產品最終上限）**：上限源自舊 Python 核心（`sgrape_core.py:2156`，每張網路 >256 節點或 >1024 線即「Graph is too large」），Refactor.7 照搬到 TS。**每張網路分開算**：各 stage、各子圖內部各 256；子圖在外層只算 1 個節點；有子圖時先展開再產碼，展開後上限 2048（`createCompiler` 的子圖路徑）。**更正**：Refactor.20 記錄寫「1000 節點無法產碼」是調查不完整（只量了無子圖的路徑），有子圖時可達 2048。產碼成本隨**展開後**大小成長（攤平產碼約每 100 節點 1 ms，2048 節點推估 16 ms 以上；展開本身未量），故畫面上的小圖可能是大圖成本。**人類方向**：現在的上限不是產品最後要的；可以設上限，但不會是這樣子——上限與 Worker、結構共享待「子圖展開的大圖」實測後一起決定。粗估（2026-10-08）：一般節點約 280～350 bytes，512 KB 約 1500～1800 節點，256 節點約 70～90 KB——先撞到的是節點數；長 Notes、GLSL Code 節點會讓單節點變大；子圖重度展開時較可能先撞 GLSL 的 512 KB。**人類：目前先維持 256。** 人類指出：若 256 是為了 TD 而避開，它就是沒有意義的值——256 節點遠小於 512 KB；推測原因是舊產品由 TD 端 Python 核心處理整張圖，新架構 TD 已不讀懂圖（Refactor.19），此理由不存在。**256 目前沒有依據，只是暫時的安全網**；真正上限應依新架構下真實存在的限制（編輯手感、GPU 編譯時間、GLSL 大小）實測後訂。**config 整理（人類）：等以後真的用得到再說**，做著做著可能就會用到。〔同日人類改定：數字散落不能接受，現在就做——已建 `src/core-ts/config.ts`（Refactor.20.1），開頭寫明約定；數字仍為 256 等舊值。〕 上限散落 5～6 處（top_compiler、subgraph_compiler、subgraph_operations、舊 Python；2048 寫兩次；512 KB 核心與 TD 各寫），整理方向：核心 `config.ts` 只放核心內至少兩處共用、開發者定死的值；元件建立時接收設定（測試可傳自己的、不改檔案）；跨編輯器↔TD 的值（512 KB）由 TD 告知編輯器、不兩邊各寫；只有一處用的值留原地（如 Math 的 32）。config（開發者定死）與 settings（使用者可改）分開。〔2026-10-09 補（Refactor.34）：**512,000 的來歷**——最早的 0.1 版（2026-09-09）就同時用在圖、匯入檔、匯出、TD 網頁服務的請求上限，文件沒寫理由；不是瀏覽器儲存的上限（當時直接用內建 `sessionStorage`，上限約 5 MB）；推測（無證據）原是請求上限、圖跟著設成一樣。**GLSL 上限不是 TD 的**：舊產品沒有，2026-10-04 第一個 TD 端接收程式照抄圖的數字；實測 TD 能編 2 MB。**現在寫下的理由（實測）**：TD 主執行緒處理每次編輯約每 MB 3.3 ms；實際 GLSL 程式碼編譯約每 KB 2.2 ms、送出一次編兩次——GLSL 的 512 KB 可能卡數秒，偏寬鬆，子圖展開實測時重訂。人類：很難碰到，數字先不動，但要有理由。〕 |
| 2026-10-08 | **【已處理 Refactor.21】** **編輯時不檢查節點上限**：GraphDocument 新增節點時不看上限，使用者可一直加到超過，直到產碼才失敗（「outside the selected frontend compiler capability」），事先沒有提醒——編輯與產碼對上限的認知沒對齊。方向：一個數字（`core-ts/config.ts`）、多個檢查點，編輯時就能提早告知「快到上限」。屬新行為，做之前與人類確認。 |
| 2026-10-08 | **子圖定義數上限（64）沒有依據**：舊產品文件自承「這些是現有程式的限制，不是 GLSL 或 GPU 的標準上限」（LOOPS_DISCUSSION.md:100）；它想擋的（產碼成本、文件大小）已被展開後節點數與 512 KB 擋住。助手建議拿掉；人類：先留著，之後再說（改 config 一處即可）。 |
| 2026-10-07 | **程式中「graph」一字多義（命名整理待辦）**：`core-ts/model.ts` 型別 `Graph` 指整份圖文件，子圖資料的 `graph` 欄位與各處 graph 又指單一網路；應以不同字區分（如 `document`／`network`）。違反 GLOSSARY 命名對齊原則；連同 `groupSubgraph`（意為包成子圖，與 Group 撞名）等一起整理。 |
| 2026-10-07 | **決策文件的存放位置（人類暫不決定）**：design-interview、target-architecture 等在 workspace（不在 git，Q17 定到重構收尾再整理），今天新增 Q33–Q40 後風險變大：無版本紀錄、不與 commit 連結、別的環境（換電腦、雲端 agent）讀不到、單檔近千行難讀。曾提：僅在 `work/in-place-refactor-design/`（492 KB、18 檔）做本機 git、不設遠端不 push；精簡決策寫進 repo（repo 公開，原始討論一律不進）。人類顧慮：Dropbox 同步 `.git`、日後想轉雲端會有問題——先不動。 |
| 2026-10-07 | **新入口沒有 Shader 選單（舊能力漏接）**：舊產品標題列 `#shaderpicker` 列出 TD 內所有 Grape OP，選取後 `location.assign('/shader/<id>/')` 整頁換網址，有未送出修改先確認（legacy `app.js:679-705`）。換網址＝重新向 TD 讀圖、Undo／選取消失，TD 最小化時打不開；替代為多開分頁，或日後同頁多 session。可與 Q32 的 Grape OP 清單一起考慮。 |
| 2026-10-07 | **【已處理 Refactor.38（介面文字；節點文字另排）】新入口介面文字寫死（越晚越貴）**：`src/editor-react/`（`session.ts`、`main.tsx` 等）的提示與按鈕文字直接寫中文。舊產品已有 `src/editor/locales.json`（預設 `en`；繁中／英／日／法／韓；1,617 則訊息、`technicalTerms`）與 `t()`。人類要求 localization 做得越乾淨越好，文字應放在 JSON 之類的資料檔，不寫死在程式。**人類定：英文為首選；缺翻譯一律回退英文**（舊 `t()` 已是「所選語言 → 預設 en → 訊息代號」；但 `languages` 清單順序是繁中在前，要改成英文在前）。**方向已定（design-interview Q34）**：代號式、格式對齊 React 慣例（一語言一 JSON）、核心只送代號；現在起以最小規模維護。最小骨架已提案，人類要求先記下、之後一起動手。 |
| 2026-10-07 | 衝突時選「TD 端」後的編輯端版本，目前只能以 Undo 叫回（人類選 A），重新整理頁面即失；持久保存需多版本快照，人類判斷目前太大。 |
| 2026-10-07 | 現有草稿機制每個 Grape OP 只存一份（sessionStorage，關分頁即失）；「找到先前草稿」提示出現時畫布被鎖住，違反「編輯不等 TD」。 |
| 2026-10-07 | 被擋在「無法在此入口開啟」畫面時，瀏覽器內未送出的草稿無法取回（遷移期人類接受）。 |
| 2026-10-07 | 沒有對應 Grape OP 時也能先寫草稿——屬之後部署到網路（可能另開倉庫）的議題，先不做。 |
| 2026-10-07 | 舊編輯器匯入草稿用的 `POST inspect` 新 Manager 未提供（已斷）。 |
| 2026-10-07 | **【已做 Refactor.39】【已定 2026-10-07：ghost wire，見 design-interview Q37 1-3】** **改型別後變不合法的線怎麼處理**：舊產品自動拔線（同一次 Undo，開發設定可關）；新編輯器目前留紅線、產碼失敗、TD 保留上次成功結果；人類構想「留紅線當參考、產碼時當作斷開」——類似已確認意圖「缺失節點與線保留可見但不參與運算」，但斷開後輸入用什麼值、使用者是否察覺結果改變等邏輯未想通。紅線由核心 `edge.connection().valid` 判斷、projection 決定顏色，RF 只負責畫。 |
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
- **未遷移**：MAT／ISF、TOP texture／array／進階來源、舊 `expose` 旗標、Uniform 拖曳即時更新（目前放開才送值——**這是遷移中的妥協，不是新產品行為**（人類 2026-10-08）；目標是拖著 TD 就跟著變，同舊產品，做法見 Q41 即時通道）、pixel preview session、Personal Library、離線 Sketch、阻尼、面板（待人類討論）。

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

- 主組件 `/TD_Grape`（全域捷徑 `TDGrape`，程式一律用捷徑找）；Grape OP 只剩兩個（2026-10-09 人類同意清理）：`/project1/Grape_TOP_test`（rev 596，以新範本重建、圖／Shader／Grape ID 照搬）、人類的樣板 `Grape_TOP_REF`、`Grape_TOP1`（人類 2026-10-09 用 Tab 選單從 Refactor.33 範本建立——「人類實際用 Tab 選單建立」這項已有人做過；Refactor.34 時隨其他 OP 轉成 `grape-meta-2`）。`Grape_TOP2`、`Grape_TOP3`（預設圖）與舊格式樣本已刪；舊樣本的圖、舊信封與 `.tox` 留在 workspace `work/refactor/grape-op-round/cleanup-33/`，給日後匯入器用；舊格式樣本已移到 workspace（見上）
- 編輯網址 `http://127.0.0.1:65465/shader/3ffb8d81896943c8bf90bec56791a33b/`；測試 OP 的圖已是 grape-graph 1（Refactor.26，revision 571）
- `GrapeEditor` 為**內嵌**（2026-10-09 `Deliver()`，服務 Refactor.42，存 TD-Grape-dev.74；TD 2025.33230）；開發前先 `DevMode()`，提交 TOE 前 `Deliver()`，見 AGENTS.md
- 開發 TOE：`src/td/TD-Grape-dev.toe`（TD 顯示 `.23.toe` 是遞增存檔的正常狀態）；未提交的修改是人類的，須保留。2026-10-07 已存 TOE：含 GrapeManager Legacy 分組、`/dev_tools`、Refactor.16 內嵌網頁
- 2026-10-07 TD MCP 確認 ✅：server 1.1.55／port 13316，TD 2025.32820
- 保護區：`/TD_Grape/IconGen → /TD_Grape/icon` 及其依賴
