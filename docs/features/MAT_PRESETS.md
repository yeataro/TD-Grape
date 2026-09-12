# TD-Sgrape：對應 TD 原生 MAT 的預設圖範本

2026-09-10。使用者新增的後續需求筆記；本次未建立範本、註冊新 TDFam 項目或更改目前 Shader。實作依既有核心與 Shader 能力的依賴排序；是否納入第一個 1.0 尚未指定。

## 已確認需求

在 TDFam 提供帶完整預設圖的 Sgrape MAT 建立項目，例如 **Sgrape PBR MAT**。使用者從 TD 原生 Tab／TDFam 選取後，取得的是內部已經有節點、連線與預設設定、可直接 Open Editor 編修的 Sgrape Shader。

使用者要求對 TD 現有 MAT 提供一比一對應的預設圖範本；**Line MAT 明確排除**，因為它較特殊。不能擅自把「一比一」縮成只有近似外觀或只有 PBR 一項，也不能把尚未驗證的全部原生能力稱為已支援。

TDFam 項目是建立 Shader 的入口；圖內的節點／Function 是其內容，兩者要在文件與 UI 名稱上分清楚。這項需求以可編輯 Graph 為成果，只包一個原生 PBR MAT 或放入未拆解的 GLSL 程式碼，不能算完成預設圖。

## 用語與建立行為

- **Sgrape MAT**：共同的材質 Shader 元件與運行機制；現有通用入口保留。
- **Sgrape PBR MAT** 等：建立時選擇的材質範本，帶對應原生 MAT 的預設圖。可共用同一個 Sgrape MAT 核心，不需要各自維護另一套編輯器或服務。
- **TD-Sgrape 主元件**：仍統一負責 TDFam 註冊及建立，不讓每個生成的材質再充當安裝主元件。
- 建議每次建立有獨立 Shader ID 與 Graph；共用 Function 來源繼續遵守既有唯讀／首次編修本地化規則。使用者改一個實例，不回寫範本或其他實例。這是沿用既有資料模型的實作方向。

## 一比一對應的盤點與驗收

先以實測 TD build 的原生 MAT 清單建立逐項對應表。官方 MAT 概覽列有 PBR、Phong、Constant、Depth、Point Sprite、GLSL 及 Line；這只是初步盤點來源，不當作該 build 的完整清單。除已排除 Line 外，其他特殊或工具性 MAT 若不能直接對應預設 Shader 圖，需逐項說明後再確認，不自行省略。[官方 MAT 概覽](https://derivative.ca/UserGuide/MAT)

每項對照包含原生名稱、Sgrape 範本名稱、Vertex／Pixel 圖、參數與預設值、貼圖／幾何／燈光需求、輸出與特殊渲染設定。目標是可核對的功能對應；每個未支援差異必須明列，不能只驗證一張相似的預览便宣稱一比一完成。

PBR 是使用者明確舉出的範例與優先研究對象。需要先核對法線、光照、環境光、相關貼圖與 TD 渲染環境；不能只用目前簡單 Color Output 假裝 PBR 已成立。圖內適合重用的計算可採 Function 分層，保持可讀與可編修，具體圖結構留到實作設計。

TD 官方 PBR MAT 提供 Output Shader，可輸出目前使用的 GLSL 供後續調整；可作為行為比對與研究線索，不能因此假設已有自動轉換為 Sgrape 節點圖的功能。[官方 PBR MAT 說明](https://derivative.ca/UserGuide/PBR_MAT)

## 建議執行順序

1. 在目標 TD build 盤點原生 MAT，列出範本與能力差距；把缺少的法線、光照、TD builtins 等需求帶回 Shader 能力工作。
2. 先用簡單 MAT 對應驗證範本建立、預设參數、可編輯性與渲染比較的流程，再完成 PBR 等依賴較多的對應。這是依賴排序提案，不改變一比一對應的需求。
3. 在相同幾何、燈光、相機與渲染設定下，比較原生 MAT 與 Sgrape 範本；涵蓋預設值、主要參數變動、貼圖與所需渲染情境。明列測試 TD build 與差異。
4. 驗證 TDFam 建立後已有正確圖、Open Editor 定位、公開參數與輸出可用；建立兩次後彼此獨立，保存重開／更新／移除主元件後的運作沿用既有驗收。

Line MAT 不列入這項實作或驗收。PBR／Phong 等具體完整性仍以對應表與實機結果確認；本筆記不表示範本已交付。
