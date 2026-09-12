# TD Shader Graph — 實作規格（交接版 v2）

> **讀者**：實作 agent（主）、人類協作者（輔）。
> **用途**：據此開始實作，不需回頭問設計者即可完成 §14 的前段里程碑。
> **狀態**：吃進第三方審閱的正確性修正（原 v1.8 計畫 A 類 + B1）。
> 標 `[待實測]` = 需在 TD 中驗證後回填（共數處，集中於附錄）。
> 標 `[待作者複核]` = 改動了語意、設計者尚未拍板（僅 B1 一處）。
> **推導與被否決的路徑**不在此文件；需要「為什麼不是別的做法」時見《規格草案筆記》。

---

## 導讀：這是什麼

一個給 TouchDesigner 用的、**網頁介面的 GLSL 節點式 shader 編輯器**。使用者在瀏覽器裡連節點，工具產出靜態的 GLSL 程式碼與參數，寫進 TD 的 GLSL MAT。

**心智模型是 Unreal 的 material graph，不是 Blender。** 但比 UE 更低階——終點是真正的 colorbuffer（`vec4`），不是交給引擎組裝的具名 material attribute。原因：TD 的 GLSL MAT 比 UE 的 material 更低階（forward、直接寫 buffer、量化就在下一步）。

**一句話抓住整個架構**：這是一個編譯器，不是一個執行期。它替使用者把 GLSL 打出來，打完就退場。TD 的 `.toe` 是活的宿主環境；這個工具是編譯器，產物是靜態文本。

初始目標 target 是 **GLSL MAT**（功能最全、涵蓋最多）。TOP 是它的限制版（幾乎免費）。POP/compute 是同哲學的獨立實例（明確不在初始範圍）。

### 三個「租來的」前提（為什麼這個極端模型成立）

1. **GLSL 的型別封閉且可列舉**（就那幾個 vec/mat，無自訂型別）→ 型別解析是查表不是推導 → 可以畫成節點
2. **GLSL 在 fragment 內是純的、無副作用、邊界全在簽名上**（uniform/in/out）→ 圖 = 純表達式 DAG，宣告 = 介面
3. **TD 給了宿主承諾**：par 系統（投影有落點）、`TD*` 函數恆存在且簽名穩定（節點表不需 flag 感知）、DAT 是純文字（產出能靜態）

這三個都不是工具發明的。**工具的價值在於一行自己的發明都沒有——它只是拒絕在這三者之上疊任何抽象。** 砍掉的比加上的多。

---

## 0. 原則（每條附可執行檢驗）

實作與審閱以**可執行形式**為準；抽象句只是標題。

### 0.1 工具只是替使用者打字，打完就退場
- 執行期為空：shader 運行不需要主節點在場
- 產出是靜態的：GLSL 寫進 DAT、par 建在 MAT/COMP，皆一次性投影
- **檢驗：刪除主節點 `.tox`，專案照常運作**（只是不能再編輯圖）

### 0.2 不內置，但預設
- **判準：它有其他合理的樣子嗎？**
  - 有 → 做成預設接法（初始圖的內容），可拆、**可完全清空**
  - 沒有 → 固定，位置在 schema 或 shell，使用者碰不到
- **預設可以被完全清空，是預設與約束的分界線**
- 決定權不在使用者手上的（TD flag 控制的行為）不進圖

### 0.3 圖恆合法，deploy 需驗證
- 未接的 pin 用型別預設值；**opaque（sampler）未接 → 該取樣節點不 emit，輸出降型別預設值**（見 §3.6、§7）
- 型別解析在接線當下拒絕不相容的線
- varying 沒被寫就不宣告，被引用就給 0
- **檢驗：resolve 恆成功**（不 throw、不產生非法圖）
- **但 deploy 不恆成功**：emit 出的 GLSL 仍可能編譯失敗（TD include 變動 / 資源限制 / emit bug）→ 必須先驗證再提交（§7）
- **承諾範圍：保證結構合法與定義行為，不保證數值符合意圖。** NaN（`normalize(vec3(0))`、除零）、switch fall-through、值域越界皆在界外，與手寫等價。**結構歸圖，值域歸人。** Safe 變體是節點表內容（預設推薦），非架構
- **合法性的單位是 MAT**（vertex 圖 + pixel 圖 + 宣告的聯合）；resolve 一次收整組

### 0.4 沒有第二份真相
- 節點表、宣告、圖，各只有一份權威；其餘是投影或視圖
- 圖 JSON 不存可算出的東西
- 前端不持有獨立、持久、未版本化的語意權威（可持有帶 `baseRevision` 的暫時 working copy，見 §9）

### 0.5 工具的聰明在架構，不在行為
- 架構的聰明消滅問題；行為的聰明製造例外
- 編輯器忠實且謹慎：呈現宣告與節點表、拒絕不合法操作，僅此而已
- 不猜測意圖、不判斷「完成」、不評估效能預算、不修正圖

---

## 1. 環境契約（v1 鎖定範圍）

**這一節必須在動工時先確定，否則型別系統會被迫演化成一個未命名的 capability system。**

以下標 `[待實測]` 的值需撈 TD 環境確認：

```
最低 TD build：      [待實測]
Graphics backend：   Vulkan（TD 現行）
GLSL version：       [待實測，對應 TD 的 Vulkan GLSL 前端]
```

**v1 支援型別（socket 上可流動的集合）：**

