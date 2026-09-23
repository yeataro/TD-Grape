# 目前節點分類整理（0.8.213）

2026-09-23，基準 `bf4e7fb`。本次整理現況與建議，不移動產品選單或改寫節點身分。完整逐節點資料見 [342 列 CSV](NODE_CLASSIFICATION_2026-09-23.csv)；待辦見 [最新盤點](TODO_AUDIT_2026-09-23.md)。

## 如何計數

- Catalog 有 **342 份定義**。固定型別入口、TD 來源選項、Subgraph 資產與同名 overload 不等於獨立定義數。
- 表中「定義數」採現行 `browserMeta()` 的主分類，包含舊圖相容定義及邊界；不是只看 JSON 的 category。
- 三種情境的入口數由隔離 Chromium 執行現行 `browserIndex()` 取得：空白根圖、無個人資產／自訂結構／本地 Subgraph，保留 4 個內建色彩 Subgraph。固定型別與可用內建來源均展開；Generated GLSL 尚未建立。
- 入口數依 Target、Stage、當前圖與個人庫而變。Output 邊界及舊 Float／Vector Constant 等由 `availableEntries()` 排除；已存在的單例與所在 Subgraph 也影響可新增項目。
- 主分類只計一次。secondary category 可以讓同一項出現在多個分支，不應當作新節點重複計數。本次沒有改使用者的圖。

## 實際分類與數量

| 分類 | 定義數 | TOP Pixel 入口 | MAT Vertex 入口 | MAT Pixel 入口 |
| --- | ---: | ---: | ---: | ---: |
| math／數學 | 229 | 192 | 187 | 216 |
| vector／向量 | 8 | 23 | 23 | 23 |
| matrix／矩陣 | 21 | 39 | 39 | 39 |
| logic／邏輯 | 11 | 11 | 11 | 11 |
| color／色彩 | 26 | 8 | 8 | 30 |
| coordinate／座標 | 4 | 1 | 2 | 2 |
| texture／貼圖 | 7 | 3 | 2 | 6 |
| data／資料 | 18 | 42 | 48 | 38 |
| shader／Shader | 12 | 4 | 8 | 6 |
| uncategorized／未分類 | 6 | 5 | 5 | 4 |
| 合計 | 342 | 328 | 333 | 375 |

目前 Math 的 229 份定義中，**203 份直接放在 Math 根層**。既有五個子類只收納 26 份：四則／基本運算 6、插值 2、範圍 14、三角 2、指數 2。這是後續大量擴充未一起整理分類造成的落差。

## 查到的分類問題

| 問題 | 實際證據 | 整理方向（尚未套用） |
| --- | --- | --- |
| Catalog 與 UI 分類投影不同步 | Math、Switch、Generated GLSL、Attribute 已有 catalog 分類，但內嵌 `node-browser-data` 沒有對應項；實際回退未分類 | 先同步這四項已存在的分類；建立可重現的投影一致性檢查 |
| 內建來源缺分類資料 | Constant、TOP Input 沒有 browser metadata，回退未分類；Spec Constant 靠前端特例落在 Shader | 明確統一來源入口的 metadata，而非繼續新增特例 |
| Math 過度集中 | texture*／texelFetch、TD 光照／陰影、distance／cross／reflect、Boolean And 等都在 Math | 按功能移至貼圖、Shader／光照、向量、邏輯；保留搜尋別名 |
| 新舊三角／指數不在同一分支 | Sine／Cosine 有 trigonometry；tan／asin／atan 等在 Math 根層。Power／Sqrt 有 exponential；exp／log 等在根層 | 同一運算家族歸在同一子類 |
| Array 原始分類不是目前 UI 分類 | Array 系列的 catalog category 是 array，但目前頂層沒有 array；前端複合型別分支統一覆寫為 Data | 決定沿用 Data／Array 子類，再統一資料與投影；不是功能不存在 |
| Source token 不一致 | POP Buffer 的 effective source 是 `touchdesigner`，其他 TD 項用 `td` | 統一顯示／篩選來源識別，不改序列化 definition UUID |
| 同名節點容易混淆 | Texture 2D 有舊整合取樣與新取樣定義；Noise Deriv 有不同輸出簽名 | 列清簽名、輸出與用途；舊圖相容定義不能直接刪除 |
| 舊文件仍寫獨立 This Project 或 Function 圖 | 現行已是 Library 的 This Shader 分頁，Subgraph 展開產碼 | 以本表及 0.8.201–203 行為為準；原始文件保留歷史標示 |

