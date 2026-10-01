# 產碼與目標相容

本文記錄 Generator 的責任、ISF 圖與 Pass 的層級，以及方言節點的轉換方式。設計優先 TouchDesigner，再支援 ISF，之後才擴展 FFGL；不是本輪實作或發布承諾。總覽見[重構計畫入口](README.md)。

## Generator 的位置

產碼能力由 Grape 提供，入口以 `Grape.generator.top`、`.mat`、`.isf` 示意。共用的 `generate(graph)` 可以依圖種類分派；精確方法簽章與結果 class 名待細化。

Graph 保存及查詢當前圖；`Graph.updates` 安排這張圖的必要驗證與產碼。Generator 是可被呼叫的能力，並不自行決定每次滑鼠操作是否需要產碼，也不由 Editor 獨占觸發入口。

```text
呼叫產碼，固定本次圖版本與目標
    ↓
Graph／Stage／NodeType 等依責任驗證
    ↓
追溯 Stage、Network、子圖、終端與輸入依賴
    ↓
呼叫 node.nodeType.generator 及共用能力
    ↓
整合程式、來源／綁定需求、資源與診斷
    ↓
回傳結果，由 Binding 決定交付及處理回應
```

各節點 generator 表達該節點的產碼能力；整體 Generator 管理目標程式的組合。每次工作有自己的上下文，處理輸入與本地值、Edge 轉換、合法符號、型別宣告、helper 去重、依賴及位置對照。共用 NodeType 不保存個別工作的可變暫存。

產碼結果應帶有本次圖版本／目標的對應資訊、Stage 程式與宿主需要的來源、綁定或資源描述，以及診斷及物件位置關聯。宿主不必遍歷整張編輯圖才能套用；完整圖的序列化與保存仍是另一條能力。

一次產碼使用同一個一致的圖版本；過程中發生的新修改留給後續工作。可用快照或其他方式保障一致性，不在此固定複製算法。重產、快取、比較結果及過期工作處理見[操作與更新](UPDATES_AND_HISTORY.md)。

## 產碼讀取圖但不修改圖

Generator 及 NodeType 的生成行為只讀取本次一致的圖狀態。需要建立接口、初始化來源或調整設定的工作，經由正常初始化或編輯能力完成，不在產碼途中偷偷補進圖。

本次產碼的符號、helper 集合、暫存與程式片段留在工作上下文及結果中。錯誤由診斷回報；Generator 不自行修圖，也不產生圖編輯的 History 紀錄。開啟程式碼檢視不因此改變圖資料。

## Helper 與接口映射的分工

模組維護自己的 Shader helpers，NodeType 引用需要的內容；Generator 負責收集、依賴排序、合法命名及相應 Shader 內的去重。不同模組的同名函式保持獨立，不自動按名稱或內容合併。共用引用格式尚待定義，見[節點模組與型別](NODE_DEFINITIONS.md)。

Stage 的接口節點與子圖的接口節點沿用 NodeType 的生成契約。Input／Output 提供資料型別與引用關係，節點生成行為與整體 Generator 才負責 Shader 邊界或子圖展開的映射。

## 圖種類與 ISF 的範圍

保留 TD TOP、TD MAT 與 ISF 三種圖。ISF 圖可以輸出標準 ISF，也可由 TD 的 ISF 承載方式執行；不強迫所有 TD 圖採用跨宿主能力的最小集合。

