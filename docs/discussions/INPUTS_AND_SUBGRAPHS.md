# Inputs、Sampler 與 Subgraph：2026-09-11 討論記錄

狀態：設計討論，尚未開始功能修改。使用者授權本輪保存討論及整理 TD-Grape 專案目錄，不等於啟動下一輪 Shader 語意修改。

## 使用者明確表達的方向

- Texture 2D 的 Sampler 應獨立，讓來源可供多個取樣操作引用。舊圖的貼圖來源與既有輸出必須保留。
- 若由工具自行提供缺省貼圖，使用者偏好不透明黑；同時希望優先沿用 TD 原生空來源行為。尚未實測原生空 Sampler 的顏色或錯誤條件，不能把黑色當成已驗證的 TD 規則。
- Expose 以能對應 GLSL OP 原生參數的值／資源為主。Attributes 與 Buffers 是輸入設定，不能僅以「有參數頁」推導為 promote。
- 框選打包時，Uniform 節點傾向保留在 Shader 外層，經 Subgraph Input 傳入；使用者明確保留後續改決策的權利。
- 設計保持易於小幅修改，但不為此全面重構或建立龐大抽象框架。
- P、N、uv 指標準幾何屬性（語音的 Path 已澄清）；預設材質圖應備妥需要的標準讀取。Phong MAT 與 PBR MAT 匯出後自動填寫的完整欄位，仍待本機實測。
- SOP／POP 相容性需依 TD 的 Write a GLSL MAT 規範；不因使用 POP 幾何而要求使用者重建另一份基本材質圖。

## 目前討論傾向，尚未完成產品設計驗收

自訂幾何屬性由 TD 上游 SOP／POP 建立。Shader 的 Attributes／Buffers 設定傾向以 TD UI 為編修入口；網頁主要提供引用、型別和缺失提示，暫不新增重複的完整輸入編輯分頁。

必須分清：建立上游屬性資料、在 GLSL MAT 宣告要讀的名稱／型別、圖中的讀取節點。MAT Attributes 頁本身不會替上游產生資料；MAT 可用於不同幾何物件，宣告存在不等於每個物件都有資料。

若以 TD 設定為準，後續套用 Shader 必須讀取／校驗必要的介面資訊，不能把使用者剛在 TD 改好的輸入覆蓋成舊快照。此資料權威方向與 v2 的「池為權威、參數為投影」有差異，實作前需確認適用範圍；不能從本記錄默默改成所有宣告都由 TD 管理。

## SOP／POP 與 Buffer 的界線

- 標準讀取採 TDPos()、TDNormal()、TDTexCoord()；自訂屬性使用 Attributes 設定與 TDAttrib_<name>()。
- TDTexAttrib_<name>() 提供 SOP UV 層與 POP 屬性讀取的相容介面。POP 可指定其他頂點索引的多載，不直接假定 SOP 支援。
- 此處 Buffer 是 POP 屬性資料，指定 POP、Point／Vertex／Primitive、來源屬性與 Shader 引用名稱，再由 TDBuffer_<name>() 讀取。
- Buffer 元素數與屬性陣列大小要分開。Color Output 的色彩緩衝、Arrays 頁的 CHOP Texture Buffer 不是同一個輸入種類。
- 原規格 §6.6 把 Attributes／Buffers 都列為 Vertex-only；TD 官方文件已有 TOP 讀取 POP Buffer。若採用該能力需明確修訂階段限制，並按實際支援 build 驗證。
- 不每幀把完整屬性／Buffer 資料傳回網頁；必要設定与狀態的讀回策略另行驗證。

## 未決與待實測

1. 有 Sampler 但 TOP 空白、完全沒有 Sampler、TOP 零輸入三種狀態的原生行為與保底方式。
2. 獨立 Sampler 是否同 Uniform 留在 Subgraph 外層。Attributes／Buffers 的打包方式也尚未決定。
3. 缺失 Attribute、空 Buffer、索引越界、來源型別改變時的 TD 行為；SOP／POP 同圖渲染測試。
4. 同一 MAT 套在不同幾何物件的驗證呈現；目前預覽不能代表所有物件。
5. 純網頁遠端使用者新增輸入需要回 TD 的操作成本，以及圖匯入時缺少來源的提示方式。
6. 只有 float／Vector 的圖型別不足以提供正式 Buffer 整數索引；需依原本數值型別里程碑推進。

## Comment 提案

原始 Comment 已存在 ui.comment，能儲存、顯示、複製及復原，目前未寫入 GLSL。

提案是在對應節點產生的程式碼區塊下方，逐行加入 // 註解，保留原始文字並更新 source map。必須處理換行、控制字元、行末反斜線造成的 GLSL line continuation；不能讓文字吞掉下一行程式或變成指令。沒有自己產生程式敘述的節點及展開的 Subgraph，仍需定義註解定位。尚未決定最終規則或實作。

## 現有程式觀察

FunctionModel 已處理引用、函式庫匯入與副本；共用 change() 已處理編輯歷史與失敗復原。groupSelection() 目前把選中節點篩選、邊界接線與套用集中在一個短函式內。現在 Uniform 節點會移入 Subgraph，但其引用的宣告仍在 Shader 層。未實作「連 Uniform 節點也留在外面」。

## 查證來源

- 原始交接規格：[v2 §6](../specs/shader-graph-handoff-v2.md)。原規格用於理解偏差原因，並非不得修改的規則。
- [TD：Write a GLSL MAT / Geometry Attributes](https://derivative.ca/UserGuide/Write_a_GLSL_MAT#Working_with_Geometry_Attributes)
- [TD：GLSL MAT](https://derivative.ca/UserGuide/GLSL_MAT)
- [TD：GLSL TOP](https://derivative.ca/UserGuide/GLSL_TOP)
- [TD：TOP POP Attributes](https://derivative.ca/UserGuide/Write_a_GLSL_TOP#POP_Attributes)
- [GLSL 4.60：Comments](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.html#comments)

已核對本機 TD 2025.32820 隨附離線文件；未執行新的 TD 原生 Attribute／Buffer 探針。