| 類別 | v1 支援 | v1 deferred |
|---|---|---|
| scalar | `bool` `int` `uint` `float` | `double` |
| vector | `bvec2-4` `ivec2-4` `uvec2-4` `vec2-4` | — |
| matrix | `mat2` `mat3` `mat4`（若確需；否則一併 defer） | 非方陣 `mat2x3` 等 |
| sampler | `sampler2D` `sampler3D` `samplerCube` | sampler array、shadow sampler、image |
| 複合 | — | uniform array 進 socket、runtime array |

- **matrix / array 是否進 socket 必須明確標定**（影響 §3.4 的 cost 計算）。v1 建議：matrix 進 socket，array 不進（array 只作為宣告的內部維度）
- 其餘型別明確 deferred，不是「之後自然支援」——加入時需補該型別的投影規則

---

## 2. 節點定義表

系統的字典。codegen 與編輯器共讀同一份外部 JSON。

### 2.1 Entry schema

```json
{
  "definitionUuid": "8f3c1a20-…",
  "revisionHash": "a1b2c3d4",
  "id": "smoothstep",
  "category": "Math/Interpolation",
  "weight": 90,
  "summary": "在兩個邊界之間做 Hermite 平滑插值",
  "params": [
    {"name": "edge0", "desc": "下邊界"},
    {"name": "edge1", "desc": "上邊界"},
    {"name": "x",     "desc": "取樣點", "requiresConst": false}
  ],
  "overloads": [
    {"params": ["genType","genType","genType"], "outputs": ["genType"], "constRule": "builtinNonSpecOnly"},
    {"params": ["float","float","genType"],      "outputs": ["genType"], "constRule": "builtinNonSpecOnly"}
  ],
  "emit": "{out0} = smoothstep({0}, {1}, {2});",
  "global": null,
  "stages": ["vertex", "pixel"],
  "variadic": null,
  "deprecated": false,
  "replacedBy": null
}
```

### 2.2 識別與 append-only

| 欄位 | 規則 |
|---|---|
| `definitionUuid` | 節點**定義**的身分（簽名與概念）。**改簽名 = 新 uuid + 舊的標 deprecated**。節點表 append-only，永遠不 break 任何一張圖 |
| `revisionHash` | `emit`/`global`/metadata 的**內容版本**。改 emit（不改簽名）= 同 uuid、新 revisionHash。用於考古精度與「upgrade available」提示 |
| `deprecated` / `replacedBy` | 舊 entry 永遠留在活表；編輯器不列入候選，但既有圖照常解析 |

> **為什麼拆兩層**（回應審閱）：uuid 管「這是不是同一個概念」，revisionHash 管「這是不是同一份實作」。圖記錄用到的 revisionHash，才能區分「合法更新」與「內容漂移」。

### 2.3 emit / global

| 欄位 | 規則 |
|---|---|
| `emit` | **SSA 語句**，非表達式。佔位符 `{0}…{n}` = 輸入、`{out0}…` = 輸出。codegen 先宣告輸出變數再替換。多輸出、out 參數、優先級問題由此形態一次解決 |
| `global` | 完整 GLSL 函數定義，**按 revisionHash 去重、emit 一次**；`emit` 每實例一次。內部迴圈寫這裡（node-level loop）。**必須 self-contained 或明列 dependencies；symbol 用 uuid/hash namespacing 避免撞名；標注 purity/effect**（sinking pass 需要，見 §4.4） |

**⚠ TD 函數的 entry 一律 `global: null`。禁止複製 TD include 的實作進節點表。** 我們只呼叫，不重寫——TD 編譯時自己插入實作。抄一份會凍結行為（破壞「行為隨環境調整」的承諾），且著作權不乾淨。

### 2.4 overloads 與 genType

- 每個 overload：`{params[], outputs[], constRule}`。**多輸出型別在 overload 層定義**（`modf`/`frexp` 各 overload 的 output 型別可不同，不能只靠 entry 層）
- genType = `float`/`vec2`/`vec3`/`vec4` 的受限多型，同一簽名內一致
- `constRule` ∈ `operator` / `constructor` / `builtinNonSpecOnly` / `never`（見 §3.5 const lattice）

### 2.5 variadic

`variadic` 為 null 或一個物件：

```json
"variadic": {
  "minArity": 1,
  "maxArity": null,
  "typeRule": "allSame",
  "emitStrategy": "fold",     // fold | switch | list
  "foldOrder": "left"
}
```

- `min(a,b,c…)` 不是 GLSL 原生 variadic，是**巢狀 fold**（`min(min(a,b),c)`）→ `emitStrategy: fold`
- `switch` 是另一種 emitter（見 §4.4），**不可與 fold 共用同一個 `{0..n}` 概念**
- 零輸入 / 低於 minArity 的行為：輸出視為未接，節點不 emit（套用 §0.3 既有規則）

### 2.6 純 UI 欄位

`weight` / `category` / `summary` / `params[].desc` 是純 UI 資料，codegen 不讀。**一律可缺席**，fallback：排最後 / Uncategorized / 顯示簽名 / 顯示參數名。

### 2.7 內容的生成與驗證

- **來源優先序：實物（TD include 檔 / 官方 wiki）> GLSL spec > 手寫。禁止憑記憶填簽名**
- 描述欄位 AI 生成、人工查驗；**查驗重點是 `emit`**（emit 錯 = 產出錯的碼；summary 錯 = 文件問題）
- 分層合併：內建表在 `.tox` 內；掃描外部目錄，**同 uuid 外部覆蓋前必須驗 signature fingerprint 相同**（否則外部表可破壞 append-only）
- 測試見 §12

---

## 3. 型別系統

### 3.1 多載解析

