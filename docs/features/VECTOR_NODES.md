# 向量拆分、組合與常數

0.8.80 開發版。這輪提供可實際操作的規則，後續再依使用回饋調整節點外觀與 Inputs 整體介面。

## 入口與用途

| 節點 | 用途 | 主要分類 |
| --- | --- | --- |
| Float／Vector 2／Vector 3／Vector 4 | 無輸入接孔的固定值來源；修改數值會重新編譯 | Data |
| Color RGBA | vec4 固定值，使用色彩編輯介面 | Color |
| Split | 拆開 vec2／vec3／vec4，輸出各個 float 分量 | Vector，另可由 Data 找到 |
| Combine | 將 float 與向量依序組成 vec2／vec3／vec4 | Vector，另可由 Data 找到 |
| Swizzle | 取出、重排或重複 1–4 個分量 | Vector，另可由 Data 找到 |

Vector 4 補足一般 X／Y／Z／W 數值來源。原有 Compose RGBA、Split RGBA 仍保留原來的型別與行為；不把既有固定值來源改成可接線運算。

## Combine：分量位置固定

在 Parameter 選擇輸出 vec2、vec3 或 vec4，預設 vec2。X／Y／Z／W 是固定的輸出位置；接入向量時，從指定位置占用連續分量，節點明示 XY、YZ、ZW 等範圍。

例如輸出 vec4：

- X 接 vec2，Z、W 各接 float：`vec4(vec2, float, float)`。
- X 接 float，Y 接 vec2，W 接 float：`vec4(float, vec2, float)`。
- X、Z 各接 vec2：`vec4(vec2, vec2)`。
- 四個 float、vec3 加 float、float 加 vec3 或一個 vec4 也使用同一規則。

越過輸出範圍，或占用另一條已接線的分量時，拒絕該操作並保留原圖。原接孔的來源可正常替換；不會因此刪除旁邊的線。這些節點不隱式截斷向量或把 float 複製成多個分量。

沒有接線的位置使用 Parameter 中的值。解除向量連線後，該範圍恢復獨立 float 接孔及先前數值，其餘分量的位置與連線不移動。縮小輸出若會破壞現有連線，也會先拒絕。

## Split、Swizzle 與快捷

Split 預設 Auto，依輸入 vec2／vec3／vec4 顯示 2／3／4 個輸出。Swizzle 使用同樣的輸入型別規則；由左至右的下拉欄代表輸出分量，`+`／`−` 調整數量。例如 vec2 的 YX 交換兩軸，YXY 產生 vec3，XXXX 重複 X 成 vec4。只能選取輸入確實具有的分量；修改型別／數量若破壞既有下游接線，先解除該接線再改。

Settings 可以切換 X／Y／Z／W、R／G／B／A，或 vec2 的 U／V 名稱。這只是名稱，不改變接孔身分或資料型別。

向量輸出旁的分支圖示會新增一個接好的 Split；再次使用會選取已連接的 Split。從 UV 或 Color 建立時自動使用 U／V 或 RGBA。這是一個真正的圖節點，新增與連線一起 Undo；尚未改成在原節點裡直接展開多個接孔。

拖線到空白處的選單會依方向與型別排序：向量輸出優先 Split、Swizzle、Combine，再接常用運算；向量輸入往回拉優先相符的 Combine、固定值與 Swizzle。分類的 Vector／Math 也往前。輸入搜尋文字後仍以文字相關性排序；Combine 可用 compose、append、合併、組合等別名搜尋。

實際 UV 操作：UV 輸出圖示建立 Split → V 接 Add 修改數值 → U 與新的 V 接 Combine → 輸出 vec2 到取樣的 UV。

## 編譯期常數

型別與常數性分開判定。Combine／Split／Swizzle 接入固定值及合法常數運算時，保留編譯期常數；接入 Uniform、UV、貼圖等執行期資料時，仍是一般執行期結果。

支援常數運算的節點在 Settings 提供「必須為編譯期常數」。它檢查完整上游鏈，包含 Subgraph 邊界；違反要求的開關或接線操作會在 UI 被拒絕，後端也再次驗證。不會把當下的 Uniform 數值凍結成常數。

編譯器以有限的 GLSL 運算清單判定，包括建構／分量操作、算術及目前支援的數值內建函式。GLSL Code 的使用者函式不列入常數表達式；`const` 關鍵字本身不能把任意執行期表達式變成編譯期常數。原生檢查除了像素結果，也把常數結果用於區域陣列長度，確認實際符合常數表達式用途。

只有新向量節點或明確常數要求所需的鏈會新增 `const` 修飾。舊圖沒有使用新能力時，生成文字保持原樣；原有 138 份 GLSL 指紋未變。本輪不加入 int／uint 或陣列／Buffer 編輯 UI，這些仍在[數值型別計畫](../discussions/NUMERIC_TYPES_PLAN.md)。

## 相容與驗證

新增四個節點定義，沒有重寫舊定義、舊 RGBA 節點或圖格式版本。僅因產品升到 0.8.80 不會要求既有相容圖升級。兩份 Master 已同步目前編譯器版本。

- 179 項 Python 檢查及既有可攜檢查通過；UI 處理函式測試覆蓋組合、重排、斷線、型別變更、Undo、常數要求與接線候選。
- TD 2025.32820：27 項原生檢查，涵蓋 TOP／MAT 各八種 vec4 組合、像素數值、UV V 單獨修改、常數陣列長度及失敗時保留既有輸出。
- 桌面 Chromium 連到實際 TD，完成上述 UV 流程、Swizzle YXY、常數操作拒絕與 Vector 4 新增；重載保存正常，沒有 JavaScript 錯誤。
- 本輪尚未在手機／iPad／Safari 實機驗證。
