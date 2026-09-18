# 矩陣與雙精度值

2026-09-18 確認的設計。新增型別與新節點為第一批；既有算術、Compare、If、Convert 的能力擴充為第二批，分開提交。本文記錄實作契約，TD 是否已收到版本依開發狀態及交付紀錄確認。

## 型別與資料

- 支援 Column 與 Row 分別為 2～4 的所有 9 種 `mat` 及 9 種 `dmat`，並加入 `double`、`dvec2/3/4`。
- `matCxR` 的 C 是 Column 數，R 是 Row 數。方形使用 `mat2/3/4` 或 `dmat2/3/4`。資料平坦保存為 Column-major：`values[column * rows + row]`。
- Matrix 與 Scalar／Vector 同樣提供穩定名稱的通用入口，以及固定型別入口。型別切換不更改通用節點名稱。固定型別由 `params.fixedType` 保存與驗證。
- Matrix 本地初始值為單位矩陣；非方形在現有對角線填 1，其餘為 0。矩陣元素的純量型別是 float 或 double，不存在 integer／Boolean matrix。
- 基礎批的普通矩陣接線只接受相同完整型別；總分量數相同不代表相同形狀，例如 mat2 不等於 vec4。擴縮矩陣及明確精度轉換由後續 Convert 負責。

## 畫布與 Parameter

每組控制項代表一個 Column，保留 `Column 0` 等母層名稱。展開為 X／Y／Z／W 分量；沿用共同的 RGBA／STPQ 分量命名選项。母層向量接口保持存在，展開／收合不改接線；收合後已接線的子分量仍可見。收合的數值列始終保留完整分量位置：由接線提供值的格子顯示橫槓，其餘保持可編輯，不因某個子分量接線而縮減格數或移動後面的分量。下方已接線的子列保留名稱、接口與橫槓。

Matrix 常數無輸入口，數值直接編輯。Matrix Combine、Matrix Replace 有 Column 向量與展開的純量輸入口，`out` 放最下面。Matrix Split 有一個矩陣輸入，Column 向量與展開純量輸出並存；使用者明確接受在同一節點直接拆出分量，避免每個 Column 再接一個 Vector Split。

已有接線提供值時不把本地備用值顯示成即時值。沿用既有數值拖曳、Value Ladder、取消、唯讀與 Undo 行為。

2026-09-18 視覺試行：使用者先要求另作來源辨識方案，隨後同意先試 `↳ X／Y／Z／W`。收合列由整個 Matrix／Column 提供值的格子仍顯示 `—`；有獨立純量接線的格子在原位置顯示符號與分量名稱，滑鼠提示提供實際來源。Combine／Replace 共用此規則，下方分量接孔保留。這是供 review 的視覺方案，固定格數修正已先獨立交付。

## 新節點

| 節點 | 能力 |
| --- | --- |
| Matrix | 本地矩陣常數，含 18 種固定型別入口 |
| Matrix Combine | 手填值 → 接入 Column → 接入純量分量，後者覆蓋前者 |
| Matrix Replace | 保持同尺寸；接入 Value 後只由額外接線覆写，未接線部分沿用來源 |
| Matrix Split | 同時提供完整 Column 和其純量分量 |
| Matrix Get／Set | 以可接線的 int／uint 零起算索引取得／替換整個 Column 或單一元素 |
| Transpose | C×R 變成 R×C，精度不變 |
| Inverse／Determinant | 只接受方形矩陣；行列式輸出 float／double |
| Matrix Comp Mult | 相同形狀、精度的矩陣逐元素乘法 |
| Outer Product | A 決定 Row 數、B 決定 Column 數，產生外積矩陣 |

Get／Set 的索引、Inverse 的奇異矩陣等沿用原生 GLSL 行為，不新增 CPU 執行期檢查、截斷或回退。Matrix Set 產生本地 GLSL 指派，不能因所有輸入是字面值就誤標為 GLSL 常量表達式。

## TD 來源與實測界線

Matrix Uniform 使用 TD 原生 Matrices 頁的 4×4 DAT／CHOP／tdu.Matrix 來源。來源載體的 4×4 與 GLSL 宣告尺寸是不同概念；不因文件曾建議 mat4 就禁止較小或非方形宣告。

TD 2025.32820 的隔離 GPU 探針結果：

- 九種 float 矩陣 × 三種來源 × TOP Pixel／MAT Pixel／MAT Vertex，共 81 項全部正確，逐元素核對 Column／Row 順序。
- `dmat` 的 Matrices 來源與 `double/dvec` 的 Vectors 來源可編譯，但 105 項直接傳輸測試未得到正確值。觀察數值符合 float32 載體位元被讀成 double 的情形；未檢查 TD 內部實作，不能將此推論當作已證實原因。
- 圖內雙精度字面值／運算、float Uniform 在 GLSL 內明確轉成 double／dvec／dmat，另 78 項全部通過。

因此仍保留原生宣告能力，來源介面說明已實測的傳輸問題，不偷偷轉型、攔截或監控。使用 float 來源再在 GLSL 轉 double 不會找回傳輸前已失去的精度，但可讓後續運算使用雙精度。

矩陣來源快照只讀原生配置；手填 tdu.Matrix 建構式以靜態 literal 解析取得值，不對動畫 DAT／CHOP／Expression 每幀求值比對。明確寫入整個矩陣或修改原生 binding 時沿用既有來源歷史與 Undo／Redo。動態來源由 TD 自己執行。

## 分批邊界與驗證

第一批涵蓋型別、數值、宣告、Subgraph／手寫 GLSL／relay、匯入匯出／剪貼簿及以上新節點。不能因全域型別表增加，就自行放寬所有舊數學節點的 overload。

第二批既有操作需以完整輸入／輸出簽名設計。例如矩陣乘向量會改變輸出形狀；矩陣加 scalar 必須產生原生逐元素加法，不能先把 scalar 建成對角矩陣後再相加。明確 constructor 配對另列，不與普通接線相容表混合。

關鍵驗證入口：`test_matrix_foundation.py`、`test_matrix_editor.js`、`test_matrix_values.cjs`、`test_matrix_transport.py`、`test_matrix_sources.py`。原有圖的編譯基準與數值操作回歸仍須通過。
