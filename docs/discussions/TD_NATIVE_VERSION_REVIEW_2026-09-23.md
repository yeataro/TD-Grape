# TouchDesigner 2025.32820：原生 GLSL 函數版本與文件查核

查核日期：2026-09-23。使用者目前 TD：**2025.32820**，依本機開發橋接的宿主版本紀錄確認。

這次查的是 **TouchDesigner 本身的版本差異**，不是 Grape 有沒有把函數做成節點。範圍集中於目前 TOP／MAT 工作相關的原生 GLSL 能力；不宣稱涵蓋所有 Python API、POP／Compute API 或未公開的內部符號。

## 結論

**本次沒有從已查到的新版公開紀錄，確認出「2025.32820 沒有、較新正式版才新增」的 TOP／MAT 原生 GLSL 函數名稱。** 這是查核結果，不是證明新版與舊版 API 完全相同。

官方目前列出的正式版是 **2025.33230，2026-09-01**。查閱它及中間 2025.33070 的發布項目，與本題直接相關的是既有行為修正，例如 Image Load／Store 的範圍檢查，而非一組新函數名稱。[官方版本紀錄](https://derivative.ca/UserGuide/Release_Notes)

反而找到兩個容易被漏掉的函數：`TDProjTextureLod`、`TDProjTextureSize`。**它們在你的 2025.32820 就已公開新增，不是升級後才有。** [2025.32820 發布說明](https://derivative.ca/release/202532820/74545)

## 1. 已屬於目前 TD 版本的入口

| 入口 | 功能 | 證據與界線 |
|---|---|---|
| `vec4 TDProjTextureLod(int lightIndex, vec2 coord, float lod)` | 明確指定 LOD 讀取燈光投影貼圖 | 2025.32820 發布說明列出；本次未另做實際投影場景測試 |
| `ivec3 TDProjTextureSize(int lightIndex)` | 查詢燈光投影貼圖尺寸 | 同版發布說明列出；回傳各分量的精確語意仍需實測／完整文件，不由名稱猜定 |
| `TDScreenSpaceCoord()` | 取得 viewport 上的正規化座標 | 更早的 2022.33910 發布說明已有；本機 2025.32820 已完成材質存取器像素對照 |
| `TDTrueCameraIndex()` | 攝影機相關索引入口 | 2022.33910 發布說明已有；不因此把它與 `TDCameraIndex()` 視為完全等價 |
| `TDColor()` | 原生幾何顏色讀取 | 2023.12230 發布說明已有使用紀錄；本機原生材質匯出與像素對照確認可用 |

依據：[2025.32820](https://derivative.ca/release/202532820/74545)、[2022.33910](https://derivative.ca/release/202233910/67933)、[2023.12230](https://derivative.ca/release/202312230/71440)。版本頁的歷史日期表述可能有修訂；這裡以 build 與所列 API 為依據，不推定最早內部實作日期。

**與 Grape 的差別：** 在 `f6eb393` 的 `src/` 搜尋未找到 `TDProjTextureLod`／`TDProjTextureSize` 引用。這兩項是後續節點入口盤點的候選缺口，不是你的 TouchDesigner 版本不足。本次只記錄，沒有順便修改節點表。

## 2. 已在宿主出現，但本次指南查詢未完整涵蓋

下列名稱出現在 2025.32820 原生匯出碼或本機已通過的測試中。此次取得的 [Write a GLSL MAT](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) 網頁文字，未檢索到這些名稱：

| 名稱 | 本機證據 | 能得出的結論 |
|---|---|---|
| `TDConvertColorSpace` | 原生 Phong／PBR 匯出使用；既有獨立測試引入 `TDColorSpace` 後可編譯並對照 | 目前版本有此路徑；不是未來功能 |
| `TDInstanceIndex` | 關閉點色的原生分支使用；兩實例測試通過 | 可以傳遞實例索引供 Pixel 使用 |
| `TDTexAttrib_名稱` | 原生 Tex／TexX／TexY／TexZ 分支；Tex 的 SOP／POP 測試 | 名稱由宣告特化，不是四種不同的固定 API |
| `TDColor`、`TDScreenSpaceCoord` | 原生匯出與本機測試；另有上節發布紀錄 | 指南搜尋結果不能代表完整函數目錄 |

證據位置：[材質功能研究附錄](MAT_FUNCTIONAL_RESEARCH.md#13-證據索引與重現方法)、[材質存取器測試](../../tests/td/test_native_material_accessors.py)、[函數清單](../features/MAT_NATIVE_FUNCTIONS.md)。

**嚴格說法是「這次取得的指南內容未涵蓋」，不能直接說「官方完全沒公開」。** 例如 `TDColor` 與 `TDScreenSpaceCoord` 就能在舊發布頁找到。網頁擷取也可能漏掉內容；`docs.derivative.ca` 的部分直接存取回傳 403，本次以官方 `derivative.ca/UserGuide` 與版本發布頁交叉核對。

## 3. 新版變更與本輪驗證的關係

2025.33070 的公開紀錄包含 `TDImageLoad`／`TDImageStore` 範圍檢查與 Image Outputs 相關修正；2025.33230 還列出 macOS 3D 紋理在 Working Color Space 啟用時的修正。這些是既有能力的行為／穩定性差異，不能列成「舊版缺少新函數」。[正式版紀錄](https://derivative.ca/UserGuide/Release_Notes)

**推論：** 之後如果換 TD build，材質參考匯出與數值對照應重新記錄版本；尤其涉及資源邊界、色彩與幾何資料時，不能只確認函數名稱還在就沿用原來結論。

## 4. 「還沒有公開」能確認到哪裡

- **已提供但文件分散：** 可以用發布說明、原生匯出、特定編譯／運行測試建立證據。上面列出的名稱屬於這種可查核範圍。
- **內部存在但契約不明：** 單次匯出見到名稱，只證明該組宿主條件可使用；不能自行保證所有階段、型別與版本都支援。
- **尚未發布的能力：** 本次沒有取得可確認的新函數清單。官方 Experimental 連結在本次擷取中回到正式版內容，未提供可獨立確認的較新清單；因此不列虛構候選，也不宣稱沒有未公開研發。

本次沒有安裝新版 TD、修改現有 TOE，或向外聯絡官方。沒有先前 Wiki 修訂快照可逐字對照，因此也不宣稱知道哪些段落是最近才新增；能確認的是本次可取得的內容及其明列版本。

## 5. 給後續維護者的查核順序

1. 先固定目標宿主 build、平台、Shader 階段與場景條件。
2. 以版本發布紀錄辨識新增與修正，不把搜尋摘要附近的版本標題直接當作歸屬。
3. 指南沒有寫到時，檢查原生功能匯出及舊發布紀錄。
4. 確認候選簽名後，在隔離場景編譯，再核對實際結果；不可只靠「沒有編譯錯誤」推定資源與效果正確。
5. 分別維護「宿主支援」、「專案入口」、「預置組裝」、「實測狀態」。四者不能合併成一個完成勾選。
