# 來源選單分類表（審查稿）

2026-09-19。依 [來源與命名總表](TD_SOURCE_NAMING_RESEARCH.md) 及本輪使用者審查整理；對照產品 0.8.120。這份文件提出選單分類，尚未修改 UI 或新增來源能力。原始 311 筆盤點保留於 [CSV](TD_SOURCE_NAMING_CATALOG.csv)，新增分類與審查欄位供逐項查閱。

2026-09-20 補充：[來源建構與型別共識](SOURCE_ARCHITECTURE_REVIEW.md) 決定以資料區分分類與建構行為，並允許來源節點同時提供完整結構與欄位出口。因此下表「先沿用 Array／Field」描述當時可用方式，不限制後續必須額外接 Field 才能讀欄位；具體快捷出口與 MAT Attribute 預置仍待整理。本表與 CSV 仍是審查資料，不是已實作的來源 registry。

## 本輪已收斂的方向

- 時間基本預置保留六項；Timeline Rate 移出，保留 Delta Time。Clock／CHOP 的時間細項、播放範圍、Loop、Play、Tempo、拍號與 Timecode 留在研究表，交由使用者自行新增。
- 共通來源、Texture 與 TD 內建來源按用途分組；分類入口固定，TD 名稱／共同別名的切換只影響顯示名稱。
- 同一來源有一個主要分類。搜尋可命中別名，不因此新增一份來源。
- 下方具體分組、非時間項目的收錄範圍及英文標籤仍是提案；表中「候選」不代表已支援或已獲准實作。

## 第一級與第二級

「第一級 → 第二級 → 項目」表示分類、子選單和可選來源；不是要求每組再增加第三級分類。空組不顯示，只有少量項目的入口可直接列出。

| 第一級分類 | 第二級分組 | 放入哪些項目／來源家族 | 本輪處理 |
| --- | --- | --- | --- |
| Common Sources／共通來源 | Time／時間 | 六個時間與幀預置，詳見下表 | 保留六項；四項既有，兩項待擴充 |
| Common Sources／共通來源 | Coordinates／座標 | Texture Coordinates、Fragment Coordinates、Point Coordinates | 候選；保留 TOP／MAT、stage、型別與座標語意差異 |
| Common Sources／共通來源 | Output／輸出資訊 | Output Resolution、Output Pixel Size、Viewport Origin、Viewport Resolution | 候選；TOP 輸出與 MAT viewport 分開標示 |
| Common Sources／共通來源 | Shader Info／Shader 資訊 | Front Facing、Primitive ID、Sample ID／Position 等唯讀系統值 | 進階候選；逐項確認版本與 stage，數量少可再併組 |
| Texture Inputs／紋理輸入 | 2D | TOP 的 2D 輸入／Info／Count；MAT 配置為 2D 的具名來源 | 既有能力優先，未實作項另標示 |
| Texture Inputs／紋理輸入 | 3D | TOP 的 3D 輸入／Info／Count；MAT 對應具名來源及切片資訊 | 擴充候選 |
| Texture Inputs／紋理輸入 | 2D Array | TOP 的 2D Array 輸入／Info／Count；MAT 對應具名來源 | 擴充候選；此為紋理種類，不是一般資料陣列 |
| Texture Inputs／紋理輸入 | Cube | TOP 的 Cube 輸入／Info／Count；MAT 對應具名來源 | 擴充候選 |
| Texture Inputs／紋理輸入 | Buffer | 配置的 Texture Buffer／samplerBuffer | 擴充候選；不與 Uniform Array 混用 |
| Texture Inputs／紋理輸入 | 1D | 尚未確認本輪 TOP／MAT 的對應來源入口 | 僅留審查位置；不顯示空選單、不假造 `sTD1DInputs` |
| Custom Uniforms／自訂 Uniform | Values／數值 | 已配置的 scalar／vector／color Uniform | 分組候選；Color 的色彩轉換性質保留 |
| Custom Uniforms／自訂 Uniform | Matrices／矩陣 | 已配置的 Matrix Uniform | 分組候選 |
| Custom Uniforms／自訂 Uniform | Arrays／陣列 | 已配置的 Uniform Array | 分組候選；使用者自行配置 CHOP Array 的能力保留 |
| Constants／常數 | 直接列出 | 圖內建立的常數 | 保留入口；將 Graph Constants 簡化為 Constants 仍待確認 |
| Spec Constants／特化常數 | 直接列出 | 已配置的 specialization constants | 保留入口；不再加一層空分類 |
| TD Built-ins／TD 內建 | Geometry／幾何 | Position、Normal、Point Color、UV Unwrap、Bone Matrix、具名 Attributes | 候選；來源 accessor 可在此，不包含變形運算 |
| TD Built-ins／TD 內建 | Instances／實例 | Instance ID、Instance Matrix、Instance Texture Index、自訂 instance attributes | 候選；使用 TD 的實例對應語意 |
| TD Built-ins／TD 內建 | Matrices／矩陣 | `uTDMats[]`，以及其物件／相機／投影／法線矩陣欄位 | 保留集合來源；欄位先沿用 Array／Field |
| TD Built-ins／TD 內建 | Cameras／相機 | Camera Index、True Camera Index、`uTDCamInfos[]`、camera count | 集合及 accessor 候選；欄位先沿用 Array／Field |
| TD Built-ins／TD 內建 | Lights／燈光 | `uTDLights[]`、環境燈／buffer、Ambient Color、對應數量 | 集合來源候選；取樣、陰影計算另歸運算 |
| TD Built-ins／TD 內建 | Render／繪製資訊 | `uTDGeneral`、`uTDOutputInfo` 完整結構、Pass Index、Output Slice、Color Buffer Count | 保留原生集合及 TD 特有資訊；共通快捷不重複上架 |
| TD Built-ins／TD 內建 | Textures／內建貼圖 | `sTDNoiseMap`、`sTDSineLookup` | TD 固定資源；不混入使用者 Texture Inputs |
| TD Built-ins／TD 內建 | Buffers | 使用者配置的 POP attribute buffer、Length、Attribute Array Size | 擴充候選；不等於新增 GLSL POP 宿主 |
| TD Built-ins／TD 內建 | Compile Context／編譯環境 | TD stage／render／picking 條件巨集 | 保留研究分類；先不直接當成值來源上架 |

