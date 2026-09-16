# Inputs 編輯流程

Inputs 的來源模型始於 0.8.7；以下操作入口已依目前 UI 更新。歷史版本驗證記錄保留在文末，完成範圍不代表所有輸入種類都已支援。

## 操作入口

- Nodes / Add Node 保留節點目錄。原 Uniforms 面板改稱 **Inputs**，預設與「新增節點」並排為左側同一區塊的兩個分頁；右側預設為 Parameter／自訂參數、Preview、Help。面板仍可跨側欄移動。
- 沿用舊預設分組的位置會一次性更新；自訂分組與已儲存的 Layout 預設集保留，亦可用 Restore default 套用新配置。
- Inputs 保留名稱與型別搜尋，各來源分類標題的 `+` 開啟建立對話框，填寫名稱與該類別可用的型別。TOP 提供 TOP Inputs、Constants、Uniforms；MAT 提供 Constants、Uniforms、Samplers。Uniform 對話框保留 Color 與四種時鐘快捷方式。重複選同一時鐘會選取既有來源，不產生新來源、空 Undo 或 Shader 更新。
- 分類預設展開，收合偏好存在瀏覽器；新增成功會展開該分類並清除搜尋，使新來源可見。空分類保留標題與建立按鈕，不顯示無作用的收合箭頭。搜尋暫時展開匹配結果，不覆寫原有收合偏好。
- 來源列使用緊湊、淡類別底色。點名稱在 Parameter 編輯；整列可用滑鼠拖入畫布。列右小 `+` 點一下建立引用，也支援滑鼠或觸控拖入；它不建立額外來源。拖出畫布、Escape、pointer cancel、第二指加入或失去視窗焦點均取消。觸控在名稱列保留捲動，明確拖放入口為 `+`。
- 浮動 Add Node 提供 **Inputs → Constants／Uniforms／TOP Inputs／Samplers** 分類，同時包含新增來源與現有來源引用；Time／Frame 預設歸在 Uniforms。全域搜尋保留，搜尋到來源名稱後建立的是同一 ID 的引用。
- 浮動清單的 Uniform 引用與時間預設使用 Uniform 辨識色，Sampler 引用使用 Sampler 辨識色。
- 畫布 Uniform／Sampler 引用的輸出端口顯示來源名稱（例如 `mixfac · float`），改名後同步更新顯示。內部端口仍為 `out`，接線與 GLSL 身分不因顯示規則改變；長名稱截斷時可由提示查看完整名稱。
- 從未接線的 input 呼叫新增選單，新增 Uniform 會預填接收端的型別、名稱與未接線數值並接線。新增／引用有明確區別；不再自動挑第一個相容 Uniform 或 Sampler。
- 刪除圖中引用保留來源。刪除 Uniform 來源走 Parameter 的獨立操作，保留缺失引用與恢復入口。自訂參數仍是獨立實體。

## 類型與來源

| 入口 | 實際建立／編輯的資料 |
| --- | --- |
| Uniform | GLSL OP Vectors 的原生列；目前支援 float、vec2、vec3、vec4 |
| Color | GLSL OP Colors 的原生列與 vec4；保留 TD 色彩轉換語意 |
| Sampler | 既有 sampler2D 宣告、TOP 來源及取樣分離流程 |
| Time | float Uniform，初始 Python Expression 為 `me.time.seconds` |
| Frame | float Uniform，初始 Python Expression 為 `me.time.frame` |
| Absolute Time | float Uniform，初始 Python Expression 為 `absTime.seconds` |
| Absolute Frame | float Uniform，初始 Python Expression 為 `absTime.frame` |

