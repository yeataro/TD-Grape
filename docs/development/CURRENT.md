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

> **遷移期便利行為，非產品行為（人類 2026-10-07）：** 新舊入口並存才有的功能——版本衝突覆寫、拒絕開圖的不支援說明與載入預設圖、返回舊入口——只是遷移途中方便測試，做最小可用即可，不寫進產品規格；安全底線（版本核對、不靜默丟資料）照守。舊入口關閉時移除。

1. **【重中之重】純版面修改不觸發產碼（人類 2026-10-07）**：可節省大量 TD 效能，屬協定、越晚越貴。現況與舊產品做法見 [LEGACY-GAPS](LEGACY-GAPS.md) 第一批 #1；Router「不觸發產碼」建立在此之上。
2. **Uniform 支援（需人類決策，下次以 grilling 互相拷問後才動工）：** 牽涉宣告、TD 原生參數與綁定，不只節點本身，**不可當成小切片直接做**。2026-10-07 盤點：
   - **TS 新核心已有**：Uniform 節點模組（引用宣告、輸出其值）、compiler 產生 `uniform` 宣告與綁定清單、宣告名稱／型別／值檢查；只支援一般數值與顏色（`nativeSequence` vec／color）。
   - **仍在舊 Python（新 Manager 使用中，GrapeManager 黃框）**：宣告新增／改名／刪除（`sgrape_sources.edit`）、建立與同步 TD 原生參數（`configure`）、改值（`write_value`）、原生值 Undo（`sgrape_history`）、原生參數遺失偵測。
   - **完全沒有**：React 的 Values 面板與 Uniform 節點選擇宣告的 UI；時間等預設驅動、陣列、矩陣、Attribute、POP Buffer、Spec Constant；拖曳即時更新。
   - **待決策**：(1) 宣告管理放哪——依 Q29「誰需要」，宣告屬作品→核心，建立原生參數只有 TD 能做→宿主，目前兩者混在 `sgrape_sources.py`；(2) 新入口的 Values 面板與節點選單；(3) 支援範圍先做數值／顏色，或一次對齊舊產品。
3. **固定入口（討論中，未實作）**：新增清單直接提供「vec2」等 16 個固定型別（同 Vector／Scalar 模組 + `fixedType`），卡片顯示固定名稱、鎖定時不顯示型別選單。入口清單該放哪裡（舊產品寫在畫面程式）待定。
4. **下一切片候選：** 其他舊產品功能（Q29：舊產品是功能基準，不是模仿對象）。
5. **Legacy 盤點續作：** `src/core/` 其餘 6 檔與 TOE 內其他 Python（見 [LEGACY-PYTHON](LEGACY-PYTHON.md)「尚未整理」）。

## 已發現、尚未處理

| 發現日 | 情況 |
| --- | --- |
| 2026-10-07 | 衝突時選「TD 端」後的編輯端版本，目前只能以 Undo 叫回（人類選 A），重新整理頁面即失；持久保存需多版本快照，人類判斷目前太大。 |
| 2026-10-07 | 現有草稿機制每個 Grape OP 只存一份（sessionStorage，關分頁即失）；「找到先前草稿」提示出現時畫布被鎖住，違反「編輯不等 TD」。 |
| 2026-10-07 | 被擋在「無法在此入口開啟」畫面時，瀏覽器內未送出的草稿無法取回（遷移期人類接受）。 |
| 2026-10-07 | 沒有對應 Grape OP 時也能先寫草稿——屬之後部署到網路（可能另開倉庫）的議題，先不做。 |
| 2026-10-07 | 舊編輯器匯入草稿用的 `POST inspect` 新 Manager 未提供（已斷）。 |
| 2026-10-07 | **改型別後變不合法的線怎麼處理（待人類想清楚，不實作）**：舊產品自動拔線（同一次 Undo，開發設定可關）；新編輯器目前留紅線、產碼失敗、TD 保留上次成功結果；人類構想「留紅線當參考、產碼時當作斷開」——類似已確認意圖「缺失節點與線保留可見但不參與運算」，但斷開後輸入用什麼值、使用者是否察覺結果改變等邏輯未想通。紅線由核心 `edge.connection().valid` 判斷、projection 決定顏色，RF 只負責畫。 |
| 2026-10-07 | **教訓**：開放節點前要先查舊產品新增清單是否刻意排除（17 曾放出已淘汰定義）；調查要走產品實際路徑（17 盤點繞過 `insert` 補預設而誤判）。 |
| 2026-10-07 | 最終產品不顯露瀏覽器特徵（原生右鍵選單等，可留一處允許）——**移植大致完成後才做**（design-interview Q30）。選單用 JS 攔截，其他痕跡多為 CSS。 |
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