上述分組是可審查的歸屬表，不要求一次新增所有選單。Geometry Shader／Compute Shader 專用項及後端差異項保留資料，實際入口依已支援宿主與 stage 提供。

## Time：六個基本預置

| 項目 | TD 主名稱 | 現況 |
| --- | --- | --- |
| Absolute Time | `absTime.seconds` | 已有預置 |
| Absolute Frame | `absTime.frame` | 已有預置 |
| Timeline Time | `me.time.seconds` | 已有預置 |
| Timeline Frame | `me.time.frame` | 已有預置 |
| Delta Time | `absTime.stepSeconds` | 待擴充 |
| Frame Step | `absTime.step` | 待擴充 |

時間欄位保留原始 float 型別與原先記錄的時鐘語意。Delta Time 指 TD 全域 frame 起點間隔，不冒充某一 TOP 的 cook 間隔。

| 留在研究表的時間資料 | 預置處理 | 決策狀態 |
| --- | --- | --- |
| Timeline Rate | 使用者自行新增 | 使用者明確移出 |
| Play、Loop、Start／End、Range Start／End、Tempo、拍號、Timecode | 使用者自行新增 | 依本輪使用者審查；Timecode 為字串，需自行轉成所需數值才可供 Shader 使用 |
| Clock CHOP 各時間／日期／天文分量、Feedback CHOP `dt` | 使用者自行新增 | 不提供這批專用預置；不影響 CHOP Array 或一般自訂 Uniform |
| Fraction、Independent | 建議使用者自行新增 | 依「基本常用項」原則整理，具體項目待確認 |
| Project Rate、System Time／Date | 建議使用者自行新增 | 助手建議，尚待使用者確認；不當成已撤回所有 System Time 需求 |

## 座標與輸出：容易混淆的歸屬

| 第二級 | 候選項目 | 來源／條件 | 呈現方式 |
| --- | --- | --- | --- |
| Coordinates | Texture Coordinates | TOP `vUV.st`；MAT `TDTexCoord(layer)` | 共通別名可相同，來源身分、型別與 stage 分別保留；MAT 有 layer 輸入 |
| Coordinates | Fragment Coordinates | `gl_FragCoord` | 完整 vec4 的 window coordinates，不改名成 UV |
| Coordinates | Point Coordinates | MAT `TDPointCoord()` | TD 方向處理保留；`gl_PointCoord` 留原生對照，不冒充同一結果 |
| Coordinates | `vUV` | TOP 完整原生 varying | 進階候選，是否另列入口待審；不替第三分量假造語意 |
| Output | Output Resolution／Output Pixel Size | TOP `uTDOutputInfo.res.zw`／`.xy` | 同一輸出資訊的常用快捷；不從輸入貼圖尺寸代替 |
| Output | Viewport Origin／Viewport Resolution | MAT `uTDGeneral.viewport.xy`／`1.0 / ...zw` | Viewport 可以是目標中的一部分，名稱保留 Viewport；後者是明確的派生快捷 |