1. 先按 GLSL 規則解析（隱式轉換僅 `int→float`、`int→uint`、`uint→float` 及向量版；**splat 不參與**）
2. 失敗 → fallback：僅允許 `float → vecN` splat，重解析一次
3. 仍失敗 → 編輯器擋線

`vecN → vecM` 截斷不在 cast 規則；要截斷接 swizzle/split 節點（丟哪個分量是使用者的意圖）。

**隱式轉換表（v1，完整）：**

| 從 | 到 | 方式 |
|---|---|---|
| `int` | `uint` `float` | GLSL 隱式 |
| `uint` | `float` | GLSL 隱式 |
| `ivecN` | `uvecN` `vecN` | GLSL 隱式（同維） |
| `uvecN` | `vecN` | GLSL 隱式（同維） |
| `float` | `vec2/3/4` | **splat，僅 fallback** |
| 其餘 | — | 不轉，擋線 |

### 3.2 genType 實例化（型別傳播）

- 從具體型別錨點出發，沿邊雙向傳播；遇 genType 節點即實例化
- **輸入優先**：輸入接 `float`、輸出接 `vec3` pin → 實例化為 `float`，輸出邊插 splat
- 傳播不到 → 兜底 `float`
- 衝突 → 拒絕後接的那條線
- **codegen 拿到的圖，每個節點都已是具體 overload**

**genType 展開表（實例化後的具體簽名）：**

| genType 綁定 | `T` | `vecN` 版本 |
|---|---|---|
| float | `float` | — |
| vec2 | `vec2` | 分量 `float` |
| vec3 | `vec3` | 分量 `float` |
| vec4 | `vec4` | 分量 `float` |

（GLSL 的 genType 家族僅浮點向量。整數版函數若存在為獨立 overload，不走 genType。）

### 3.3 常數路徑（const lattice）★ 回應審閱 A2

**`isConst: bool` 不足**——spec constant 經某些 built-in 後不再是 constant expression，bool 規則會放行 GLSL 會拒絕的東西，破壞圖恆合法。

**lattice（每個 output 一個值）：**

```
runtime  <  literalConst  <  compileConst  <  specConstExpression  <  invalidConst
```

- **標在 output 上，非 node 上**（同一節點可 output0=runtime、output1=compileConst）
- 傳播規則按節點的 `constRule`：

| `constRule` | 行為 |
|---|---|
| `operator` | 輸入皆為某 const 級 → 輸出同級（含 spec：spec 輸入 → `specConstExpression`） |
| `constructor` | 同 operator（`vec3(1.0, 2.0, 3.0)` 是 constant expression） |
| `builtinNonSpecOnly` | 輸入皆 `compileConst` 以下 → 輸出 `compileConst`；**輸入含 spec → 輸出 `invalidConst`**（該 built-in 對 spec 不保證是常數） |
| `never` | 恆 `runtime`（user-defined function、`texture()`） |

- `requiresConst` 的 pin 接受 `literalConst` / `compileConst` / `specConstExpression`；拒絕 `runtime` / `invalidConst`
- **接線時對 lattice 檢查**，不等到編譯器報錯
- `[待實測]` `cTDAttribArraySize_*` 等錨點的實際 lattice 層級，撈 dump 時逐一確認（暫定 `compileConst`）

### 3.4 常數的 emit

由型別驅動，不看值：`float` 永遠帶小數點（`1.0`）、`int` 純整數、`uint` 帶 `u`、`vecN` 每分量照 float。**產出碼中不存在隱式提升；所有轉換由 resolve pass 顯式插入。**

---

## 4. 圖

### 4.1 Schema 要點

- 節點實例 id：8 碼隨機十六進位，單圖內唯一，複製時重發
- 圖 id：由 DAT 路徑決定，**不存進 JSON**
- 邊：`{from, fromSlot, to, toSlot}`，slot 必存（單輸出恆 0）
- **不存可算出的東西**：無輸出型別、無 cast、無拓樸序、無 const 級別
- schema version 必存（見 §4.2 migration）
- 圖頂層存：`schemaVersion`、`nodeTableVersion`、本圖用到的 `revisionHash` 清單
- 子節點（group）：group 標記 + 成員 id + `templateUuid` + clone 狀態，**不進 codegen 視野**
- `archive`：可選區塊（見 §4.3）

### 4.2 載入、正規化、migration ★ 回應審閱 B3/A1

外部手改（非編輯器途徑）造成的非法圖，**分階段處理，不自動覆寫原始 JSON**：

```
parse → validate → repair view → commit repair
```

| 階段 | 行為 |
|---|---|
| parse | JSON 解析。壞 → 見下 schema 分支 |
| validate | 檢出：懸空邊、撞號 id、引用失效節點、環 |
| repair view | 在**記憶體 working copy** 上修（丟懸空邊、重發撞號 id、失效節點走 §4.4 梯度）。**原始 DAT 不動** |
| commit repair | 產出 repair report；**使用者接受後才寫回** |

- **丟邊是語意修改，不是 canonicalization**——故不自動 commit（否則 git merge 出錯的內容會在下次儲存永久消失）
- **環**：唯一降不掉的（拓樸排序不成立）→ 整圖進 repair view，不可 deploy

**schema version 分支：**
- 已知**舊**版 → 走 migration chain（`v1→v2→v3`），保留原始副本
- 未知**新**版 → 只讀拒絕（工具太舊，無法安全處理）
- **不可只提示「重新產生」**——舊圖可能是唯一來源，無物可重生

