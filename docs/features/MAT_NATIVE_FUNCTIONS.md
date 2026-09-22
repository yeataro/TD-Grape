# 原生 Phong／PBR：GLSL 與 TD 函數清單

更新：2026-09-23；參考宿主 TouchDesigner 2025.32820；Grape 0.8.173。

抽象功能、依賴與組合順序見[原生材質功能研究](../discussions/MAT_FUNCTIONAL_RESEARCH.md)；宿主新舊版本與文件涵蓋差異見[TD 版本查核](../discussions/TD_NATIVE_VERSION_REVIEW_2026-09-23.md)。本頁清單依原生材質匯出取得，並非 TD 所有可呼叫函數的全集。

**這份是功能盤點與驗證列表，不是完整材質已完成的宣告。** 小目標的驗收單位是原生匯出 GLSL 實際使用的函數、資料讀取與運算組合；最終再以完整材質外觀／結果核對。不同的產碼文字及按參數特化的生成機制，不是必須複製的目標。

## 取樣範圍與證據

- 原生 Phong 85 個配置、PBR 73 個配置，共 158 個。每個配置匯出 Vertex／Pixel，並對原生 MAT 與匯出的 GLSL MAT 檢查編譯；158 個均連結成功。
- 包含預設、相容功能同時啟用、各 Toggle 的兩種狀態、所有枚舉選單值（實例貼圖選擇除外）。具有相同選項的貼圖控制同步切換；這不等於所有控制的笛卡兒積組合。
- 多重貼圖使用四個來源及非空組合式；Emission、Constant、第二 Specular、Darkness、Rim 與 Height 均有非零設定與貼圖。普通燈與環境燈均存在。
- Common／Deform 頁不枚舉；既有設定由原生參數頁承擔。Picking 只記錄其條件分支，不因此擴充授權範圍。
- 解析保留預處理條件內的呼叫，因此清單可能包含目前渲染未執行的分支。某選項已匯出不代表該分支在場景中實際生效。
- 可重跑入口：[audit_native_material_functions.py](../../tests/td/audit_native_material_functions.py)。每批最多 12 個，私人工作區的 `native-material-audit-selection.json` 指定 `start`／`count`（全表索引 0–157）。原始 GLSL、參數、來源雜湊與編譯紀錄留在私人報告，不作為產品依賴。

## GLSL 內建函數

| 函數 | 原生材質用途 | Grape 能力 |
|---|---|---|
| `clamp` | 法線／Rim 權重等界限 | Clamp |
| `dot` | 視角、Rim、亮度運算 | Dot |
| `length` | 向量長度、環境座標 | Length |
| `max` | PBR roughness 下限 | Max |
| `mix` | PBR diffuse/specular、角度 Alpha、Darkness 混合 | Mix |
| `normalize` | 法線、切線、view、Rim 方向 | Normalize |
| `pow` | 角度 Alpha rolloff | Pow |
| `reflect` | Phong 環境反射方向 | Reflect |
| `texture` | 一般／高度／法線／環境／Rim／多重貼圖取樣 | Texture Sample 與各維度取樣入口；目前自訂資源綁定仍以 sampler2D 為限 |

`vec2`、`vec3`、`vec4`、`mat3` 是型別建構，不另算內建函數；可由 Combine、Convert、Matrix 等既有入口表達。

## TD 原生函數與特化存取器

本批觀察到 **34 個不同呼叫名稱**。`TDTexAttrib_名稱` 依屬性宣告特化；以下保留實際看見的四個名稱，不把它們當成四種獨立能力。

