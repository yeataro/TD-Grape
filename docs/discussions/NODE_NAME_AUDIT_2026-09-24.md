# 節點名稱第一輪盤點

2026-09-24，產品 0.8.223，程式基準 07517de。依使用者要求先做名稱層級盤點，不啟動功能補齊或完整 overload 稽核。

## 範圍與方法

- 現有 catalog 共 342 份定義，包含運算、來源與 Editor 節點，不等於 342 個獨立 GLSL 函式。逐項名稱見 [節點清單](NODE_NAME_INVENTORY_2026-09-24.csv)。
- 基準為 [Khronos OpenGL 4.x Reference Pages 索引](https://registry.khronos.org/OpenGL-Refpages/gl4/html/indexflat.php)的 GLSL 函式名稱；排除 gl 開頭的 OpenGL API／內建變數，以及 noise、packUnorm、unpackUnorm 的索引總稱與 removedTypes。保留實際 noise1–4、pack／unpack 個別名稱，共 161 項。
- 以 catalog 的 browser.glslName 做同名對照，搭配 key／label 確認改名入口，例如 sin → Sine、matrixCompMult → Matrix Component Multiply；同函式多個維度或用途的節點合算一個名稱。
- 對沒有名稱對應的候選，另搜尋 library／editor／core，避免漏算藏在共用節點內的操作。GLSL Code 手寫能力不計為正式入口。
- 這是該參考索引的快篩，不是 GLSL 4.60 全規範／擴充清单。建構子、運算符、陣列方法及控制流另外摘要，不混進 161 項。未逐 overload、宿主版本、UI 可見性、原生編譯或像素驗證。
- 全部逐項結果見 [GLSL 名稱對照 CSV](NODE_NAME_GLSL_AUDIT_2026-09-24.csv)。

## 結果

| 判定 | 名稱數 | 說明 |
| --- | ---: | --- |
| 已有名稱對應 | 114 | 三角／雙曲、指數、一般數值、向量幾何／比較、矩陣、位元／打包、整數、微分，以及多數取樣名稱已有對應。不是完整型別支援率。 |
| 取樣入口候選 | 5 | 以下列出；沒有找到直接名稱入口，不等於不能用其他節點組合。 |
| 需資源或輸入契約 | 4 | textureSamples 與三個 interpolateAt 函式；不能只增加名稱。 |
| 標準 Noise 未設入口 | 4 | noise1–4；現有 TD Perlin／Simplex 並非這些 GLSL 函式的同名實作。 |
| 資源副作用或其他執行流程 | 34 | Atomic 11、Image 12、Barrier 7、Geometry 輸出 4；列為範圍邊界，不直接加入預覽版必補清單。 |
| 合計 | 161 | 114 有對應，47 沒有直接名稱對應。 |

### 優先確認的五個取樣入口

| GLSL 名稱 | 目前相近入口 | 第一輪判斷 |
| --- | --- | --- |
| textureGatherOffset | textureGather、textureOffset | 缺直接名稱入口；常數 offset、資源及輸出契約留待補查。 |
| textureGatherOffsets | textureGather、Array | 缺直接名稱入口；多個 offset 的輸入方式留待設計。 |
| textureProjOffset | textureProj、textureOffset | 缺直接名稱入口。 |
| textureProjLodOffset | textureProjLod、textureLodOffset | 缺直接名称入口。 |
| textureProjGradOffset | textureProjGrad、textureGradOffset | 缺直接名稱入口。 |

函式名稱依上述 Khronos 索引；相近入口不宣稱可直接替代或具有相同取樣語意。

### 四個需先確認前提的入口

- textureSamples：需 multisample sampler；现有資源型別清單沒有對應的 sampler2DMS／sampler2DMSArray。
- interpolateAtCentroid、interpolateAtOffset、interpolateAtSample：需要真正的 fragment input，不能把任意計算結果當輸入。現有 legacy 定義曾建立後移除 interpolateAtCentroid，註解明確指出目前 value graph 無法表達此契約；其餘兩個也無名稱入口。

### 不應直接列成漏做的部分

34 個 Atomic／Image／Barrier／Geometry 名稱需要資源、執行順序或其他 Stage 的設計；它們不全限定 Compute，但也不能當成普通數值節點直接補上。noise1–4 則與產品現有 TD Noise 分開記錄，未驗證目前宿主是否值得提供。

## 運算符與結構操作的名稱快篩

現有 Add／Subtract／Multiply／Divide／Remainder、Compare、Boolean、Bit／Shift、If／Switch／Math 已涵蓋主要操作名稱。Convert／Vector／Matrix、Swizzle／Split／Combine、Array Create／Array[i]／Array Length、Structure／Field 也已有入口。這不是對所有 GLSL 語法的相容性聲明；Loop 子圖與一般控制流仍依既有筆記，不把 TDLoop 視為 for／while。

## TD 名稱的補充核對

舊 0.8.163「缺 87 個 TD 入口」不能再引用為現況。最新 catalog 已有當時多數候選，例如 TDAverage、變換、Noise Deriv、色彩轉換、光照與陰影。來源 accessor 與編譯器自動呼叫仍須分開，沒有獨立運算節點不代表缺能力。

既有紀錄仍保留十個 Quaternion／矩陣函式的宿主驗證限制，以及 Image／進階 Picking／其他 Stage 的流程邊界；不在這輪重跑。Texture Attribute、TDWritePickingValues 的後續交付以 [目前待辦索引](TODO_AUDIT_2026-09-23.md)為準。這段只校正舊筆記，不宣稱重新盤點當日所有 TD API。

## 對功能預覽版的意義

名稱快篩沒有顯示一般數學節點大量缺漏。先確認上述五個取樣入口是否列入本次預覽範圍，比把所有 GLSL 能力當成未完成更具體。名稱盤點這一層已完成；完整 GLSL 覆蓋、overload、資源可用性及 Help 語意稽核仍未完成。

只新增文件與對照表，未改產品版本、TD 圖、TOE 或來源。表格核對名稱唯一、節點 key 可解析、分類數量加總；未新增或執行功能測試。

## 0.8.224 後續交付

使用者確認後，已補上上述五個取樣函式的 13 個維度入口，catalog 共 355 份定義；原有 342 份定義未改。Gather 單一 offset 可以是動態值，GatherOffsets 的四元素陣列與 component 則須為一般編譯期常數；初查表中的常數限制疑問以此次驗證為準。

本文件與兩份 CSV 保留 0.8.223 的名稱盤點快照。五個候選現已交付，依同一索引計算名稱對應為 119／161，並不代表完整 overload 覆蓋。支援範圍、原生驗證與來源限制見 [Offset Sampling](../features/TEXTURE_OFFSET_SAMPLING.md)。