**last-good 保護**：JSON 壞 / 非法 / 未 deploy 時，DAT 裡的 GLSL 是**上次成功 deploy 的產物**，MAT 照跑。圖的問題不影響演出（§0.1 紅利）。

### 4.3 定義解析梯度 ★ 回應審閱 B2

resolve 對每個實例，權威順序固定：

| 層 | 來源 | 狀態 | 可 deploy |
|---|---|---|---|
| 1 | 活表精確 `revisionHash` | `ok` | ✓ |
| 2 | 活表相同 uuid、不同 revision | `ok`，標 `upgrade available` | ✓ |
| 3 | deprecated entry | `ok`，不列入候選 | ✓ |
| 4 | archive 精確 revision | `stale` | ✓ |
| 5 | 都沒有 | `dead` | ✗ **不可 deploy** |

- **活表在場時禁止讀 archive**——archive 從不與活表爭對錯
- `ok/stale/dead` 是 resolve 輸出，投影為前端註記（`kind-*`），樣式歸 CSS
- **dead 節點**：保留身分與接線的錨點。可移動、可刪、**不可編輯**；pin 從邊反推（有 archive 則照 archive 簽名畫）
- **dead 圖預設不可 deploy**（見 §7）——否則節點遺失會把演出悄悄改成大量零值卻標「成功」

### 4.4 archive（可選功能）

**產出的一個檔位，不是圖的一個層。少了它一切照動。**

- 圖 JSON 的可選區塊：本圖用到的節點定義（按 revisionHash 去重），每次 deploy/匯出整塊重寫
- 由選項生成（`embed archive: on/off`）；日常編輯可關，分發時開 → 收的人拿到自足內容
- 缺席只影響孤島/離線可考古性（配合生成 GLSL 的 `// n:` 註解，足以重建工具鏈）
- **圖只保證介面相容，不保證歷史語意可重現**（明文承認；archive 是鑑識層非重現保證）
- **安全**：archive 的 `global` 是可執行 shader code。**首次載入外來 archive 不自動 deploy**（見 §11）

### 4.5 兩張圖，強制

- 一張圖 = 一個 stage；vertex 圖與 pixel 圖各自獨立，唯一耦合是 `varyings` 宣告
- **沒有「vertex 圖不存在」**：預設 vertex 圖是可運作 pass-through（`TDWorldToProj(TDDeform(TDPos()))` → `gl_Position`），**可被完全清空**
- **「完全不 deform」（螢幕空間、全螢幕 quad）是完整用法，不提示**——`gl_Position` 直接接 `vec4`
- 兩張圖對稱多終點：vertex = `gl_Position` + N 個 varying 輸出；pixel = 輸出模組

### 4.6 子節點（group / template）★ 回應審閱 C3

- 引用 = 複製展開（實例 id 重發），摺疊是視覺
- **模板 = 圖片段 + 池片段**（含 promote / default / parType / Menu 標籤）
- 禁止遞迴，載入時環檢測
- **v1 只做「插入一次的複製」**。auto/manual clone 延後——它會比 codegen 更早爆炸（對外連線的穩定 port、member id 映射、外部 edge 保留、pool fragment 同名合併、revision 追蹤、群組內移動是否算 override 皆未解）

### 4.7 分支與迴圈 ★ 回應審閱 B5

| | 定位 |
|---|---|
| `mix` | 選值的預設方式，兩邊求值 |
| const `switch` | **必要**（spec constant 的 mode 切換靠它）；selector `requiresConst`；特化後只剩一支；帶 `default` pin（未接給型別預設值 0）；零分支 = 輸出視為未接 |
| `select` | const 二選一的便利入口（**原名 `const if`，改名**：`mix` 語意是兩邊都算，叫 if 會誤導短路語意） |
| **runtime if/switch** | **v1 完全不做** |
| node-level loop | **承重牆**：lighting、gather、raymarch 全靠它，寫在 `global` |
| graph-level loop | 不做。IR 是 expression DAG；拓樸排序寫成明確 pass（保留未來擴張路徑） |

**為什麼 runtime branch v1 不做**：它需要 control-flow region、branch-local scheduling、合流變數、effect ordering、dominance——即使不叫 phi，仍要做相同的合流。而外部 `global` 目前的 purity metadata 才剛引入（§2.3），sinking pass 尚無足夠依據安全搬動節點。等 IR 明確加入 control-flow/effect model 後再做。**現在不寫成「可做不建議」，以免實作者誤以為它在架構承諾內。**

---

## 5. Shell 與輸出模組 ★ 回應審閱 B8

### 5.1 Shell

包住 `main()` 的固定結構，使用者碰不到。

- 永遠呼叫（安全、關閉時 no-op）：`TDCheckDiscard()`（開頭）、`TDAlphaTest(alpha)`、`TDDither()`（per-output）、`TDOutputSwizzle()`（最後）
  - `[待實測]` `TDCheckDiscard` vs `TDCheckOrderIndTrans`——三種結果殼行為相同（見附錄）
  - **`TDAlphaTest` 的 alpha 來源**：預設 output index 0 在 dither/swizzle 前的 alpha
- **判準：殼裡的函數只接受它自己能拿到的東西**（要寫出的顏色）。`TDFog` 需要 worldPos → 是節點，不在殼
- **preprocessor 規則**：**node emit 不得產生 preprocessor directive；target shell 可以**（picking `#ifdef`、color buffer `#if` 都在殼上）
- **禁止 emit `#version`**（TD 自動插入，重複即報錯）
- 工具不產生 node 層的 directive；`predat` 留給使用者（手寫時 predat 的兩用途——共同函數、共同 uniform——圖裡已是機制）

