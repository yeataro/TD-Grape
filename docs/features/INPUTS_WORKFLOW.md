# Inputs 編輯流程（0.8.6 開發版）

這輪依 2026-09-13 的討論開始實作，讓使用者看成果後調整。版本仍未進入 Alpha；以下完成範圍不代表所有輸入種類都已支援。

## 操作入口

- Nodes / Add Node 保留節點目錄。原 Uniforms 面板改稱 **Inputs**，保留原 Layout 身分與使用者配置。
- Inputs 列出此 Shader 的 Uniforms 與 Samplers，可搜尋名稱與型別。選取來源會開啟 Parameter，不需要先在圖中放節點。
- 每列 `+` 點一下建立引用，也可用滑鼠或觸控拖入畫布。拖出畫布、Escape、pointer cancel、第二指加入或失去視窗焦點均取消，不建立項目。清單其餘區域仍可捲動。
- 浮動 Add Node 同時包含新增來源、現有來源引用與 Time 預設；搜尋到來源名稱後建立的是同一 ID 的引用。
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

## 驗證與後續

- `tests/browser/test_native_sources.cjs`：選取來源、原生值寫入、搜尋、新增／引用區分、預填接線、待套用編輯 Undo、滑鼠取消與實際 Chromium 觸控事件。
- `tests/browser/test_custom_parameters.cjs`：加入自訂頁、修改、解除關聯。
- `tests/td/test_native_sources.py`、`test_custom_parameters.py`、`test_input_presets.py`：TOP / MAT 原生資料、時鐘、保留驅動、型別呈現、衝突與回復。測試使用獨立元件，並比較使用者 Shader 保存內容。
- 桌面 wire geometry、既有觸控編輯與 WebKit 空白斷線流程有回歸驗證。這輪新 Inputs 拖放尚待 iPad / macOS 實機回驗。

Alpha 仍須補足：明確的命名編譯常數、int / uint 與分量轉換、Attributes / Input Buffers 完整來源管理、MAT 跨 stage 介面、可多輸出的手寫 GLSL 節點、Instancing 存取與變形／法線／顏色／UV／自訂屬性、Render TOP Uniform 外部供值與同名診斷，以及能快速修改 PBR / MAT / TOP 範例的節點與模板。較少使用的能力仍在 Alpha 範圍內，實作順序可分輪推進。

恆常集合節點、末端灰點與節點 Label／來源資訊位置保留既有未決策狀態；不因這輪 Inputs 原型而定案。
