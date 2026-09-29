# 待辦與未實作功能盤點（0.8.213）

2026-09-23，基準 `bf4e7fb`。依最新交付紀錄、目前程式與既有筆記核對，取代 [9 月 21 日盤點](TODO_AUDIT_2026-09-21.md)作為目前索引。本文是調查，不代表把所有項目排入 Preview 或授權立即實作。節點分類另見 [目前分類整理](NODE_CLASSIFICATION_2026-09-23.md)。

狀態分成：**未實作**（有明確缺口）、**部分完成**（已有功能但範圍不足）、**已知問題／待重現**、**待設計／候選**、**重構後／排除**。舊文件寫「尚未完成」不等於目前仍缺；測試通過也不等於所有場景完成。

## 材質快捷子圖待辦（2026-09-29 補充，0.8.261）

**最新決策：新增功能必須以 Windows／macOS 雙平台相容為前提，不支援雙平台的功能不做。Geometry Shader 因此排除；自動法線重算暫緩，下面的替代方式僅保留討論背景。**

以下四項已於 0.8.261 實作為內建、可編輯子圖，未加入預設圖。目標是提供常用材質操作便利性，不宣稱完整複製 Blender 節點的全部模式。具體用法見[材質輔助子圖](../features/BASIC_MATERIAL_PRESETS.md)。

| 項目 | 用途與待決範圍 |
| --- | --- |
| **View Direction** | 已完成。MAT Vertex／Pixel；Position 世界座標、Camera 索引 → 表面朝觀看者的單位向量。標準透視與正交相機分開處理，已做 TD 旋轉相機渲染對照。沒有修改現有 Material 內部的方向算法。 |
| **Fresnel** | 已完成。Normal、View Direction、IOR → 介電質未偏振反射比例；包含 IOR＝1、全反射與數值保護。取角度絕對值，IOR 定義為透射／入射折射率比，離開介質時由使用者提供倒數。 |
| **Facing** | 已完成。Normal、View Direction → 雙面邊緣權重，正面 0、掠射 1；與 TDFrontFacing 的正反面布林用途不同。 |
| **Mapping** | 已完成。Vector、Translation、Rotation、Scale → Vector；縮放 → X／Y／Z 旋轉 → 平移，度數、原點旋轉。先提供正向座標變換，取樣在外部；逆 Texture／Normal 等其他模式未加入。 |
| **Rim Light** | 0.8.262 完成。Normal、View Direction、Color、Strength、Power → Color／Fac；雙面視角輪廓效果，可接 Material Emission，無場景燈光依賴。 |
| **Subsurface Approx** | 0.8.263 完成。以反向法線的原生背光 × 厚度衰減 × 顏色／強度，輸出可接 Phong／PBR Emission 的 Color；可編輯、MAT Pixel、保留陰影控制。不是空間擴散。 |
| **Subsurface Scattering（SSS）** | 完整散射／螢幕空間流程仍待設計；與已完成的背光近似分開，見下方筆記。 |

同輪 Color Ramp 已記錄「色標陣列＋插值設定」及 Uniform Array 求值的第一版建議，詳見下方 Color Ramp 設計筆記。使用者要求先保存討論，尚未實作；TD Ramp TOP／Table DAT 引用、自訂參數呈現及正式綁定流程仍待設計。

