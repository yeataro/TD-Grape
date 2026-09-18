# Arrays and structures

本文件記錄陣列第一輪的使用方式及各層責任。討論與使用者決議仍見 `docs/discussions/ARRAY_AND_STRUCT_PLAN.md`；此處描述目前的操作契約，不把未提供的自訂結構編輯介面視為已完成。

## 操作

| 節點 | 輸入 | 輸出／行為 |
| --- | --- | --- |
| Array | Parameter 指定元素型別與長度（數字或整數常數引用） | 建立陣列。所有元素初始為零；布林是 `false`，矩陣是零矩陣。 |
| Array Create | 整數常數 `length`、填值 `value` | 建立指定長度的陣列，每一項填入 value。value 可以是執行期來源。 |
| Array[i] | `Array`、整數 `i` | 取出一項，輸出型別由陣列元素型別推導。索引小於零取第一項，超過上界取最後一項。 |
| Array Replace | `Array`、整數 `i`、`replacement` | 產生替換一項後的陣列。越界時原陣列保持不變，不 Clamp、不回寫 Uniform 或 TD 來源。 |
| Array Length | `Array` | 回傳宣告長度，型別是 `int`。固定／宿主巨集大小是編譯期資訊，不讀取陣列內容。 |
| Field | 結構 `value`，欄位選單 | 依共用結構定義列出欄位；輸出所選欄位的型別。 |
| TD 內建來源 | 選擇一個可用的來源 | 引用 TD 已提供的資料，保留其陣列／結構型別。 |

建立節點時可以搜尋 Array、Array Create、Array[i]、Array Replace、Array Length、Field，或 TD 來源名稱。從接孔拖線建立節點時，候選節點使用同一份型別描述進行局部配對；真正建立時仍進行完整接線驗證。輸入搜尋文字不向 TD 查詢，也不逐一複製整份圖模擬候選接線。

Array 的畫布節點在標題選擇元素型別，body 上方選長度來源，選固定數字時在下方編輯長度；與 Parameter 共用設定及 Undo，不會因長度增加而展開 N 個編輯欄位。節點長度使用既有 INT 編輯器，沿用拖值、文字草稿、Escape、驗證及 Undo，只額外指定合法長度範圍；下拉沿用共用節點欄位樣式，不另訂 Array 的色彩或高度。來源只接受 int／uint Graph Constant 或 Spec Constant，float／向量來源不列入。逐項內容由 Array Replace 編輯。Replace 的數值、向量或矩陣替換值沿用既有值編輯器；結構或陣列替換值顯示型別並接受接線。

### Array Create（0.8.104）

標題選元素型別，`length` 與 `value` 使用既有接孔／INT／數值編輯器，不增加專用 CSS。未接線時長度預設 4、value 預設零；向量或矩陣填值沿用 Parameter 值編輯方式，結構／固定陣列可接線。既有 Array 仍保留，並維持零初始化及上下排列的長度控制。

`length` 可接 int／uint 純量、Graph Constant、Spec Constant，或產碼器已支援的合法整數常數運算鏈。編輯器拒絕執行期 Uniform 長度；相同 Uniform 可接 value。直接整數顯示 `[4]` 等數字；常數運算不在 JavaScript／Python 求值，顯示 `[N]`，以來源節點／輸出口／所在圖的身分保存長度。產碼使用既有節點 emitter 生成全域常數及一個共用長度符號，再以 GLSL 迴圈填值。Array Length 單獨使用時只生成長度相依，不執行填值也不讀無用的 Uniform。

常數來源的值域及最終 GLSL 合法性仍由 GLSL 編譯檢查：例如運算結果為 0、負數或過大的配置，不新增 CPU 求值器去預判。手動／直接數字沿用 1–1024 的既有上限。Specialization 運算只接受支援的運算子／建構類；內建函數不一律視為 specialization 常數。

長度相依可隨複製貼上、子圖擷取、Function 本地化／獨立副本重映射。可把 Create 與常數鏈一起收進子圖，也可把常數長度接在子圖入口。**目前同一 Function 定義的多個實例若使用不同的長度表達式來源，會明確拒絕**，不以其中一份實例的長度替另一份產碼；可使用同一常數來源，或建立獨立 Function 定義。不為每個實例推算數字或建立多型函式特化器。

