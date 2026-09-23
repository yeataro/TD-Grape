# 待辦與未實作功能盤點（0.8.213）

2026-09-23，基準 `bf4e7fb`。依最新交付紀錄、目前程式與既有筆記核對，取代 [9 月 21 日盤點](TODO_AUDIT_2026-09-21.md)作為目前索引。本文是調查，不代表把所有項目排入 Preview 或授權立即實作。節點分類另見 [目前分類整理](NODE_CLASSIFICATION_2026-09-23.md)。

狀態分成：**未實作**（有明確缺口）、**部分完成**（已有功能但範圍不足）、**已知問題／待重現**、**待設計／候選**、**重構後／排除**。舊文件寫「尚未完成」不等於目前仍缺；測試通過也不等於所有場景完成。

## 目前最直接的未完成工作

| ID | 狀態 | 項目與界線 | 依據 |
| --- | --- | --- | --- |
| A01 | 未實作 | **Sampler 從 Sources 拖入自訂參數浮窗**。`customSourceAllowed()` 仍僅接受數值 Uniform／Spec Constant。舊 Sampler Expose／TOP 路徑控制已有基礎，不能說全部後端從零開始；新拖入流程、移動／刪除／歷程與說明仍須接通。多維取樣節點存在不代表可建立同維度的原生綁定。 | [參數編輯器](../features/CUSTOM_PARAMETER_EDITOR.md)、`src/editor/inspector.js`、[Sampler Expose](../features/SAMPLER_EXPOSE.md) |
| A02 | 調查尚未完成 | **完整 GLSL 內建函式／overload／方法覆蓋表**。0.8.164／166 已補大量數學、位元、微分與取樣能力，不能沿用早期「都缺」清單；仍需以目標 GLSL／TD／Stage／資源型別逐項核對。這次只確認此待辦及現有 catalog，沒有冒稱完成標準逐條稽核。 | [補齊紀錄](../features/LEGACY_COMPLETION.md)、[Alpha 範圍](ALPHA_SCOPE_2026-09-21.md) |
| A03 | 已證實分類落差 | **節點分類投影與擴充後分類整理**。Math／Switch／Generated GLSL／Attribute 未同步分類投影；Math 集中過多取樣、光照、幾何等功能。 | [本輪分類與 CSV](NODE_CLASSIFICATION_2026-09-23.md) |
| A04 | 部分完成 | **原生 Phong／PBR 完整能力與可編修預置圖**。0.8.175 基本版本已交付；法線圖、視差／遮蔽步進、位移、各貼圖槽、Rim、角度 Alpha、多貼圖、輔助輸出與交互組合等仍未全數完成。另需使用者可操作的完整示例場景。 | [原生等價清單](../features/MAT_NATIVE_PARITY.md)、[原生函式清單](../features/MAT_NATIVE_FUNCTIONS.md) |
| A05 | 部分完成 | **資源建立／綁定／取樣設定**。具名 sampler 的原生管理仍以 2D 為主；3D／Cube／Array 等取樣入口不等於對應綁定管理完整。Filter／Extend／Anisotropy 的介面與 Apply 保留、實例貼圖有效場景仍需整理。 | [MAT 等價清單](../features/MAT_NATIVE_PARITY.md)、[來源計畫](SOURCE_COMPLETION_PLAN.md) |
| A06 | 未完成／需補驗 | **MAT Attribute 後續**：指定其他 vertexIndex 的讀取；缺少 Attribute 的不同幾何情境；多攝影機、完整 Instancing／陰影／Fog 等。具名 Texture Attribute、Current Instance UV 及跨 Stage 介面已完成，不重列缺口。 | [補齊紀錄](../features/LEGACY_COMPLETION.md)、[來源計畫](SOURCE_COMPLETION_PLAN.md) |
| A07 | 部分完成 | **Help 語意與官方章節完整性稽核**。選中來源的專屬 Help、函式簽名與連結已有交付；逐項語意、overload 限制與錨點仍需全面審查。 | [補齊紀錄](../features/LEGACY_COMPLETION.md) |
| A08 | 未實作 | **多選 Help** 應顯示可用的多選操作；**排列分割按鈕** 可重複上次操作，跨次記憶待決；**Uniform 引用自動命名可讀性** 依來源名與唯一尾碼改善，保留中間變數及使用者名稱。三項可各自獨立處理。 | [UX 筆記](UX_BACKLOG.md)，舊 W02–W04 |
| A09 | 延後／待設計 | **GLSL OP 狀態卡**、UV 數字顯示節點、完整 **Switch Case**。目前 Switch 已有連續 Case＋Default；不是一般控制流／任意 Case 條件設計已完成。 | [UX 筆記](UX_BACKLOG.md)、[Switch](../features/SWITCH.md)、[節點流程](NODE_WORKFLOW_ROUND.md) |

## 已知問題與待驗證事項

