# 專案用語表

本表統一 TD-Grape 文件、設計討論及開發溝通的用詞。定義名詞不代表啟用功能、改變接線規則或批准 UI 命名方案；UI 標籤、程式識別碼及保存格式也不隨本表自動更名。

採用既有 GLSL／圖形編輯器術語，補上本專案需要的層次與範圍。中文詞搭配穩定英文詞；縮寫及舊稱作為查找別名，不另建立不同概念。

## 子圖與函式

**Subgraph（子圖）** 是可重用的節點集合。編譯器在各使用位置展開其內容，再產生目前階段的 GLSL；共用定義、雙擊進入及 Make Independent 是編輯器能力，不代表生成 GLSL 函式。0.8.201 起，新建預設名稱、邊界、選單與說明統一使用 Subgraph，資源庫以輸入／輸出列表顯示介面。既有使用者名稱保持原樣。

歷史格式的 `functions`、`functionId` 及 `sgrape.function.*` 識別碼保留相容。GLSL Code 等真正定義或呼叫 GLSL 函式的地方仍使用 Function。

## 型別、接孔與運算

| 建議用語 | 英文／識別碼 | 定義與區分 |
| --- | --- | --- |
| 型別 | Type | 一個值的具體型別，例如 float、int、ivec3。Auto 是選擇型別的模式，不是一種值型別。 |
| 型別家族 | Type family；`family` | 純量與向量的基本元素種類，例如 float、int、uint、bool、double。矩陣、陣列與資源的結構需另行描述，不能只靠家族與分量數概括。 |
| 元素型別 | Element type | 一個容器中單一元素的型別，須指出所談的容器。ivec3 的分量型別是 int；vec3[4] 的陣列元素型別是 vec3；Sample[4] 的元素型別是 Sample。不可把陣列元素型別一律等同 scalar family。 |
| 分量／分量數 | Component／Component count；`components` | vec3 有三個分量，純量有一個。談向量形狀時優先說「分量數」，避免與貼圖維度或矩陣行列混用。 |
| 純量／向量 | Scalar／Vector | 單一值與有多個分量的值；與名稱相同的節點種類須依上下文區分。 |
| 接孔 | Port／Socket | 節點上的輸入或輸出端點，帶有具體型別與用途。接線（Edge）連接兩個接孔。 |
| 待新增接孔（暫稱） | Spare Port | 尾端灰色的預留新增入口；尚不是正式輸入或輸出，接線時建立正式接孔。2026-09-23 在連續四則運算的未來功能筆記中暫定，參考既有 Input／Output 行為；不代表新節點已實作或現有 UI 已改名。 |
| 函數簽名／節點簽名 | Function signature／Node signature | 一組輸入與輸出型別。相同功能可有多個合法簽名；支援哪些簽名由功能決定。 |
| 運算型別 | Operation type | 節點選用的運算配置型別，不保證等於輸出型別。例如 Length 可對 vec3 運算而輸出 float。 |
| 來源型別／接孔型別／輸出型別 | Source type／Input port type／Output type | 分別指上游提供的型別、輸入接孔要求的型別及結果型別。介面上的 `int → float` 表示來源與接孔之間有轉換。 |
| 自動型別推導 | Type inference／Auto | 編輯器依來源及合法簽名選擇實際運算型別。它決定使用哪個型別，不等於自動轉換值。推導方向、優先順序及無接線時的預設另由規則文件定義。 |
| 指定型別／鎖定型別 | Explicit type／Locked type | 使用者明確指定運算型別，Auto 不再為該配置選型別。這不等於禁止輸入接線轉換；兩者需分開判斷。 |

## 接線與轉換

「接線型別規則」是討論型別推導、接孔相容性與接線轉換的總稱。描述轉換時先說值做了什麼，再說由誰決定；不要用一個「Auto Cast」涵蓋所有行為。

| 建議用語 | 英文 | 定義與區分 |
| --- | --- | --- |
| 接線顯示樣式 | Wire／Link | 同一接線的兩種呈現：Wire 為曲線；Link 為細灰直線虛線，附接孔箭頭導航。切換不改變資料流或產碼，詳見 [Wire／Link](ui/WIRE_LINK.md)。 |
| 接線整理節點 | Router | 圖中實際存在的節點，輸入、輸出邊分別保存；產碼直接沿用來源，不新增 GLSL 運算。最多十個圓為外觀限制，不是連接數量限制。詳見 [Router](features/ROUTER.md)。 |
| 型別轉換／轉型 | Type conversion／Cast | 在本表的純量／向量例子中，指元素型別改變，例如 int → float、vec3 → ivec3，也包含 bool 與數值的明確轉換。是否合法、自動或需 Convert，是另一個問題。 |
| 純量展開 | Splat | 把同一純量填入向量每個分量，例如 int → ivec3，得到三個相同整數。不是補零，也不是任意向量擴張或截短。可與元素型別轉換同時發生。 |
| 分量組合／選取 | Component assembly／Selection；Combine／Swizzle | 明確指定分量的組成、來源或順序。vec2 變 vec4 需要說明新增分量的來源，不能籠統稱為 splat。 |
| 接線自動轉換 | Automatic connection conversion | 編輯器按接線規則替來源與接孔的型別差異產生轉換程式；畫布上不需要存在 Convert 節點。可包含 cast 與 splat。 |
| GLSL 隱式轉換 | GLSL implicit conversion | GLSL 語言規格在特定情境中允許編譯器自動完成的轉換。與 Grape 的接線轉換表不是同一件事。 |
| GLSL 明確轉換 | GLSL explicit conversion／Constructor | 程式直接寫出 `float(x)`、`ivec3(x)` 等建構式。即使畫布沒有 Convert，Grape 也可能產生這種程式。 |
| 明確轉換節點 | Convert | 圖上明確表達轉換操作的節點。它是編輯介面中的實體，不等同所有產生的 GLSL constructor。 |
| 來源型別推導 | Source type inference | 轉換操作根據實際接線決定來源型別。與目的型別選擇分開；此詞不宣告現有 Convert 已提供 Auto。 |
| 自動插入轉換節點 | Automatic Convert insertion | 編輯器新增並接好 Convert 的快捷操作。與不新增節點的接線自動轉換，以及 Convert 本身的來源型別推導，都是不同功能。 |