## 建議的功能分類

先保留現有頂層，整理下層；不因本次盤點自動新增分類或移動 UI。

| 主分類 | 建議子類／內容 | 代表節點 |
| --- | --- | --- |
| Math | 基本運算、插值、範圍與取整、角度與三角、指數與對數、Noise、微分 | Math、Add、Mix、Clamp、radians、exp、Perlin Noise、dFdx |
| Vector | 建立／拆分／重排、幾何運算 | Vector、Combine、Split、Swizzle、Dot、distance、cross、reflect、refract |
| Matrix | 建立／存取、代數、變換矩陣 | Matrix、Get／Set、Transpose、Inverse、TDRotate*、TDCreateTBNMatrix |
| Logic | 比較、布林、選值 | Compare、If、Switch、lessThan、any／all、Boolean And／Or／Not |
| Color | 建立／拆分、色彩模型、色域、Transfer | Color RGBA、Compose／Split RGBA、HSV、TDLuminance、TDTransfer* |
| Coordinate | UV／投影／映射、幾何變形 | Texture Coordinates、TDDeform*、World to Projection、Cube／Equirectangular、Triplanar |
| Texture | 取樣、尺寸／LOD 查詢、Fetch／Gather、投影、Buffer | texture*、texelFetch*、TDBicubic／Tricubic、TDProjTexture*、Buffer Fetch |
| Data | Scalar／Convert、位元與打包、Array／Struct、編輯輔助 | Scalar、Convert、pack／unpack、bitfield*、Array、Field、Note、Generated GLSL、Router |
| Shader | 來源引用、Stage 介面／輸出、光照／材質／陰影、手寫碼 | Uniform、Constant、Spec Constant、Attribute、Vertex Inputs／Outputs、Phong／PBR Lights、GLSL Code |
| Uncategorized | 未指定分類的使用者資產 | 不作為已知內建節點的預設堆放處 |

邊界待 review：Router／Note／Generated GLSL 可先留 Data 的「編輯輔助」，是否另開 Utility 頂層再決定；Boolean Mix 是選值或插值、位元運算放 Data 還是 Math，宜一次定案。取樣函式以用途歸 Texture，TD／GLSL 是來源篩選，不應取代功能分類。Vertex Inputs／Outputs 建議同歸 Stage 介面，目前 Vertex Inputs 在 Coordinate。

## Sources 與 Library 是另一個維度

Sources 預設頂層優先為 Uniform、Graph Constants、Spec Constants、POP Buffers，接 Common、Textures、TD Built In；使用者可拖曳改順序，空分類和不適用 Target 可隱藏。

- Uniform：數值、矩陣、陣列。
- Common：時間、座標、輸出資訊、Shader 資訊。
- Textures：TOP Inputs 或 MAT Samplers、Texture Buffers；TD 內建集合再按 2D、3D、2D Array、Cube 分組。
- TD Built In：Geometry（含自訂 Attribute 入口）、Instances、Matrices、Cameras、Lights、Render、Resources。
- source catalog 目前有 **58 個 builtins、6 個時間 Uniform presets、2 個 nodeSources**。可用性仍依 Target／Stage；這些數字不能直接加到 342 定義數。

Library 的 **All／This Shader／Built-in／Personal** 是資產歸屬，不是運算分類。This Shader 包含未使用但仍保存的 Subgraph 定義，不是 TD Project，也不是只有目前 Stage 上出現的引用。個人／本地分類編輯與未使用定義管理仍是已知問題。

## 核對與限制

核對 `node_catalog.json`、`source_catalog.json`、`index.html` 的分類投影、`graph_ui.js` 的 browserMeta／browserIndex／browserTree、`functions_ui.js` 的 availableEntries、`inspector.js` 的 renderSourceCards。隔離瀏覽器三種情境零 page error，逐列 CSV 為 342 個唯一 key／UUID；原始核對資料留私人 reports/audit-213/。

這是分類調查，不是每個節點的數值正確性測試，也不是完整 GLSL 標準缺口驗收。類型變體、TD 宿主版本、資源綁定與完整材質流程應另外核對。