### 符號長度（0.8.93）

長度選單可選固定數字，或圖內既有的 `int`／`uint` Graph Constant、Specialization Constant。已知數字顯示數字；TD 巨集及 specialization 長度顯示 `T[N]`，提示保留實際名稱。`N` 只是顯示方式，不是把所有未知長度視為同一型別：資料仍保存長度來源的穩定 ID，例如 `float[sg_len_count]`，產碼再以該宣告的實際名稱生成 `float values[arrayCount]`。重新命名、Undo、整圖保存和選取複製貼上均保留／重映射依賴。

這些陣列可經過 Array[i]、Replace、Length、Function／Subgraph 和 GLSL Code；產碼先安排長度宣告，不向 TD 查詢 specialization 的目前值。Length 直接引用長度符號，不掃描內容。符號長度的 Array 用 GLSL 迴圈填零；specialization 陣列的 Replace 用逐元素複製，再進行越界不修改判斷，避免 GLSL 不允許的整體賦值。普通固定長度維持既有產碼。

0.8.104 已新增 Array Create 的長度接孔與填值；既有 Array 的長度來源仍是節點 body／Parameter 引用選單。SSBO 執行期長度尚未實作。沒有新增 CPU GLSL 求值器、持續監控或 TD 常數值鏡像。符號初始化不是 ordinary constant expression；Specialization Length 也不冒充普通編譯期常數。不同來源 ID 不靠預設值恰巧相同就判定相容；個人函式匯出仍遵守原本自足定義的限制，沒有新增封裝全域來源的能力。

Specialization 長度只可位於最外層維度；結構欄位仍使用固定長度。CHOP Uniform Array 的 specialization 長度有已重現的宿主上傳問題，因此目前 UI 與 native 配置會拒絕該組合；圖內 specialization 陣列仍可用，詳見 [TD array sources](TD_ARRAY_SOURCES.md)。

在編輯器接線或更改來源型別時，Get、Replace、Length 的陣列型別隨來源更新，相關設定隨該次編輯保存。編譯器仍依實際接線重新推導，不改寫傳入的圖資料。索引型別 int／uint 由節點設定決定，不因索引接線自動改變；不同數值型別依共用接線轉換規則處理。

Field 接上結構後依其定義顯示欄位。若來源型別改變、原本選取的欄位不再存在，改用新結構第一個欄位；下游不相容接線依既有「自動斷開不相容接線」設定處理。這些編輯使用既有圖的 Undo／Redo 交易。

## TD 來源

來源入口依 TOP／MAT 與 Shader Stage 過濾：

| 環境 | 來源 | 元素型別／大小 |
| --- | --- | --- |
| TOP Pixel | `uTD2DInfos` | `TDTexInfo[TD_NUM_2D_INPUTS]` |
| TOP Pixel | `sTD2DInputs` | `sampler2D[TD_NUM_2D_INPUTS]` |
| MAT Vertex／Pixel | `uTDMats` | `TDMatrix[TD_NUM_CAMERAS]` |
| MAT Vertex／Pixel | `uTDCamInfos` | `TDCameraInfo[TD_NUM_CAMERAS]` |
| MAT Vertex／Pixel | `uTDLights` | `TDLight[TD_NUM_LIGHTS]` |

這些來源同時出現在節點瀏覽器與 Inputs 的 TD Built-ins 區域。來源與其結構資訊來自共用契約；Field 不需要各自實作 TDTexInfo、TDMatrix 等專用節點。既有 TOP Input 的 sampler、size、pixelSize 便利輸出保留。

sampler 是資源引用。sampler 陣列可取項、傳遞及取得長度，但不能當成一般數值陣列建立或 Replace。空的宿主來源沒有可讀取的元素；取項應回報診斷，不虛構最後一项或任意填值。實際 TD 編譯失敗時，沿用現有保留圖與最後有效 Shader 的流程。

### CHOP Uniform Array

1. 在 Inputs 的 Uniforms 選擇新增，種類選 **Uniform Array · CHOP**。
2. 選擇 `float`、`vec2`、`vec3` 或 `vec4`，填入固定長度和 CHOP 路徑。
3. 建立來源引用節點，接到 Array[i]、Array Length，或可接受該型別的 Function／GLSL Code 入口。

