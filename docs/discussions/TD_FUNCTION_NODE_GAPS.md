# TD 內建函式節點缺口盤點

2026-09-21，核對 Grape **0.8.163**（`5488f1b`）的 catalog／編譯器與當日 TD TOP／MAT 公開指南。目標 TD build 為 2025.32820；本次為靜態盤點，**未對新增候選逐項執行原生 Shader 編譯或渲染測試**。公開文件可查到不等於這個 build 的所有 overload 都已驗證。

使用者後續將 Alpha 範圍補充為 GLSL、TD 函式、MAT Attribute／來源、Sources 命名與自訂參數整理，見 [Alpha 範圍筆記](ALPHA_SCOPE_2026-09-21.md)。**本頁只完成 TD 函式這一份盤點；GLSL 標準函式完整缺口表尚待另查。使用者仍在補充需求，因此下方分類不是工作順序。**

## 結論與計數方式

以既有來源研究中的 **124 個 TD 函式名稱／動態家族**逐項對照，並核對目前公開指南：

| 狀態 | 數量 | 意義 |
| --- | ---: | --- |
| 已有運算節點 | 9 | 已有正式入口；仍不代表每個原生 overload 都已覆蓋。 |
| 已有具名來源入口 | 17 | 包含 TD Position 與 catalog 中的讀值 accessor。 |
| 已有動態來源家族入口 | 2 | `TDBuffer_<name>`、`TDBufferLength_<name>`；實際名稱由來源配置產生。 |
| 部分支援的家族 | 1 | `TDAttrib_<name>`：已有目前頂點讀值，缺指定其他 vertexIndex 的入口。 |
| 編譯器自動使用 | 4 | 已有產碼支援；沒有獨立節點不等於缺功能。 |
| 缺獨立入口 | 87 | 82 個運算候選、1 個來源家族、2 個 Render Image 家族及 2 個 Picking 函式。後兩類另有執行流程需求。 |
| 其他 Stage／範圍待定 | 3 | Compute 的 output image load／store，以及 TOP Vertex 範例中的 `TDSOPToProj`。 |
| 版本與既有流程關係待核對 | 1 | `TDCheckOrderIndTrans` 與目前使用的 `TDCheckDiscard`。 |

完整逐項對照見 [CSV](TD_FUNCTION_NODE_GAPS.csv)。這是**函式名称／家族數，不是承諾新增 87 顆 UI 節點**：overload 可能共用同一節點；Transfer 等相關函式也可共用操作選擇器。也不宣稱包含未公開 API、TD Python 方法或所有 OP。

舊 [來源 CSV](TD_SOURCE_NAMING_CATALOG.csv) 的「非來源」只代表不該列在來源面板，不能讀成已有運算節點；「GLSL Code 可手寫」也不能算作已交付正式入口。

## 缺口按能力分類

| 類別 | 尚缺的函式／家族 | 需要處理的部分 |
| --- | --- | --- |
| 數值與矩陣（12） | `TDAverage`、`TDRotateToVector`、`TDRotateOnAxis`、`TDRotateX/Y/Z`（3 個）、`TDTranslate`、`TDScale`、`TDCreateRotMatrix`、`TDExtractRotation`、`TDSlerpRotationMatrices`、`TDInterpolateTransformMatrices` | 已有 scalar／vector／matrix 基礎；補接口、適用型別與產碼，核對角度及矩陣約定。 |
| Quaternion（7） | `TDAxisAngleToQuaternion`、`TDQuaternionToRotMatrix`、`TDRotMatrixToQuaternion`、`TDRotateFromQuaternion`、`TDQuaternionMultiply`、`TDSlerpQuaternions`、`TDQuaternionFromTo` | 可使用現有 vec4／mat3；不必先引入新的全域 Quaternion 型別。 |
| Noise／Fade（4） | `TDFade`、`TDFadeDeriv`、`TDPerlinNoiseDeriv`、`TDSimplexNoiseDeriv` | 既有 Perlin／Simplex 不代表導數已完成；含 out 參數的版本要用同一次呼叫供應多個輸出。 |
| 色彩（23） | `TDLuminance`、`TDGamutRec709ToRec2020`／反向，以及 20 個 `TDTransfer*` 函式，逐項名稱見 CSV | Gamma 1.8／2.2／2.4／2.6／2.8、sRGB、Rec709、ACESproxy、BT2100 HLG、ST2084 PQ 的雙向轉換。核對 alpha／預乘與各 overload，不自行統一不同曲線。 |
| 取樣與座標映射（7） | `TDBicubicInterpolation`、`TDTricubicInterpolation`、`TDTriplanarBlend`、`TDTexGenSphere`、`TDCubeMapToEquirectangular`、`TDEquirectangularToCubeMap`、`TDSineLookup` | 純座標函式與 sampler 函式分開驗收；取樣須有對應維度的實際來源配置。 |
| MAT 幾何／Instancing（13） | `TDDeformNorm`、`TDDeformVec`、`TDSkinnedDeform`、`TDSkinnedDeformVec`、`TDInstanceDeform`、`TDInstanceDeformVec`、`TDInstanceTexCoord`、`TDInstanceColor`、`TDInstanceTexture`、`TDCreateTBNMatrix`、`TDQuadReproject`、`TDFrontFacing`、`TDPixelColor` | 既有 TDDeform 已包含部分宿主處理；獨立較低階操作要明確說明輸入／輸出的座標空間，避免使用者重複變形。逐項核對 Stage 與 Instancing 資料傳遞。 |
| MAT 光照／陰影（16） | `TDLighting`、`TDLightingPBR`、`TDEnvLightingPBR`、`TDHardShadow`、`TDSoftShadow`、`TDAttenuateLight`、`TDFog`、`TDProjMap`、`TDEnvLightTextureLod`、`TDShadowTexture`／`TDShadowTextureProj`、`TDCompareShadowTexture`／`TDCompareShadowTextureProj`、`TDProjTexture`／`TDProjTextureProj`、`TDConeLookup` | 需要燈光／陰影／環境貼圖的真實 Render 場景。`TDPBRResult`、`TDPhongResult` 尚未登記為現有來源結構；須補宿主型別描述，核對回傳／inout 簽名與 Field 輸出方式。 |
| Attribute 來源（1） | `TDTexAttrib_<name>(layer)` | 補指定貼圖層的 accessor；與已有 `TDAttrib_<name>` 的 arrayIndex／vertexIndex 是不同能力。 |
| Render Image（2） | `TDImageLoad_<name>`、`TDImageStore_Name` | 需要 Render TOP image 配置；讀值與寫入副作用分開處理，不能直接照一般值節點的可達性規則執行寫入。 |
| Picking（2） | `TDPickAdjust`、`TDWritePickingValues` | 需要 Render Pick 分支、資料與輸出契約；不只是在選單多放一個函式。 |