例：`int → Ceil` 的來源是 int，Ceil 使用浮點運算。Grape 可選擇 float 簽名並產生 `ceil(float(x))`；前者是型別推導，`float(x)` 是轉型，畫布省略 Convert 是接線自動轉換。If 的 Condition 是 bool，而分支／結果可用另一種型別；一個節點的 Auto 不一定作用於所有接孔。

「節點內 cast」無法說明是接孔適配、節點本身的演算法還是 GLSL constructor，應指明上述層次。「自動 cast」也應改寫為接線自動轉換、來源型別推導或自動插入 Convert 中實際指涉的行為。

## 節點、來源與值

| 建議用語 | 英文／識別碼 | 定義與區分 |
| --- | --- | --- |
| 節點種類／節點定義 | Node kind／Node definition | 種類描述功能分類；定義記錄該功能的接孔、配置等資料。不能只用目前顯示名稱判斷節點身分。 |
| 節點實例 | Node instance | 畫布上某一個具體節點，有自己的位置、配置及 UI 狀態。 |
| 顯示名稱／身分識別碼 | Display name／ID | 顯示名稱供人辨識，ID 供資料穩定引用；顯示名稱也不必是合法 GLSL 識別字。具體命名與更名行為另由設計規則決定。 |
| 共用來源 | Shared source／Source | 可被多個畫布引用使用的具名來源，例如 Uniform。談接線上的「來源」時需說明是上游輸出，避免和來源物件混淆。 |
| 宣告 | Declaration | 圖內記錄來源種類、名稱、型別等資料的定義；談產生的 GLSL 宣告時明說「GLSL 宣告」。兩者不是一段一對一跨 Stage 共用的程式文字。 |
| 來源引用 | Source reference | 指向既有來源的畫布節點。它與其他引用共用來源定義，位置與註記等節點 UI 狀態可以獨立；不以「實體／克隆」表示來源與引用的關係。 |
| 本地值／字面值 | Local value／Literal | 本地值描述資料由某個節點或輸入持有；字面值描述程式中的直接值表示，例如 `1.0`。資料歸屬和程式表示是不同問題。 |
| 預設值／目前值 | Default value／Current value | 建立、初始化或回復時採用的值，與當下實際使用的值。來源預設值、TD 原生目前值、未接線輸入值需明確標出歸屬。 |
| 未接線輸入值 | Unconnected input value／Input default | 沒有上游連線時使用的本地輸入值；不可與來源宣告的預設值混稱。 |

## 常量、Stage 與參數

| 建議用語 | 英文 | 定義與區分 |
| --- | --- | --- |
| 常量／常量表達式 | Constant／Constant expression | 前者是值的分類；後者是符合相應語言常量規則的表達式。值目前沒有變動，不足以判定它是編譯期常量。專案中已有「常數」用詞視為同義詞，不另造一類。 |
| Uniform | Uniform | 由宿主提供 Shader 執行時使用的值。即使 TD 目前手填一個固定值，來源仍是 Uniform。 |
| 特化常量 | Specialization constant／Spec Constant | 特化時決定的常量，有自己的可用表達式與宿主覆寫規則；不能直接當成普通常量或 Uniform。 |
| Shader 階段 | Shader stage／Stage | 例如 Vertex、Fragment（本專案介面也使用 Pixel）。階段間資料傳遞，與不同階段引用同一份 Grape 來源定義是不同關係。 |
| 共用範圍／生效時機 | Sharing scope／Value resolution time | 分別描述哪些地方引用同一份定義，以及值何時確定；跨 Stage 可用不代表各類來源具有相同生效時機。 |
| Parameter 面板 | Parameter panel | Grape 編輯器的節點設定介面。不是另一種 Shader 資料來源。 |
| TD 原生參數／自訂參數 | Native TD parameter／Custom parameter | TD OP 的參數，以及建立於 COMP 的控制項。需與 Parameter 面板、GLSL 函數參數分開稱呼。 |
| TD 固定值模式 | TD parameter Constant mode | TD 參數的手動固定值模式。不是 GLSL `const`，也不是 Spec Constant。 |