Time / Frame 名稱可改，衝突時使用流水號。這些是普通 Uniform，不是新增 GPU built-in。Frame 暫以 float 傳遞，沒有藉此宣稱 int / uint 管線已完成。時鐘語意依 [TD Frame](https://derivative.ca/UserGuide/Frame) 與 [absTime Class](https://docs.derivative.ca/AbsTime_Class)。

Parameter 顯示四個原生分量，未使用分量淡化並保留原值；GLSL 型別與 TD 原生列分開。預設值收在折疊區，與目前值分開。來源型別修改沿用現有相容性檢查；不相容修改會被阻擋，不靜默改接線。

## 驅動與自訂參數

原生參數是目前值／模式的唯一來源。Expression 編輯直接修改同一個 Par，使用模式與 Expression 的衝突檢查；動畫數值每幀變動不會使 Expression 編輯失效。空 Expression 或「保留目前值」會取當下有效數值後切回原生 Constant 模式。這個模式是 TD 的數值模式，與 GLSL 編譯常數不同。

Bind / Export 由原生參數頁處理，網頁不覆寫其驅動。非數值或非有限結果會恢復先前模式、數值與 Expression。一般自訂 Python Expression 的執行語意依 TD；不嘗試自動搬移任意相對路徑程式。

四種已知時間 Expression 可以加入 COMP 自訂參數。時間驅動移至自訂 Par，GLSL 原生 Par 綁定該控制；時間軸 Expression 仍明確指向原本 GLSL OP 的時間環境。任意其他 Expression、Export 或外部 Bind 保留原有保護，需先自行解除。

`initialDriver` 是新建原生來源時的預設，不是每次套用都重設的控制器。重新編譯保留現有值、Expression、Bind、Export；匯入到新 OP 時可依初始預設建立。完整原生驅動配置的可攜式匯出仍需後續設計。

Graph 的待套用新增可整筆復原。原生來源一旦已由 TD 接受，Graph Undo 只移除引用，保留來源、型別與原 ID；避免輪詢把同一個原生列重新辨識成新來源。實際來源刪除走 Parameter 的獨立操作，不能把 Graph Undo 當作 TD 來源刪除。

## TOP Inputs 與 Constants 的初版記錄（0.8.7）

本節記錄最初槽位模型，包含當時至少保留一槽及舊 Sampler 的過渡行為；目前來源清單、零輸入、命名與相容處理以 [TOP 來源清單](TOP_SOURCE_INVENTORY.md) 為準。

TOP Inputs 管理 COMP 外部接口，預設 Input 0，可先建立最多 16 個槽位再接入圖像。槽位 ID 不隨名称與排序變動；Parameter 提供改名、上下移動、預設圖與引用位置。第一槽位的有效圖像決定 Match Input 的輸出尺寸；Custom 模式仍使用指定尺寸。刪除槽位前須移除圖中引用並斷開 COMP 接線，至少保留一個槽位。

每個 TOP Input 引用提供 sampler2D、解析度與像素大小，分別使用同一槽位的 `sTD2DInputs[i]`、`uTD2DInfos[i].res.zw`、`.res.xy`。空槽使用設定的預設圖；新增加的槽位預設不透明黑。未知路徑依既有缺失來源策略使用黑色；非 TOP 與非 2D 圖像會拒絕套用，保留上一個成功輸出。

執行端使用現有 GLSL TOP 的 TOPs 參數依序綁定來源，不替換 Shader OP。設定槽位不依使用與否壓縮編號。額外保留舊圖的獨立 Sampler 與缺接黑色來源空間；它們不占用 COMP 槽位。TOP 的新建入口不提供另一份獨立 Sampler 清單，MAT 保留 Samplers。

舊圖未使用槽位模型時維持原編譯順序；第一次編輯／引用 TOP Input 才加入 `topInputs`。`topInputLegacyId` 固定舊 `input:0` 引用的槽位，使重新排序後仍使用原圖像。舊 Expose TOP 參數及其 Expression 身分保留。新增 catalog 定義不改動舊節點 revision。

Constants 是 `kind: constant` 的圖資料，首版提供 float／vec2／vec3／vec4。使用的常數產生全域 `const`，引用直接使用常數名稱，避免被轉成一般區域變數。修改值會重新編譯；不建立 Uniform 原生列，也不套用 Python 時鐘預設。既有 Float／Vector 常值節點維持不變。

新增節點與 Inputs 共用 Pointer Events 拖放：`+` 可供滑鼠及觸控拖入；節點名稱也支援滑鼠拖入。觸控捲動區不截取手勢。來源／節點複製貼上維持引用身分；跨 Shader 的 TOP Input 貼上建立新槽位，禁止貼入 MAT。打包子圖時具名來源留在外層。

Inputs 不產生原生 GLSL Parameters 按鈕，也不保留其 HTML、前端事件綁定或隱藏樣式；後端開啟原生參數的 API 能力仍保留，後續有需求再設計入口。

## 驗證與後續

- `tests/unit/test_top_inputs.py`、`tests/td/test_top_inputs.py`：槽位順序、16 槽與黑色備援、原生像素輸出、刪除／編譯失敗回復、保存重載、2D 型別保護、舊來源與 Expression 保留、具名常數。原生環境為 TD 2025.32820 / Windows。
- `tests/browser/test_inputs_round.cjs`：分類建立對話框、取消／非法名稱、收合／搜尋／保存重載、重複時鐘不產生編輯、Constants／TOP Inputs、引用、複製貼上、刪除／還原、整列滑鼠／明確入口觸控拖放。
- `tests/browser/test_native_sources.cjs`：選取來源、原生值寫入、搜尋、新增／引用區分、預填接線、待套用編輯 Undo、滑鼠取消與實際 Chromium 觸控事件。
- `tests/browser/test_custom_parameters.cjs`：加入自訂頁、修改、解除關聯。
- `tests/td/test_native_sources.py`、`test_custom_parameters.py`、`test_input_presets.py`：TOP / MAT 原生資料、時鐘、保留驅動、型別呈現、衝突與回復。測試使用獨立元件，並比較使用者 Shader 保存內容。
- 桌面 wire geometry、既有觸控編輯與 WebKit 空白斷線流程有回歸驗證。這輪新 Inputs 拖放尚待 iPad / macOS 實機回驗。

Alpha 仍須補足：int / uint 與分量轉換、Attributes / Input Buffers 完整來源管理、MAT 跨 stage 介面、可多輸出的手寫 GLSL 節點、Instancing 存取與變形／法線／顏色／UV／自訂屬性、Render TOP Uniform 外部供值與同名診斷，以及能快速修改 PBR / MAT / TOP 範例的節點與模板。較少使用的能力仍在 Alpha 範圍內，實作順序可分輪推進。

恆常集合節點、末端灰點與節點 Label／來源資訊位置保留既有未決策狀態；不因這輪 Inputs 原型而定案。

### 0.8.7 歷史交付驗證

0.8.7：148 項 Python 單元測試、14 項啟動邏輯測試、421 個雙語鍵、四組 JavaScript 模型測試及新舊 Inputs 瀏覽器測試通過。TD 2025.32820 實測通過槽位接線／排序、17 張來源（16 槽加缺接備援）、既有參數 Expression、常數像素輸出、錯誤回復與組件保存重載。開發 TOE 已保存，展開後 24 份內嵌文字來源與 repository 一致，私人開發助手排除。

0.8.7 當時未取得冷啟動 HTTP 驗證回報；後於 0.8.71 查明為測試清單換行造成探針未被打包，修正測試工具後已通過獨立重開驗證。未修改執行架構或全域 Cooking 偏好。詳見 [連線與啟動驗證](CONNECTION_RECOVERY.md)。iPad / macOS 本輪實機回驗仍待進行。
