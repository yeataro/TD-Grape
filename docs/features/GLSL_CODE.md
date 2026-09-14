# GLSL Code

0.8.73 新增手寫 GLSL 函式節點。從新增節點搜尋 `GLSL Code`／`custom GLSL`，在同一個 Parameter 入口編輯介面與內容。

## 操作

- UI 設定函式名稱、輸入／輸出的名稱、型別與順序。介面目前使用既有圖型別：`float`、`vec2`、`vec3`、`vec4`；`sampler2D` 可作為輸入。最多 16 個輸入、16 個輸出，至少保留一個輸出。
- 中央程式框只編輯函式內容。UI 在上下顯示函式宣告及結尾；多個輸出以 GLSL `out` 參數表示。
- 編輯後失焦或按 Ctrl／Cmd + Enter 提交。Tab 插入四個空白；Shift + Tab 可離開編輯框。提交會沿用自動套用與 Undo／Redo。
- 輸入的未接值使用既有 Parameter 數值控制；Sampler 缺接沿用不透明黑。所有輸出在執行手寫內容前初始化為零，提早 `return;` 或未賦值仍有明確結果。

例如 UI 宣告兩個 `float` 輸入 `a`、`b`，兩個輸出 `float sum`、`vec4 colour`，手寫區輸入：

```glsl
sum = a + b;
colour = vec4(sum, a, b, 1.0);
```

一個節點只呼叫一次函式，多條輸出線使用同次呼叫的結果。實際產碼的函式名稱帶節點專屬前綴，因此不同節點可使用相同顯示名稱。

## 介面與保存

Port ID 與可見名稱分開。改名與排序保留接線；改名不猜測或自動改寫手寫內容中的變數，使用者需一併更新程式。已接線的接口不能直接刪除，先斷線再移除。型別變更沿用圖的相容規則，拒絕新增不相容連線，不靜默刪線。

節點可放入 Subgraph，內容和介面隨圖的 JSON、TOX／TOE 保存。實際函式內文加入編譯來源對照；TD 回報可定位的行號時，點擊錯誤會前往所在 stage／Subgraph、選取節點，並反白程式框中的對應行。編譯失敗保留最後成功套用的 Shader。

## 範圍

此版是函式內容編輯，尚無全域函式庫、`#include`／`#define`、自訂結構或矩陣／整數接口編輯。介面識別字由 UI 和核心驗證；內容限制在產生的函式括號內。GLSL 運算語意及 stage 可用函式仍由 TD 編譯器檢查。MAT Vertex 內可呼叫該 stage 可用的 TD 函式，例如 `TDDeform`、`TDWorldToProj`。

## 驗證

核心檢查涵蓋多輸出單次呼叫、未賦值輸出、改名／排序保留接線、Sampler、巢狀 Subgraph 行號、重複函式名稱及 JSON 往返。Windows TouchDesigner 2025.32820 實測 TOP／MAT 編譯、TOP 像素值、錯誤保留上次結果、TOX 重載與 MAT Vertex。

Chromium 瀏覽器檢查建立入口、介面修改、Undo／Redo、未提交內容保留、失焦接續按鈕操作、錯誤行定位及窄面板布局。macOS／iPad 實機回驗仍待完成。