| ID | 項目 | 目前判定／下一步 |
| --- | --- | --- |
| K01 | Swizzle 的分量操作依靠參數面板 | 已知操作一致性問題；替代互動尚未定案。不混為 Switch。見 [UX](UX_BACKLOG.md)。 |
| K02 | 個人／此 Shader 的 Subgraph 分類無編輯入口 | 保留已知問題；增加更明確的個人庫保存入口仍在筆記。個人項目刪除由資料夾處理，目前沒有新增刪除 UI 的需求。 |
| K03 | 移除最後引用後，This Shader 仍留 Subgraph 定義 | 已知資源管理限制；目前沒有要求自動清理或新增刪除功能。Stage 篩選已有，不能將同一 Shader 視為所有 Stage 通用。 |
| K04 | OP Parameter 結構修改後刷新操作清單 | 已知 UI 更新問題，非數值寫入錯誤；Default／Range 已縮小更新範圍，頁面增刪／排序／Label 仍可能重建。見 [參數編輯器](../features/CUSTOM_PARAMETER_EDITOR.md)。 |
| K05 | Slider 右鍵框選放開誤開選單 | 舊 B01 仍待重現；目前數值編輯器仍由 contextmenu 開啟預設選單。本次靜態確認路徑，未重新操作證明每種情境。 |
| K06 | Array 長度 Escape／失焦與共用數值草稿不一致 | 舊 B03 的共用調查待審；重新重現後小範圍修正，不將整份 UI 共用提案直接開工。見 [元件調查](UI_COMPONENT_REUSE_AUDIT.md)。 |
| K07 | 預覽暫時 Lock 期間保存 TOE | `src/remote_panel/runtime.py` 仍有暫時 Lock；需針對保存／重開窗口驗證。Cache TOP 或使用者自製 Viewer 為方向，尚未取代現況。見 [預覽筆記](PREVIEW_UI_NOTES.md)。 |
| K08 | 偶發卡頓／RAF 與 DevTools 指標差異 | 待可重現 trace；不能先歸因整圖同步或 GPU。預覽調大小延遲也需分段量測。 |
| K09 | HTTP 報無回應但即時數值仍可操作 | 待重現與連線證據分類，不直接判定 TD 全部失聯。 |
| K10 | 淺色與觸控零散問題 | OP Parameter／浮窗淺色已修；其餘舊 Sources／Expression／Structure 外觀需重新 review。iOS focus／縮放／Ladder 定位與 Mac／Safari 真機仍待；使用者已要求觸控集中另輪排查。 |
| K11 | 原生 OP Create Dialog 說明與 TDFam 的關係 | 舊 B11 暫緩，未確證因果。 |
| K12 | 舊瀏覽器測試 fixture／隱藏入口假設 | 若干測試仍依賴過時 fixture 或布局；最新專項通過不能等於所有歷史腳本已維護完。見 [測試紀錄](../development/TESTING.md)。 |

K05–K11 沿用既有未結案筆記，本次未重新做原生／跨裝置重現。詳見 [舊待辦 B01–B11](TODO_AUDIT_2026-09-21.md)。

## 仍保留的候選、能力邊界與延後工作

- **來源與即時編輯**：來源列表結構變動後的局部 metadata 恢復（舊 W01）；Matrix／Array 原生即時值、通用 Parameter 按需訂閱；POffset、Primitive ID／Sample Mask 等來源仍須重新按 catalog 與宿主核對，不能照舊 CSV 數量直接新增。來源完整管理與即時值是不同工作。
- **編輯操作**：插入既有接線、Group-aware 排列、選取真正參與產碼節點、解開 Subgraph、局部複製 Auto 節點的型別保留／提示、Convert 自動化政策。均有候選或待設計部分，保留型別及原圖保護。
- **UI 設計**：英文文案舊 63 項候選需按現況再 review、通用 Binding／選單元件共用、StrMenu 自由文字＋候選、Double 入口可見性、Glow／亮度分離、初始網址旗標、狀態列收納。舊筆記數量不是本版缺陷數。
- **預覽與原生工作區**：節點中間結果／Canvas Backdrop、自製 Viewer 接入、Window COMP 前後順序、多來源預覽、TD Pane 內嵌 Editor、原生 OP／Parameter 跨程序拖入、無 Shader 啟動入口。外部獨立 app-window 與目前 WebRTC 預覽不等於 Pane 內嵌已做。
- **同步與保存**：磁碟工作圖快取、project UUID／Save As、增量同步／checkpoint、同 GLSL 略過編譯、跨刷新完整歷程、TD 全域 Undo、來源版本升級及雲端衝突。以實測與責任邊界決定，不因本次盤點啟動重構。
- **可攜與發布**：圖封存包含相依實作／資產、打包／安裝、可讀升級紀錄、Mac／實體 iPad 驗收、Preview 範圍裁定。現有 JSON／PNG 與保存 TOE 已可用。
- **Loop／自訂碼擴充**：Loop 子圖、Break／Discard／Return 作用域、一般 SSBO／執行期陣列、完整作者定義介面待設計；現有 GLSL Code 與 TDLoop 數值 helper 不代表這些完成。
- **遠期構想**：Online／PWA 配對、瀏覽器執行圖、ISF、GPU texture sharing。僅保留候選，不列為此次或必然的 Preview 阻擋。