CHOP 樣本對應陣列元素，通道對應分量。CHOP 必須具有不少於宣告長度的樣本。來源 Parameter 顯示 CHOP 路徑／Python expression 綁定，不建立逐元素的数值滑桿。修改綁定使用既有 Source 編輯端點與 expected token；BIND／EXPORT 等不可直接修改的模式維持唯讀。

這一輪沒有更動 Uniform 的即時同步傳輸方式，也沒有把 Inputs 面板整體重新命名為 Sources。

## 型別、圖、UI 與產碼的責任

- **共用型別定義**：描述陣列元素、長度、結構穩定 ID、欄位穩定 ID、欄位型別、GLSL 名稱及定義提供方式。
- **圖資料**：保存節點設定、接線與專案自訂結構定義；引用穩定 ID。顯示名稱不能取代型別或欄位身份。
- **UI**：根據定義提供選單、型別標籤和適用的值編輯器；不在各節點複製 TD 結構欄位清單。
- **GLSL 產生器**：驗證型別及環境、安排必要宣告、推導輸出型別、產生取項／替換／欄位運算與預設初始化。
- **TD 的 GLSL 編譯器**：接收生成的 GLSL；不讀 Grape 的圖資料或 UI 狀態。

TD 內建結構由宿主提供，只登記並引用，不重複輸出 `struct`。圖擁有的結構由產碼器在需要的 Shader 內宣告一次，依欄位依賴安排順序。型別宣告、變數／值的建立、TD 外部資料綁定仍是不同責任。

自訂結構的作者 UI 延後。既有图、測試或匯入資料可提供 `typeDefinitions`；其欄位能由通用 Field 節點列出並傳遞。自訂型別不會自動具有 Add 等數學運算。

```json
{
  "typeDefinitions": [{
    "id": "sample",
    "name": "Sample",
    "provider": "generated",
    "fields": [
      {"id": "position", "name": "offset", "type": "vec2"},
      {"id": "weight", "name": "amount", "type": "float"}
    ]
  }]
}
```

對應的圖型別是 `struct:sample`，陣列可寫成 `struct:sample[8]`。Field 保存 `position`，顯示並生成欄位名 `offset`。生成的 GLSL 結構使用 `sg_type_sample`，避免直接把任意 UI 名稱當成 GLSL 識別字。

## 大小與限制

目前共用契約的固定單維長度上限是 1024，陣列最多 8 維。這是實作保護上限，不是 GLSL 或硬體保證；宿主巨集長度由 TD 提供。複合預設值另有 65536 個遞迴項目的預算，防止展開巨大陣列或結構耗盡編輯器資源。UI 讀取契約上限，不自行維護另一份型別／長度配對表。

巢狀陣列的第一個括號是最外層：`float[2][3]` 的長度是 2，取項結果是 `float[3]`。元素型別下拉可以使用目前圖已知的固定陣列型別；不提供通用自訂型別文字編輯器。

陣列長度描述儲存範圍，不代表應用程式的「有效資料筆數」。若宣告 100 項只使用前 12 項，有效筆數必須作為另外的值或資料約定傳遞。

目前尚未提供圖形化迴圈、任意執行期配置、一般 SSBO／Texture Buffer 作者介面或使用者結構定義編輯器；不把這些功能與本輪的 Array 建立、傳遞、取項混為一談。

## 驗證入口

- `tests/browser/test_array_structure.cjs`：Array 互動、Undo、型別推導、Field、局部搜尋、環境篩選及 CHOP 綁定控制。
- `tests/unit/test_array_editor.js`：共用前端型別解析、巢狀陣列、零值、限制、GLSL wrapper 及來源型別。
- `tests/browser/test_composite_functions.cjs`：Function／GLSL Code／剪貼簿等整合，另由整體測試及原生 TD 驗證覆蓋產碼與宿主結果。

- `tests/unit/test_array_create.py`、`tests/browser/test_array_create.cjs`、`tests/td/test_array_create.py`：常數鏈／填值分離、子圖、型別更新與原生 GPU 輸出。
