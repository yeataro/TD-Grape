# TD 來源分類與命名總表（審查稿）

研究日期：2026-09-19。對照產品 0.8.119／TD 2025.32820，並核對當日公開指南。使用者已確認範圍是 **GLSL TOP 與 GLSL MAT**。本報告沒有更名產品、改變來源／圖格式、啟動 TD 或執行 Shader。

## 審查結論與使用規則

1. **分類入口固定。** 可預備通用與 TD 名稱，但不隨顯示風格切換分類名稱、位置或成員。顏色不能代替固定文字入口。
2. **有實際 Python 供值來源，TD 主名稱就顯示該表達式。** 例如 `absTime.seconds`，而不是我們配置的 Uniform 名 `uAbsTime`。`me` 必須是實際求值的原生 OP，不是編輯器任意位置。
3. **GPU／GLSL 原生來源沒有 Python 對應就留空。** `TDPos()`、`uTDMats[c]` 不硬造 `op(...).xxx` 來取代。CPU 可查到某個場景值，不表示它等同於每次 render／instance／camera 的 Shader 來源。
4. **共通名是候選別名，不是跨宿主能力保證。** 表內 `—` 表示沒有確認適合的共同名；顯示時保留原生名。不是把每個 `uTD` 字串翻成英文就算共通。完整結構、混合單位與內部配置常保留原名。
5. **節點標題與分類命名分開。** 已提出的節點名稱選擇器尚未實作。使用者自訂名稱優先、搜尋接受兩種名稱是助手建議，仍待審查。

這裡的「完整」以 TOP／MAT 公開 Shader 環境 API、具名來源家族、結構欄位，加上專案已驗證的版本差異為界。使用者可無限新增的 Uniform、sampler、attribute、buffer 與 Python 路徑以 `<name>` 等家族列示，不假造有限名單。不是 TD 所有 OP／Python 屬性的大全，也不聲稱涵蓋未公開內部 Shader 符號。GLSL POP 本身未擴入宿主範圍，但 TOP／MAT 的 POP Buffer 來源已列入。

資料核對涵蓋當日 TOP／MAT 指南、兩個 OP 的參數頁、安裝版離線文件與目前來源登記。**本輪沒有逐條做 native compile／WebGL 測試。** 網頁指南新增的函數不因此視為已在 2025.32820 證實；既有 constructor probe 的三個額外欄位另標記。文件完成度與執行驗證是兩件事。

## 分類建議（固定入口，尚待審查）

2026-09-19 審查進展：具體第一級／第二級與來源歸屬見 [來源選單分類表](TD_SOURCE_MENU_REVIEW.md)。時間基本預置收斂為六項，Timeline Rate 移出；Clock／CHOP 時間細項及低頻時間控制改列自行新增。下方六大入口仍作概覽；逐組內容、非來源排除與未定案項以新版分類表為準。CSV 新增分類／審查欄位；原 `status` 保留研究時的支援現況，不能單憑「待擴充」視為要實作。

| 入口 | 收納內容 | 界線 |
| --- | --- | --- |
| Common Sources／共通來源 | 選定的時間、座標、輸出資訊等便利入口 | 同一來源可有通用／TD 主標題；不新增第二份值實體 |
| Texture Inputs／紋理輸入 | TOP 輸入或 MAT 具名 sampler 與相關資訊 | 名稱候選；3D、Array、Cube 不能冒充目前已實作 |
| Custom Uniforms／自訂 Uniform | 使用者配置的 scalar/vector/color/matrix/array | 即時值由宿主持有；不因命名更新圖或產碼 |
| Constants／常數 | 圖內編譯期常數 | `Graph Constants` 簡化名稱仍待使用者確認 |
| Spec Constants／特化常數 | TD Constants 頁供應的 specialization values | 名稱已接受；不是普通 Uniform |
| TD Built-ins／TD 內建 | MAT 幾何、矩陣、相機、燈光，以及進階 TOP／Buffer／編譯環境 | 可在固定入口內分組；分類不隨顯示風格改名 |

下方數字分組是**研究表的章節**，不是要把左側新增成十一個分類。哪些便利入口從 TD Built-ins 提到 Common Sources，需依使用頻率審查；同一來源維持相同身分，不因兩個搜尋別名建立重複來源。

`V`=Vertex、`P`=Pixel/Fragment、`G`=Geometry、`C`=Compute。現有圖介面主要為 TOP P／MAT V+P，表列 G／C 不代表本專案已支援。`c` 是正確 batch camera index，`i` 是對應來源陣列索引。型別沿用原生，不為名字好看偷偷截斷 float 或丟掉向量分量。

完整欄位另見 [CSV 總表](TD_SOURCE_NAMING_CATALOG.csv)：有獨立 Python 與 GLSL 欄，方便比較、篩選與後續審查。以下依範圍分段呈現同一份資料。

