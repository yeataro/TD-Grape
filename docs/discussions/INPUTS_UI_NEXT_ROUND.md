# Inputs 面板與工作區設計

狀態：待實作／驗收的設計規格。本文件不作交付宣告；完成狀態以 [STATUS](../development/STATUS.md) 為準。同一事項與舊筆記不同時，以本規格的範圍為準。

分為 UI 批與型別批推進，以 TOP 為優先。沿用既有來源身分、引用、原生參數與 Parameter 編輯流程，不以外觀調整改變來源語意。

清單分為下一輪實作、後續待辦，以及模糊／待決筆記；後兩類不因記入文件便自動納入下一輪。下一輪可拆成 UI 與型別兩次提交。

已完成、不重列待辦：GLSL 原生參數按鈕已從 HTML／JavaScript／CSS 移除，API 保留；Subgraph 清單圖示已修正為實心。Vector Constant 名稱與節點數字欄位修正亦已交付。

## 下一輪實作：UI 批

### Inputs 與新增節點清單

- 保留 Inputs 搜尋。移除獨立新增 Input 表單，包括底部獨立新增區；改由各來源分類標題的小 `＋` 開啟建立對話框，填名稱與該類別適用的型別。
- 分類預設展開，記住使用者的收合選擇；新增來源後展開該分類。空分類保留標題與 `＋`，不顯示無效收合箭頭。
- 來源列先對齊 Add Node 現有緊湊尺寸，試用圓角、淡類別底色，不增加列高。列上的大 `＋` 改小；分類 `＋` 建立來源，列上 `＋` 建立引用，兩者仍需清楚區分。
- 點來源列繼續在 Parameter 編輯。桌面可從整列拖入畫布，與新增節點的操作一致；拖入建立同一來源的引用。保留觸控捲動與既有拖放取消行為，避免點選被誤認為拖曳。
- 新增節點清單的一般圖示改試緊湊圓角類別底色列；外觀可回退成有辨識性的圖示，來源、搜尋與拖放邏輯不依賴試驗外觀。保留已修正的 Subgraph 實心辨識圖示；其餘 icons 造型這輪不重設計。
- Personal 的說明傾向移至 Help，精簡占空間的說明區；目前該區同時是拖放保存目標，並提供 Refresh Personal、來源資料夾與錯誤資訊，有實際用途的控制先保留，不能隨說明一起移除。

既有來源建立、刪除與引用界線見 [Inputs 流程](../features/INPUTS_WORKFLOW.md)、[TOP 來源清單](../features/TOP_SOURCE_INVENTORY.md)；Uniform 的原生目前值與模式規則見 [原生來源](../features/NATIVE_UNIFORM_SOURCES.md)。

### 狀態列與畫布工具列

- 將頂部位置列的 Shader applied／pending 等狀態合併到底部狀態列，仍區分圖儲存與 Shader 套用。持久狀態與錯誤不能被一般操作訊息覆蓋；狀態列始終可見。桌面 footer 高度約縮為目前的三分之二。
- 工具列分為四組：`Undo / Redo`、`Copy / Paste / Subgraph / Delete`、`Fit / Box select`、`GLSL`。組間用細分隔，窄版以整組換行，不拆散組內操作。
- 桌面保留舒服的按鈕尺寸；手機上各類控制統一高度，Pixel／Vertex 控制也一致。graphpath 保持獨立，不與工具列合併。

### 頂欄與重新載入

- 頂欄可收合，預設顯示。開關放在第二列，視覺語言與 sidebar 開關一致，但只表示頂欄，不控制狀態列。兩列保持分開。
- 英文 `About` 併入副標、版本的小字行，呈現為 `tagline · version · About`；右上按鈕與 select 等高，Apply 按鈕先保留。
- 第二列在頂欄開關旁放小型 refresh icon，執行類似 F5 的整頁重新載入。刷新前必須處理未儲存圖與尚未提交的欄位草稿，不能靜默丟失編輯。
- 此 refresh 與 Preview 重新連線、載入已套用圖是不同操作，不共用名稱或混淆效果。預覽既有議題見 [預覽筆記](PREVIEW_UI_NOTES.md)。

## 下一輪實作：型別批

目前圖編譯器的數值型別只有 float／vec2／vec3／vec4；具名 Constants 產生一般 GLSL `const`，Uniform 的原生來源支援 Vectors／Colors。COMP 已有 Integer／Toggle 自訂控制，不代表圖中的 int／bool 管線已完成。

