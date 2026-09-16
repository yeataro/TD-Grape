# Inputs 面板與工作區設計

狀態：待實作／驗收的設計規格。本文件不作交付宣告；完成狀態以 [STATUS](../development/STATUS.md) 為準。同一事項與舊筆記不同時，以本規格的範圍為準。

分為 UI 批與型別批推進，以 TOP 為優先。沿用既有來源身分、引用、原生參數與 Parameter 編輯流程，不以外觀調整改變來源語意。

## UI 批

### Inputs 與新增節點清單

- 保留 Inputs 搜尋。移除獨立新增 Input 表單，包括底部獨立新增區；改由各來源分類標題的小 `＋` 開啟建立對話框，填名稱與該類別適用的型別。
- 分類預設展開，記住使用者的收合選擇；新增來源後展開該分類。空分類保留標題與 `＋`，不顯示無效收合箭頭。
- 來源列先對齊 Add Node 現有緊湊尺寸，試用圓角、淡類別底色，不增加列高。列上的大 `＋` 改小；分類 `＋` 建立來源，列上 `＋` 建立引用，兩者仍需清楚區分。
- 點來源列繼續在 Parameter 編輯。桌面可從整列拖入畫布，與新增節點的操作一致；拖入建立同一來源的引用。保留觸控捲動與既有拖放取消行為，避免點選被誤認為拖曳。
- 新增節點清單的一般圖示改試緊湊圓角類別底色列；外觀可回退成有辨識性的圖示，來源、搜尋與拖放邏輯不依賴試驗外觀。Subgraph 圖示須為填色形狀，不用 stroke 線框；其餘 icons 造型這輪不重設計。
- GLSL 原生參數按鈕暫不呈現：HTML 不放按鈕，JavaScript 不產生或綁定該按鈕，不以 CSS hidden 代替。保留既有 API 與功能能力。
- Personal 的說明傾向移至 Help，精簡占空間的說明區；目前該區同時是拖放保存目標，並提供 Refresh Personal、來源資料夾與錯誤資訊，有實際用途的控制先保留，不能隨說明一起移除。
- 資源庫是否獨立成 panel 未決。本輪不拆 panel，先觀察大量庫項目與 Add Node 的分流需求。
- 浮動 Add 的「全部來源／全部型別」select 暫時保留。多選 tags 是待試提案：初始 All，首次點 tag 改為僅選該項，再點其他項可多選；清掉最後一項、All reset 與多 tags 的空間占用尚未定案。

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

## 型別批

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

## 保留與驗收界線

- Attributes 暫緩；TOP vertex 屬遠期，不在這輪實作。
- Vector I/O 是否拆成不同節點未決，這輪不改其結構。Parameter 的整體位置與 OP 參數呈現仍待決；本輪點選來源繼續使用 Parameter。
- 後續考慮點空白畫布時，在既有 Parameter 呈現畫布／整體 UI 設定，不新增 panel。本輪不實作；與先前 OP 參數呈現方向的關係尚待決。希望可因應不同螢幕調整介面亮度，明亮模式與 Gamma 皆為候選，尚未選定算法或控制方式；UI 調整與預覽色彩的作用範圍仍需界定。
- 後續考慮點空白畫布時，在既有 Parameter 呈現畫布／整體 UI 設定，不新增 panel。本輪不實作；與先前 OP 參數呈現方向的關係尚待決。希望可因應不同螢幕調整介面亮度，明亮模式與 Gamma 皆為候選，尚未選定算法或控制方式；UI 調整與預覽色彩的作用範圍仍需界定。
- UI 批核對建立／點選／整列拖放／取消、收合記憶、搜尋、桌面與手機布局，以及持久狀態、錯誤和刷新草稿保護。
- 觸控不是產品的核心目標，但保留「筆電執行 TD、iPad 操作 Editor」驗收情境：常用新增、拖曳、接線、改值、Undo、reload 與捲動手勢應順暢；桌面仍是優先設計基準。
- 型別批以合法接線與 Cast、literal 邊界、原生數值更新、常數性、保存重載與失敗回復驗證支援範圍；Array／Matrix 評估結果須明確區分「型別與初始化已可用」和「完整值編輯尚未提供」。