快速入口：[時間與日期](#catalog-01) · [TOP 紋理／資訊](#catalog-02) · [幾何／實例](#catalog-03) · [矩陣／相機](#catalog-04) · [燈光](#catalog-05) · [可配置來源](#catalog-06) · [編譯環境](#catalog-07)。附表：[Picking](#catalog-08) · [GLSL 系統值](#catalog-09) · [運算函數](#catalog-10) · [歷史與疑點](#catalog-11)。

**命名表本身可作靜態 metadata。** 顯示別名不需要查詢 TD、模擬 Shader 或同步每幀值。未來若新增真正的來源能力，才另行處理宿主供值與支援條件；不將更名與新增執行成本綁在一起。


<a id="catalog-01"></a>

## 01 時間與日期｜Common Sources 候選

| TD 主名稱／原生識別 | 共通名候選 | 型別 | 適用範圍 | 現況／性質 | 語意與證據 | 擴充／選單審查（2026-09-19） |
| --- | --- | --- | --- | --- | --- | --- |
| `absTime.seconds` | Absolute Time | float | TOP／MAT，CPU → Uniform | 已有預置；來源 | 秒；TD 全域播放時間，會隨 Power／root timeline 暫停。不是電腦開機時間或牆鐘。 [A](https://docs.derivative.ca/AbsTime_Class) [P](../../src/core/sgrape_sources.py) | 保留基本預置 |
| `absTime.frame` | Absolute Frame | float | TOP／MAT，CPU → Uniform | 已有預置；來源 | 原生 float；是時間幀數，不是每個 Shader 真正完成的渲染次數。 [A](https://docs.derivative.ca/AbsTime_Class) [P](../../src/core/sgrape_sources.py) | 保留基本預置 |
| `absTime.stepSeconds` | Delta Time | float | TOP／MAT，CPU → Uniform | 待擴充；來源 | TD 前後全域 frame 起點的秒差；應標註時鐘，不能保證等於此 TOP 兩次 cook 間隔。 [A](https://docs.derivative.ca/AbsTime_Class) [P](../../src/core/sgrape_sources.py) | 保留基本預置 |
| `absTime.step` | Frame Step | float | TOP／MAT，CPU → Uniform | 待擴充；來源 | TD 全域時間前進的幀數，可能大於 1；不是 FPS。 [A](https://docs.derivative.ca/AbsTime_Class) [P](../../src/core/sgrape_sources.py) | 保留基本預置 |
| `me.time.seconds` | Timeline Time | float | TOP／MAT，CPU → Uniform | 已有預置；來源 | 當前 OP 所屬時間軸；保留循環、跳轉、暫停語意。 [TC](https://derivative.ca/UserGuide/TimeCOMP_Class) [OP](https://derivative.ca/UserGuide/OP_Class) [P](../../src/core/sgrape_sources.py) | 保留基本預置 |
| `me.time.frame` | Timeline Frame | float | TOP／MAT，CPU → Uniform | 已有預置；來源 | 原生 float，不能未經決定就轉為零起算整數渲染計數。 [TC](https://derivative.ca/UserGuide/TimeCOMP_Class) [OP](https://derivative.ca/UserGuide/OP_Class) [P](../../src/core/sgrape_sources.py) | 保留基本預置 |
| `me.time.rate` | Timeline Rate | float | TOP／MAT，CPU → Uniform | 待擴充；來源 | 時間軸設定速率，不代表實際顯示 FPS。 [TC](https://derivative.ca/UserGuide/TimeCOMP_Class) [OP](https://derivative.ca/UserGuide/OP_Class) [P](../../src/core/sgrape_sources.py) | 使用者自行新增；本輪不列專用預置 |
| `me.time.play` | Timeline Playing | bool | TOP／MAT，CPU → Uniform | 待擴充；來源 | 播放狀態；不是 Shader 正在 cook 的證據。 [TC](https://derivative.ca/UserGuide/TimeCOMP_Class) [OP](https://derivative.ca/UserGuide/OP_Class) [P](../../src/core/sgrape_sources.py) | 使用者自行新增；本輪不列專用預置 |
| `me.time.fraction` | — | float | TOP／MAT，CPU → Uniform | 待擴充；來源 | TD 定義 frame/end；不冒充 (frame-start)/(end-start) 的一般進度。 [TC](https://derivative.ca/UserGuide/TimeCOMP_Class) [OP](https://derivative.ca/UserGuide/OP_Class) [P](../../src/core/sgrape_sources.py) | 建議使用者自行新增，待確認 |
| `me.time.start` | Timeline Start | float | TOP／MAT，CPU → Uniform | 待擴充；來源 | 主範圍起點，單位幀。 [TC](https://derivative.ca/UserGuide/TimeCOMP_Class) [OP](https://derivative.ca/UserGuide/OP_Class) [P](../../src/core/sgrape_sources.py) | 使用者自行新增；本輪不列專用預置 |
| `me.time.end` | Timeline End | float | TOP／MAT，CPU → Uniform | 待擴充；來源 | 主範圍終點，單位幀。 [TC](https://derivative.ca/UserGuide/TimeCOMP_Class) [OP](https://derivative.ca/UserGuide/OP_Class) [P](../../src/core/sgrape_sources.py) | 使用者自行新增；本輪不列專用預置 |
| `me.time.rangeStart` | Playback Range Start | float | TOP／MAT，CPU → Uniform | 待擴充；來源 | 子播放範圍起點，單位幀。 [TC](https://derivative.ca/UserGuide/TimeCOMP_Class) [OP](https://derivative.ca/UserGuide/OP_Class) [P](../../src/core/sgrape_sources.py) | 使用者自行新增；本輪不列專用預置 |
| `me.time.rangeEnd` | Playback Range End | float | TOP／MAT，CPU → Uniform | 待擴充；來源 | 子播放範圍終點，單位幀。 [TC](https://derivative.ca/UserGuide/TimeCOMP_Class) [OP](https://derivative.ca/UserGuide/OP_Class) [P](../../src/core/sgrape_sources.py) | 使用者自行新增；本輪不列專用預置 |
| `me.time.loop` | Timeline Looping | bool | TOP／MAT，CPU → Uniform | 待擴充；來源 | 所屬時間軸是否循環。 [TC](https://derivative.ca/UserGuide/TimeCOMP_Class) [OP](https://derivative.ca/UserGuide/OP_Class) [P](../../src/core/sgrape_sources.py) | 使用者自行新增；本輪不列專用預置 |
| `me.time.independent` | — | float（文件型別） | TOP／MAT，CPU → Uniform | 待擴充；來源 | 時間軸是否獨立；保留 TD 屬性名，實作時再核對值型別，不由名稱推成 bool。 [TC](https://derivative.ca/UserGuide/TimeCOMP_Class) [OP](https://derivative.ca/UserGuide/OP_Class) [P](../../src/core/sgrape_sources.py) | 建議使用者自行新增，待確認 |
| `me.time.tempo` | Tempo | float | TOP／MAT，CPU → Uniform | 待擴充；來源 | 每分鐘拍數；僅為節拍設定，不代表已有連續 Beat Phase 來源。 [TC](https://derivative.ca/UserGuide/TimeCOMP_Class) [OP](https://derivative.ca/UserGuide/OP_Class) [P](../../src/core/sgrape_sources.py) | 使用者自行新增；本輪不列專用預置 |
| `me.time.signature1` | Time Signature Numerator | int | TOP／MAT，CPU → Uniform | 待擴充；來源 | 拍號第一數。 [TC](https://derivative.ca/UserGuide/TimeCOMP_Class) [OP](https://derivative.ca/UserGuide/OP_Class) [P](../../src/core/sgrape_sources.py) | 使用者自行新增；本輪不列專用預置 |
| `me.time.signature2` | Time Signature Denominator | int | TOP／MAT，CPU → Uniform | 待擴充；來源 | 拍號第二數。 [TC](https://derivative.ca/UserGuide/TimeCOMP_Class) [OP](https://derivative.ca/UserGuide/OP_Class) [P](../../src/core/sgrape_sources.py) | 使用者自行新增；本輪不列專用預置 |
| `me.time.timecode` | — | str | CPU／UI | 待擴充；UI 資訊 | 可作 UI 資訊；不是可直接送入 GLSL 的數值來源。 [TC](https://derivative.ca/UserGuide/TimeCOMP_Class) [OP](https://derivative.ca/UserGuide/OP_Class) [P](../../src/core/sgrape_sources.py) | 使用者自行新增；本輪不列專用預置 |
| `project.cookRate` | Project Rate | float | CPU → Uniform | 待擴充；來源 | 專案設定 cook rate，不是實測 FPS，也不同於所有 local timeline 的 rate。 [FR](https://docs.derivative.ca/Frame_Rate) | 建議使用者自行新增，待確認 |
| `op('<clock>')['msec'].eval()` | Millisecond | float | TOP／MAT，CPU → Uniform | 原生可用；來源設定待定；來源 | 0–999，限 Units 模式。 <clock> 必須由已選定的 Clock CHOP 取代，非內建固定路徑。 [C](https://derivative.ca/UserGuide/Clock_CHOP) | 使用者自行新增；本輪不列專用預置 |
| `op('<clock>')['sec'].eval()` | Second | float | TOP／MAT，CPU → Uniform | 原生可用；來源設定待定；來源 | 秒分量，限 Units 模式。 <clock> 必須由已選定的 Clock CHOP 取代，非內建固定路徑。 [C](https://derivative.ca/UserGuide/Clock_CHOP) | 使用者自行新增；本輪不列專用預置 |
| `op('<clock>')['min'].eval()` | Minute | float | TOP／MAT，CPU → Uniform | 原生可用；來源設定待定；來源 | 分鐘分量，限 Units 模式。 <clock> 必須由已選定的 Clock CHOP 取代，非內建固定路徑。 [C](https://derivative.ca/UserGuide/Clock_CHOP) | 使用者自行新增；本輪不列專用預置 |
| `op('<clock>')['hour'].eval()` | Hour | float | TOP／MAT，CPU → Uniform | 原生可用；來源設定待定；來源 | 必須選定 12／24 小時制與 Hour Adjust。 <clock> 必須由已選定的 Clock CHOP 取代，非內建固定路徑。 [C](https://derivative.ca/UserGuide/Clock_CHOP) | 使用者自行新增；本輪不列專用預置 |
| `op('<clock>')['ampm'].eval()` | AM/PM | float | TOP／MAT，CPU → Uniform | 原生可用；來源設定待定；來源 | 0／1；僅在有意義的時制下顯示。 <clock> 必須由已選定的 Clock CHOP 取代，非內建固定路徑。 [C](https://derivative.ca/UserGuide/Clock_CHOP) | 使用者自行新增；本輪不列專用預置 |
| `op('<clock>')['wday'].eval()` | Day of Week | float | TOP／MAT，CPU → Uniform | 原生可用；來源設定待定；來源 | TD Units 模式以 Monday=0；跨宿主需保持約定。 <clock> 必須由已選定的 Clock CHOP 取代，非內建固定路徑。 [C](https://derivative.ca/UserGuide/Clock_CHOP) | 使用者自行新增；本輪不列專用預置 |
| `op('<clock>')['day'].eval()` | Day of Month | float | TOP／MAT，CPU → Uniform | 原生可用；來源設定待定；來源 | 日序，Units 模式。 <clock> 必須由已選定的 Clock CHOP 取代，非內建固定路徑。 [C](https://derivative.ca/UserGuide/Clock_CHOP) | 使用者自行新增；本輪不列專用預置 |
| `op('<clock>')['yday'].eval()` | Day of Year | float | TOP／MAT，CPU → Uniform | 原生可用；來源設定待定；來源 | TD 由 0 起算。 <clock> 必須由已選定的 Clock CHOP 取代，非內建固定路徑。 [C](https://derivative.ca/UserGuide/Clock_CHOP) | 使用者自行新增；本輪不列專用預置 |
| `op('<clock>')['week'].eval()` | Week | float | TOP／MAT，CPU → Uniform | 原生可用；來源設定待定；來源 | TD 的週序規則，不默認為 ISO week。 <clock> 必須由已選定的 Clock CHOP 取代，非內建固定路徑。 [C](https://derivative.ca/UserGuide/Clock_CHOP) | 使用者自行新增；本輪不列專用預置 |
| `op('<clock>')['month'].eval()` | Month | float | TOP／MAT，CPU → Uniform | 原生可用；來源設定待定；來源 | Units 模式 1–12。 <clock> 必須由已選定的 Clock CHOP 取代，非內建固定路徑。 [C](https://derivative.ca/UserGuide/Clock_CHOP) | 使用者自行新增；本輪不列專用預置 |
| `op('<clock>')['year'].eval()` | — | float | TOP／MAT，CPU → Uniform | 原生可用；來源設定待定；來源 | 相對 Start Reference；預設不是完整西元年，不能直接當 ISF DATE.x。 <clock> 必須由已選定的 Clock CHOP 取代，非內建固定路徑。 [C](https://derivative.ca/UserGuide/Clock_CHOP) | 使用者自行新增；本輪不列專用預置 |
| `op('<clock>')['moonphase'].eval()` | Moon Phase | float | TOP／MAT，CPU → Uniform | 原生可用；來源設定待定；來源 | 0–1；0/1 新月，0.5 滿月。 <clock> 必須由已選定的 Clock CHOP 取代，非內建固定路徑。 [C](https://derivative.ca/UserGuide/Clock_CHOP) | 使用者自行新增；本輪不列專用預置 |
| `op('<clock>')['sunphase'].eval()` | Sun Phase | float | TOP／MAT，CPU → Uniform | 原生可用；來源設定待定；來源 | 日出為 0、日落為 1，之後下降至下一次日出的 0。 <clock> 必須由已選定的 Clock CHOP 取代，非內建固定路徑。 [C](https://derivative.ca/UserGuide/Clock_CHOP) | 使用者自行新增；本輪不列專用預置 |
| `op('<clock>')['sunrise'].eval()` | Sunrise | float | TOP／MAT，CPU → Uniform | 原生可用；來源設定待定；來源 | 0–1 日內時間；依地理位置與設定。 <clock> 必須由已選定的 Clock CHOP 取代，非內建固定路徑。 [C](https://derivative.ca/UserGuide/Clock_CHOP) | 使用者自行新增；本輪不列專用預置 |
| `op('<clock>')['sunset'].eval()` | Sunset | float | TOP／MAT，CPU → Uniform | 原生可用；來源設定待定；來源 | 0–1 日內時間；依地理位置與設定。 <clock> 必須由已選定的 Clock CHOP 取代，非內建固定路徑。 [C](https://derivative.ca/UserGuide/Clock_CHOP) | 使用者自行新增；本輪不列專用預置 |
| `op('<clock>')['declination'].eval()` | Solar Declination | float | TOP／MAT，CPU → Uniform | 原生可用；來源設定待定；來源 | 太陽赤緯；文件以角度表示。 <clock> 必須由已選定的 Clock CHOP 取代，非內建固定路徑。 [C](https://derivative.ca/UserGuide/Clock_CHOP) | 使用者自行新增；本輪不列專用預置 |
| `op('<feedback>')['dt'].eval()` | — | float | CPU → Uniform | 原生可用；非預置；來源 | 該 Feedback CHOP 兩次 cook 的秒差；沒有單一共通 Delta Time 語意，不為取得它而自動建立 Feedback 網路。 [F](https://docs.derivative.ca/Feedback_CHOP) | 使用者自行新增；本輪不列專用預置 |
| `System Time／Date（來源待選）` | System Time | 待定 | CPU → Uniform | 未定案；待決概念 | 概念已提出，精確 TD Python 主標題尚不能填；輸出格式、時區、時鐘與組合方式待決。不是原生自動 GLSL Uniform。 [C](https://derivative.ca/UserGuide/Clock_CHOP) [A](https://docs.derivative.ca/AbsTime_Class) [I](https://github.com/mrRay/ISF_Spec) | 建議使用者自行新增，待確認 |


<a id="catalog-02"></a>

## 02 TOP 紋理與資訊｜Texture Inputs／TD Built-ins

| TD 主名稱／原生識別 | 共通名候選 | 型別 | 適用範圍 | 現況／性質 | 語意與證據 |
| --- | --- | --- | --- | --- | --- |
| `sTD2DInputs[]` | Texture Inputs | sampler2D[] | TOP P／C | 已有 2D 來源／陣列入口；來源 | 按維度分組；i 是該維度中的索引，不是原始 connector 索引。無 Python 等價主標題。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [R](../../src/core/sgrape_composites.py) |
| `uTD2DInfos[]` | — | TDTexInfo[] | TOP P／C | 已有陣列入口；來源 | TD 定義的資訊陣列；可用說明文字，不將打包結構偽裝為跨平台通用型別。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [R](../../src/core/sgrape_composites.py) |
| `TD_NUM_2D_INPUTS` | Texture Input Count | 編譯期整數 | TOP P／C | 長度契約已用；無獨立入口；來源 | 依該維度輸入數量由 TD 編譯環境提供；不是 Uniform。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [R](../../src/core/sgrape_composites.py) |
| `sTD3DInputs[]` | 3D Texture Inputs | sampler3D[] | TOP P／C | 待擴充；來源 | 按維度分組；i 是該維度中的索引，不是原始 connector 索引。無 Python 等價主標題。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [R](../../src/core/sgrape_composites.py) |
| `uTD3DInfos[]` | — | TDTexInfo[] | TOP P／C | 待擴充；來源 | TD 定義的資訊陣列；可用說明文字，不將打包結構偽裝為跨平台通用型別。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [R](../../src/core/sgrape_composites.py) |
| `TD_NUM_3D_INPUTS` | 3D Input Count | 編譯期整數 | TOP P／C | 待擴充；來源 | 依該維度輸入數量由 TD 編譯環境提供；不是 Uniform。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [R](../../src/core/sgrape_composites.py) |
| `sTD2DArrayInputs[]` | Texture Array Inputs | sampler2DArray[] | TOP P／C | 待擴充；來源 | 按維度分組；i 是該維度中的索引，不是原始 connector 索引。無 Python 等價主標題。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [R](../../src/core/sgrape_composites.py) |
| `uTD2DArrayInfos[]` | — | TDTexInfo[] | TOP P／C | 待擴充；來源 | TD 定義的資訊陣列；可用說明文字，不將打包結構偽裝為跨平台通用型別。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [R](../../src/core/sgrape_composites.py) |
| `TD_NUM_2D_ARRAY_INPUTS` | Texture Array Input Count | 編譯期整數 | TOP P／C | 待擴充；來源 | 依該維度輸入數量由 TD 編譯環境提供；不是 Uniform。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [R](../../src/core/sgrape_composites.py) |
| `sTDCubeInputs[]` | Cubemap Inputs | samplerCube[] | TOP P／C | 待擴充；來源 | 按維度分組；i 是該維度中的索引，不是原始 connector 索引。無 Python 等價主標題。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [R](../../src/core/sgrape_composites.py) |
| `uTDCubeInfos[]` | — | TDTexInfo[] | TOP P／C | 待擴充；來源 | TD 定義的資訊陣列；可用說明文字，不將打包結構偽裝為跨平台通用型別。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [R](../../src/core/sgrape_composites.py) |
| `TD_NUM_CUBE_INPUTS` | Cubemap Input Count | 編譯期整數 | TOP P／C | 待擴充；來源 | 依該維度輸入數量由 TD 編譯環境提供；不是 Uniform。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [R](../../src/core/sgrape_composites.py) |
| `uTDOutputInfo` | — | TDTexInfo | TOP P／C | 待擴充；來源 | 輸出目標資訊，與輸入來源不同。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `uTDOutputInfo.res.zw` | Output Resolution | vec2 | TOP P／C | 待擴充；來源 | 像素寬高；可由原生欄位取得，不要求建立額外 Uniform。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [N](../../src/core/sgrape_core.py) |
| `uTDOutputInfo.res.xy` | Output Pixel Size | vec2 | TOP P／C | 待擴充；來源 | 1/width、1/height；指 UV 中一個 texel 的步長，不是像素長寬。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [N](../../src/core/sgrape_core.py) |
| `uTD2DInfos[i].res.zw` | Input Resolution | vec2 | TOP P／C | TOP Input 有便利輸出；來源 | 像素寬高；可由原生欄位取得，不要求建立額外 Uniform。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [N](../../src/core/sgrape_core.py) |
| `uTD2DInfos[i].res.xy` | Input Pixel Size | vec2 | TOP P／C | TOP Input 有便利輸出；來源 | 1/width、1/height；指 UV 中一個 texel 的步長，不是像素長寬。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [N](../../src/core/sgrape_core.py) |
| `TDTexInfo.res` | — | vec4 | TOP，資訊結構欄位 | 2D 可經 Field／分量取值；來源 | xy=寬高倒數，zw=寬高；TD 的打包布局。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [R](../../src/core/sgrape_composites.py) |
| `TDTexInfo.depth` | — | vec4 | TOP，資訊結構欄位 | 2D 可經 Field／分量取值；來源 | x=深度倒數，y=深度，z=最新更新切片偏移；w 未定義，不提供可用值入口。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [R](../../src/core/sgrape_composites.py) |
| `TDTexInfo.depth.x` | Reciprocal Depth | float | TOP，資訊結構欄位 | 2D 可經 Field／分量取值；來源 | 適用有深度的紋理。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [R](../../src/core/sgrape_composites.py) |
| `TDTexInfo.depth.y` | Texture Depth | float | TOP，資訊結構欄位 | 2D 可經 Field／分量取值；來源 | 保留原生 float；3D 深度或 2D Array layer 數。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [R](../../src/core/sgrape_composites.py) |
| `TDTexInfo.depth.z` | — | float | TOP，資訊結構欄位 | 2D 可經 Field／分量取值；來源 | 3D 為正規化偏移，2D Array 為 layer 索引；uTDOutputInfo 的此值為 0。不能一概命名為同單位的 Slice Index。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [R](../../src/core/sgrape_composites.py) |
| `uTDCurrentDepth` | Output Slice | int | TOP P | 待擴充；來源 | 逐切片繪製的當前輸出 slice index；Compute 不以它代替 gl_GlobalInvocationID.z。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `uTDPass` | Pass Index | int | TOP P／C | 待擴充；來源 | TOP Num Passes 的零起算 pass；不是 Frame。其他宿主須提供同樣的 pass 定義。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `sTDNoiseMap` | — | sampler2D | TOP | 待擴充；來源 | TD 固定內建噪聲貼圖；不與任意 Noise texture 當作同一資料來源。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `sTDSineLookup` | — | sampler1D | TOP | 待擴充；來源 | TD 內建 lookup 資源；沒有固定通用資源等價，不硬取別名。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |

<a id="catalog-03"></a>

## 03 座標、幾何與實例｜Common Sources／TD Built-ins

| TD 主名稱／原生識別 | 共通名候選 | 型別 | 適用範圍 | 現況／性質 | 語意與證據 |
| --- | --- | --- | --- | --- | --- |
| `vUV.st` | Texture Coordinates | vec2 | TOP P，預設 vertex | 已有入口；來源 | 全屏紋理座標；不是 Uniform。自訂 vertex shader 時需自行傳遞 varying。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [N](../../src/core/sgrape_core.py) |
| `vUV` | — | vec3 | TOP P，預設 vertex | 待擴充；來源 | 保留原生完整 varying；第三分量不在此假設為已定義的通用資料。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDPos()` | Position | vec3 | MAT V | 已有入口；來源 accessor | 幾何原始位置；空間為 SOP／object space，不是變形後 world position。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [N](../../src/core/sgrape_core.py) |
| `TDNormal()` | Normal | vec3 | MAT V | 待擴充；來源 accessor | 原始幾何法線；變形與 normal matrix 另行處理。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [N](../../src/core/sgrape_core.py) |
| `TDTexCoord(layer)` | Texture Coordinates | vec3 | MAT V | 待擴充；來源 accessor | 可選 texture layer；與 TOP 的 vec2 vUV.st 入口型別不同。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [N](../../src/core/sgrape_core.py) |
| `TDPointColor()` | Point Color | vec4 | MAT V | 待擴充；來源 accessor | 使用 TD 對 alpha premultiplication 的處理結果。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [N](../../src/core/sgrape_core.py) |
| `TDInstanceID()` | Instance Index | int | MAT V | 待擴充；來源 accessor | TD 調整過的 instance index；不能直接換成 gl_InstanceID。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [N](../../src/core/sgrape_core.py) |
| `TDCameraIndex()` | — | int | MAT V | 待擴充；來源 accessor | 本次 draw batch 的相機索引；不是整份 Render 的 camera index。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [N](../../src/core/sgrape_core.py) |
| `TDTrueCameraIndex()` | Camera Index | int | MAT V | 待擴充；來源 accessor | Render TOP Cameras 清單中的索引；跨宿主需定義同一清單語意。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [N](../../src/core/sgrape_core.py) |
| `TDUVUnwrapCoord()` | — | vec3 | MAT V | 待擴充；來源 accessor | Render TOP 選定的 UV unwrap 來源。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [N](../../src/core/sgrape_core.py) |
| `TDPointCoord()` | Point Coordinates | vec2 | MAT P | 待擴充；來源 accessor | Point sprite 座標；TD 的方向修正，應優先於 gl_PointCoord。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [N](../../src/core/sgrape_core.py) |
| `TDBoneMat(boneIndex)` | Bone Matrix | mat4 | MAT V | 待擴充；來源 accessor | 骨骼矩陣；必須說明原生空間與 deform 配置，非 CPU op transform 的替身。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [N](../../src/core/sgrape_core.py) |
| `TDInstanceMat(instanceID)` | Instance Matrix | mat4 | MAT V | 待擴充；來源 accessor | 省略 instanceID 的 overload 使用當前 instance；保留 TD instancing 意義。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [N](../../src/core/sgrape_core.py) |
| `TDInstanceMat3(instanceID)` | Instance Linear Matrix | mat3 | MAT V | 待擴充；來源 accessor | 只供線性／向量部分；不是 inverse-transpose normal matrix。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [N](../../src/core/sgrape_core.py) |
| `TDInstanceTextureIndex()` | Instance Texture Index | uint | MAT V | 待擴充；來源 accessor | 無參數版本僅 vertex；需傳往 pixel 時使用 flat。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [N](../../src/core/sgrape_core.py) |
| `TDInstanceTextureIndex(instanceID)` | Instance Texture Index | uint | MAT V／G／P | 待擴充；來源 accessor | 顯式 instanceID 版本；回傳 texture index。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [N](../../src/core/sgrape_core.py) |
| `TDInstanceCustomAttrib0(instanceID)` | — | vec4 | MAT V | 待擴充；來源 accessor | 無參數 overload 讀當前 instance；0–3 為 TD 固定 custom slots，名稱需使用者定義內容。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDInstanceCustomAttrib1(instanceID)` | — | vec4 | MAT V | 待擴充；來源 accessor | 無參數 overload 讀當前 instance；0–3 為 TD 固定 custom slots，名稱需使用者定義內容。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDInstanceCustomAttrib2(instanceID)` | — | vec4 | MAT V | 待擴充；來源 accessor | 無參數 overload 讀當前 instance；0–3 為 TD 固定 custom slots，名稱需使用者定義內容。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDInstanceCustomAttrib3(instanceID)` | — | vec4 | MAT V | 待擴充；來源 accessor | 無參數 overload 讀當前 instance；0–3 為 TD 固定 custom slots，名稱需使用者定義內容。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |

<a id="catalog-04"></a>

## 04 MAT 矩陣、相機與渲染狀態｜TD Built-ins

| TD 主名稱／原生識別 | 共通名候選 | 型別 | 適用範圍 | 現況／性質 | 語意與證據 |
| --- | --- | --- | --- | --- | --- |
| `uTDGeneral` | — | TDGeneral | MAT V／G／P | 待擴充；來源 | TD 自動宣告；這是來源集合／結構，不是另造同值 CPU Uniform。環境燈 buffer 是 storage buffer。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDMats[]` | — | TDMatrix[] | MAT V／G／P | 已有陣列／Field；來源 | TD 自動宣告；這是來源集合／結構，不是另造同值 CPU Uniform。環境燈 buffer 是 storage buffer。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDCamInfos[]` | — | TDCameraInfo[] | MAT V／G／P | 已有陣列／Field；來源 | TD 自動宣告；這是來源集合／結構，不是另造同值 CPU Uniform。環境燈 buffer 是 storage buffer。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDLights[]` | — | TDLight[] | MAT V／G／P | 已有陣列／Field；來源 | TD 自動宣告；這是來源集合／結構，不是另造同值 CPU Uniform。環境燈 buffer 是 storage buffer。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDEnvLights[]` | — | TDEnvLight[] | MAT V／G／P | 待擴充；來源 | TD 自動宣告；這是來源集合／結構，不是另造同值 CPU Uniform。環境燈 buffer 是 storage buffer。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDEnvLightBuffers[]` | — | TDEnvLightBuffer[] | MAT V／G／P | 待擴充；來源 | TD 自動宣告；這是來源集合／結構，不是另造同值 CPU Uniform。環境燈 buffer 是 storage buffer。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDGeneral.ambientColor` | Ambient Color | vec4 | MAT V／G／P | 待擴充；來源 | 所用 ambient lights 的合計。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `uTDGeneral.viewport` | — | vec4 | MAT V／G／P | 待擴充；來源 | xy=viewport 像素起點；zw=寬高倒數，不能直接當 Output Resolution。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `uTDGeneral.viewport.xy` | Viewport Origin | vec2 | MAT V／G／P | 待擴充；來源 | 只取 origin。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `1.0 / uTDGeneral.viewport.zw` | Viewport Resolution | vec2 | MAT V／G／P | 待擴充；派生來源 | 派生值；viewport 可只是 render target 的子區域，不直接叫 Output Resolution。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `uTDMats[c].world` | Model Matrix | mat4 | MAT V／G／P | 已有陣列／Field；來源 | c 為當前 batch 的 camera index；名稱候選不保證其他宿主具有相同座標／深度約定。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDMats[c].worldInverse` | Inverse Model Matrix | mat4 | MAT V／G／P | 已有陣列／Field；來源 | c 為當前 batch 的 camera index；名稱候選不保證其他宿主具有相同座標／深度約定。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDMats[c].worldCam` | Model-View Matrix | mat4 | MAT V／G／P | 已有陣列／Field；來源 | c 為當前 batch 的 camera index；名稱候選不保證其他宿主具有相同座標／深度約定。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDMats[c].worldCamInverse` | Inverse Model-View Matrix | mat4 | MAT V／G／P | 已有陣列／Field；來源 | c 為當前 batch 的 camera index；名稱候選不保證其他宿主具有相同座標／深度約定。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDMats[c].cam` | View Matrix | mat4 | MAT V／G／P | 已有陣列／Field；來源 | c 為當前 batch 的 camera index；名稱候選不保證其他宿主具有相同座標／深度約定。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDMats[c].camInverse` | Inverse View Matrix | mat4 | MAT V／G／P | 已有陣列／Field；來源 | c 為當前 batch 的 camera index；名稱候選不保證其他宿主具有相同座標／深度約定。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDMats[c].camProj` | View-Projection Matrix | mat4 | MAT V／G／P | 已有陣列／Field；來源 | c 為當前 batch 的 camera index；名稱候選不保證其他宿主具有相同座標／深度約定。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDMats[c].camProjInverse` | Inverse View-Projection Matrix | mat4 | MAT V／G／P | 已有陣列／Field；來源 | c 為當前 batch 的 camera index；名稱候選不保證其他宿主具有相同座標／深度約定。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDMats[c].proj` | Projection Matrix | mat4 | MAT V／G／P | 已有陣列／Field；來源 | c 為當前 batch 的 camera index；名稱候選不保證其他宿主具有相同座標／深度約定。 TD 文件標示投影 Z 範圍為 Vulkan [0,1]。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDMats[c].projInverse` | Inverse Projection Matrix | mat4 | MAT V／G／P | 已有陣列／Field；來源 | c 為當前 batch 的 camera index；名稱候選不保證其他宿主具有相同座標／深度約定。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDMats[c].worldCamProj` | Model-View-Projection Matrix | mat4 | MAT V／G／P | 已有陣列／Field；來源 | c 為當前 batch 的 camera index；名稱候選不保證其他宿主具有相同座標／深度約定。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDMats[c].worldCamProjInverse` | Inverse Model-View-Projection Matrix | mat4 | MAT V／G／P | 已有陣列／Field；來源 | c 為當前 batch 的 camera index；名稱候選不保證其他宿主具有相同座標／深度約定。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDMats[c].worldForNormals` | Model Normal Matrix | mat3 | MAT V／G／P | 已有陣列／Field；來源 | c 為當前 batch 的 camera index；名稱候選不保證其他宿主具有相同座標／深度約定。 inverse-transpose，用於法線。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDMats[c].camForNormals` | View Normal Matrix | mat3 | MAT V／G／P | 已有陣列／Field；來源 | c 為當前 batch 的 camera index；名稱候選不保證其他宿主具有相同座標／深度約定。 inverse-transpose，用於法線。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDMats[c].worldCamForNormals` | Model-View Normal Matrix | mat3 | MAT V／G／P | 已有陣列／Field；來源 | c 為當前 batch 的 camera index；名稱候選不保證其他宿主具有相同座標／深度約定。 inverse-transpose，用於法線。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDMats[c].quadReproject` | — | mat4 | MAT V／G／P | 已有 Field；語意待核對；來源 | 現有 2025.32820 constructor probe 證實欄位；公開指南未列完整語意，不猜別名。 [L](../features/TD_ARRAY_SOURCES.md) [R](../../src/core/sgrape_composites.py) |
| `uTDMats[c].clipDistances` | — | vec4 | MAT V／G／P | 已有 Field；語意待核對；來源 | 現有 2025.32820 constructor probe 證實欄位；公開指南未列完整語意，不猜別名。 [L](../features/TD_ARRAY_SOURCES.md) [R](../../src/core/sgrape_composites.py) |
| `uTDCamInfos[c].nearFar` | — | vec4 | MAT V／G／P | 已有陣列／Field；來源 | near、far、差值、差值倒數的打包。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDCamInfos[c].fog` | — | vec4 | MAT V／G／P | 已有陣列／Field；來源 | start、end、range 倒數、density 的打包。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDCamInfos[c].fogColor` | Fog Color | vec4 | MAT V／G／P | 已有陣列／Field；來源 | 相機霧色。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDCamInfos[c].renderTOPCameraIndex` | Camera Index | int | MAT V／G／P | 已有陣列／Field；來源 | 全 Render 相機清單索引，不是 batch index。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDCamInfos[c].ipdShift` | — | float | MAT V／G／P | 已有陣列／Field；來源 | 既有 2025.32820 probe 確認存在；未有充分公開語意，不依名稱猜測。 [L](../features/TD_ARRAY_SOURCES.md) [R](../../src/core/sgrape_composites.py) |
| `uTDCamInfos[c].nearFar.x` | Camera Near | float | MAT V／G／P | 可組合取得；來源 | 已知欄位中的分量；可經 Field 與分量選取。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDCamInfos[c].nearFar.y` | Camera Far | float | MAT V／G／P | 可組合取得；來源 | 已知欄位中的分量；可經 Field 與分量選取。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDCamInfos[c].fog.x` | Fog Start | float | MAT V／G／P | 可組合取得；來源 | 已知欄位中的分量；可經 Field 與分量選取。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDCamInfos[c].fog.y` | Fog End | float | MAT V／G／P | 可組合取得；來源 | 已知欄位中的分量；可經 Field 與分量選取。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDCamInfos[c].fog.w` | Fog Density | float | MAT V／G／P | 可組合取得；來源 | 已知欄位中的分量；可經 Field 與分量選取。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |

<a id="catalog-05"></a>

## 05 燈光與環境｜TD Built-ins

| TD 主名稱／原生識別 | 共通名候選 | 型別 | 適用範圍 | 現況／性質 | 語意與證據 |
| --- | --- | --- | --- | --- | --- |
| `uTDLights[i].position` | Light Position | vec4 | MAT V／G／P | 已有陣列／Field；來源 | world space；w 不在此猜測用途。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDLights[i].direction` | Light Direction | vec3 | MAT V／G／P | 已有陣列／Field；來源 | world space。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDLights[i].diffuse` | Light Color | vec3 | MAT V／G／P | 已有陣列／Field；來源 | diffuse light color。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDLights[i].nearFar` | — | vec4 | MAT V／G／P | 已有陣列／Field；來源 | Light View clipping 與衍生量打包。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDLights[i].lightSize` | — | vec4 | MAT V／G／P | 已有陣列／Field；來源 | 尺寸與投影尺寸比例打包。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDLights[i].misc` | — | vec4 | MAT V／G／P | 已有陣列／Field；來源 | TD 內部參數打包，文件只賦予部分分量意義。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDLights[i].coneLookupScaleBias` | — | vec4 | MAT V／G／P | 已有陣列／Field；來源 | TD 錐形光 lookup 的 scale/bias。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDLights[i].attenScaleBiasRoll` | — | vec4 | MAT V／G／P | 已有陣列／Field；來源 | TD 衰減計算所需的 scale/bias/rolloff。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDLights[i].shadowMapMatrix` | Shadow Projection Matrix | mat4 | MAT V／G／P | 已有陣列／Field；來源 | world → shadow lookup space；保留 TD 深度及偏移約定。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDLights[i].shadowMapCamMatrix` | Light View Matrix | mat4 | MAT V／G／P | 已有陣列／Field；來源 | world → shadow light camera space。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDLights[i].shadowMapRes` | — | vec4 | MAT V／G／P | 已有陣列／Field；來源 | xy 倒數、zw 尺寸；無 shadow map 時全零。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDLights[i].projMapMatrix` | Light Projection Matrix | mat4 | MAT V／G／P | 已有陣列／Field；來源 | world → projection map space，用於投影貼圖。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDLights[i].shadowMapRes.zw` | Shadow Resolution | vec2 | MAT V／G／P | 可組合取得；來源 | 只取尺寸；無 map 時為零，不能假設可安全取倒數。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `uTDEnvLights[i].color` | Environment Color | vec3 | MAT V／G／P | 待擴充；來源 | 不包含環境貼圖的額外 color。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `uTDEnvLights[i].rotate` | Environment Rotation | mat3 | MAT V／G／P | 待擴充；來源 | 環境取樣方向旋轉。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `uTDEnvLightBuffers[i].shCoeffs` | Environment SH Coefficients | vec3[9] | MAT V／G／P | 待擴充；來源 | 環境貼圖的 SH 係數；基底、順序與 normalization 不假設跨平台相同。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDEnvLightTextureLod(i, coord, lod)` | Environment Sample | vec4 | MAT P（指南所在範圍） | 待擴充；取樣／lookup 運算 | vec2／vec3 overload 對應 2D／Cube；缺該種 map 時回黑。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDShadowTexture(i, uv)` | — | float | MAT P（指南所在範圍） | 待擴充；取樣／lookup 運算 | Hard shadow 與 Soft shadow 模式的深度單位不同。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDShadowTextureProj(i, coord)` | — | float | MAT P（指南所在範圍） | 待擴充；取樣／lookup 運算 | 投影取樣版本；深度單位隨模式，不硬當線性 Shadow Depth。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDCompareShadowTexture(i, uv, depth)` | — | float | MAT P（指南所在範圍） | 待擴充；取樣／lookup 運算 | 原生深度比較結果，含 TD 的 shadow 約定。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDCompareShadowTextureProj(i, coord)` | — | float | MAT P（指南所在範圍） | 待擴充；取樣／lookup 運算 | 投影深度比較版本。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDProjTexture(i, uv, bias)` | — | vec4 | MAT P（指南所在範圍） | 待擴充；取樣／lookup 運算 | 直接讀 light projection map；無貼圖回黑。不是一般無語境的紋理來源。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDProjTextureProj(i, coord)` | — | vec4 | MAT P（指南所在範圍） | 待擴充；取樣／lookup 運算 | 使用投影座標；是取樣 operation，不是可直接連出的 sampler。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDConeLookup(i, coord)` | — | float | MAT P（指南所在範圍） | 待擴充；取樣／lookup 運算 | TD cone lookup；非 cone light 時為 1。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |

<a id="catalog-06"></a>

## 06 使用者配置的來源家族｜分別歸入 Texture Inputs／Custom Uniforms／TD Built-ins

| TD 主名稱／原生識別 | 共通名候選 | 型別 | 適用範圍 | 現況／性質 | 語意與證據 |
| --- | --- | --- | --- | --- | --- |
| `<uniformName>` | Custom Uniform | scalar／vector | TOP／MAT V／P（C 依宿主） | 已支援數值家族；需配置來源 | Vectors 的具名參數；名稱由使用者提供，Python Expression／Bind／Export 是驅動方式，不替使用者一律改名。 [TP](https://derivative.ca/UserGuide/GLSL_TOP) [MP](https://derivative.ca/UserGuide/GLSL_MAT) [P](../../src/core/sgrape_sources.py) |
| `<colorName>` | Color Uniform | vec4 | TOP；MAT 依實際版本 | TOP 已支援；需配置來源 | 原生 Colors 可做 working color space 轉換；不是 Vectors 原樣數值的同義詞。 [TP](https://derivative.ca/UserGuide/GLSL_TOP) [P](../../src/core/sgrape_sources.py) |
| `<matrixName>` | Matrix Uniform | matN／matCxR 等 | TOP／MAT | 已支援部分原生映射；需配置來源 | Matrices 原生配置；實際可用形狀／double 支援依宿主與本專案實測。 [TP](https://derivative.ca/UserGuide/GLSL_TOP) [MP](https://derivative.ca/UserGuide/GLSL_MAT) [P](../../src/core/sgrape_sources.py) |
| `<arrayName>[]` | Uniform Array | float／vec2／vec3／vec4[] | TOP／MAT | 已支援首批；需配置來源 | CHOP Uniform Array；宣告長度與當前 CHOP 樣本數不一定相等。 [TP](https://derivative.ca/UserGuide/GLSL_TOP) [MP](https://derivative.ca/UserGuide/GLSL_MAT) [P](../../src/core/sgrape_sources.py) |
| `<bufferSampler>` | Texture Buffer | samplerBuffer | TOP／MAT | 未納入目前來源入口；需配置來源 | Arrays 的 Texture Buffer 模式；不是 Uniform Array，也不是一般 2D texture。 [TP](https://derivative.ca/UserGuide/GLSL_TOP) [MP](https://derivative.ca/UserGuide/GLSL_MAT) |
| `<samplerName>` | Texture Input | sampler 依配置 | MAT V／P／G | 目前僅 sampler2D 路徑；需配置來源 | MAT Samplers 指向 TOP 資源；不能硬套 TOP 的 sTD2DInputs 索引命名。 [MP](https://derivative.ca/UserGuide/GLSL_MAT) |
| `<samplerName>POffset` | — | float | MAT | 待擴充；需配置來源 | Texture 3D TOP 的最新切片位置；需 matching sampler 名稱與 uniform 宣告。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `<specName>` | Spec Constant | int／uint／bool／float | TOP／MAT | 已有入口；需配置來源 | 常數頁提供 specialization 值；不是每幀 Uniform。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [P](../../src/core/sgrape_sources.py) |
| `<atomicCounter>` | — | atomic_uint／array | TOP，依版本／pipeline | 文件有列；未實測；需配置來源 | 原生 Atomic Counters 配置；可變 GPU 資源，不能只視為 readonly Source；Vulkan 支援需版本驗證。 [TP](https://derivative.ca/UserGuide/GLSL_TOP) |
| `TDAttrib_<name>(arrayIndex, vertexIndex)` | Attribute | 依配置 | MAT V | 待擴充；需配置來源 | Attributes 頁配置；省略 vertexIndex 用 gl_VertexID，省略 arrayIndex 用 0。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [MP](https://derivative.ca/UserGuide/GLSL_MAT) |
| `TDTexAttrib_<name>(layer)` | — | 依配置 | MAT V | 待擴充；需配置來源 | 針對 POP attribute／SOP uv 的原生適配，不假定任意 attribute 是共同 UV。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `cTDAttribArraySize_<name>` | Attribute Array Size | uint 常數 | MAT V | 待擴充；需配置來源 | 該 attribute 每個元素內的 array extent，不是幾何頂點總數。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDBuffer_<name>(elementIndex, arrayIndex)` | Buffer Attribute | 依配置 | TOP／MAT，Buffers 配置後 | 待擴充；需配置來源 | POP Point／Vertex／Primitive attribute buffer；省略 arrayIndex 用 0。不是要求支援整個 GLSL POP 宿主。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [TP](https://derivative.ca/UserGuide/GLSL_TOP) |
| `TDBufferLength_<name>()` | Buffer Length | uint（文件標 const） | TOP／MAT，Buffers 配置後 | 待擴充；需配置來源 | 來源 buffer 元素數；不在 UI 或 Python 模擬求值，常數性需依真正產生的定義確認。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `cTDBufferArraySize_<name>` | Buffer Attribute Array Size | uint 常數 | TOP／MAT，Buffers 配置後 | 待擴充；需配置來源 | 每個 attribute 的 array extent，與 Buffer Length 分開。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDImageLoadOutput(index, coord)` | Load Output Image | vec4 | TOP C | 未支援 Compute 入口；資源讀取 | 2025.30000+ 路徑；ivec3／uvec3 座標，讀 output storage image；有同步與可見性責任。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDImageLoad_<name>(arrayIndex, coord)` | Load Image | vec4 | MAT，Render TOP image output context | 待擴充；資源讀取 | 由 Render TOP 定義；無 array 時 arrayIndex=0；單獨 MAT validation 不一定具備。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |

<a id="catalog-07"></a>

## 07 編譯環境｜TD Built-ins，偏向進階資訊

| TD 主名稱／原生識別 | 共通名候選 | 型別 | 適用範圍 | 現況／性質 | 語意與證據 |
| --- | --- | --- | --- | --- | --- |
| `TD_NUM_LIGHTS` | Light Count | 巨集／條件 | 編譯期 MAT | 數量部分已作長度契約；編譯環境 | 不含 environment lights；零燈須正常處理。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `TD_NUM_ENV_LIGHTS` | Environment Light Count | 巨集／條件 | 編譯期 MAT | 待擴充；編譯環境 | 環境燈數量，與一般燈分開。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `TD_NUM_CAMERAS` | — | 巨集／條件 | 編譯期 MAT | 數量部分已作長度契約；編譯環境 | 本次 batch 相機數，非整個 Render 的相機總數。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `TD_ENV_LIGHTS_ARRAY_SIZE` | — | 巨集／條件 | 編譯期 MAT | 待擴充；編譯環境 | 環境燈 storage buffer 配置長度；不自行假設等同 TD_NUM_ENV_LIGHTS。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `TD_NUM_COLOR_BUFFERS` | Color Buffer Count | 巨集／條件 | 編譯期 MAT | 待擴充；編譯環境 | 依 MAT Render 配置的輸出數；TOP 同名支援需另驗證，不由此推定。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `TD_VERTEX_SHADER` | — | 巨集／條件 | 編譯期 MAT／宿主生成 | 待擴充；編譯環境 | 編譯 stage 條件。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `TD_GEOMETRY_SHADER` | — | 巨集／條件 | 編譯期 MAT／宿主生成 | 待擴充；編譯環境 | 編譯 stage 條件。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `TD_PIXEL_SHADER` | — | 巨集／條件 | 編譯期 MAT／宿主生成 | 待擴充；編譯環境 | 編譯 stage 條件。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `TD_COMPUTE_SHADER` | — | 巨集／條件 | 編譯期 宿主生成 | 待擴充；編譯環境 | 編譯 stage 條件；不代表 MAT 有 Compute stage。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `TD_RENDER_TOP` | — | 巨集／條件 | 編譯期 MAT | 待擴充；編譯環境 | 當前處於 Render TOP render context，可作 image output guard。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |
| `TD_PICKING_ACTIVE` | — | 巨集／條件 | 編譯期 MAT | 待擴充；編譯環境 | Picking shader permutation；不應轉成即時 Uniform。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [R](../../src/core/sgrape_composites.py) |

<a id="catalog-08"></a>

## 08 Picking｜宿主互動資料，非一般 Sources

| TD 主名稱／原生識別 | 共通名候選 | 型別 | 適用範圍 | 現況／性質 | 語意與證據 |
| --- | --- | --- | --- | --- | --- |
| `vTDPickVert` | — | TDPickVertex | MAT Picking／V | 待擴充；輸出 payload | 可寫的 picking payload，非自動可讀 source；TDWritePickingValues 初始化後才做自訂覆寫。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `vTDPickVert.sopSpacePosition` | — | vec3 | MAT Picking／V | 待擴充；輸出 payload | 完整列入 payload 欄位；保留 TD 名稱，不當作普通場景來源。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `vTDPickVert.worldSpacePosition` | — | vec3 | MAT Picking／V | 待擴充；輸出 payload | 完整列入 payload 欄位；保留 TD 名稱，不當作普通場景來源。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `vTDPickVert.camSpacePosition` | — | vec3 | MAT Picking／V | 待擴充；輸出 payload | 完整列入 payload 欄位；保留 TD 名稱，不當作普通場景來源。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `vTDPickVert.sopSpaceNormal` | — | vec3 | MAT Picking／V | 待擴充；輸出 payload | 完整列入 payload 欄位；保留 TD 名稱，不當作普通場景來源。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `vTDPickVert.worldSpaceNormal` | — | vec3 | MAT Picking／V | 待擴充；輸出 payload | 完整列入 payload 欄位；保留 TD 名稱，不當作普通場景來源。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `vTDPickVert.camSpaceNormal` | — | vec3 | MAT Picking／V | 待擴充；輸出 payload | 完整列入 payload 欄位；保留 TD 名稱，不當作普通場景來源。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `vTDPickVert.uv` | — | vec3[1] | MAT Picking／V | 待擴充；輸出 payload | 完整列入 payload 欄位；保留 TD 名稱，不當作普通場景來源。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `vTDPickVert.instanceId` | — | flat int | MAT Picking／V | 待擴充；輸出 payload | 完整列入 payload 欄位；保留 TD 名稱，不當作普通場景來源。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `vTDPickVert.color` | — | vec4 | MAT Picking／V | 待擴充；輸出 payload | 完整列入 payload 欄位；保留 TD 名稱，不當作普通場景來源。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `vTDCustomPickVert.<attribute>` | — | 依 Render Pick 配置 | MAT Picking | 待擴充；輸出 payload | 自訂 picking attribute 的 payload 家族，不是 Python 變數。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |

<a id="catalog-09"></a>

## 09 GLSL 原生系統值｜不是 TD 特有來源

| TD 主名稱／原生識別 | 共通名候選 | 型別 | 適用範圍 | 現況／性質 | 語意與證據 |
| --- | --- | --- | --- | --- | --- |
| `gl_FragCoord` | Fragment Coordinates | vec4 | P | 原生規範；未做本輪宿主驗證；來源 | window coordinates；不可把完整 vec4 改稱 UV。 [G](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf) |
| `gl_FrontFacing` | Front Facing | bool | P | 原生規範；未做本輪宿主驗證；來源 | MAT 建議 TDFrontFacing 包裝；兩者不是無條件等價。 [G](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf) |
| `gl_PointCoord` | Point Coordinates | vec2 | P | 原生規範；未做本輪宿主驗證；來源 | MAT 優先 TDPointCoord 以保留方向修正。 [G](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf) |
| `gl_VertexID` | Vertex Index | int | V，GLSL OpenGL 語境 | 原生規範；未做本輪宿主驗證；來源 | Vulkan 語境的 gl_VertexIndex 與 TD wrapper 須核對，不能互換名字後聲稱同義。 [G](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf) |
| `gl_VertexIndex` | Vertex Index | int | V，GLSL Vulkan 語境 | 原生規範；未做本輪宿主驗證；來源 | 與所選 TD backend／版本核對；不是新增支援承諾。 [G](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf) |
| `gl_InstanceID` | — | int | V，GLSL OpenGL 語境 | 原生規範；未做本輪宿主驗證；來源 | TD 多相機 instancing 應用 TDInstanceID()。 [G](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf) |
| `gl_InstanceIndex` | — | int | V，GLSL Vulkan 語境 | 原生規範；未做本輪宿主驗證；來源 | 同樣不能繞過 TD 的 instance mapping。 [G](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf) |
| `gl_PrimitiveID` | Primitive Index | int | G／P（依 pipeline） | 原生規範；未做本輪宿主驗證；來源 | primitive 編號，不是 point／vertex index。 [G](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf) |
| `gl_PrimitiveIDIn` | Input Primitive Index | int | G | 原生規範；未做本輪宿主驗證；來源 | geometry stage 的輸入 primitive ID。 [G](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf) |
| `gl_InvocationID` | Invocation Index | int | G（及其他原生 stage） | 原生規範；未做本輪宿主驗證；來源 | 執行索引；依 stage 定義。 [G](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf) |
| `gl_SampleID` | Sample Index | int | P／MSAA | 原生規範；未做本輪宿主驗證；來源 | 使用可能改變 per-sample 執行方式，非免費 metadata。 [G](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf) |
| `gl_SamplePosition` | Sample Position | vec2 | P／MSAA | 原生規範；未做本輪宿主驗證；來源 | 像素內 sample 位置。 [G](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf) |
| `gl_SampleMaskIn` | — | int[] | P／MSAA | 原生規範；未做本輪宿主驗證；來源 | 覆蓋樣本的 bit mask；保留原生名。 [G](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf) |
| `gl_HelperInvocation` | — | bool | P | 原生規範；未做本輪宿主驗證；來源 | helper invocation 狀態；不是一般可見像素值。 [G](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf) |
| `gl_NumWorkGroups` | Workgroup Count | uvec3 | TOP C | 原生規範；未做本輪宿主驗證；來源 | dispatch 各軸群組數。 [G](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf) |
| `gl_WorkGroupSize` | Workgroup Size | uvec3 常數 | TOP C | 原生規範；未做本輪宿主驗證；來源 | local size，不是 image resolution。 [G](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf) |
| `gl_WorkGroupID` | Workgroup Index | uvec3 | TOP C | 原生規範；未做本輪宿主驗證；來源 | 群組座標。 [G](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf) |
| `gl_LocalInvocationID` | Local Invocation Index | uvec3 | TOP C | 原生規範；未做本輪宿主驗證；來源 | 群組內 3D index。 [G](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf) |
| `gl_GlobalInvocationID` | Global Invocation Index | uvec3 | TOP C | 原生規範；未做本輪宿主驗證；來源 | 全域 invocation index，不自動等於有效 texture pixel。 [G](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf) |
| `gl_LocalInvocationIndex` | Local Linear Index | uint | TOP C | 原生規範；未做本輪宿主驗證；來源 | 群組內一維 index。 [G](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf) |

<a id="catalog-10"></a>

## 10 附表：運算與宿主函數｜不放入 Sources

| TD 主名稱／原生識別 | 共通名候選 | 型別 | 適用範圍 | 現況／性質 | 語意與證據 |
| --- | --- | --- | --- | --- | --- |
| `TDAlphaTest()` | — | void | MAT P | 調查項；非 Sources；運算／宿主操作 | 宿主 alpha test；不把它列成來源。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDAttenuateLight()` | — | float | MAT P | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDAverage()` | Average | float | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDAxisAngleToQuaternion()` | Axis-Angle to Quaternion | vec4 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDBicubicInterpolation()` | Bicubic Sample | vec4 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDCheckDiscard()` | — | void | MAT P | 調查項；非 Sources；運算／宿主操作 | 宿主丟棄片段流程，void side effect。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDCreateRotMatrix()` | From-To Rotation | mat3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDCreateTBNMatrix()` | Tangent Basis | mat3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDCubeMapToEquirectangular()` | Direction to Equirectangular | vec2 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDDeform()` | Deform Position | vec3／vec4 | MAT V；依 overload | 已有運算入口；運算／宿主操作 | 依 geometry 的 skinning／instancing，輸出 world space。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDDeformNorm()` | Deform Normal | vec3 | MAT V；依 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDDeformVec()` | Deform Vector | vec3 | MAT V；依 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDDither()` | — | vec4 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | MAT 依 Render TOP 設定；TOP 版本與適用條件另外驗證。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDEnvLightingPBR()` | — | TDPBRResult | MAT P | 調查項；非 Sources；運算／宿主操作 | 指南 signature 同時記載 return struct 與 inout；實作前應以目標 build 編譯核對。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDEquirectangularToCubeMap()` | Equirectangular to Direction | vec3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDExtractRotation()` | Extract Rotation | mat3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDFade()` | — | float | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | TD 噪聲 fade 多項式；不是一般可任意替換的 easing。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDFadeDeriv()` | — | float | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | TDFade 的解析導數；保留原生名。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDFog()` | — | vec4 | MAT P | 調查項；非 Sources；運算／宿主操作 | 讀取相機霧設定；不是單一 Fog source。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDFrontFacing()` | Front Facing | bool | MAT P | 調查項；非 Sources；運算／宿主操作 | 需要 position、normal 的原生 wrapper，normal 應正規化且同空間。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDGamutRec2020ToRec709()` | — | vec3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 色彩運算；曲線／色域與參考亮度保留在原生名稱，vec4 overload 的 alpha 行為不可省略。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDGamutRec709ToRec2020()` | — | vec3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 色彩運算；曲線／色域與參考亮度保留在原生名稱，vec4 overload 的 alpha 行為不可省略。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDHSVToRGB()` | HSV to RGB | vec3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDHardShadow()` | — | float | MAT P | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDImageStoreOutput()` | Store Output Image | void | TOP C | 調查項；非 Sources；運算／宿主操作 | TOP Compute 寫入 output image；TD 已處理 swizzle，勿重複套用。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDImageStore_Name()` | Store Image | void | M；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | MAT Render TOP image output 寫入；需有效 render context。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDInstanceColor()` | Instance Color | vec4 | MAT V；依 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDInstanceDeform()` | Instance Position | vec4 | MAT V；依 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDInstanceDeformVec()` | Instance Vector | vec3 | MAT V；依 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDInstanceTexCoord()` | Instance Texture Coordinates | vec3 | MAT V；依 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDInstanceTexture()` | — | vec4 | MAT V 隱式／V+G+P 顯式 index | 調查項；非 Sources；運算／宿主操作 | 無 texture index 參數的版本僅 Vertex；顯式 texture index 版本可用於各 stage。這是取樣結果，不能當 sampler 引用。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDInterpolateTransformMatrices()` | Transform Interpolation | mat4 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDLighting()` | — | TDPhongResult | MAT P | 調查項；非 Sources；運算／宿主操作 | 回傳 TDPhongResult；宿主燈光、陰影與投影計算。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDLightingPBR()` | — | TDPBRResult | MAT P | 調查項；非 Sources；運算／宿主操作 | 回傳 TDPBRResult；保留 TD 實作與結果布局。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDLoop()` | Loop | float | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDLuminance()` | Luminance | float | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDOutputSwizzle()` | — | vec4 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 輸出格式適配，保留 TD 專名；不是一個 Sources 值。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDPerlinNoise()` | Perlin Noise | float | M／T；stage 依原生 overload | 已有運算入口；運算／宿主操作 | 已有 TD helper 節點；共通別名不表示可替換成任意同類噪聲並保持畫面一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDPerlinNoiseDeriv()` | Perlin Gradient | vec4 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDPickAdjust()` | — | vec4 | M；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | TD picking 投影修正，保留原生名。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDPixelColor()` | — | vec4 | MAT P | 調查項；非 Sources；運算／宿主操作 | 可含 Geo Text glyph 處理，不能簡化為直通 Color。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDProjMap()` | — | vec4 | MAT P | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDQuadReproject()` | — | vec4 | M；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | TD 相機四點重投影，保留原生名。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDQuaternionFromTo()` | From-To Quaternion | vec4 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDQuaternionMultiply()` | Quaternion Multiply | vec4 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDQuaternionToRotMatrix()` | Quaternion to Matrix | mat3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDRGBToHSV()` | RGB to HSV | vec3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDRemap()` | Remap | float／vec2／vec3／vec4 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDRotMatrixToQuaternion()` | Matrix to Quaternion | vec4 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDRotateFromQuaternion()` | Quaternion Rotate | vec3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDRotateOnAxis()` | Axis Rotation | mat3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDRotateToVector()` | Look Rotation | mat3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDRotateX()` | Rotate X | mat3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDRotateY()` | Rotate Y | mat3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDRotateZ()` | Rotate Z | mat3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDScale()` | Scale Matrix | mat3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDSimplexNoise()` | Simplex Noise | float | M／T；stage 依原生 overload | 已有運算入口；運算／宿主操作 | 已有 TD helper 節點；共通別名不表示可替換成任意同類噪聲並保持畫面一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDSimplexNoiseDeriv()` | Simplex Gradient | vec4 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDSineLookup()` | — | float | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | TD lookup 行為，不將名稱簡化成 sin。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDSkinnedDeform()` | Skin Position | vec4 | MAT V；依 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDSkinnedDeformVec()` | Skin Vector | vec3 | MAT V；依 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDSlerpQuaternions()` | Quaternion Slerp | vec4 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDSlerpRotationMatrices()` | Rotation Slerp | mat3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDSoftShadow()` | — | float | MAT P | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDTexGenSphere()` | Sphere Map Coordinates | vec2 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDTransferACESproxyToLinear()` | — | vec3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 色彩運算；曲線／色域與參考亮度保留在原生名稱，vec4 overload 的 alpha 行為不可省略。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDTransferBT2100HLGToLinear()` | — | vec3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 色彩運算；曲線／色域與參考亮度保留在原生名稱，vec4 overload 的 alpha 行為不可省略。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDTransferGamma1_8ToLinear()` | — | vec3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 色彩運算；曲線／色域與參考亮度保留在原生名稱，vec4 overload 的 alpha 行為不可省略。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDTransferGamma2_2ToLinear()` | — | vec3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 色彩運算；曲線／色域與參考亮度保留在原生名稱，vec4 overload 的 alpha 行為不可省略。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDTransferGamma2_4ToLinear()` | — | vec3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 色彩運算；曲線／色域與參考亮度保留在原生名稱，vec4 overload 的 alpha 行為不可省略。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDTransferGamma2_6ToLinear()` | — | vec3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 色彩運算；曲線／色域與參考亮度保留在原生名稱，vec4 overload 的 alpha 行為不可省略。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDTransferGamma2_8ToLinear()` | — | vec3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 色彩運算；曲線／色域與參考亮度保留在原生名稱，vec4 overload 的 alpha 行為不可省略。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDTransferLinearToACESproxy()` | — | vec3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 色彩運算；曲線／色域與參考亮度保留在原生名稱，vec4 overload 的 alpha 行為不可省略。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDTransferLinearToBT2100HLG()` | — | vec3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 色彩運算；曲線／色域與參考亮度保留在原生名稱，vec4 overload 的 alpha 行為不可省略。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDTransferLinearToGamma1_8()` | — | vec3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 色彩運算；曲線／色域與參考亮度保留在原生名稱，vec4 overload 的 alpha 行為不可省略。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDTransferLinearToGamma2_2()` | — | vec3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 色彩運算；曲線／色域與參考亮度保留在原生名稱，vec4 overload 的 alpha 行為不可省略。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDTransferLinearToGamma2_4()` | — | vec3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 色彩運算；曲線／色域與參考亮度保留在原生名稱，vec4 overload 的 alpha 行為不可省略。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDTransferLinearToGamma2_6()` | — | vec3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 色彩運算；曲線／色域與參考亮度保留在原生名稱，vec4 overload 的 alpha 行為不可省略。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDTransferLinearToGamma2_8()` | — | vec3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 色彩運算；曲線／色域與參考亮度保留在原生名稱，vec4 overload 的 alpha 行為不可省略。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDTransferLinearToRec709()` | — | vec3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 色彩運算；曲線／色域與參考亮度保留在原生名稱，vec4 overload 的 alpha 行為不可省略。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDTransferLinearToSRGB()` | — | vec3／vec4 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 色彩運算；曲線／色域與參考亮度保留在原生名稱，vec4 overload 的 alpha 行為不可省略。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDTransferLinearToST2084PQ()` | — | vec3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 色彩運算；曲線／色域與參考亮度保留在原生名稱，vec4 overload 的 alpha 行為不可省略。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDTransferRec709ToLinear()` | — | vec3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 色彩運算；曲線／色域與參考亮度保留在原生名稱，vec4 overload 的 alpha 行為不可省略。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDTransferSRGBToLinear()` | — | vec3／vec4 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 色彩運算；曲線／色域與參考亮度保留在原生名稱，vec4 overload 的 alpha 行為不可省略。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDTransferST2084PQToLinear()` | — | vec3 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 色彩運算；曲線／色域與參考亮度保留在原生名稱，vec4 overload 的 alpha 行為不可省略。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDTranslate()` | Translation Matrix | mat4 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDTricubicInterpolation()` | Tricubic Sample | vec4 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDTriplanarBlend()` | Triplanar Blend | vec4 | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDWorldToProj()` | World to Projection | vec4 | MAT V／G；G 需 camera index | 已有運算入口；運算／宿主操作 | 包括 TD 投影、picking、unwrap 等宿主處理；不是單純矩陣相乘的別名。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDWritePickingValues()` | — | void | M；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 初始化／寫入 picking payload。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDZigZag()` | Ping-Pong | float | M／T；stage 依原生 overload | 調查項；非 Sources；運算／宿主操作 | 運算名稱候選；精確 overload、數值與座標約定沿用 TD 原生實作，不宣稱跨宿主結果一致。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDCheckOrderIndTrans()` | — | void | MAT P | 待擴充；運算／宿主操作 | 指南的 OIT 相容入口；與 TDCheckDiscard 的現行關係需版本驗證。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDPBRResult.diffuse` | — | vec3 | MAT lighting 結果 | 待擴充；運算結果欄位 | 函數回傳結構欄位；沒有同名自動 Uniform／來源實體。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDPBRResult.specular` | — | vec3 | MAT lighting 結果 | 待擴充；運算結果欄位 | 函數回傳結構欄位；沒有同名自動 Uniform／來源實體。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDPBRResult.shadowStrength` | — | float | MAT lighting 結果 | 待擴充；運算結果欄位 | 函數回傳結構欄位；沒有同名自動 Uniform／來源實體。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDPhongResult.diffuse` | — | vec3 | MAT lighting 結果 | 待擴充；運算結果欄位 | 函數回傳結構欄位；沒有同名自動 Uniform／來源實體。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDPhongResult.specular` | — | vec3 | MAT lighting 結果 | 待擴充；運算結果欄位 | 函數回傳結構欄位；沒有同名自動 Uniform／來源實體。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDPhongResult.specular2` | — | vec3 | MAT lighting 結果 | 待擴充；運算結果欄位 | 函數回傳結構欄位；沒有同名自動 Uniform／來源實體。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDPhongResult.shadowStrength` | — | float | MAT lighting 結果 | 待擴充；運算結果欄位 | 函數回傳結構欄位；沒有同名自動 Uniform／來源實體。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |

<a id="catalog-11"></a>

## 11 歷史、輸出與文件疑點｜避免誤列成現行來源

| TD 主名稱／原生識別 | 共通名候選 | 型別 | 適用範圍 | 現況／性質 | 語意與證據 |
| --- | --- | --- | --- | --- | --- |
| `sTDComputeOutputs[]` | — | 歷史 image array | 依歷史與版本 | 不作新入口；非新來源 | 2025.30000 前的路徑；現行應用 TDImageLoadOutput／TDImageStoreOutput。指南尾段仍殘留舊描述。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `uTDMat` | — | 歷史矩陣結構 | 依歷史與版本 | 不作新入口；非新來源 | 舊 world/camera lighting 路徑；新入口使用 uTDMats[c]。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `uTDInstanceIDOffset` | — | 歷史／底層資訊 | 依歷史與版本 | 不作新入口；非新來源 | 不自行以 gl_InstanceID 加 offset 取代 TDInstanceID()。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `P／N／uv／Cd` | — | 歷史直接幾何屬性 | 依歷史與版本 | 不作新入口；非新來源 | MAT 優先 TDPos／TDNormal／TDTexCoord／TDPointColor；TOP 自訂 vertex 範例仍有 P、uv，要另做版本驗證。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |
| `TDSOPToProj()` | — | TOP vertex 範例函數 | 依歷史與版本 | 不作新入口；非新來源 | 僅記錄指南範例，2025 可用性與 TDWorldToProj 關係待核對，不直接上架。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `fragColor／gl_Position／gl_PointSize／gl_FragDepth` | — | Shader 輸出 | 依歷史與版本 | 不作新入口；非新來源 | 是使用者輸出或 GLSL 輸出內建值，不是 read-only Sources。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) [G](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf) |
| `uTDOutputINfo` | — | 文件拼字 | 依歷史與版本 | 不作新入口；非新來源 | 正確符號依宣告為 uTDOutputInfo；不建立第二個來源。 [T](https://derivative.ca/UserGuide/Write_a_GLSL_TOP) |
| `TDAttenutateLight` | — | 文件拼字 | 依歷史與版本 | 不作新入口；非新來源 | 正確函數為 TDAttenuateLight；不建立第二個函數。 [M](https://derivative.ca/UserGuide/Write_a_GLSL_MAT) |

## 本輪發現的實作差距與決策點

- 目前核心 `SOURCES` 登記只有 `uTD2DInfos`、`sTD2DInputs`、`uTDMats`、`uTDCamInfos`、`uTDLights` 五種陣列。既有 `Texture Coordinates`、`TD Position` 與四個時間／幀預置是另外的入口，不能據此宣稱 TD 內建來源已齊全。
- 原生結構已登記 `TDTexInfo`、`TDMatrix`、`TDCameraInfo`、`TDLight`。`TDGeneral`、`TDEnvLight` 與環境光 buffer 尚不是同等完整的圖內入口。
- `quadReproject`、`clipDistances`、`ipdShift` 是既有 2025.32820 實測欄位；沒有足夠文件語意就保留原名與待核對狀態，不猜解讀。
- `absTime.frame`／`me.time.frame` 的 Python 原生型別是 float。UI 名字叫 Frame 不足以授權改成 int，也不等於零起算的 render counter。
- `Clock CHOP.year` 受 Start Reference 影響；System Time／Date 必須先確定時間約定。這輪不建立新的 Clock／Feedback OP、不新增高頻同步或輪詢。
- `uTDGeneral.viewport` 是 origin 與 reciprocal size 的打包；MAT 的 viewport 不必等於整個輸出目標尺寸。`uTDOutputInfo` 的 TOP 語意不能直接移植為 MAT 同名來源。
- 對 3D／2D Array，最新切片 offset 單位不同；來源名字與型別提示應保留區別。
- 現有 `Array[i]`／Field 可組合取得多項資料，並不代表每個資料都需要一個專門節點。列入表只是確定來源與命名，不自動增加幾百個清單項目。
- 純運算、sampling、宿主 side effect 與可寫 picking/output 資料都已標出；這些不能僅因名稱以 TD 開頭就塞進 Sources。

## Online／ISF 對名稱的影響

獨立 Online 版自行提供執行環境，不要求 TD 在場。ISF 2.0 可成為產碼／執行中介候選；它的格式版本與 GLSL ES／桌面 GLSL 的版本分開。共通名字可以先存在，不因此限制 TD 功能到 WebGL 的最低共同範圍。

| 來源群 | 移植評估界線 |
| --- | --- |
| 時間、Frame、尺寸、UV、一般自訂輸入 | 有相近宿主能力，仍需對齊時鐘、frame 起點、UV 與尺寸語意 |
| `TDTexInfo`／TOP sampler arrays | 可提供相容資料，但 WebGL 的 sampler array 動態索引等限制需產碼適配 |
| Geometry／Camera／Light／Instance | 需要真正的場景與渲染宿主；ISF 的影像執行器不自動重現 TD MAT 環境 |
| TD Noise／色彩／lookup | 需要相容函數與資源；同名不保證同畫面 |
| Picking、宿主巨集、內部結構欄位 | 保留 TD 身分；沒有對應就不提供共同名，不靜默替代 |

## 覆蓋核對與尚未驗證事項

以兩份當日公開指南中的 TD 符號作交叉檢查，另展開固定結構欄位與已知動態命名家族。純命名前綴、文件標題、範例使用者變量與拼字錯誤不當作新 API。公開指南仍有舊版殘留；歷史項另列，沒有以最新網頁文字覆寫已確認的宿主版本事實。GLSL 系統值附表列出相關入口供比對，不是整份 GLSL 規範的內建值與函數大全；時鐘部分也不擴張為所有 TD Python 屬性的收集。

具名符號檢查：TOP 指南辨識到 96 個 TD 符號，MAT 167 個（兩者有重複）。排除庫／章節名稱 `TDBasicColorSpace`、`TDColorSpace`、`TDMath`、`TDQuaternionMath`、`TDPages`，以及命名前綴、範例名後，其餘都有表列項目或對應的動態家族。函數宣告共辨識 121 個不同函數名，overload 在同一列說明；不以列數假裝每種簽名都已驗證。公開的九個 struct／buffer 定義之欄位亦已對照，Picking payload 另列。

尚需後續實作時驗證：版本特定函數／overload、所有 stage 的可用性、MAT 空場景與多相機、各種紋理維度、色彩管理、System Time 表示法，以及具體 Online／ISF 執行器的能力。這些不阻止命名審查，但不能在表內被誤讀為已通過測試。

## 來源

- **T**：[TD GLSL TOP 指南](https://derivative.ca/UserGuide/Write_a_GLSL_TOP)
- **M**：[TD GLSL MAT 指南](https://derivative.ca/UserGuide/Write_a_GLSL_MAT)
- **TP**：[GLSL TOP Parameter](https://derivative.ca/UserGuide/GLSL_TOP)
- **MP**：[GLSL MAT Parameter](https://derivative.ca/UserGuide/GLSL_MAT)
- **A**：[absTime Python](https://docs.derivative.ca/AbsTime_Class)
- **TC**：[Time COMP Python](https://derivative.ca/UserGuide/TimeCOMP_Class)
- **OP**：[OP.time 與時間參照](https://derivative.ca/UserGuide/OP_Class)
- **C**：[Clock CHOP](https://derivative.ca/UserGuide/Clock_CHOP)
- **F**：[Feedback CHOP](https://docs.derivative.ca/Feedback_CHOP)
- **FR**：[TD Frame Rate](https://docs.derivative.ca/Frame_Rate)
- **G**：[GLSL 4.60 規範](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf)
- **W**：[WebGL 2 規範](https://registry.khronos.org/webgl/specs/2.0.0/)
- **I**：[ISF 2.0 規範](https://github.com/mrRay/ISF_Spec)
- **L**：[專案 TD 結構既有驗證](../features/TD_ARRAY_SOURCES.md)
- **P**：[專案來源預置](../../src/core/sgrape_sources.py)
- **R**：[專案結構與來源登記](../../src/core/sgrape_composites.py)
- **N**：[專案產碼器](../../src/core/sgrape_core.py)

本表共 311 列，包含來源、派生入口、欄位、配置家族及函數／非來源附表；不是 311 個待新增節點。
