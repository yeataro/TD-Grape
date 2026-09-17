# Subgraph I/O 快捷與節點拖曳

0.8.73 在 Subgraph **內部**的 Function Input／Function Output 尾端增加灰色接口。

## 灰點接線

- 把節點輸入接到 Function Input 的灰點，新增一個 Subgraph 輸入；把節點輸出接到 Function Output 的灰點，新增一個 Subgraph 輸出。可由任一端開始拖線，亦可使用既有逐點連線操作。
- 放開才建立接口與第一條線，整個動作是一步 Undo／Redo。取消、拖至空白處或灰點接灰點，不建立項目。
- 型別依另一端的實際接口決定，包含 `sampler2D`。名稱沿用該接口的可見名稱；同側重名時加序號。
- 新輸入沿用另一端的未接數值；未提供明確數值時使用該型別的零值。Sampler 沿用現有缺接處理。新輸出的未接預設為零。
- 選取邊界節點後，在 Parameter 修改名稱與預設值；Settings 可修改型別、排序、移除。排序只改顯示順序，不更換 Port ID 或接線。
- 每側仍上限 16 個。唯讀及已滿的灰點停用。Library／Personal 來源維持既有規則：第一次編輯建立本地版本並更新此 Shader 的相關呼叫，保留來源快照。

外部呼叫節點會顯示更新後的介面，本輪未增加外部呼叫節點、Uniform、Attributes 或 Output 根節點的灰點。後續 Inputs 及節點顯示設計另行討論。

## 實驗性拖曳設定

`src/editor/graph_ui.js` 的 `EDITOR_DEV_SETTINGS.nodeBodyDrag` 預設為 `true`，允許從節點內文、數值摘要、註解區拖曳。可從 footer 齒輪的「實驗功能」即時關閉，恢復只從標題列拖曳。

設定只保存在目前瀏覽器，不隨圖／Layout 保存。接孔、按鈕、輸入框及 Label 編輯區仍使用各自操作。滑鼠和觸控共用這個範圍判斷；取消、唯讀與雙指縮放保護保留。

`canvasTrash` 本輪維持 `false`；既有 input 線拖至空白處斷線行為保留。

## Sampler 與取樣函式的顏色

Sampler／TOP 輸入來源保留棕色。Texture 2D 與 Texture Sample 使用既有紫色函式色；Texture 搜尋分類與各資料型別的接孔顏色保留。

這個 UI 分類依據是：Sampler 提供資源引用，`texture` 接收資源與座標並回傳取樣值；GLSL 規格也把這兩者分別描述為 opaque 型別與 texture lookup function。見 [Khronos GLSL 4.60 規格](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.html)。既有合併來源的 Texture 2D 與可獨立傳遞資源的 Sampler + Texture Sample 都保留，這輪不改變採樣功能。

## 驗證

Chromium 使用真實滑鼠事件及 CDP 觸控事件驗證：建立兩側接口、從灰點起拖、取消／空白投放、單步復原、來源保留、型別與預設值、排序、容量、唯讀、整個節點拖曳、接孔優先、Label 編輯、取消及雙指縮放。瀏覽器產出的 Subgraph 圖再交由核心編譯器驗證。這些自動化檢查不等同 iPad 或 macOS 實機驗證。