以上沿用 [舊盤點 W／D 項](TODO_AUDIT_2026-09-21.md)及 [UX](UX_BACKLOG.md)；較新決定優先。

## 重構後的未來功能與明確排除

- **節點本身的程式碼／算式預覽、GLSL 行號與節點雙向高亮**：使用者指定重構後再做。Math 現有註記只是運算元關係文字；編譯錯誤已有部分節點定位，也不等於任意程式碼雙向互動完成。
- **Link 視覺略過 Router**：最新設計已取消，不列為漏做。Router 是實際保存的節點，前後線段各自保留 Wire／Link。
- **Picking、Compute／其他 Stage、Image 寫入**：未因補齊數值函式而取得實作範圍。Picking 可行性可再評估，目前依既有排除裁定。
- **10 個 TD Quaternion／矩陣函式**：目標 TD 2025.32820 的既有原生 probe 失敗，列宿主版本／簽名界線，不冒充只差 UI。詳見 [補齊紀錄](../features/LEGACY_COMPLETION.md)與 [版本查核](TD_NATIVE_VERSION_REVIEW_2026-09-23.md)。
- 原生 double／uint 傳輸精度、Attribute Array Size、特化長度等限制按 [來源精度](TD_SOURCE_PRECISION_REVIEW.md)及 [TD Array](../features/TD_ARRAY_SOURCES.md)保留；不能靠分類調整宣稱解除。

## 不再列為未完成的舊筆記

| 舊待辦 | 目前狀態 |
| --- | --- |
| TD 函式「缺 87 個入口」／Noise Deriv 等全缺 | 歷史數字；0.8.164–174 已大量交付。精確剩餘覆蓋另做 A02，不能重用 0.8.163 缺口總數。 |
| Built-in Source 只有通用 Help | 已有選中來源的專屬說明／連結；全面語意審查仍是 A07。 |
| Sources 改名、搜尋分行、分類排序、常數控制、緊湊卡片、POP 分類 | 0.8.176–179／200 已交付；分類改拖曳、預設折疊。 |
| 自訂參數還在側邊新增／只有 Uniform 能用 | 0.8.197–200 已提供非模態浮窗、數值 Uniform＋Spec Constant、排序、獨立歷程、Range／Clamp、原生修改保護與可讀名稱；Sampler 新拖入仍未完成。 |
| 自訂參數刪除後 cooking 問題完全未處理 | 0.8.198 已修 Bind 解除順序並通過原生刪除／cook 檢查；不宣稱已重現原回報的每一種情境。 |
| 瀏覽器偏好無法重設 | 0.8.199 已提供範圍明確的重設入口，保留草稿與 TD 資料。 |
| Link 樣式、導航箭頭、多端 tooltip、顯示選項 | 0.8.180 起分批交付至 210；Router 間距與拖曳 213 補完。 |
| Group 標題需在線上方、Ctrl／Shift 多選 Node／Group／Wire | 0.8.196 已交付，Shift 框選保留；觸控另輪。 |
| Generated GLSL 節點／面板 | 已交付，節點每畫布最多一個；與重構後逐節點程式碼預覽分開。 |
| Subgraph 誤稱 Function、Library 此專案區塊、重複操作入口 | 0.8.201–203 已修文案及整理入口／分頁；分類編輯與定義保留另列 K02／K03。 |
| Switch、連加連乘 Math、Router | 0.8.204–213 已實作；Math 註記、待新增接孔與 Router 移動／間距已有後續 review。 |
| Frame／平移阻尼預設未開 | 現行 `EDITOR_DEV_DEFAULTS` 已開啟；舊 D05 的關閉敘述過時。 |
| MAT 完全沒有跨 Stage 或 Texture Attribute | 動態 Stage 介面、具名 Texture Attribute 與 Current Instance UV 已交付；完整實際場景仍有 A06 邊界。 |

## 建議後續順序

1. 先 review 本輪分類：修復投影漏項，再定功能分類的搬移範圍。
2. 完成最近明確留下的 Sampler 拖入控制；同步驗證移動、刪除、Undo／外部 TD 編輯與 Help。
3. GLSL 能力逐項盤點，分開「已有入口」「缺 overload」「缺資源管理」「宿主不支援」，再選 Preview 必要能力。
4. 將 Swizzle／資產分類等 UI 項與材質等價大項分批；觸控／跨平台驗收另排，避免用一次大重構混做。

這是依相依性提出的順序，不取代使用者後續優先決定。

## 本次驗證界線

已核對目前 catalog、分類投影、來源拖入白名單、來源分類建構及相應版本交付。使用隔離 Chromium 讀取三個 Target／Stage 的實際入口分類；沒有改動產品程式、使用者圖、TD 狀態或 TOE，也沒有重新跑所有舊問題。私人核對資料在 reports/audit-213/。下一專案草稿只保留遠期背景，不把其中候選架構當作本專案未交付承諾。