函式存在與宿主語意核對：[TD TOP 指南](https://derivative.ca/UserGuide/Write_a_GLSL_TOP)、[TD MAT 指南](https://derivative.ca/UserGuide/Write_a_GLSL_MAT)。本表主要用於比對 Grape 入口缺口；精確簽名仍以實作時目標 TD build 的驗證為準，不複製指南範例作為產品契約。

## 已有能力與仍需查核的邊界

**9 個既有運算入口：** TDDeform、TDWorldToProj、TDRGBToHSV、TDHSVToRGB、TDRemap、TDLoop、TDZigZag、TDPerlinNoise、TDSimplexNoise。對應 `deform`、`to_clip`、`rgb_to_hsv`、`hsv_to_rgb`、`remap`、`loop`、`zigzag`、`perlin_noise`、`simplex_noise`。`range_from`／`range_to` 等其他公式也已存在，但不是新增的 TD API 名稱。

**來源 accessor 沿用來源分類。** `TDBoneMat(index)`、`TDInstanceMat(index)`、`TDTexCoord(layer)` 等只有選取資料用的 index／layer，不因有輸入接孔而改歸運算。反之 `TDInstanceColor(index, color)` 和光照函式的待處理資料仍使它們歸運算。具體分類按 [Alpha 筆記](ALPHA_SCOPE_2026-09-21.md) 的使用者最新界線。

**目前編譯器已自動呼叫：** MAT pixel main 的 `TDCheckDiscard`，MAT Color Output 的 `TDAlphaTest`／`TDDither`，TOP／MAT Color Output 的 `TDOutputSwizzle`。若之後要讓使用者手動控制，應先釐清與自動流程的關係；不能直接把它們再套一次。

**Attribute 是部分完整。** `attribute` emitter 現在產生 `TDAttrib_name(arrayIndex)`；沒有供指定其他頂點的 vertexIndex 接孔。一般 Attribute／Matrix Attribute 設定管理已存在，不能整塊列成未實作。`TDTexAttrib`、幾何缺失情形、Instancing／跨 Stage 工作流程仍需各自核對。

**結構基礎已可沿用，但宿主結構不是自訂結構的同義詞。** 目前 source catalog 登記 TDTexInfo、TDMatrix、TDCameraInfo、TDLight、TDGeneral、TDEnvLight，未含兩種 lighting result。不能直接重新宣告 TD 已定義的同名 struct；需沿用宿主型別的識別與欄位契約。多输出產碼已有模式可參考，不因此先重做全域型別系統。

**Stage 和版本另列。** `TDImageLoadOutput`／`TDImageStoreOutput` 属 Compute；`TDSOPToProj` 出現在 TOP Vertex 文件範例，目前 Grape 的 TOP Pixel／MAT Vertex+Pixel 範圍不能直接上架。現行 MAT 指南仍列 `TDCheckOrderIndTrans`，本次不認定它已棄用；需查目標版本與既有 discard 流程的關係。

## 盤點證據與驗證界線

- [節點 catalog](../../src/library/node_catalog.json)：目前有 88 份 definition 記錄；這不是 88 個待補函式，也不等於 UI 所有固定型別入口數。
- [來源 catalog](../../src/library/source_catalog.json)：來源 expression、index 接孔、適用 Target／Stage、結構登記。
- [編譯器](../../src/core/sgrape_core.py)：函式對照表、動態 Attribute／Buffer 呼叫、輸出與 MAT main 的自動處理。檢查包含字典映射，不只搜尋字面上的 `TD...(`。
- [矩陣能力](../features/MATRIX_NODES.md)、[陣列與結構](../features/ARRAYS_AND_STRUCTURES.md)、[來源計畫](SOURCE_COMPLETION_PLAN.md)：沿用基礎與實測限制；舊階段敘述須對照最新版本。
- CSV 已檢查 124 個名稱／家族唯一、全部有分類與狀態；公開指南中觀察到的動態家族名稱已正規化，示例 Attribute 名不另計數。
- 本次沒有新增節點、改圖格式、改來源設定或重編使用者 Shader。完整標準 GLSL 盤點、逐 overload 原生 probe、完整 MAT 情境驗收仍是後續工作；不把本文件視為已完成那些能力。
