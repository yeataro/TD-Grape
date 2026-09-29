# Voronoi

0.8.268 加入正式內建 `Voronoi` 節點，位置為 **Math → Noise**。這是 TD-Grape 獨立實作的細胞雜訊，功能分類對齊 Blender Voronoi，圖樣、雜湊、正規化與分形混合不要求數值相同。不是 Subgraph，也不依賴 TD 的雜訊函式。

可用於 TOP Pixel、MAT Vertex／Pixel。模式選單只放在 **Parameter／參數**，不放到節點 body；不順帶開放自訂 Subgraph 的選單功能。

## 座標與模式

| 維度 | 座標輸入 | 細胞位置輸出 |
| --- | --- | --- |
| 1D | W | W |
| 2D | Vector.xy，忽略 Z | Position.xy，Z 為零 |
| 3D | Vector.xyz | Position.xyz |
| 4D | Vector.xyz + W | Position.xyz + W |

Vector 固定為 vec3，W 為 float。未接時使用零，不自動選用 UV、世界位置或 Generated 座標。例：TOP 可接內建 `vUV`（vec3）到 Vector，選 2D，再把 Color 接 Color Output。Scale 在取樣前乘上座標；不包含 Mapping／Texture 2D。

預設為 3D、F1、Euclidean、Normalize 關閉；Scale 5、Randomness 1、Detail 0、Roughness 0.5、Lacunarity 2、Smoothness 1、Exponent 0.5。

| Feature | 計算內容 | 輸出 |
| --- | --- | --- |
| F1 | 最近細胞點的距離與資料 | Distance、Color、Position／W |
| F2 | 第二近細胞點的距離與資料 | Distance、Color、Position／W |
| Smooth F1 | 平滑最小距離，同步混合細胞色彩與位置；平滑度為零時回到 F1 | Distance、Color、Position／W |
| Distance to Edge | 最近細胞與其他細胞的等距分割平面，到取樣點的最短距離 | Distance |
| N-Sphere Radius | 最近細胞點到其最近其他細胞點的距離之半 | Radius |

Distance to Edge 並非 `F2 − F1`。邊界與半徑都使用歐幾里得幾何；它們不顯示 Metric／Exponent。最近點類模式支援 Euclidean、Manhattan、Chebyshev、Minkowski；1D 不顯示 Metric，只有 Minkowski 顯示 Exponent。

Color 是細胞識別色，vec4 的 Alpha 固定 1。Position／W 以輸入座標空間表示細胞位置；Scale 為零時回傳零。Distance／Radius 使用乘過 Scale 的細胞空間單位，不除回 Scale。

## 分形與正規化

- Detail 0–15：零為單次取樣，整數增加完整層，小數混入下一層。
- Roughness 0–1：每層振幅倍率；零只計算第一層。
- Lacunarity 0–16：每層頻率倍率；零讓後續層取樣原點。
- Distance 為各層振幅加權和；Color 與轉回輸入空間的 Position／W 為加權平均。因此多層 Position 不再代表單一真實細胞。
- Normalize 將 Distance 除以振幅總和及目前維度／算法的保守距離上界，最後限制於 0–1；不改 Color／Position／W。
- N-Sphere Radius 沒有分形或 Normalize，介面不顯示這些選項。

Randomness 0–1 將點從每格中心移向雜湊位置。Smoothness 0–1 控制局部平滑；實際平滑半徑為其一半。Minkowski Exponent 限制於 0.125–32。這些範圍在參數編輯器與 GLSL 端都有限制；接入 Uniform 也不會繞過運算端範圍。

## 數值、效能與相容性界線

每個整數格內放一個點。最近點與平滑使用取樣格周圍 `[-2, 2]^D` 的有限鄰域，邊界／半徑再查最近細胞格周圍 `[-3, 3]^D`。這是有界 GPU 程序雜訊，不是任意點集的精確 Voronoi 解算器。尤其 Minkowski 指數低於 1 時，有限鄰域與全域最近點可能不同。

平滑是順序確定的多項式 smooth-min；分形邊界距離也是逐層加權混合。它們對齊功能用途，不承諾重現 Blender 的分佈、平滑形狀或正規化數值。

取樣座標限制於 ±1048576，分形頻率限制於 1048576。這能避免無限增長或整數雜湊轉換越界，但大座標仍受 32-bit float 精度限制，極端值會飽和。需要細小細胞時宜先平移到較接近原點的座標。

4D、Smooth F1、高 Detail 的計算量較高；特別是邊界／半徑需要第二輪鄰域搜尋。GLSL 只產生被使用的節點／模式，同一 Stage 的相同模式共享 helper 與雜湊，不會把所有選項分支塞進每次取樣。實作使用基本 GLSL 算術、uint 與固定上限迴圈，不新增 geometry shader 或平台專用函式。Windows TD 已實測；macOS／Metal 尚未實測。

## 編輯與保存

維度／特徵／距離選擇存在 node.params；實際接孔由後端契約傳給前端，避免兩邊分別推導。模式切換時，暫時隱藏的手動輸入值緩存在 node.ui，切回時恢復。有效連線保留，失效連線依既有實驗設定處理；預設保留並標示，Undo／Redo 包含這整次變更。

模式和 Normalize 是產碼設定，會重新編譯；座標、Scale、Detail 等接孔則可以接 Uniform，即時更新不必重新產碼。既有圖、內建 Subgraph 及材質範本不改寫。

## 驗證入口

- `tests/unit/test_voronoi.py`：模式／接孔／Stage、輸出、非法設定、helper 共用、source map、零值、解析規則與五語系。
- `tests/unit/voronoi_fixture.py`：獨立 CPU 參考算法，包含負座標、整數雜湊、分割平面、分形及正規化。
- `tests/browser/test_voronoi.cjs`：實際建立、所有模式、只有 Parameter 有選單、接線保留、失效標示、值恢復、Undo／Redo、五語系；匯出圖交由核心編譯。
- `tests/td/test_voronoi.py`：隔離元件內 TOP／MAT Vertex／Pixel 數值讀回，測試前後核對既有 Shader 資料，最後移除 fixture。

功能參照：[Blender Voronoi Texture 文件](https://docs.blender.org/manual/en/4.5/render/shader_nodes/textures/voronoi.html)。實作未複製 Blender 程式碼。