TOP、MAT、ISF 都能包含 Vertex 與 Pixel Stage，未自訂的階段可以沿用目標預設實作。TD GLSL TOP 本身也可指定 Vertex Shader，詳見 [Write a GLSL TOP](https://derivative.ca/UserGuide/Write_a_GLSL_TOP)。

ISF 圖初期使用通用 GLSL 計算及 ISF 的來源、內建值、取樣便利能力。TD 專有函數不因 ISF 正在 TD 執行就自動開放；本輪不全面重作 TD helpers。可由後續模組逐個提供可攜的方言節點。

目前以影像、參數及圖像輸出作為可攜範圍。ISF Vertex 操作宿主提供的平面幾何或預先計算資訊；ISF 2.0 沒有標準化任意 mesh 輸入。未來草案的 3D／Geometry 能力不納入當前基準。參考 [ISF Vertex Shader](https://docs.isf.video/primer_chapter_5.html)。

## Passes 是 ISF 圖的設定

**Pass 不包住 Stage，也不各自擁有一份 Network。** ISF Graph 保有一組 Vertex／Pixel Stage，另外持有 `passes` 設定列表。

```text
ISF Graph
├─ stages
│  ├─ vertex
│  └─ pixel
└─ passes
   ├─ Pass 設定 0
   └─ Pass 設定 1
```

每項 Pass 設定描述列表順序、目標緩衝名稱、尺寸、浮點格式及是否 persistent。ISF Generator 將它們輸出為 JSON 的 `PASSES`。各輪運算可在共用程式中依 Pass Index 分支，不必在模型中建立每個 Pass 各自的 Stage。

標準 ISF 使用一份 Fragment Shader 與可選的對應 Vertex Shader，每個 Pass 重複執行。`PASSINDEX` 是執行期 Uniform，不是必然會被編譯期刪除分支的常數；是否分支由程式決定。命名緩衝可供後續 Pass 取樣，persistent 內容可保留到下一幀。讀到哪個版本取決於該緩衝在本幀是否已被寫入，不是一律讀前一幀。參考 [ISF Multi-Pass](https://docs.isf.video/ref_multipass.html)。

同一份 Vertex 也會逐 Pass 執行；參考實作提供 `PASSINDEX` 與隨輪次可能不同的 `RENDERSIZE`。依據為 [VVISF ISFDoc 宣告](https://github.com/mrRay/VVISF-GL/blob/master/VVISF/src/ISFDoc.cpp)與 [ISFScene 執行流程](https://github.com/mrRay/VVISF-GL/blob/master/VVISF/src/ISFScene.cpp)。

## TD 與 ISF 的 Pass 差異

TD GLSL TOP 的 Num Passes 在一般 Vertex／Pixel 模式下，把前一輪輸出用作下一輪第一個輸入，其餘輸入及參數維持；Feedback TOP 則可提供跨幀回饋。它不等於 ISF 的命名中間目標與個別 persistent 設定。參考 [GLSL TOP](https://derivative.ca/UserGuide/GLSL_TOP)及 [Feedback 教學](https://learn.derivative.ca/courses/100-fundamentals/lessons/102-tops-working-with-images/topic/creating-a-feedback/)。

TD 承載 ISF 的設計方向是多個 TOP 引用共用 Shader，按 Pass 設定配置輸入、輸出、尺寸與所需的 Feedback；實際配置不是一定只沿單一直線串接。緩衝管理是宿主執行責任，不能只在 GLSL 裡寫 if 取代。

多個各自只有一輪的 TOP，其 `uTDPass` 不會自動變成全局 ISF Pass Index；承載方式需要提供各個 Pass 的正確索引。

TD 目標可保留用 Uniform 或特化常數提供固定 Pass Index 的選項；標準 ISF 輸出維持 Uniform `PASSINDEX`。特化常數可讓固定條件有編譯最佳化機會，但不是所有 Uniform 型別／資源的通用替代，也不保證各平台的效能。預設策略及成本需實測。參考 [TD Specialization Constants](https://derivative.ca/UserGuide/Specialization_Constants)。

## 方言節點由後加入的模組定義

方言是實際的另一個 NodeType。後加入的 NodeModules 模組可以宣告它對應／替換哪些既有 NodeType，以及適用的圖種類、Stage 與目標；原本的模組不用預先知道未來的方言。

註冊時可收集這些關係，供匯入或切換目標查詢。需要轉換時，圖內 Node 真正改為目的 NodeType，之後依新定義編輯、驗證及產碼；不把這個決策改寫成「每次產碼時偷偷替換實作、圖內仍是舊型別」。

切換回另一種圖／目標時，先檢查目前 NodeType 是否已支援；支援就保留，不強制換回原件。不支援才查找轉換關係。接口與設定契約等價時可逆查同一關係，不強制重寫一份反向轉換；需要有損映射、碰到多個候選或設定語意不同時，仍須明確規則，不能推定必定可逆。

## 定義更新與接口相容

模組可提供明確的版本／接口相容映射，提供時優先使用。沒有提供時，依輸入與輸出各自的接口順序嘗試對應，再驗證型別、值與接線；不要求每個模組都提供完整遷移程式。

不能保留而斷開的連線必須警告，指出受影響節點及接口。圖的保存格式要保留足夠的原接口順序與引用資料，以便舊模組缺少時仍能解讀；精確格式待定。按順序回退不保證語意完全相容。

只改產碼內部最佳化，與改接口或保存設定契約，應分開辨認。版本欄位、重載時機、候選衝突及完整轉換報告的格式，保留在[待討論事項](OPEN_QUESTIONS.md)。
