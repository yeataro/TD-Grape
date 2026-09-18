# 最新使用者決定（2026-09-18）

本輪實作順序再確認：先接通 float／int／uint／bool 及其 2–4 分量向量、合法運算、來源、共用編輯與型別轉換。使用者對矩陣及陣列的介面仍在評估；不在這批鋪滿矩陣／陣列選單。矩陣下一步以 `mat3`／`mat4` 的旋轉、座標變換為使用案例，`Matrix` 是介面名稱，`mat3`／`mat4` 是 GLSL 具體型別；`vec3`／`vec4` 可在乘法左／右側充當行／列向量，不另建 1×N／N×1 型別。陣列待使用情境及初始化／取值介面一起決定。

跨族接線採同維度數值 constructor 轉換，沿用接孔轉型提示；Auto 優先保留實際输入家族。數值 scalar → vector 亦可 constructor splat，布林與數字之間由明確 Convert 處理。Convert 使用 GLSL constructor 本來的語意（float → int 向零截斷），不把 Floor／Round／Ceil 混成隱藏選項。這是依使用者「符合 GLSL 習慣、可以自行判斷」所作的實作取捨，可在實測後調整。不同向量長度使用 Split／Combine／Swizzle，不默默丟掉分量。參考：[GLSL constructors](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.html#constructors)。

### 本輪已完成

16 種 scalar／vector 值型別已接通：共用 family／components 契約、精確 literal、Scalar／Convert、Graph Constant／Uniform、各族向量組拆、共用值編輯、Auto、Subgraph／GLSL Code、剪貼簿與保存。Vector／Combine／Split／Swizzle／Replace 的分量與分組保留相同家族及精確型別；數值跨族接線使用 constructor，布林與數值之間以 Convert 明確處理。Add／Subtract／Multiply／Divide／Min／Max／Clamp／Modulo 開放 numeric 12 型別，Abs／Sign 開放 float／int 家族；其餘既有浮點函式保留實際合法簽名。Compare 維持 float／int／uint scalar → bool，If 為 scalar bool 條件與全部 16 種結果型別。矩陣與陣列仍按上方最新決定另行設計，不屬於這批已交付能力。

原生 typed values 394 項、native sources 21 項、Spec Constants 18 項、custom parameters 18 項通過；portable 327 項 Python 檢查通過，其後追加的型別 Undo 重現測試與相關測試共 52 項通過。瀏覽器型別通路 12 組通過。完整驗收範圍與實測限制見 [TESTING.md](../development/TESTING.md)；下方早期方案保留為歷史推演，不代表目前實作仍未啟用。

### 本輪原生傳輸實測

TD 2025.32820 的隔離 TOP、MAT pixel、MAT vertex 已以 GPU 內整數比較確認 330 組傳輸案例（CONSTANT 與 EXPRESSION），包含正負端點及所有向量分量。編譯、CPU 參數儲存成功，不等於 GPU 值正確。

| 來源 | 已觀察的傳輸行為（不是編輯器輸入限制） |
|---|---|
| 圖內 Constant／Scalar／Vector、GLSL 運算 | int／uint 完整 32 位範圍，literal 不經 float32 |
| TOP／MAT Vectors int／ivec | float32 可精確表示的整數傳輸正確；負值與 INT_MIN 可正確傳輸，其他整數可能失真 |
| TOP Vectors uint／uvec | float32 可精確表示的 uint 傳輸正確；例如 4294967040 正確，UINT_MAX 失真 |
| MAT Vectors uint／uvec | 除 float32 精度外，大於 2147483648 的 uint 實測被傳成 2147483648 |
| TOP／MAT Vectors bool／bvec | 以 0／1 傳送，所有分量通過；不把原生任意小數轉布林當成可攜保證 |

2026-09-18 使用者決定：移除額外的傳輸精度限制，Grape 接受完整 GLSL int／uint 範圍，Spec int 也允許負值；傳輸結果依 TD 原生行為。套用、明確寫值、driver 修改、綁定及歷史還原只保留有限值、型別及完整 32 位範圍檢查。讀取 snapshot 不掃描驗值、不回報精度 issue，前端不顯示額外宿主上限。上表是能力探針的實測紀錄，不限制使用者輸入，也不暗中改值。維護測試：`tests/td/test_typed_uniform_transport.py`。本機驗證不代表已在 Metal 或其他 GPU 上測試。

整數 Mod 產生 `%`，浮點 Mod 產生 `mod()`。GLSL 不保證負運算元的整數 `%` 結果；不得把某個 GPU 的負餘數結果寫成跨平台語意。參考：[GLSL expressions](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.html#expressions)。

優先完成型別能力，再做數字顯示、Switch Case 等快捷／控制功能。既有數學節點也應在型別批一起核對並补齊合法的輸入／輸出組合，避免每加一個功能又回頭補型別。設計以最大可用能力為先，再尋找最簡潔、統一的操作方式；不因 UI 暫時不好做而先刪除底層能力。以下歷史「最小範圍／初版排除」是研究起點，不能當成最新需求的永久限制；各型別與 TD 宿主能力仍須分別實測。

實作前只有 Spec Constant、Compare、literal 驗證及 Subgraph 接口部分支援 int／uint／bool，一般來源、向量、運算、編輯及轉型尚未形成完整通路；這些 scalar／vector 缺口已由本輪接通。後續矩陣／陣列仍須一起考慮表示／形狀、合法簽名、值來源、常數分類、共用編輯、介面、保存及原生驗證，不能只在下拉清單增加名稱。資源型別與數值型別分清楚，依實際目標支援列能力表，不假定 GLSL 的所有型別都能透過 TD 的同一種 Uniform 通道輸送。

Alpha 前既有圖皆為可重建的試驗資料，可直接整理不合理的型別集合、契約及圖格式，不為未發布的舊格式增加相容層；詳見 [升級政策](../architecture/UPGRADE_POLICY.md)。歷史指紋是偵測非預期變動的工具，不阻止有意識的模型改進。

分支須涵蓋整數索引選擇，以及大於／小於／區間／布林條件的有序選擇。前者可產生原生 `switch`（索引為 int／uint），後者可產生 `if / else if`，不能因原生 Switch 只接受整數而排除條件分支需求。先完成型別與既有運算的支援，再決定分支 UI 的整合方式。[GLSL Selection](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.html#selection)

參數的選單與接孔是不同層次：例如 Align 可用 int 表示左／中／右，未接線時用下拉編輯，接線時也可由 int 輸入決定；快捷定位亦可用 bool。使用者隨後明確澄清這些只是思考例子，不是數字顯示必須提供這些接孔的要求；精簡成只有下拉也可接受。具體介面依便利性與通用性取捨，待型別基礎完成後設計，不把讨论例子固化為強制規格。

## 已完成的 Auto 決定（2026-09-10）

新 Math 節點預設 Auto，可手動鎖定；舊圖保持已存型別。本決定取代下方歷史段落的「Auto 待決」，已完成並通過模型、瀏覽器、編譯器與 TD 數值驗證，詳見 MATH_AUTO.md。

使用者希望以輸出型別作為節點的主要識別，避免改輸入造成不明確的下游變動。現行 float → vecN 是顯式產生 vecN(value) 的 splat，兩個 float 接入已鎖定 vec4 Multiply 仍合法並輸出四分量。介面要區分輸出型別、輸入來源型別及轉換，不可把所有輸入口籠統改成 any；Auto 解析、已連下游的衝突處理與顯式鎖定需共用同一合法簽名契約。先補清楚顯示，再實作推導，不回寫舊圖。

# 歷史：顯式數值型別的前置設計

以下記錄形成時，產品只支援 float／vec2／vec3／vec4；0.8.5 增加共用 family／components，尚未啟用新型別或 Auto。保留早期設計及實測依據；型別、跨族接線及矩陣／陣列排程以本文件上方 2026-09-18 的完成狀態與最新決定為準。

GLSL 分成浮點、帶號整數、無號整數與布林家族。不同函式有不同簽名；例如 abs 有整數版本，而 min／max／clamp 包含整數與無號整數。只看函式名稱能否編譯不足以判定回傳型別，因為可能經過隱式數值轉換。依據：[GLSL 4.60 規範，Common Functions](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.html#common-functions)。

在 Windows／TD 2025.32820 的隔離 GLSL TOP 已實測九例：

| 測試 | 結果 |
|---|---|
| ivec4 + int | 每個分量加上純量，結果正確 |
| uvec4 的 scalar clamp | 四個分量結果正確 |
| -7 / 2，帶號整數 | 得到 -3 |
| 4294967295u 與十六進位對照 | 相等 |
| (-2147483647 - 1) 與最小 int 對照 | 相等 |
| bvec4 選擇兩組 ivec4 | mix 選到對應分量 |
| ivec4 明確轉 vec4 | 分量正確 |
| uint v = abs(1u) | TD 拒絕，不能當成 uint 回傳的 overload |
| bool 相加 | TD 拒絕 |

七個可編譯案例都讀回整張輸出，對白色通過標記的最大差為0。這些是專用研究 GLSL，沒有進入產品 emitter。測試區已移除；結果在 research/value085-native-results.json。

## 推進順序

1. 建立有限的顯式型別資料、literal 編碼與 JSON 值驗證；涵蓋 int／uint 範圍及 bool 真正布林，禁止以 truthiness 或浮點四捨五入偷偷接受輸入。增加對應向量與明確 Cast 的節點候選，原有圖與 revision 保持可核對。
2. 按節點列出合法 overload，UI、Create、port 與 compiler 都由同一表決定。不要將所有型別塞入每個 math 節點。跨家族只透過使用者選擇的 Cast；既有 Math Auto 已完成，新增家族仍須由同一合法簽名表推導，不默許跨家族轉換。
3. 再核對 TD GLSL MAT／TOP 的整數 Uniform 參數列與 bool 投影、Expose 參數型別、預設值／目前值、Expression／Bind／Undo；使用真正動態更新和端點值驗證精度，避免把 uint 最大值經 float32 中轉。
4. 接常數分類、requireConstant 與 Specialization Constants；Array／Matrix 的型別及合理初始化列入本批最小範圍評估，完整值編輯後補。迴圈不在這批。

使用體驗：維持單一操作節點加明確 Type 選項，顯示確實解析出的 port 型別；型別切換只在合法選項間進行，接線不相容要清楚顯示錯誤，既有連線及上次成功輸出保留。這是實作起點，不宣稱新型別或所有GLSL overload已支援。

## 型別批依賴與可分段邊界

歷史狀態：以下是新型別啟用前的依賴審查，不是目前能力表；scalar／vector 已完成情況見上方。本節保留與 [Inputs 設計](INPUTS_UI_NEXT_ROUND.md#下一輪實作型別批) 對照的編譯及原生依賴，矩陣／陣列範圍以最新使用者決定為準。

| 範圍 | 已有證據 | 最小可交付邊界／准入條件 |
|---|---|---|
| float／vec2／vec3／vec4 | 現行圖、Constants、Vectors／Colors Uniform 已實作 | 舊圖 literal、簽名及產碼維持相容 |
| int／ivec2–4、uint／uvec2–4、bool／bvec2–4 | 上述研究只證明指定 GLSL 表達式；不是完整圖或原生 Uniform 驗證 | 共用型別、值驗證、合法 overload、Cast、來源與保存鏈完成後開放；Uniform 另以動態 GPU 讀回把關 |
| Specialization Constants | TD TOP／MAT 有 Constants 頁；官方提供 int 範例 | 先驗證單一 scalar int 的預設／覆寫、穩定 ID、更新與失敗回復；uint／float／bool 分別驗證後才列入其來源選單 |
| Matrix | TD 有 Matrices 頁，現行圖尚無 matrix 型別 | 候選先做 float mat2／mat3／mat4、固定形狀、零／單位矩陣初始化、同型接線與 GLSL Code 使用；原生 Uniform 另驗 mat4，其餘維度不推定可上傳 |
| Array | TD Arrays 頁的元素選項是 float／vec2／vec3／vec4，來源是 CHOP | 候選先做固定一維、固定正整數長度、已支援 scalar／vector 元素及零／false 初始化的圖內常數；要能接入 GLSL Code 或有界取值才算可用。原生 CHOP Uniform Array 是另一個來源整合項 |

Array／Matrix 沒有全部延期；先落實形狀與初始化的可用範圍，完整值編輯器可後補。初版建議不納入巢狀／不定長陣列、以 Spec 決定陣列長度、非方形矩陣、矩陣陣列、double／dvec。這是有界實作候選，實際啟用的組合須經驗證後明列。

### 1. 先建立共用型別與 overload，再開放圖內數值

- [sgrape_core.py](../../src/core/sgrape_core.py) 的 `TYPE_DESCRIPTORS`、`CONVERSIONS`、`resolved_ports()`、`type_contract()`、`literal()` 必須一起調整。目前每個含 `T` 的節點展開成所有 `TYPES`，而 float 到其他型別一律 splat；直接加 int／bool 會產生不合法 Math 簽名。先按現有節點的完整輸入／輸出列白名單，再擴充特殊 overload；例如目前 Mix 的 float factor 不能直接套到整數版本。
- `number()` 把值轉 float 並格式化為 `.9g`，不可用於整數 literal。int／uint 應驗證整數與 32-bit 範圍、精確編碼及 unsigned 後綴；bool 使用 JSON boolean。UI 的輸入、Value Ladder、預設值與 native 寫入都應共用家族規則，不以 truthiness、截斷或四捨五入修正無效輸入。
- 明確 Cast 需要獨立的來源／目的型別簽名；不能沿用一個 `T` 同時代入所有接孔的機制。初版可限定同維度跨家族與明列的 scalar constructor，避免偷偷加入向量截短／擴張。Vector／Combine／Split／Swizzle 的分量與分組也須依家族產生，現行硬編碼 `float`／`vecN` 不足。
- [graph_ui.js](../../src/editor/graph_ui.js) 的 `setTypeContract()` 目前只接受 float 家族、1–4 components、固定三種 vectors；同步更新契約驗證、Auto、Create／接線相容與值形狀。Array／Matrix 需明確 shape／元素型別／維度資料，不能把分量數加大後當成一般向量。
- [functions_model.js](../../src/editor/functions_model.js) 的 GraphClipboard 目前以型別字尾猜數量、只收 number，來源 kind 也有白名單。連同 [functions_ui.js](../../src/editor/functions_ui.js)、[sgrape_library.py](../../src/core/sgrape_library.py)、Subgraph 外部來源政策、[app.js](../../src/editor/app.js)／[inspector.js](../../src/editor/inspector.js) 的值編輯一起改用契約；驗證複製、匯入、函式介面及保存重載，不另維護一份型別猜測表。

### 2. 原生 Uniform 先驗精度，再擴來源支援

TD 2025.32820 的只讀參數盤點確認 TOP／MAT 均有 Vectors、Colors、Arrays、Matrices、Constants，沒有獨立 Integers 頁。Vectors 分量是 XYZW style，Constants 的 `const0value` 是 Float style；沒有 clamp 並不等於整數極值能精確送進 GPU。此輪只讀 metadata，沒有建立／cook／修改 TD 節點，尚未完成動態精度測試。

- 必須在隔離 shader 動態寫入後於 GLSL 內比較，將通過旗標讀回；只比較 Python `par.eval()` 或把 uint 轉 float 輸出都不足。至少覆蓋 `16777216 ± 1`、int 最小／最大、uint 最大，以及 bool 各分量切換；區分參數儲存精度與 GPU 上傳精度。
- [sgrape_sources.py](../../src/core/sgrape_sources.py) 現有 `TYPES`／`CHANNELS` 只認 float 家族、vec／color；讀值先 `float()`、寫值用 `core.number()`。需改成來源種類與家族感知的辨識、驗證、快照、同步、原生模式保留及失敗回復。Python float 可精確表示 32-bit 整數，不可僅見 `float()` 就判定 TD 已有損失；真正未知的是原生上傳路徑。
- [sgrape_runtime.py](../../src/td/runtime/sgrape_runtime.py) 的 configure、live snapshot／write、candidate 驗證、manifest bindings 與 rollback 必須同步。原生 Vectors 列本身沒有 int／uint／bool 型別選項；無現有圖宣告時不能從欄位猜家族，需明確的來源型別選擇／保留政策。
- [sgrape_parameters.py](../../src/core/sgrape_parameters.py) 已有 COMP Integer／Toggle；[sgrape_parameter_links.py](../../src/core/sgrape_parameter_links.py) 仍用既有 native channels／浮點讀值，execute 監聽也只涵蓋 vec／color。擴支援時核對 Bind／Expression／Export、Undo、預設值與目前值；不需同輪重做整個自訂參數編輯器。

### 3. Specialization Constants 必須有自己的常數規則

原生 `const0name`／`const0value` 依名稱覆寫，GLSL `constant_id` 則是另一個穩定識別。分配 ID 不應依每次拓撲排序重排；建立、重新命名、複製／匯入、刪除、未使用來源及失敗回復都要有一致政策。改預設值會改 shader 內容；改原生覆寫值的生效與狀態不可冒用普通 Uniform 更新流程。TD 會為特殊化版本保留快取，適合偶爾切換的模式值。[TD 官方說明](https://derivative.ca/UserGuide/Write_a_GLSL_TOP#Specialization_Constants)

`constant_id` 只能直接標 scalar bool／int／uint／float／double，不能直接宣告一個 Spec vecN；向量可由個別 scalar 合成。這是 GLSL 能力，TD 的覆寫型別與精度仍須各別驗證。一般函式以 Spec 為參數不因此產生常數表達式；只支援規範允許的運算與 constructor。以 Spec 決定 array 長度還會影響型別相等與初始化，初版固定長度可避開這個耦合。[GLSL 常數與特殊化規則](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.html#specialization-constant-qualifier)

因此 `sgrape_core.py` 的 `CONSTANT_EXPRESSIONS`／`constant_outputs`／`demand_constant()` 與 `graph_ui.js` 的 `constantRequirementIssues()` 需共用一般常數、specialization expression、runtime 分類，保留逐輸出口判定與 Subgraph 展開後行為。先定義 `requireConstant` 在哪些位置接受 Spec，不直接把新來源加入現有二元名單。

### 4. Array／Matrix 的最低可用形狀與來源分開交付

圖內 literal、宣告、GLSL Code 輸入／輸出初始化與函式介面都須認得形狀；不能只讓選單出現 `mat4` 或 `float[]`。Matrix 明確定義欄列順序；Array 明確定義元素型別、固定長度、容量上限與合法初始化。先以同型接線及 GLSL Code 使用驗收，再決定補專用運算節點；矩陣乘法不是目前所有輸入口／輸出口共用 `T` 的逐分量 Math 簽名。

TD Matrices 參數雖顯示 CHOP style，官方實際接受 `tdu.Matrix`、4×4 Table DAT 或 16-channel CHOP，不能只把它當成 CHOP 路徑。原生矩陣綁定需另驗維度與排列，不能由頁面存在推導 mat2／mat3 一定可用。[Matrix Parameters](https://derivative.ca/UserGuide/Matrix_Parameters)

TD Arrays 的 `Uniform Array` 與 `Texture Buffer` 是不同資源路徑；後者是 samplerBuffer，不能混入數值 array 型別或沿用 sampler2D。初版若整合原生 Array，只承諾實際菜單的 float 家族與 CHOP 來源，並驗證長度／通道排列／GPU 限制；不把它當成 int／uint 全精度陣列來源。[GLSL TOP Arrays](https://derivative.ca/UserGuide/GLSL_TOP#Parameters_-_Arrays_Page)

### 版本與驗收

UI 批不需要先變更編譯版本。型別基礎、消費契約的 Editor、core、library 與 native runtime 必須成套交付；可以分「圖內家族與 Cast → 已驗證 Uniform → Spec → aggregate 最小範圍」幾次完整編譯版本，不要求一次大改。任何一段未通過時，不把該來源／型別組合放進選單。

`typeContract.version` 表示資料結構，hash 表示內容；加入 shape 或新的常數契約若不相容，應升契約版本並讓舊 Editor 明確拒絕。Catalog definition revision、emitter ABI、target shell 與產品 compilerBuild 分開判斷，不因加型別就重寫所有舊 revision。保留現有舊圖產碼／catalog 指紋檢查，補 core/UI 簽名對照、邊界 literal、Cast、Clipboard／Subgraph、native 動態更新及保存／失敗回復；以實際能力完成後的 compilerBuild 與 manifest 核對部署。