**Picking**（`TD_PICKING_ACTIVE` 在殼上）：
- v1 明列限制：**非標準 deformation 不保證 picking 正確**。標準 `TDDeform` 路徑保證；任意 vertex graph 變形下 picking 可能錯。可選 picking 終點延後

### 5.2 輸出模組（final out）

圖裡唯一刪不掉的節點。

- 條目：`{id, name, index, dither}`
- **投影用陣列形式**：`layout(location = 0) out vec4 fragColor[TD_NUM_COLOR_BUFFERS];`
- **color buffer index 用 `#if` 包**（回應審閱，防 corruption/GPU crash）：
  ```glsl
  fragColor[0] = TDOutputSwizzle(TDDither(v42));
  #if TD_NUM_COLOR_BUFFERS > 1
  fragColor[1] = TDOutputSwizzle(v57);
  #endif
  ```
  （MAT 可能同時被不同 Render TOP 使用，不能假設固定 buffer 數）
- 順序固定：dither 在 swizzle 前（swizzle 是 channel 重排），per-output toggle
- **depth 寫 `gl_FragDepth`**（不是自訂 out float，否則實作者易做成假深度）；可選 toggle 預設關；**開了就所有執行路徑都必須寫值**（否則深度未定義）；不套 swizzle
- `gl_PointSize`：vertex 側同構的可選 toggle，預設關
- 寫超出 `TD_NUM_COLOR_BUFFERS` 的 index：`#if` 已防護

---

## 6. 七份宣告

模式統一：**宣告是權威，GLSL 宣告與 par 是投影**。細節各異，不是同一個機制。

| # | 名字 | 投影目標 | promote |
|---|---|---|---|
| 1 | `uniforms` | MAT vec1–4 page | ✓ → Float / RGB / XYZ |
| 2 | `samplers` | MAT sampler page | ✓ → TOP |
| 3 | `constants`（spec constant） | MAT Constants 頁 | ✓ → Int / Menu / Toggle（成本須可見） |
| 4 | `attributes` | MAT Attributes 頁 | ✗ |
| 5 | `buffers` | MAT Buffers 頁 | ✗ |
| 6 | `varyings` | `in`/`out` + interpolation qualifier | ✗ |
| 7 | `outputs` | `fragColor[]` 陣列 + `out` 宣告 | ✗ |

1–3 是值的來源 → 可 promote；4–7 是資料的通道 → 不可。

### 6.1 共通規則

- **先宣告，後接線。** 工具永不從圖推斷宣告
- 條目有 immutable `id`；圖的引用走 `id`
- **`name` 投影成 GLSL symbol 與 par name**（三者同字串，但引用鍵是 id 不是 name）→ rename 不斷圖內引用（斷的是 export，那是使用者宣告新東西的後果）
- 條目在池子裡就宣告、就建 par；圖上沒人用只做**灰顯**，不移除。**例外：`varyings` 沒被寫就不宣告**（interpolant 稀缺，且無外部依賴，省掉零風險）
- 七份彼此獨立，可任意順序載入；全部載入後才校驗圖
- 池條目 schema 中**無 emit**；資料源的元資料 emit 由 target 表決定（§8）

### 6.2 Symbol 驗證 ★ 回應審閱 B4

MAT 級 global symbol validation（載入 / 建立條目時）：
- GLSL identifier 合法性
- 全宣告名稱唯一（跨七份）
- 不得 `gl_` 開頭；不得碰 shell / SSA / TD / 工具保留前綴
- `global` helper 用 uuid/hash namespacing

### 6.3 投影規則 ★ 回應審閱 B4

- par name 對得上 → 更新屬性（**不碰當前值**，見附錄 A-3）；對不上 → 建新的；池子裡沒有 → 刪
- **只刪工具標記為 `managed` 的 par**，不靠同名判斷（否則刪到使用者手建的參數）
- export 靠 par name 解析——改名/改型別導致的斷開是使用者的責任

### 6.4 parType hint

promote 時 par 建成什麼型別（`vec3`→RGB/XYZ；`int`→Int/Menu/Toggle；Menu 標籤存此）。投影時讀一次，codegen 不讀。`page` 不是欄位——由宣告種類推導（照內建 MAT 分頁）。

### 6.5 varyings 細則

- 條目：`{id, name, type, interpolation}`；`interpolation ∈ {smooth, flat, noperspective}`
- **整數族在 schema 層鎖定 `flat`**（值域約束；int+smooth 的 JSON 不是合法的圖）
- GLSL 名加前綴（如 `sg_`）避開 TD 保留字；使用者見裸名。改名不斷線
- **數量用 `cost()` 不是條目數**（回應審閱）：`vec4`/`float` 佔 1 個 location，`mat3` 佔 3 個，`mat4` 佔 4 個，`double` 類佔 2×。上限用 Vulkan 法定下限 64 components ÷ 4 ≈ 16 location（按 slot 保守計）。**編輯器提示不擋**
- 沒被 vertex 寫 → 不宣告；pixel 引用未宣告者 → pin 未接 → 型別預設值 0。**無未定義行為**

### 6.6 attributes / buffers 細則

- **vertex-only**（`stages: ["vertex"]`）；pixel 要用一律經 `varyings`，使用者自己傳
- 每個條目生成一組節點：資料存取 + 尺寸常數（`cTDAttribArraySize_*` 為 const 錨點，lattice 層級 `[待實測]`）
- `TDBufferLength_*()` 是執行期值 → buffer gather 只能寫在葉節點 `global` 內
- POP 屬性有 class（point/vertex/primitive），條目帶 class。**屬性名是內容不是規範——工具程式碼裡沒有任何屬性名**