| 原生呼叫 | 階段 | 對應能力／驗證狀態 |
|---|---|---|
| `TDAlphaTest` | pixel | Pixel Output 自動呼叫；遵守原生 Alpha Test 參數。 |
| `TDAttrib_T` | vertex | Attribute 宣告 T:vec4 可讀取；Tangent/TBN 在完整材質圖的組裝與幾何驗證待完成。 |
| `TDCameraIndex` | vertex | Built-in Source：`TDCameraIndex` |
| `TDCheckDiscard` | pixel | MAT Pixel 入口自動呼叫；不是一般可移動的運算節點。 |
| `TDColor` | vertex | 0.8.173 新增 Built-in Source，直接呼叫原生 TDColor；與 TDPointColor 分開。基本幾何顏色對照通過。 |
| `TDConvertColorSpace` | pixel | 0.8.173 新增 TDConvertColorSpace；依需引入 TDColorSpace。Render TOP 像素對照通過；Window／MAT viewer 的實際目的地轉換尚未做畫面對照。 |
| `TDCreateTBNMatrix` | vertex | td_create_tbn_matrix 已有入口；須接法線、切線與 handedness，完整法線貼圖仍待組裝。 |
| `TDCubeMapToEquirectangular` | pixel | td_cube_to_equirectangular；包含額外 mipMapBias 輸出，不能只保留 UV。 |
| `TDDeform` | vertex | Deform 與 td_deform_instance；一般與指定實例的變形入口。 |
| `TDDeformNorm` | vertex | `td_deform_normal`、`td_deform_normal_instance` |
| `TDDither` | pixel | Pixel Output 自動呼叫；依繪製環境啟用。 |
| `TDEnvLightingPBR` | pixel | TDEnvLightingPBR／PBR Environment Lights；一／兩盞環境燈的像素對照已通過。 |
| `TDFog` | pixel | td_fog 已有入口；完整材質須維持原生處理位置，實際 Fog 場景仍待對照。 |
| `TDFrontFacing` | pixel | `td_front_facing` |
| `TDInstanceColor` | vertex/pixel | Vertex 帶索引入口保留；0.8.173 新增 Current 與 Pixel 入口。兩個不同顏色實例的兩條路徑均通過原生像素對照。 |
| `TDInstanceIndex` | vertex | 0.8.173 新增 Built-in Source；須以 flat int 傳到 Pixel。兩實例測試通過。 |
| `TDInstanceTexCoord` | vertex | Current 與帶索引入口均存在；Current 接 Texture Attribute 的 SOP／POP／實例路徑已驗證。 |
| `TDLighting` | pixel | TDLighting／Phong Lights；全燈光迴圈與三個光照分量已驗證。全燈光 shadowStrength 輸出尚待補齊。 |
| `TDLightingPBR` | pixel | TDLightingPBR／PBR Lights；全燈光兩個分量已驗證。全燈光 shadowStrength 輸出尚待補齊。 |
| `TDNormal` | vertex | Built-in Source：`TDNormal` |
| `TDOutputSwizzle` | pixel | Pixel Output 自動呼叫；多個輸出 buffer 各自處理。 |
| `TDPixelColor` | pixel | `td_pixel_color` |
| `TDPos` | vertex | Position / Built-in Source。 |
| `TDScreenSpaceCoord` | pixel | 0.8.173 新增 Built-in Source，輸出原生呼叫的 st 分量（vec2）；像素對照通過。 |
| `TDSineLookup` | pixel | `td_sine_lookup` |
| `TDTexAttrib_Tex` | vertex | Texture Attribute + 共用 vec3 Attribute 宣告。Tex 的 SOP／POP 及改名路徑已驗證；TexX/Y/Z 為三平面模式使用的不同宣告名稱。 |
| `TDTexAttrib_TexX` | vertex | Texture Attribute + 共用 vec3 Attribute 宣告。Tex 的 SOP／POP 及改名路徑已驗證；TexX/Y/Z 為三平面模式使用的不同宣告名稱。 |
| `TDTexAttrib_TexY` | vertex | Texture Attribute + 共用 vec3 Attribute 宣告。Tex 的 SOP／POP 及改名路徑已驗證；TexX/Y/Z 為三平面模式使用的不同宣告名稱。 |
| `TDTexAttrib_TexZ` | vertex | Texture Attribute + 共用 vec3 Attribute 宣告。Tex 的 SOP／POP 及改名路徑已驗證；TexX/Y/Z 為三平面模式使用的不同宣告名稱。 |
| `TDTexGenSphere` | pixel | `td_texgen_sphere` |
| `TDTriplanarBlend` | pixel | td_triplanar_blend 已有入口；三個投影方向的座標、取樣與法線圖組裝仍待完成。 |
| `TDUVUnwrapCoord` | vertex | Built-in Source：`TDUVUnwrapCoord` |
| `TDWorldToProj` | vertex | To Clip 與 td_world_to_proj_uv；完整預置須接 UV Unwrap 座標。 |
| `TDWritePickingValues` | vertex | 已觀察到 Picking 條件分支；依既有裁定，尚未實作。 |