- 目標補齊一般 float／int／uint／bool 標量及對應向量，加入 Specialization Constants。double／dvec 不自動包含在「補齊」中。
- **Array／Matrix 不定案為完全延後。** 希望至少讓型別與合理初始化可用，完整值編輯 UI 後補；初版可支援哪些形狀與來源仍需評估。矩陣維度與初始化方式、陣列元素型別／長度與初始化、接線與原生綁定限制，須在啟用前明列範圍。
- Specialization Constants 與一般 Constants、Uniform、TD 的 Constant 參數模式分開。其可用型別、原生映射、預設值與目前值、修改後的生效成本及失敗回復需核對，不能直接沿用 Uniform 行為。

實作至少涵蓋以下層次，不只新增選單項目：

1. 共用型別與合法函式簽名、JSON 值驗證、literal、明確 Cast、Vector 分量及分組規則；int／uint 邊界與 bool 真正布林不能沿用浮點解析。
2. 前端建立與編輯、接孔／Create 相容判斷、來源引用、複製／匯入與既有圖相容性；只顯示已實際支援的型別組合。
3. TD 原生來源辨識、精確讀寫、Expression／Bind／Export 保留、快照與失敗回復；避免整數尤其 uint 極值經浮點 Uniform 通道損失精度。
4. Spec Const 宣告與穩定身分、原生參數映射、常數性傳播與產碼；區分一般常數與 specialization expression，不能直接套用目前的二元常數判定。

型別基礎與既有研究見 [數值型別計畫](NUMERIC_TYPES_PLAN.md)、[型別契約](../architecture/TYPE_CONTRACT.md)。來源連動沿用 [自訂參數基礎](../features/CUSTOM_PARAMETER_EDITOR.md)，不因此重設計整個自訂參數編輯器。

## 後續待辦：有目標，未排入下一輪

- Array／Matrix 完整數值編輯介面。型別與合理初始化仍屬下一輪評估範圍，不能因編輯介面延期而一併劃掉。
- 自訂參數編輯與 Inputs 拖入建立公開控制；工作區位置與 Parameter 整體設計留待決定。
- 擴充 TOP 的 3D／Array Texture／Cube 來源、Attributes／Input Buffers 與 MAT 跨 stage 能力。圖的資料陣列與貼圖維度是不同功能。
- 後續自製 Viewer 接入、預覽尺寸延遲量測，以及替換 Lock 暫解。Viewer 由使用者製作；若仍需保留上一幀，優先評估 Cache TOP，依 [預覽筆記](PREVIEW_UI_NOTES.md) 處理。
- 發佈前的 macOS／Safari 與實體 iPad 驗證、可讀的升級相容紀錄、打包與安裝整理。其他既有能力待辦仍見 [STATUS](../development/STATUS.md)，不在這次 UI 工作中一併展開。

## 模糊／待決筆記：尚不直接實作

- Vector I/O 是否拆成不同節點；這輪保留現有形態，不改其能力。
- 點空白畫布時，沿用 Parameter 呈現畫布／整體 UI 設定，不新增 panel。此為後續方向；與先前 OP 參數呈現的關係、Parameter 的整體位置與排版仍待決。
- 因應不同螢幕調整 UI 亮度。最新候選是同一套深色主題的「較暗 ↔ 標準 ↔ 較亮」三個配色基準，使用滑桿平滑過渡；Gamma、完整明亮模式與具體算法未定。建議只調介面色票、保留 Shader 預覽判讀，仍需確認作用範圍。本輪不做。
- 資源庫是否獨立成 panel；本輪不拆，先觀察大量庫項目與 Add Node 的分流需求。
- 浮動 Add 的「全部來源／全部型別」改用多選 tags：初始 All，首次點 tag 改為僅選該項，之後可多選。清掉最後一項、恢復 All 與多 tags 的空間占用未定，本輪保留 select。
- GLSL 是否改成獨立 panel；目前按鈕保留。Apply 的長期必要性與頂部兩列是否合併亦未定，目前保留功能與兩列結構。
- Subgraph 函式化、RGBA 染色旗標未來選單位置，以及快捷入口的進一步延伸皆不因這輪而定案。內部 Subgraph 灰點已完成，外部呼叫與其他來源類別尚待設計。
- TOP Vertex Stage 為遠期備選，等待實際自訂 GLSL 使用案例，不在這輪處理。

## 驗收界線

- UI 批核對建立／點選／整列拖放／取消、收合記憶、搜尋、桌面與手機布局，以及持久狀態、錯誤和刷新草稿保護。
- 觸控不是產品的核心目標，但保留「筆電執行 TD、iPad 操作 Editor」驗收情境：常用新增、拖曳、接線、改值、Undo、reload 與捲動手勢應順暢；桌面仍是優先設計基準。
- 型別批以合法接線與 Cast、literal 邊界、原生數值更新、常數性、保存重載與失敗回復驗證支援範圍；Array／Matrix 評估結果須明確區分「型別與初始化已可用」和「完整值編輯尚未提供」。