### 6.7 samplers 細則 ★ 回應審閱 B1【待作者複核】

- sampler 是節點（引用池條目），texture 取樣是函數節點
- **未接的 sampler pin → 該取樣節點不 emit，輸出降型別預設值（`vec4(0)`）**

> **【待作者複核】** 此為對原「null 貼圖」方案的取代。
> 原方案（主節點放 null 貼圖，未接 pin 接它）與 §0.1「主節點可拋棄」**衝突**——
> 生成的 MAT sampler par 指向主 `.tox` 的 null TOP，刪除主節點即失效。
> 現方案（不 emit）保住主節點可拋棄，代價是 codegen 對 opaque 未接 pin 加一個特例
> （該節點不 emit，違反「每節點恰好 emit 一次」的原初模型）。
> **此改動動到「所有輸入都有具體值」的模型，設計者尚未拍板。**
> 若選擇保留 null 貼圖，則必須把 null 資產也做成 per-MAT 或專案級的一次性投影，
> 不依賴編輯器 `.tox`。

---

## 7. 產碼與提交流程 ★ 回應審閱 A1

**核心改動**：GLSL 編譯是 TD 在 DAT 寫入後才發生。若新 GLSL 編譯失敗而舊的已被覆蓋，live 演出即斷。故**先驗證再原子提交**。

```
1. resolve candidate（型別傳播 + genType 實例化 + cast 插入 + const lattice）
2. emit 到記憶體 / 暫存 DAT（statement emitter）
3. glslang 驗證
4. 隱藏測試 MAT 做 TD 實際編譯，讀 compile status
5. 全部通過 → 在單一 undo block 內提交（圖 JSON / 正式 GLSL / par）
   任一失敗 → 不提交，保留 last-good，回報錯誤
```

**兩個 hash（部署狀態，非第二份真相）：**
- `editedGraphHash`：目前編輯中的圖
- `appliedGraphHash`：runtime 正在用的圖
- 兩者不同 = 已編輯但仍跑 last-good shader

**resolve / emit 細則：**
- resolve 是純函數，編輯器共用（候選集、接線預測、註記都來自它）
- emit 按拓樸序，每節點恰好 emit 一次寫進 SSA 變數（`v0, v1…`）
- 拓樸序 tie-break 寫死（如實例 id 字典序）→ **同圖產出 byte-identical**
- `global` 按 revisionHash 去重；每節點前插 `// n:<實例id> <節點id>` 註解（此即 source map，人可追、前端可 parse 跳節點）
- 入口泛化：**給定一組終點，回溯聯集**——單節點預覽 = 單元素集合

**deploy 閘門：**
- `dead` 圖**預設不可 deploy**；使用者明確選「產生降級版本」才覆蓋 last-good
- 首次載入的**外來 archive 不自動 deploy**（§11）

**生成碼 header**（回應審閱 A3，**不含時間戳**）：
- 工具版本、`semanticGraphHash`、`definitionManifestHash`
- **時間放獨立 metadata DAT**（否則破壞 byte-identical）
- `semanticGraphHash` **排除** UI 座標 / group 摺疊 / archive（移動節點不該改 GLSL header）
- 所有宣告 / global / archive 條目用明確 canonical sort

**觸發**：編輯器改一筆 → debounce → 上述流程。無暫時 shader 洩漏、無確認按鈕（驗證是自動的）、部署狀態由兩個 hash 表達。

---

## 8. Target 表

職責：**所有「同一概念在不同 target 長得不一樣」的東西。** 結構 `{op, stage}`。

| 內容 | 例 |
|---|---|
| 邊界宣告 | MAT.vertex 輸入 = geometry attribute；MAT.pixel 輸入 = varyings；TOP = `vUV` |
| stage 可用性 | `dFdx` → pixel；attributes → vertex |
| 資料源元資料 emit | sampler size：MAT 用 `textureSize(s,0)`，TOP 用 `uTD2DInfos[i].res` |

**MAT target 邊界宣告（v1，`[待實測]` 標記處撈 dump 校正）：**

| stage | 輸入邊界 | 輸出邊界 | 內置函數（節點，`global:null`） |
|---|---|---|---|
| vertex | `TDPos()` `TDNormal()` `TDTexCoord(uint)` `TDPointColor()`；自訂 `TDAttrib_*()` | `gl_Position`（必填）、varyings、`gl_PointSize`(選) | `TDDeform*` `TDWorldToProj` `TDInstanceTexCoord` … `[待實測 完整清單]` |
| pixel | varyings | `fragColor[]`、`gl_FragDepth`(選) | `TDFog` … `[待實測]` |

- `TDInstanceTexCoord` 等永遠合法（非實例化時退化為單一值）——不需 flag 感知
- vertex 屬性皆為函數（`TDPos()` 非變數）→ geometry input 就是葉節點，無特殊類別

**TOP target = MAT 的限制版：**
- 仍是兩張圖（vertex 預設畫 quad 的直線，通常不動）
- 無 attributes / buffers / deform / lighting 環境
- **samplers 換成 input 索引模型**（`sTD2DInputs[i]` / `uTD2DInfos[i].res`，由 OP 連線決定，**不 promote**）——這是宣告種類 per-target 的第一個實例