## 不是原生函數、但仍是必要能力

| 項目 | 原生碼的作用 | 狀態 |
|---|---|---|
| `luminance` | 匯出碼自行定義的 dot 加權函數 | 可用 Dot + 權重表達；不要誤認成 TD 原生函數 |
| `getVaryingAlpha` | 匯出碼自行定義的視角 Alpha 組合 | 由 Dot、TDSineLookup、Pow、Mix 等組成，預置接線待完成 |
| `uTDMats` / `uTDGeneral` | 攝影機矩陣、環境光及 viewport 等 | 共用來源、Array Get 與 Structure Field 已有；預置須接好 view 與正確空間 |
| `TD_NUM_LIGHTS` / `TD_NUM_ENV_LIGHTS` | 全燈光迴圈的宿主界限 | 三個 Light Sum 節點已內建遍歷，不要求使用者建立 for |
| `TDPhongResult` / `TDPBRResult` | 一次光照呼叫的多個結果 | 單燈入口拆成輸出接孔；所有燈光的陰影總和仍待補齊 |
| Vertex／Pixel 介面 | UV、世界位置、法線或 TBN、顏色、flat camera/instance index | 動態接孔已可用；完整預置及個別插值設定待驗證 |
| 高度／視差遮蔽 | 反覆高度取樣、步進、末段插值；不是一個額外 TD 原生函數 | 固定流程的節點能力仍待補齊；現有取樣入口不等於完成迴圈 |
| 貼圖資源及取樣狀態 | sampler 維度、filter、extend、anisotropy | 需要綁定與 Apply 保留狀態；只有函數簽名不夠 |
| `TD_NUM_COLOR_BUFFERS` | 主輸出及輔助輸出的目的地數量 | Pixel Output 多 buffer 已有；原生所有輸出選项的預置對應待完成 |

## 本輪新增能力的驗證

- 新增 `TDConvertColorSpace`、`TDInstanceColor (Current)`、`TDInstanceColor (Pixel)`；新增來源 `TDColor`、`TDScreenSpaceCoord`（st）及 `TDInstanceIndex`。既有帶索引 Vertex 節點與舊圖產碼保持不變。
- [原生像素測試](../../tests/td/test_native_material_accessors.py)：五條接線路徑全部與直接原生呼叫相同，最大誤差 0。顏色測試含兩個不同顏色實例；幾何顏色／螢幕座標／色彩轉換各比較 209,764 個像素，兩實例比較 91,520 個像素。
- [單元測試](../../tests/unit/test_native_material_accessors.py)：Header 僅在可達節點需要時加入；檢查來源對應行號、階段限制、flat 實例索引及舊節點契約。
- 這些測試沒有證明 Window 色彩管理、多攝影機、所有 Instance 模式或完整材質組合等價；不得擴大解讀。

## 尚未覆蓋與接續工作

1. 實例貼圖與其目標槽選擇、3D／Cube 等資源，須另建有效資源與實例場景。
2. 額外 Rim／MRT 序列區塊、多攝影機、陰影與 Fog 場景，以及功能交互組合，仍需補測。陰影輸出在未啟用陰影的場景可能直接輸出零；本批有枚舉輸出選項，但沒有宣稱完成陰影效果驗證。
3. 普通數學能力已多數存在；接續重點是資源綁定、視差遮蔽步進、完整材質組合與預置圖。
4. Picking 仍維持既有排除裁定。Substance 指派和 Output Shader 是作者工具，不要求複製其 UI／生成器；其渲染功能仍依實際 GLSL 盤點。
5. 完整 Phong MAT Graph／PBR MAT Graph 與可重現預覽場景尚未交付。逐項進度見 [能力清單](MAT_NATIVE_PARITY.md)。

## 參考依據

- 此表的實際呼叫與分支以安裝宿主的匯出碼為準，不以新版線上文件推測此版本必定支援。
- [TD：Write a GLSL MAT](https://derivative.ca/UserGuide/Write_a_GLSL_MAT)
- [TD：Phong MAT](https://derivative.ca/UserGuide/Phong_MAT)、[PBR MAT](https://derivative.ca/UserGuide/PBR_MAT)
- [GLSL 4.60 規格](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf)