自動 Normal 的平台前提另行討論：目前 TD 的 Vulkan 架構在 macOS 經 MoltenVK／Metal 執行，官方明確說明 macOS 所有 GPU 都不支援 Geometry Shader，因此不能把 Geometry Stage 當作 Windows／macOS 共用方案。Pixel 階段由變形後位置的微分重建面法線，與依網格鄰接關係重建平滑頂點法線是不同能力。後者可評估上游 SOP／Normal POP，但它們不會自動讀回之後 MAT Vertex Shader 裡的位移；目前僅記錄限制與候選，未選定自動法線實作。依據：[Vulkan 平台說明](https://derivative.ca/UserGuide/Vulkan)、[Normal POP](https://docs.derivative.ca/Normal_POP)。

原生 PBR 參考核對：重新讀取先前已成功匯出／編譯的 TD 2025.32820 `displaceverts_1` 分支。Vertex 取 Height Map 並沿原法線改寫位置，送入 TDDeform；基底法線仍為 `normalize(TDDeformNorm(TDNormal()))`，TBN 亦由原法線／切線建立。啟用 Normal Map 時，Pixel 將法線圖解碼、套用 Bump Scale，經 TBN 轉為世界空間法線後用於光照。此位移分支沒有根據 Height Map 重建法線；TDDeformNorm 處理原生變形的法線轉換，不知道使用者剛做的高度位移。不能把原生位移視為已有自動法線重算功能。

參考：[TD GLSL Matrix Functions](https://docs.derivative.ca/GLSL_Matrix_Functions)、[Write a GLSL MAT](https://docs.derivative.ca/Write_a_GLSL_MAT)、[Blender Mapping](https://docs.blender.org/manual/en/4.5/render/shader_nodes/vector/mapping.html)。

## Subsurface Scattering 設計筆記（2026-09-29）

**最新決策（0.8.263）：使用者後續同意先做背光透射近似，命名 Subsurface Approx。這版可與 Phong／PBR 共用，Distance 定義為材質透光衰減距離，已向使用者說明。已實作範圍見[功能說明](../features/BASIC_MATERIAL_PRESETS.md)。完整 SSS 保留以下規劃，不能以近似版完成代替。以下完整 SSS 輸入仍是候選，尚未凍結接口或實作。**

目標是表面入射光進入材質後，在內部散射並從其他位置離開的效果。須先選定可接受的渲染近似與品質／成本，不能把單點 `dot`／`pow` 或 Rim Light 稱為完整 SSS。維持 Windows／macOS 相容前提，不採 Geometry Shader。是否能只用子圖呈現，須由算法和所需宿主資源決定，不能先假定一個普通 Subgraph 就能完成。

可重用的輸入與缺口：

| 資料 | 現有可重用入口／限制 |
| --- | --- |
| 世界位置、Normal | Vertex → Pixel 的既有傳遞與 Normal Map。必須使用相同空間；幾何法線與著色法線的用途應分清。 |
| View Direction／Camera | 0.8.261 的 View Direction 子圖與 Camera 索引，可涵蓋標準透視／正交；視線本身不是光源方向。 |
| 光源 | `uTDLights` 及 TD 原生光照／陰影工具可作為整合入口。`TDLighting`／`TDLightingPBR` 的 diffuse 是已做表面光照的結果，不能直接當未處理的入射輻照度重乘一次。需確認點光、方向光、聚光的方向、衰減、投影、遮擋及多燈累加；不能只讀 diffuse 顏色便宣稱完整燈光整合。 |
| 顏色、Weight、散射距離／RGB Radius | 可從現有常數、Uniform 或 Texture 2D 取樣輸入；需要定義世界尺度／單位、顏色工作空間、合法範圍及預設。是否有必要同時暴露 Radius 與 Scale 待討論。 |
| 厚度 | 現有 Material 不提供通用厚度結果。可評估外部厚度貼圖／數值、前後表面深度或其他宿主資料；需說明開放網格、背面、薄物件與鏡頭變化的限制。厚度不能等同 Shadow Strength，也不能保證任意陰影深度就是可靠厚度。 |

先前檢索的 [TD 公開 GLSL MAT 光照文件](https://docs.derivative.ca/Write_a_GLSL_MAT) 提供表面光照、光源資料及陰影工具，未找到可直接引用的公開 SSS 函式；這不是對所有內部函式或未來版本的斷言。正式實作前需在目標 TD 版本重新確認可用性。

下一輪須決定與驗證：

討論已具體區分輕量的單點背光透射與 EEVEE 類型的跨像素擴散。後者的建議資料契約包括分離的漫反射光照／材質色、Depth＋相機投影、SSS 遮罩與物件或散射群組 ID、Radius RGB／Weight，以及供最後合成的 Specular／Emission。法線是否另存取決於算法；厚度用於透射／內部幾何近似，不等同 Radius。TD 的 MRT／Render Select／深度輸出可作基礎，但需要額外資料輸出、擴散 TOP 和合成流程；此流程尚未實作。

- 散射模型與資料流程：例如螢幕空間擴散、貼圖空間方法或其他方案；所需額外 Render／TOP／深度／法線資產由誰建立、更新與保存。跨像素的擴散不能只靠目前單點材質輸入取得。
- 材質整合：散射與原本 diffuse 的權重分配、能量重複計算、specular 保留、透明度與預乘時機。輸出是散射貢獻、混合後材質色或其他契約，尚未決定；不能直接加一層完整 diffuse 當作完成。
- 光照邊界：直接光／Environment Light、陰影、無光場景、正反面、遮擋與離屏資料。缺少資料時的行為須明確，不能自動補白光；厚度輸入亦不意味自動量測幾何厚度。
- 多相機、位移、動畫與解析度變動的資料一致性；額外通道、取樣數與品質設定的成本，以及 Windows／macOS 實機支持。
- 驗收場景包含薄葉／薄耳、厚物體、不同 RGB 散射距離、背光／無光／多燈、遮擋與材質邊界，並以可解釋的參考渲染核對，不只看單一預覽圖。

## Color Ramp 設計筆記（2026-09-29）

**狀態：使用者認可方向並要求先記入筆記；以下資料與 GLSL 是設計範例，不代表功能已實作、編譯驗證或正式格式已凍結。**

### 保存資料

以「色標陣列＋插值設定」作為可保存於圖內的資料，和 GPU 傳遞方式分開。每個色標的核心是 `position: float` 與 `rgba: vec4`，另外保留穩定 ID，拖曳或排序後仍可辨識同一色標。

```json
{
  "version": 1,
  "interpolation": "linear",
  "extend": "clamp",
  "colorSpace": "linear-srgb",
  "alphaMode": "straight",
  "stops": [
    { "id": "a", "position": 0.0, "rgba": [0, 0, 0, 1] },
    { "id": "b", "position": 0.4, "rgba": [1, 0, 0, 1] },
    { "id": "c", "position": 1.0, "rgba": [1, 1, 1, 1] }
  ]
}
```

- 位置以 0～1 為範圍；RGB 保留浮點／HDR 數值，Alpha 第一版建議使用未預乘形式，RGB 與 Alpha 分別插值。
- 插值先採整條 Ramp 共用，候選為 Constant、Linear、Ease；暫不展開成每段各自設定。
- 明確保存色彩空間；`linear-srgb` 是範例值，送入 Shader 前需轉成宿主的工作色彩空間，不能假設所有宿主都使用相同空間。
- 第一版建議超出色標範圍時延續端點顏色。重疊色標、有效數值、色標數量及排序規則須正式定義；下方範例以位置穩定排序，同位置到達時取排序後最後一個色標。
- TD Ramp TOP 的 Table DAT 使用位置、R、G、B、A 五欄，可轉接此核心資料；插值、色彩空間等設定需另行保留。引用既有 TD 資源或圖內編輯的 UI 尚待設計。

### Shader 資料與求值

第一版傾向以 Uniform Array 傳遞少量色標：`float positions[N]`、`vec4 colors[N]`、`int count`。預留容量下，修改位置／顏色／有效數量只更新 Uniform；超出容量需重新配置並重新產碼，不能靜默截斷使用者的資料。`N = 16` 僅為討論範例，正式容量、上限及多個 Ramp 的資源預算待決。

節點接收 `Fac: float`，找出左右色標並插值；輸出建議提供 RGBA、RGB、A。Fac 可來自 UV、Noise、Fresnel 等浮點結果。下例示範 Linear 與端點延伸，傳入顏色已統一到工作色彩空間：

```glsl
const int RAMP_CAPACITY = 16;

uniform int   uRampCount;
uniform float uRampPositions[RAMP_CAPACITY];
uniform vec4  uRampColors[RAMP_CAPACITY];

vec4 grapeRamp(float fac)
{
    int count = clamp(uRampCount, 0, RAMP_CAPACITY);
    if (count == 0)
        return vec4(0.0);

    if (fac < uRampPositions[0])
        return uRampColors[0];

    for (int i = 1; i < RAMP_CAPACITY; ++i)
    {
        if (i >= count)
            break;

        if (fac < uRampPositions[i])
        {
            float left  = uRampPositions[i - 1];
            float right = uRampPositions[i];
            float t = (fac - left) / (right - left);
            return mix(uRampColors[i - 1], uRampColors[i], t);
        }
    }

    return uRampColors[count - 1];
}

// 節點呼叫；factor 由上游圖提供。
vec4 rampRGBA = grapeRamp(factor);
vec3 rampRGB  = rampRGBA.rgb;
float rampA   = rampRGBA.a;
```

以上呼叫片段放在對應的 Shader 函式／main 內，不是全域 Uniform 初始化。輸入資料須為有效有限值並先排序；嚴格小於的區間搜尋會越過相同位置的色標，使實際插值區間寬度大於零。零色標回透明黑與單色標回該色是範例保護，UI 最少色標數仍待決。

Constant 模式在區間內直接回傳左側色標；Ease 模式先使用 `t = t * t * (3.0 - 2.0 * t)` 再混色。模式要以產碼固定或 Uniform 切換尚未決定。函式不預乘 Alpha、不截掉 HDR RGB；多個 Ramp 實例的函式與 Uniform 名稱需由產碼器處理唯一性。

### 傳遞方式與待辦界線

- TD 已提供 CHOP → Uniform Array 的機制；Grape 仍需新增 Ramp 編輯、資料同步、資源綁定與保存流程。要確保匯出的 GLSL 與綁定資源保存後可以持續運作，不能只把色標留在編輯器記憶體。
- Texture Buffer 可承載同樣的色標資料，但以 `texelFetch` 讀整數索引，不會自動插值；區間搜尋與混色仍由 Shader 執行。
- 烘焙成漸層取樣貼圖是另一個候選後端；可沿用原始色標資料，但解析度、過濾、硬切與誤差需另行設計，不宣稱與解析式求值完全相同。
- 此輪只記錄資料格式與 GLSL 方向，尚未決定 UI、是否為原生節點或子圖、TD 自訂參數呈現方式、外部 Table DAT 綁定、正式容量與跨平台效能；不啟動實作。

依據：[TD Ramp TOP](https://derivative.ca/UserGuide/Ramp_TOP)、[GLSL MAT Arrays](https://docs.derivative.ca/GLSL_MAT)、[Khronos Buffer Texture](https://wikis.khronos.org/opengl/Buffer_Texture)。

## 目前最直接的未完成工作

| ID | 狀態 | 項目與界線 | 依據 |
| --- | --- | --- | --- |
| A01 | 已於 0.8.215 交付 | **2D Sampler 從 Sources 拖入自訂參數浮窗**。TOP 路徑控制、舊 Expose 沿用、跨頁排序、刪除／Undo／Redo、Apply 保留及 TD 外部修改保護已驗證。Cube／3D／Array 綁定與 TOP Input 拖入未擴充。 | [參數編輯器](../features/CUSTOM_PARAMETER_EDITOR.md) |
| A02 | 名稱初查完成；完整稽核未完成 | **完整 GLSL 內建函式／overload／方法覆蓋表**。0.8.164／166 已補大量數學、位元、微分與取樣能力，不能沿用早期「都缺」清單；仍需以目標 GLSL／TD／Stage／資源型別逐項核對。2026-09-24 已完成[節點名稱快篩](NODE_NAME_AUDIT_2026-09-24.md)：參考索引 161 個名稱中 114 有對應，五個取樣入口已於 0.8.224 交付（13 個維度入口；依同一索引為 119 個名稱有對應），其餘按特殊契約／流程界線分列；仍未完成標準逐條與 overload 稽核。 | [補齊紀錄](../features/LEGACY_COMPLETION.md)、[Alpha 範圍](ALPHA_SCOPE_2026-09-21.md) |
| A03 | 已於 0.8.214 交付 | **節點分類投影與擴充後分類整理**。已新增 Source／Editor，重整子分類、同步全部定義投影並加入一致性檢查；原調查保留歷史。 | [本輪分類與 CSV](NODE_CLASSIFICATION_2026-09-23.md) |
| A04 | 部分完成 | **原生 Phong／PBR 完整能力與可編修預置圖**。0.8.175 基本版本已交付；法線圖、視差／遮蔽步進、位移、各貼圖槽、Rim、角度 Alpha、多貼圖、輔助輸出與交互組合等仍未全數完成。另需使用者可操作的完整示例場景。 | [原生等價清單](../features/MAT_NATIVE_PARITY.md)、[原生函式清單](../features/MAT_NATIVE_FUNCTIONS.md) |
| A05 | 部分完成 | **資源建立／綁定／取樣設定**。具名 sampler 的原生管理仍以 2D 為主；3D／Cube／Array 等取樣入口不等於對應綁定管理完整。Filter／Extend／Anisotropy 的介面與 Apply 保留、實例貼圖有效場景仍需整理。 | [MAT 等價清單](../features/MAT_NATIVE_PARITY.md)、[來源計畫](SOURCE_COMPLETION_PLAN.md) |
| A06 | 未完成／需補驗 | **MAT Attribute 後續**：指定其他 vertexIndex 的讀取；缺少 Attribute 的不同幾何情境；多攝影機、完整 Instancing／陰影／Fog 等。具名 Texture Attribute、Current Instance UV 及跨 Stage 介面已完成，不重列缺口。 | [補齊紀錄](../features/LEGACY_COMPLETION.md)、[來源計畫](SOURCE_COMPLETION_PLAN.md) |
| A07 | 部分完成 | **Help 語意與官方章節完整性稽核**。選中來源的專屬 Help、函式簽名與連結已有交付；逐項語意、overload 限制與錨點仍需全面審查。 | [補齊紀錄](../features/LEGACY_COMPLETION.md) |
| A08 | 未實作 | **多選 Help** 應顯示可用的多選操作；**排列分割按鈕** 可重複上次操作，跨次記憶待決；**Uniform 引用自動命名可讀性** 依來源名與唯一尾碼改善，保留中間變數及使用者名稱。三項可各自獨立處理。 | [UX 筆記](UX_BACKLOG.md)，舊 W02–W04 |
| A09 | 延後／待設計 | **GLSL OP 狀態卡**、UV 數字顯示節點、完整 **Switch Case**。目前 Switch 已有連續 Case＋Default；不是一般控制流／任意 Case 條件設計已完成。 | [UX 筆記](UX_BACKLOG.md)、[Switch](../features/SWITCH.md)、[節點流程](NODE_WORKFLOW_ROUND.md) |

## 已知問題與待驗證事項

| ID | 項目 | 目前判定／下一步 |
| --- | --- | --- |
| K01 | Swizzle 的分量操作依靠參數面板 | 已知操作一致性問題；替代互動尚未定案。不混為 Switch。見 [UX](UX_BACKLOG.md)。 |
| K02 | 個人／此 Shader 的 Subgraph 分類無編輯入口 | 保留已知問題；增加更明確的個人庫保存入口仍在筆記。個人項目刪除由資料夾處理，目前沒有新增刪除 UI 的需求。 |
| K03 | 移除最後引用後，This Shader 仍留 Subgraph 定義 | 已知資源管理限制；目前沒有要求自動清理或新增刪除功能。Stage 篩選已有，不能將同一 Shader 視為所有 Stage 通用。 |
| K04 | OP Parameter 結構修改後刷新操作清單 | 已知 UI 更新問題，非數值寫入錯誤；Default／Range 已縮小更新範圍，頁面增刪／排序／Label 仍可能重建。見 [參數編輯器](../features/CUSTOM_PARAMETER_EDITOR.md)。 |
| K05 | Slider 右鍵框選放開誤開選單 | 舊 B01 仍待重現；目前數值編輯器仍由 contextmenu 開啟預設選單。本次靜態確認路徑，未重新操作證明每種情境。 |
| K06 | Array 長度 Escape／失焦與共用數值草稿不一致 | 舊 B03 的共用調查待審；重新重現後小範圍修正，不將整份 UI 共用提案直接開工。見 [元件調查](UI_COMPONENT_REUSE_AUDIT.md)。 |
| K07 | 預覽暫時 Lock 期間保存 TOE | `src/remote_panel/runtime.py` 仍有暫時 Lock；需針對保存／重開窗口驗證。Cache TOP 或使用者自製 Viewer 為方向，尚未取代現況。見 [預覽筆記](PREVIEW_UI_NOTES.md)。 |
| K08 | 偶發卡頓／RAF 與 DevTools 指標差異 | 待可重現 trace；不能先歸因整圖同步或 GPU。預覽調大小延遲也需分段量測。 |
| K09 | HTTP 報無回應但即時數值仍可操作 | 待重現與連線證據分類，不直接判定 TD 全部失聯。 |
| K10 | 淺色與觸控零散問題 | OP Parameter／浮窗淺色已修；其餘舊 Sources／Expression／Structure 外觀需重新 review。iOS focus／縮放／Ladder 定位與 Mac／Safari 真機仍待；使用者已要求觸控集中另輪排查。 |
| K11 | 原生 OP Create Dialog 說明與 TDFam 的關係 | 舊 B11 暫緩，未確證因果。 |
| K12 | 舊瀏覽器測試 fixture／隱藏入口假設 | 若干測試仍依賴過時 fixture 或布局；最新專項通過不能等於所有歷史腳本已維護完。見 [測試紀錄](../development/TESTING.md)。 |

| K13 | 自訂頂點變形與預設 Picking 資料可能不一致 | 使用者接受先記為已知限制；能選到物件不代表回傳位置／法線正確。0.8.216 已在 Vertex main 結尾條件式呼叫 `TDWritePickingValues()`，基本原生 Picking 與正常渲染比較通過；自訂變形 payload 仍不保證一致。見 [Picking 筆記](../features/MAT_NATIVE_PARITY.md#picking-known-limitation-and-future-pipeline-2026-09-23)。 |

K05–K11 沿用既有未結案筆記，本次未重新做原生／跨裝置重現。詳見 [舊待辦 B01–B11](TODO_AUDIT_2026-09-21.md)。

## 仍保留的候選、能力邊界與延後工作

- **來源與即時編輯**：來源列表結構變動後的局部 metadata 恢復（舊 W01）；Matrix／Array 原生即時值、通用 Parameter 按需訂閱；POffset、Primitive ID／Sample Mask 等來源仍須重新按 catalog 與宿主核對，不能照舊 CSV 數量直接新增。來源完整管理與即時值是不同工作。
- **編輯操作**：插入既有接線、Group-aware 排列、選取真正參與產碼節點、解開 Subgraph、局部複製 Auto 節點的型別保留／提示、Convert 自動化政策。均有候選或待設計部分，保留型別及原圖保護。
- **UI 設計**：英文文案舊 63 項候選需按現況再 review、通用 Binding／選單元件共用、StrMenu 自由文字＋候選、Double 入口可見性、Glow／亮度分離、初始網址旗標、狀態列收納。舊筆記數量不是本版缺陷數。
- **預覽與原生工作區**：節點中間結果／Canvas Backdrop、自製 Viewer 接入、Window COMP 前後順序、多來源預覽、TD Pane 內嵌 Editor、原生 OP／Parameter 跨程序拖入、無 Shader 啟動入口。外部獨立 app-window 與目前 WebRTC 預覽不等於 Pane 內嵌已做。
- **同步與保存**：磁碟工作圖快取、project UUID／Save As、增量同步／checkpoint、同 GLSL 略過編譯、跨刷新完整歷程、TD 全域 Undo、來源版本升級及雲端衝突。以實測與責任邊界決定，不因本次盤點啟動重構。
- **可攜與發布**：圖封存包含相依實作／資產、打包／安裝、可讀升級紀錄、Mac／實體 iPad 驗收、Preview 範圍裁定。現有 JSON／PNG 與保存 TOE 已可用。
- **Loop／自訂碼擴充**：Loop 子圖、Break／Discard／Return 作用域、一般 SSBO／執行期陣列、完整作者定義介面待設計；現有 GLSL Code 與 TDLoop 數值 helper 不代表這些完成。
- **遠期構想**：Online／PWA 配對、瀏覽器執行圖、ISF、GPU texture sharing。僅保留候選，不列為此次或必然的 Preview 阻擋。

以上沿用 [舊盤點 W／D 項](TODO_AUDIT_2026-09-21.md)及 [UX](UX_BACKLOG.md)；較新決定優先。

## 重構後的未來功能與明確排除

- **節點本身的程式碼／算式預覽、GLSL 行號與節點雙向高亮**：使用者指定重構後再做。Math 現有註記只是運算元關係文字；編譯錯誤已有部分節點定位，也不等於任意程式碼雙向互動完成。
- **Link 視覺略過 Router**：最新設計已取消，不列為漏做。Router 是實際保存的節點，前後線段各自保留 Wire／Link。
- **Picking 專用流水線**：2026-09-23 使用者提出未來方向，供拾取資料初始化與自訂寫入，需設計執行順序與允許的操作；不等於新增 GLSL 硬體 Stage。與補預設 picking 的簡單方案分開，本次只記錄、不實作。自訂變形限制見 K13。
- **Compute／其他 Stage、Image 寫入**：未因補齊數值函式而取得實作範圍。
- **10 個 TD Quaternion／矩陣函式**：目標 TD 2025.32820 的既有原生 probe 失敗，列宿主版本／簽名界線，不冒充只差 UI。詳見 [補齊紀錄](../features/LEGACY_COMPLETION.md)與 [版本查核](TD_NATIVE_VERSION_REVIEW_2026-09-23.md)。
- 原生 double／uint 傳輸精度、Attribute Array Size、特化長度等限制按 [來源精度](TD_SOURCE_PRECISION_REVIEW.md)及 [TD Array](../features/TD_ARRAY_SOURCES.md)保留；不能靠分類調整宣稱解除。

## 不再列為未完成的舊筆記

| 舊待辦 | 目前狀態 |
| --- | --- |
| TD 函式「缺 87 個入口」／Noise Deriv 等全缺 | 歷史數字；0.8.164–174 已大量交付。精確剩餘覆蓋另做 A02，不能重用 0.8.163 缺口總數。 |
| Built-in Source 只有通用 Help | 已有選中來源的專屬說明／連結；全面語意審查仍是 A07。 |
| Sources 改名、搜尋分行、分類排序、常數控制、緊湊卡片、POP 分類 | 0.8.176–179／200 已交付；分類改拖曳、預設折疊。 |
| 自訂參數還在側邊新增／只有 Uniform 能用 | 0.8.197–200 已提供非模態浮窗、數值 Uniform＋Spec Constant、排序、獨立歷程、Range／Clamp、原生修改保護與可讀名稱；Sampler 拖入已於 0.8.215 補齊（限 sampler2D）。 |
| 自訂參數刪除後 cooking 問題完全未處理 | 0.8.198 已修 Bind 解除順序並通過原生刪除／cook 檢查；不宣稱已重現原回報的每一種情境。 |
| 瀏覽器偏好無法重設 | 0.8.199 已提供範圍明確的重設入口，保留草稿與 TD 資料。 |
| Link 樣式、導航箭頭、多端 tooltip、顯示選項 | 0.8.180 起分批交付至 210；Router 間距與拖曳 213 補完。 |
| Group 標題需在線上方、Ctrl／Shift 多選 Node／Group／Wire | 0.8.196 已交付，Shift 框選保留；觸控另輪。 |
| Generated GLSL 節點／面板 | 已交付，節點每畫布最多一個；與重構後逐節點程式碼預覽分開。 |
| Subgraph 誤稱 Function、Library 此專案區塊、重複操作入口 | 0.8.201–203 已修文案及整理入口／分頁；分類編輯與定義保留另列 K02／K03。 |
| Switch、連加連乘 Math、Router | 0.8.204–213 已實作；Math 註記、待新增接孔與 Router 移動／間距已有後續 review。 |
| Frame／平移阻尼預設未開 | 現行 `EDITOR_DEV_DEFAULTS` 已開啟；舊 D05 的關閉敘述過時。 |
| MAT 完全沒有跨 Stage 或 Texture Attribute | 動態 Stage 介面、具名 Texture Attribute 與 Current Instance UV 已交付；完整實際場景仍有 A06 邊界。 |

## 建議後續順序

1. 分類整理已於 0.8.214 交付，供使用者 review。
2. Sampler 拖入控制已於 0.8.215 交付，基本 Picking 已於 0.8.216 交付；供使用者 review，進階拾取流程仍延後。
3. GLSL 能力逐項盤點，分開「已有入口」「缺 overload」「缺資源管理」「宿主不支援」，再選 Preview 必要能力。
4. 將 Swizzle／資產分類等 UI 項與材質等價大項分批；觸控／跨平台驗收另排，避免用一次大重構混做。

這是依相依性提出的順序，不取代使用者後續優先決定。

## 本次驗證界線

已核對目前 catalog、分類投影、來源拖入白名單、來源分類建構及相應版本交付。使用隔離 Chromium 讀取三個 Target／Stage 的實際入口分類；沒有改動產品程式、使用者圖、TD 狀態或 TOE，也沒有重新跑所有舊問題。私人核對資料在 reports/audit-213/。下一專案草稿只保留遠期背景，不把其中候選架構當作本專案未交付承諾。