**POP / compute = 同哲學的獨立實例，不是 MAT 的升級：**
- 共用：節點表 schema、型別系統、const lattice、宣告→投影模式、statement emitter、圖恆合法
- 不共用：邊界（buffer 寫入、workgroup）、可能連圖的形狀（gather 或觸發 §4.7 保留的擴張路徑）
- 編輯器同一個殼讀另一份 target 表——**姊妹，不是版本。不要讓 MAT 的圖「升級」成 compute 圖**

**目標順位**：初始版本 = GLSL MAT（涵蓋最多、每個部件都被行使）。MAT 成功後 TOP 幾乎免費；POP 明確不在初始目標。宣告種類集合由 target 定義（TOP：uniforms/constants/inputs/outputs 四份）。

---

## 9. 前端

### 9.1 必須 / 早期

- **必須**：載入圖、拖線、型別解析、擋不相容線、存回
- **早期**：拖線放開跳搜尋框、候選按 weight 排序、七份宣告面板（與接線狀態同步、灰顯未使用）、預覽
- **無提示面板**：錯誤類為空（全部消滅於上游）；性能警示收回（後續路線，非必要）

> **錯誤為何是空集合**（每種可能錯誤的上游消滅者）：
> opaque pin 未接 → 該節點不 emit（§6.7）；`requiresConst` 接非常數 → lattice 擋線（§3.3）；
> 讀未寫 varying → 給 0（§6.5）；環 → repair view（§4.2）；型別不相容 → 拖線當下拒絕。

### 9.2 禁止清單（交付 agent 的核心）

| 禁止 | 破壞的東西 |
|---|---|
| 持有獨立持久的語意權威 | 圖是唯一權威 |
| 有自己的 codegen | 單一實作、預覽即產碼 |
| 修正圖（提示，不改） | 工具不替使用者做決定 |
| 有自己的節點定義 | 節點表是唯一來源 |
| 硬編預設值 | 缺席有明確 fallback |
| 決定 UI 之外的語意 | 編輯器可拋棄 |

**放寬（回應審閱 B6）**：前端**可持有帶 `baseRevision` 的暫時 working copy**（否則連拖曳中的圖都不能存在記憶體）。禁的是「獨立、持久、未版本化」的權威。
**便利性狀態例外**：縮放、最近使用。**檢驗：清空 localStorage 重開，一切照舊。**

### 9.3 多 tab 併發 ★ 回應審閱 B6

**optimistic concurrency，非 last-write-wins：**
- 每次讀圖回 `revision / graphHash`
- 每次寫帶 `baseRevision`
- server 只接受 revision 相符的寫入，否則回 conflict，要求 reload/merge
- 不需 server 持第二份圖，仍符單一權威（後存者直接覆蓋 = 無提示資料遺失，不採用）

### 9.4 Undo ★ 回應審閱 B7（Undo Class）

- 投影包在 `ui.undo.startBlock/endBlock` 內 → 圖 JSON / GLSL / par **原子性一起回退**
- block 內 `addCallback` 通知編輯器重載
- **block 須在單次 Web Server callback 內開閉**（懸空會被 TD 強制終結）
- 編輯器 Ctrl+Z 轉發 `ui.undo.undo()`，與 TD 共用同一條 stack
- **⚠ 安全轉發**：`ui.undo.undo()` 撤的是全域 stack 最後一筆，不知是否屬當前圖。故：
  - undo block 名稱含 graph id + revision
  - browser 呼叫前**檢查 stack top 是否屬當前 graph**；不符則拒絕 browser undo，不直接 undo
  - 明文承認：單一全域歷史代表 graph undo 可能被其他 TD 操作隔開
- undo 歷史不持久、不跨 tab、**禁止存進圖 JSON**

### 9.5 視覺

- 圖 schema 由本方定義；編輯器格式 ↔ 圖 schema 中間一層轉換（UI 座標帶著走，不進 codegen）
- **註記即 class name**：`type-*`（型別）、`kind-*`（value/const/opaque/stale/dead）、`cast-*`（目前只有 splat）。規範只保證 class 穩定；樣式 = 主節點的 `.css`，使用者自由改。`kind-*` 數量 = 接線規則數量（加第四種意味型別系統長出新規則，該被質疑）
- 邊界節點是普通節點（有座標、可移動）；**不做貼邊替身**（會讓線指向圖座標系外的東西、存不進 JSON）；邊緣只是新節點的預設落點；導覽用 minimap / 跳轉 / fit view
- **final out 唯一特殊處：刪不掉**

### 9.6 多實例

編輯器可多實例（瀏覽器 tab / Web Render TOP，數量不限）。hosting 層（開幾窗、裝在哪）不在本規格範圍；同圖衝突見 §9.3。

---

## 10. TD 包裝

- 主節點是 singleton `.tox`，拖入即用，**無 installer**。持有：節點表、codegen、編輯器服務（Web Server DAT）、模板、style 表（`.css`）。**（不含 null 貼圖——見 §6.7）**
- 圖 JSON 存 MAT 旁的 Text DAT，跟 `.toe` 走。**圖是資料會被複製；節點定義是程式不被複製**
- 端點：列圖節點 / 讀圖 / 寫圖 / 產碼 / 讀寫宣告（皆走 §11 安全）
- 編輯器自列可編輯的圖（清單頁）；TD 側按鈕 = `?graph=…` 便利參數。瀏覽器與 Web Render TOP 同一 URL。單使用者假設
- 預覽全在 TD：render 真正的 MAT；preview geometry 由使用者指定；看中間值 = 拉線到輸出或接 `toVec4` 節點。**無預覽專用路徑**
- **批次重新產碼**按鈕（掃全專案，全部重跑）——葉節點修 bug 的零操作路徑

---