Graph Constant 是既有介面名稱；Global Constant／全域常量是討論中的命名方向。本表不代替該命名決策。說明共享範圍時，應明確說是同一份 Grape Shader 的共用來源定義，不能暗示 GLSL 自動建立一個跨 Stage 的單一變數。

## 矩陣與來源傳輸

- **Column／Row**：矩陣的欄／列。GLSL `matCxR` 的尺寸依序為 Column 數、Row 數，`m[column][row]` 同樣先 Column。介面保留 Column 名稱與零起算編號，避免把一橫排編輯控制項誤認為數學上的 Row。
- **Column-major 值順序**：依 Column 逐組保存，每組包含該 Column 的所有 Row 元素；不表示 UI 必須以相同方向排版。
- **對角填值（Diagonal construction）**：`matN(scalar)` 以 scalar 填對角線，其餘為 0；與向量的純量展開（Splat）不同。
- **矩陣尺寸轉換（Matrix resize conversion）**：以矩陣 constructor 保留左上方重疊元素；擴大部分依單位矩陣補值。與 Replace 的同尺寸覆寫不同。
- **原生傳輸載體（Native transport carrier）**：TD 向 Uniform 提供資料的原生參數／資源；載體尺寸、精度與 GLSL 宣告型別是不同層次，不能相互推論。

## 陣列、結構與產碼責任

下列術語描述不同責任；實際支援範圍見[陣列與結構](features/ARRAYS_AND_STRUCTURES.md)、[TD 陣列來源](features/TD_ARRAY_SOURCES.md)，決策背景見[後續計畫](discussions/ARRAY_AND_STRUCT_PLAN.md)。

| 建議用語 | 英文 | 定義與區分 |
| --- | --- | --- |
| 陣列 | Array | 同一元素型別的有序列表。陣列長度、元素型別及元素本身的分量數分開描述。 |
| 陣列長度／有效筆數 | Array length／Active count | 長度描述陣列的元素位置數；有效筆數描述使用者目前採用其中多少筆，需由資料契約明確提供，不能由元素是否為零推測。 |
| 結構／型別定義 | Struct／Type definition | 結構將具名欄位組成一種型別；型別定義描述欄位及其型別。定義型別不等於建立一個值，也不等於已取得外部來源。 |
| 型別身分 | Type identity | 供引用與相容性判斷的穩定身分。顯示名稱或欄位形狀相同，不足以代表同一個具名結構。 |
| 定義提供者 | Definition provider | 說明某份型別定義的 GLSL 宣告由宿主、外部程式碼或 Grape 提供，連同適用環境供產碼判斷。與提供實際值的資料來源分開。 |
| GLSL 結構宣告 | GLSL struct declaration | 讓 GLSL 編譯器認得結構的程式宣告。是否需生成取決於使用情況、定義提供者及編譯環境；不是每個節點各自勾選的永久屬性。 |
| 圖的運算內容／圖文件 | Graph semantics／Graph document | 前者包含節點、接線、操作及值等計算意義；後者還可保存必要定義及位置、展開狀態等編輯資訊。存於同一檔案不代表都參與 Shader 運算。 |
| 圖建立工具 | Graph authoring tool | 依共用契約建立及修改圖的工具；可為圖形編輯器、程式或智能體。UI 是其中一種操作介面。 |
| GLSL 產生器／產碼器 | GLSL code generator | 將圖及必要定義轉為 GLSL，並處理型別、環境、宣告依賴與診斷。與建立圖的工具分開稱呼。 |
| TD 的 GLSL 編譯器 | Host GLSL compiler | 接收產生好的 GLSL 並進行語言檢查、最佳化與編譯；不直接讀 Grape 的圖文件或型別表。 |

## 維護與文件分工

- 本表回答「這個詞指什麼」，不維護另一份型別允許清單，也不收錄每輪對話。
- 實際接線與編譯規則放在 [型別契約](architecture/TYPE_CONTRACT.md)；Auto 操作放在 [MATH_AUTO](ui/MATH_AUTO.md)，型別顯示放在 [TYPE_DISPLAY](ui/TYPE_DISPLAY.md)。這些文件含歷史描述，現況需核對 [狀態](development/STATUS.md)、最新實作與文件標示的時點，不能將舊限制當成術語定義。
- 尚待決定的行為、命名與替代方案放在 `discussions/`，明確區分提案、已確認決定與已實作狀態。從候選方案挑出的例子，不自動成為共通規則。
- 新增跨功能概念時先查本表：已有概念沿用既有詞；確實不同時補上定義、英文名稱、例子及與相近詞的界線。調整用詞時保留必要別名，並同步相關文件連結。
- 本表只做術語整理時，不批次修改 UI 文案、程式識別碼、保存資料或執行行為。

GLSL 術語依據：[Implicit Conversions](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.html#implicit-conversions)、[Constructors](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.html#constructors)、[Common Functions](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.html#common-functions)。專案是否提供某項便利操作另由產品規則決定。