## Texture：二級選單裡實際放什麼

| 二級分組 | TOP 來源 | Info | Count |
| --- | --- | --- | --- |
| 2D | `sTD2DInputs[]` | `uTD2DInfos[]` | `TD_NUM_2D_INPUTS` |
| 3D | `sTD3DInputs[]` | `uTD3DInfos[]` | `TD_NUM_3D_INPUTS` |
| 2D Array | `sTD2DArrayInputs[]` | `uTD2DArrayInfos[]` | `TD_NUM_2D_ARRAY_INPUTS` |
| Cube | `sTDCubeInputs[]` | `uTDCubeInfos[]` | `TD_NUM_CUBE_INPUTS` |

各組可用水平線區分「貼圖引用」與「Info／Count」，不再為三個項目多套一層子選單。是否提供 Count 獨立快捷仍待審查，原有長度契約照常保留。

MAT 的 `<samplerName>` 按實際 sampler 種類放入相應組，直接使用配置名稱；不改成 TOP 的輸入索引。CSV 中這個動態家族只列一筆，分組標記為「依已配置 sampler 種類」，不是要求 UI 顯示這串文字。目前專案僅有 sampler2D 路徑，其他種類不能因寫進此表就宣稱可用。

Resolution、Pixel Size、Depth／Layer 數與 slice offset 依附其 Texture Info。除了明確需要的快捷，不把每一個 `.res`、`.depth` 分量建立成獨立清單項；3D 與 2D Array 的單位差異沿用總表說明。`TDTexInfo` 的共用欄位適用多組，但欄位不是一份新的頂層來源，因此不產生重複入口。

## 什麼會出現在來源選單

| 資料性質 | 分類表中的處理 | 例子 |
| --- | --- | --- |
| 值來源、集合來源 | 可選項目候選；支援情況沿用總表 | 時間、`sTD2DInputs[]`、`uTDMats[]` |
| 來源 accessor | 可列為來源；輸入的 index／layer 仍保留 | `TDPos()`、`TDCameraIndex()`、`TDTexCoord(layer)` |
| 結構欄位 | 跟隨原集合，先沿用 Array／Field | camera fog、light position、matrix world 等；常用快捷另審 |
| 使用者配置家族 | 列出配置後的具名來源 | Uniform、sampler、attribute、buffer |
| 純運算、取樣、影像讀取 | 放運算／資源操作分類，不進此來源選單 | Noise、Deform、Shadow lookup、Image Load |
| 編譯条件巨集 | 研究資料；等條件／前處理能力決定入口 | `TD_VERTEX_SHADER`、`TD_PICKING_ACTIVE` |
| Shader 輸出、Picking payload、Atomic Counter 等可寫資料 | 不當成一般唯讀來源；另行界定功能入口 | `gl_Position`、Picking 回填、原子計數器 |
| 歷史名稱、文件拼字、尚未支援 stage／後端差異 | 保留對照或條件式候選，不直接上架 | `uTDMat`、`uTDOutputINfo`、Compute 系統值 |

因此不能只看「是不是函數」：讀取宿主資料的 accessor 可以是來源；對輸入做運算的函數不是來源。也不能只看「是不是 TD 名稱」：GLSL 原生唯讀系統值可列在 Common Sources 的相應分組，原生識別照實標示。

## CSV 欄位與待審項

CSV 原有 ID、TD／共同名、型別、scope、現況及證據不變，新增 `menu_category`、`menu_section`、`menu_role`、`review_decision`。非選單項的前兩欄留空；共用欄位標記「依來源種類」，屬於來源內的欄位歸屬。這些欄位只供文件審查，不是執行期的來源登記或新的支援承諾。

接續審查可直接逐組決定：哪些項目值得做快捷、哪些只留集合＋Field；Common 的 Shader Info 是否需要獨立一組；Texture 各維度／Buffer 的優先順序；TD 內建的上述分組是否過細。英文名稱仍可隨 review 縮短，尚未套用產品。