## 11. Web Server 安全 ★ 回應審閱 B9

Web Server 的 HTTP/WebSocket callback 能直接修改專案，故即使單使用者假設，預設：
- 只綁 loopback
- 啟動生成 session token
- 驗證 `Origin`、禁任意 CORS
- 寫入端點只接 JSON，加大小上限
- **archive 的 `global` 視為可執行 shader code；首次載入外來 archive 不自動 deploy**

> 理由：「論壇貼上 archive」是列出的用例，惡意/錯誤的 shader loop 能讓 GPU/TD 不穩，不能當普通資料。

---

## 12. 測試策略 ★ 回應審閱 D

1. **Differential compile test**（既有）：每 entry 每 overload 自動生成最小圖 → 產碼 → glslang 編譯，全過才入表。**覆蓋編譯合法性，不含語意**
2. **Property tests**：隨機合法圖 → resolve 成功 / normalize idempotent / codegen deterministic / 無 exception
3. **TD integration matrix**：在支援的 build/version/backend 實際建 MAT 讀 compile status（非只 glslang）
4. **語意測試集**：`smoothstep` / matrix transform / texture sampling / out parameter / cast 建 CPU reference 或已知 GPU 輸出——**攔「參數順序寫反」**（differential compile 抓不到）

---

## 13. 名稱（暫定，落實前可改）

**七份宣告**：`uniforms` `samplers` `constants` `attributes` `buffers` `varyings` `outputs`（借 GLSL/TD 既有詞；`varyings` 專指 vertex→pixel，與 `attributes` 區分）。

**待命名**：
- 兩個 pass：暫 `resolve` / `emit`
- 「子節點」：暫 `template`（可分發資產）/ `group`（圖內一組節點 + templateUuid）
- 主節點 op shortcut：**未定**
- **工具本身**：**未定** — ⚠ 勿叫 `TDShaderGraph`，會誤導成 Blender 風；心智模型是 UE

**命名原則**：能借 GLSL 或 TD 既有詞就借，不發明。發明只用於兩邊都無對應概念處。

---

## 14. 實作順序

A 類正確性前置（返工成本最高），其餘維持「MAT 優先、內容早驗」：

```
0.  撈 TD include dump（回填附錄實測項 + const lattice 錨點層級）
1.  環境契約 + v1 型別清單（§1）
2.  definitionUuid / revisionHash / archive 解析（§2.2, §4.3）
3.  const lattice（§3.3）
4.  純 resolve + canonical graph + repair view（§3, §4.2）
5.  in-memory deterministic emitter（§7）
6.  glslang + 隱藏 TD MAT 驗證 → last-good 原子提交（§7）
7.  七份宣告投影 + symbol validation + managed par（§6）
8.  節點表 schema 完整化 + 手寫範例（§2；smoothstep/switch 先行）
9.  shell / 輸出模組（§5）
10. 編輯器 + optimistic concurrency（§9）
11. Web Server 安全（§11）
12. template：插入一次的複製（§4.6）
13. TOP target（§8）
14. POP/compute 獨立設計（§8）
```

前六步先立正確性地基（環境、識別、lattice、repair、原子提交）才碰投影與內容——這是唯一向「先立契約」讓步之處，因為 A 類是返工成本最高的。

---

## 附錄 A：未解決（需 TD 中驗證後定案）

原則傾向：**編輯器開啟時是權威**。答案取決於 TD 組件實際行為，須先審閱。

| # | 題目 | 狀態 |
|---|---|---|
| A-1 | TD 側 undo 與編輯器記憶體衝突 | **方案已定**（§9.4 Undo Class）；待實作驗證。手改/git checkout 用 hash 比對 |
| A-2 | 同圖被兩 tab 開啟 | **方案已定**（§9.3 optimistic concurrency）；待驗證 |
| A-3 | 投影更新 par 撞使用者調值 | **傾向已定**：更新 par 不碰當前值，default 只在建新 par 時寫入（default 是出生值）；待 TD 驗證轉正 |
| A-4 | 編輯器 Ctrl+Z 全域 undo 誤操作 | **方案已定**（§9.4 檢查 stack top）；待驗證 |

## 附錄 B：待實測（撈 dump / 三分鐘測）

| # | 項目 | 影響 |
|---|---|---|
| B-1 | TD include 檔簽名 dump | 節點表內容的唯一可信來源；回填 target 表內置函數清單 |
| B-2 | 最低 TD build / GLSL version | §1 環境契約 |
| B-3 | `TDCheckDiscard` vs `TDCheckOrderIndTrans` | 殼呼叫哪個名字（三種結果行為相同） |
| B-4 | spec constant 能否當陣列長度 | 不行則僅失去 graph-level 常數次數展開；schema 不變 |
| B-5 | `cTDAttribArraySize_*` 等的 const lattice 層級 | §3.3 錨點層級（暫定 compileConst） |

## 附錄 C：唯一待作者複核的語意改動

**§6.7 samplers 未接行為**：null 貼圖方案（違反主節點可拋棄）→ 改為「不 emit，降型別預設值」。此改動動到「所有輸入都有具體值」的原初模型。若選擇保留 null 貼圖，須將 null 資產做成 per-MAT/專案級的一次性投影。**設計者拍板前，實作 §6.7 以「不 emit」為準，但保留切換空間。**

## 相關文件

- **《規格草案筆記》**（v19，~2200 行）：完整推導鏈與所有被否決的路徑。需要「為什麼不是別的做法」時查此
- **《v1.8 修訂計畫》**：對第三方審閱的逐條裁決（採納/駁回/降級及理由）
