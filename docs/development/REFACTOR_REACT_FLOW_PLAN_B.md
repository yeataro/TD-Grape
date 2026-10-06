# React／React Flow 遷移 B 案：以正式產品切片帶動核心演進

2026-10-06。**人類已接受 B 案；Refactor.15 已實作第一條正式 TOP 路徑，待人類 UX review 與 Human Takeover。** 最新執行／驗證狀態见 [STATUS](STATUS.md)，開發入口見 [React README](../../src/editor-react/README.md)。下文第 2 節是規劃當時的起點，不代表現在仍有 stale 產物。

[A 案](REFACTOR_UI_UPDATES.md)原文保留供比較，評估版原地保留。既有正式流程、STATUS 與目標架構改指向 B；沿用原有工作紀錄，不同時維護兩份活動路線圖。人類另確認交易聚合、未變項引用及 RF 幾何更新的效能驗收，詳見第 7 節；不因此新增 event bus、diff 系統或治理機制。

## 1. 核心策略與查核結論

**建議正式 React Flow 從第一個產品切片就進入 repository 的正式建置與宿主路徑，和核心、應用能力一起演進。** 第一個切片完成前不切換所有使用者的預設入口，但也不再建立一個只讀 seed、只能在記憶體編輯的第三個實驗場。

一次只解決一項可用的產品能力：

> 選真實操作 → 接正式 UI 與現有核心／宿主 → 暴露具體缺口 → 就地補足 → 驗證整條操作 → 下一項能力。

核心維持不依賴 DOM／React Flow runtime；這不要求先完成一套通用應用框架，也不要求每種資料都另造獨立的 ViewModel。以目前 repository 而言，有理由保留 GraphDocument 與少量欄位轉接，沒有理由先重做圖模型，也沒有證據要求所有 React Flow 資料永遠只是完整複製的 projection。

### 對人類疑慮的獨立判斷

| 疑慮 | 判斷與依據 | B 案的實際選擇 |
| --- | --- | --- |
| A 案可能讓正式 consumer 太晚進場 | **成立，但不能說 A 完全線性。** A 第 5 節限制只補本階段能力，第 6 節允許 RF-2／RF-3 迭代、反對空框架；然而 RF-4 仍在後面，RF-1 要涵蓋的群組也很廣 | 把正式 UI 接入放進第一輪；RF-2／3／4 的工作是同一功能的不同部分，不各自等待「完成」 |
| 現有核心還不能支援真實 UI，所以需先大量準備 | **對已遷移 TOP 路徑不成立。** 評估版直接使用真實 NodeModule、GraphDocument、Network.plan/connect 和 compiler | 先用現有 Interface；缺什麼由當輪 UI 指出 |
| 完全不需要應用層整理 | **不成立。** 正式開圖、提交、歷史與晚回覆保護仍集中在 app.js，混有 DOM、面板及預覽調用 | 第一輪抽出該條路徑確實要用的協調邏輯，不搬整個 app.js，也不先建通用命令平台 |
| Node／Connection 同構，因此可直接把 RF 狀態當目前作品 | **語意部分成立、現況不能直接等同。** 既有欄位、scope、接孔語意、不可變交易和保存政策不同；RF 的 Connection 還可能只是未提交手勢 | 可共用相容欄位／唯讀資料，保留一份 authoritative document state；不為相容性先改整個保存格式 |
| 能力盤點需要涵蓋所有未來功能 | **沒有證據支持。** 新宿主及評估版都有清楚的現成小路徑；MAT／Library 等未知不影響第一條常數 TOP 路徑 | 只查當輪路徑、直接前置及已知衝突；其餘明列 UNKNOWN，到了真正使用時再查 |
| A 將產品選擇和架構規則混寫 | **成立。** A 的「硬性邊界」包含 Auto、轉換政策、live channel 等本階段決策 | 分清長期責任、目前產品決策與工作保護，不藉 B 案改掉現有產品行為 |
| 只看模組化就足以證明人類能維護 | **不成立。** 現有測試證明部分程式可擴充，尚無無 AI 的人類接管證據 | 第一個切片後安排一次實際 Human Takeover Test，明確記錄未測／結果與限制 |

不是所有先後都應消失：**版本對齊先於可信的跨端驗收；合法性與交易保護先於正式提交；資料可保存／復原先於替換預設入口。** 這些是具體動作的前置，不是要求整個 Core／Application 層完成。

## 2. 這次讀到的實際起點

查核分支為 refactor，HEAD 為 3a02677，工作目錄有既存未提交改動。不是把 HEAD 或 STATUS 當成當前全部實況。

| 證據入口 | 現況 | 對 B 案的影響 |
| --- | --- | --- |
| [STATUS](STATUS.md) 的 Refactor.14 | 真實網頁已完成限定 TOP 前端產碼、原生套用、Undo、保存；完整 MAT／ISF、來源、Library 等尚未完成 | 沿用現有原生宿主，第一輪不研究新傳輸 |
| [model.ts](../../src/core-ts/model.ts)、[graph.ts](../../src/core-ts/graph.ts) | Node 是 id／definitionUuid／params／inputValues／ui；Edge 是 id／from／to。GraphDocument.change 產生候選和 before／after／changes；Network 已有建立、編輯、接線、刪除 | 足以當第一輪的真正 domain；不必先另造 GraphController 或 CommandBus |
| [node_module.ts](../../src/core-ts/node_module.ts)、[node_sdk.ts](../../src/core-ts/node_sdk.ts) | presentation、接孔、configure、edit、emit 已存在；不是空白 SDK。通用型別選單描述仍不完整 | 先用已有描述；遇到 Add 選單等真實需求才補必要查詢 |
| [editor_contract.ts](../../src/core-ts/editor_contract.ts) | 已從真正模組產出 variants／選項資料，原本服務舊 UI；建置失敗會報模組／型別 | 可有期限地重用合用的那部分，不因它叫 compatibility 就先全部重寫 |
| [changes.ts](../../src/core-ts/changes.ts) | 有結構化變更，但內部仍快照比對，某些情況 complete=false | 可先支援穩定資料引用；不能宣稱已消除全圖掃描，更不先設計第二套 diff |
| [app.js](../../src/editor/app.js) | editorRequest、change、performApplyGraph、undo、load 包含可重用保護，也直接操作 DOM／面板；history-restore 只在有原生變更等情況才使用 | 抽取當輪真正需要的部分；常數圖歷史不必等整套原生參數歷史搬完 |
| [host_api.py](../../src/td/runtime/host_api.py)、[host_artifact.py](../../src/td/runtime/host_artifact.py) | 已有目標化 state／apply／history-restore／save；apply 驗 targetId、revision、snapshot、protocol、catalogHash，無 Python compiler fallback | 寫入保護是現成契約；第一輪應接真實契約，不用「成功」假回覆 |
| [native_family.py](../../src/td/runtime/native_family.py) | Apply 仍會驗 GPU、配置來源及保存；即使 code 一樣也不是無成本呼叫 | 不宣稱所有 layout-only 優化都已完成，不把 RF 拖曳每幀送進 Apply |
| [build_core.cjs](../../tools/build_core.cjs)、[build_editor.cjs](../../tools/build_editor.cjs)、[editor_service.py](../../src/td/runtime/editor_service.py) | 核心組裝與 bootstrap 產生已有路徑；靜態包有資產 hash，服務可由資料夾／VFS 供應 | 新入口應加入同一產品資產包，不另外發展一套 catalog producer 或 TD server |
| [評估 README](../../../work/refactor/react-flow-evaluation/README.md)、[model.ts](../../../work/refactor/react-flow-evaluation/src/model.ts) | 52 種可獨立建立節點與 102 節點／101 線已有觀察；局部草稿、拖曳、接線與穩定顯示引用已實證。無正式 TD／保存／完整歷史 | 可回收已驗證的小段能力，不能把 EvaluationModel 或 seed 場景當正式應用 |
| [EvaluationCanvas](../../../work/refactor/react-flow-evaluation/src/EvaluationCanvas.tsx)、[NodeCard](../../../work/refactor/react-flow-evaluation/src/NodeCard.tsx) | 已直接使用框架拖曳、命中、幾何；通用卡片依能力繪製。阻尼曾有回授問題，型別選項仍有 configure 探測 | 不再評估框架能否畫節點；正式 consumer 檢驗保護、呈現及操作是否可靠 |

### 本次實際執行的檢查

- npm run test:core：**97／97 通過**；這些測試讀取已生成的 wire_planning.js。
- node tests/unit/test_history_recording.js：**11／11 通過**，檢查真正 app.js 的歷史錄製函式；不等於完整 Undo 協調已獨立。
- Python 的 test_host_api、test_host_document、test_host_artifact、test_host_requests：**22／22 通過**，使用實際模組及測試替身；不是真實 TD GPU 驗證。
- 評估版 tsc --noEmit 通過；直接引用目前 TS 來源。梯尺／阻尼檢查 **13／13 通過**。
- node tools/build_core.cjs --check：**未通過**。wire_planning.js、node_catalog.json、editor-bootstrap.json 與目前來源產出不一致。目前 values.ts 的既存差異是註解；建置會把 bundle 內容納入 hash，因此不能只因執行規則看似未變就忽略。此輪未重新生成或修正它们。
- 本輪沒有重跑瀏覽器互動、完整 TOE 冷開機或 TD 待機 profiling；評估手感、GPU 等沿用有範圍的歷史證據。

因此 B 案不從「所有測試全綠、資產已同步」起跑。**先確認來源差異並以現有建置對齊產物及測試宿主的 bootstrap，才讓第一輪跨端結果有效。** 不用新 manifest／版本治理平台解決已有檢查已能指出的問題。

## 3. 保留的責任，以及可以改變的選擇

| 類別 | 本次含義 |
| --- | --- |
| 架構 invariant | Grape 規則可不靠 DOM／React Flow runtime 執行；節點／Port／型別／接線驗證／compiler 有唯一規則來源；明確的 document authority 與序列化政策；提交失敗不留下半份作品；保存不混入 UI runtime |
| 長期產品要求 | 產品能力、效能、UX；人類可理解與接管；問題可追蹤；Family 只依賴 Manager 提供編輯，缺席時原生參數／綁定／texture／Shader 照常，沒有新增搜尋與重試負擔 |
| 現行 accepted product decision | 不恢復 Auto 長鏈改型、維持現有轉換政策；Uniform live channel 及傳輸改造仍延後；面板細節後續討論。B 不改這些決策，但它們不是永遠不可改的架構定理 |
| 本輪工程選擇 | React／React Flow 的受控畫布、保留 GraphDocument、首輪少量欄位轉接、先做常數 TOP。這些按證據可調整，不升格為永久規則 |
| 工作保護 | main／固定 Legacy 只讀、IconGen → icon 不動；不誤操作另一個 TD 程序；依 B 案範圍推進，不順帶恢復延後能力 |

「一份可寫狀態」精確改述為 **一份權威的編輯文件狀態（authoritative document state）**，不是禁止存在任何其他 mutable object。

- React 的欄位草稿、拖曳位置、選取、視口、展開、pointer capture、RF measured geometry 可以各自更新。
- 草稿提交須進同一作品操作入口；不讓 RF 的 data 寫入和 GraphDocument 的寫入各自決定 shader 事實。
- History 的 before／after、編譯輸入、網路請求快照、TD 已接受的文件版本、最後套用 GLSL 均可存在。它們是有身分與版本的快照／結果，不是暗中雙寫的第二張活動圖。
- 瀏覽器中的新草稿與 TD 已接受版本可以暫時不同；由既有 revision／操作回覆協調。TD 原生 Parameter 仍有自己的權威，不藉「單一狀態」把它歸瀏覽器所有。

## 4. Node／Port／Connection：哪裡相容，哪裡仍屬 Grape

查核評估版鎖定的 @xyflow/react 12.12.0 與本機型別，並對照官方 [Node](https://reactflow.dev/api-reference/types/node)、[Edge](https://reactflow.dev/api-reference/types/edge) 定義：React Flow 接受自訂 data，但也帶有渲染、選取與量測欄位；相容不代表所有欄位都適合保存。官方[狀態管理範例](https://reactflow.dev/learn/advanced-use/state-management)也允許應用提供自己的狀態，沒有強制建立兩套業務模型。

| 概念 | 目前 repo 與 RF 的關係 | B 的責任判斷 |
| --- | --- | --- |
| Node identity | Grape id 是 network-local；RF id 是目前畫布內身分 | 優先同值使用；跨 scope 同時呈現才做 UI id 編碼，不能反改 domain id |
| Node definition／data | Grape 有 definitionUuid／params／inputValues；RF data 可放任意資料，RF type 用於選 renderer | 可共享唯讀 authored 資料或直接引用相容欄位；definitionUuid 不等於 RF renderer type，也不複製節點规则 |
| Position | Grape 現存 ui.x／y；RF position.x／y | 同一已提交座標語意，現在只需小轉接。手勢中位置可由 RF 持有，結束交易後保存；不為消除兩個欄位賦值先改全庫 schema |
| Port | Grape 是 network／node／direction／key，含動態介面、預設值與型別；RF Handle 是顯示與命中入口 | Port semantics 留在 Grape；Handle id 對應 port key，量測位置留 RF |
| Connection intent | RF onConnect 提供 source／target／handle；拖曳未必會成功 | 當作操作意圖交 Network.plan／connect；hover 與提交都問同一規則，提交重驗 |
| Saved Edge | Grape 用 from／to 二元組和保存 id；RF Edge 用 source／target／handle 和必需的 id | 語意高度同構，可共享端點與 id 的意義；目前轉接成本低。不得讓 RF addEdge 取代型別、循環、替換與動態接孔規則 |
| Scope／Subgraph | Grape stage、functions、介面與引用影響編譯；RF parentId 是畫布父子關係 | 不直接等同。Subgraph 的實際操作留待相應切片，不先設計全能巢狀畫布 |
| UI runtime | selection、dragging、measured、DOM refs、viewport 動畫 | React／RF 或前端應用持有；不直接把 RF toObject 輸出當 Grape 文件格式 |
| 序列化與文件權威 | 現有 Graph 包含宣告、stages、functions 等 RF 無法自行理解的內容 | Grape 決定持久化欄位、scope 和 revision；serializer 不以「RF 剛好有這欄」作保存理由 |

### 本案真正採取的資料做法

第一輪保留現有 GraphDocument，RF nodes／edges 只增加實際需要的呈現外殼；**不再造完整的 CanvasGraph／NodeViewModel 類別體系**。傳給 RF 的 data 可引用權威文件中的唯讀內容；交易目前會複製資料，因此由 GraphChanges 保留未受影響項目的顯示引用。先採評估已成立的簡單方法，量測後才細化，不能假定必須完整重建。

這不是禁止共享結構。若後續某項操作確實因轉換重複付費，可以由 Grape 定義 framework-neutral 的 id／position／data 或 source／target／handle 形狀，在 UI 編譯時檢查其符合 RF 公開型別。核心不 import RF；序列化仍明確挑選文件欄位。**相同 shape、共用同一個唯讀 record、甚至一次 immutable 更新供兩邊使用，均可接受。**

但目前為此全面改 model.ts，會連動圖交易、compiler、歷史、子圖及 host 保存，代價明顯大於幾個欄位轉接。B 第一輪不做這項改寫；這是依 repo 成本的選擇，不是「完整獨立 model＋完整 projection」教條。也不做特殊 getter／Proxy 來假裝零轉接，增加除錯難度。

## 5. 第一個正式 vertical slice

### 選擇：可保存、可套用的常數 TOP 編輯

使用一份真正由目前 Manager 管理的 TOP Family，開啟其文件，在正式 React 入口完成：

> Color RGBA／Float／Add／Color Output → 改值／型別、建立與刪除、接線／替換／取消、移動 → Undo／Redo → 前端產碼 → TD 套用 → 保存及重開。

起始可用现有 bootstrap.defaultDocument 的 Color → Output；使用者再加入 Float／Add，測試純量、vec4 與 Edge 轉換。不是硬編碼 UUID 或只能載入的 demo：指定任一符合當輪能力的真實 Family，從 state 讀、向 apply 寫，重開讀回自己保存的結果。

首輪文件範圍刻意為 TOP／pixel、無 Uniform 宣告、無 subgraph／texture／array／frame 的常數圖。這能避開未完成的原生參數協調，**不是去除這些能力的產品決策**。遇到範圍外作品保持原資料，清楚告知此入口尚未支援並可回舊入口；不能刪欄位後勉強開啟。

為什麼不是其他切入：

- 比只拖曳節點多驗了文件、歷史、產碼、宿主與保存，才是真實產品路徑。
- 比 Uniform 三處同步少了來源管理、原生值／圖預設／回覆衝突與面板的同時遷移；repo 已證明常數 TOP 能走完整宿主流程。
- 比先搬全部節點表更快得到正式 consumer，又有 Add 配置、Color 多分量、Output 無輸出孔等差異，不只是單一文字卡片。
- 首輪尚不能证明動態接孔、宣告更新、子圖及多面板責任完整；用後續真實切片檢驗，而不是把首輪做成它們的通用解。

### 正式 code path 的意思與最小改動範圍

新 TSX 來源放入 refactor repo 的產品來源目錄，例如 src/editor-react/；名稱可調整，**不是放回 work/ 評估場**。在现有產品靜態包提供一個明確的 React 入口，例如 /react-editor.html?target=<Family UUID>，沿用同 origin 的 /api/<UUID>/state 與 apply、授權 token 和真實 Editor Service。這個例子是路徑安排，不是新 protocol。

现有服務能回傳包內檔案，首輪通常只需擴充建置和資產入口；啟動程式需明確解析 target，不能直接搬舊 app.js 只認 /shader/<UUID>/ 的假設。保留舊入口至新路徑覆蓋其用途，新舊頁面不共同持有同一個 live document，也不在一個 DOM 上交叉寫入。不同頁面同時開同一 Family 仍受既有 revision 衝突保護，不新增鎖定服務。

| 當輪改動 | 真實 caller | 開始就要有的行為 |
| --- | --- | --- |
| 正式 React 頁、NodeCard、值欄位與畫布接線 | 人類實際編輯 TOP | 讀真實文件、用模組呈現、命令與取消可用 |
| 小範圍作品／歷史協調 Module | React 控制項、畫布、Undo、提交入口 | 呼叫 GraphDocument.change，保存圖歷史；失敗不發布，無效草稿不送宿主 |
| 现有 state／apply 交付邏輯脫離 DOM | 開圖、提交、狀態顯示 | 目標、revision、catalogHash、送出快照和晚回覆一致；有未送出變更就保留 |
| 選單所需能力查詢（若現有資料不夠） | Add 的真正型別選單 | 先看 NodePresentation／生成 variants 能否正確供應；不足才補 SDK。禁止 renderer 自己列型別規則 |
| 建置／啟動整合 | Editor Service、TD Manager | 同一包、同一 registry／producer、來源與 bootstrap hash 一致 |

第一批可先接「載入 → 畫一顆真實節點」，隨即接改值與提交；這些是首輪內的小提交，不等待核心／應用先完成。只讀的第一批不是切片完成，不另設一個長期只讀模式工程。

**首輪優先使用現有生成核心 bundle／bootstrap 的一致組裝結果，React 入口經小型型別接入使用它。** 這能先沿用真正的 registry、compiler 與 producer 身分。只有這個真實接入出現限制，才讓現有組裝器供應同源 ESM 入口；不是開工前另做套件化工程。前端直接 import 新 TS、卻拿舊 bundle 的 hash 冒稱同版本不可接受；不建立第二份模組清單或重算另一套 protocol。

### 這一輪需要保留的保護

- 先核對並對齊現有 stale 產物，再接使用同來源的測試宿主；hash／資產檢查不可用硬編碼繞過。
- 抽出 app.js 中此路徑使用的開圖、graph-only 歷史與提交協調；不抽象尚未使用的 live receipt、Personal Library、全能 command dispatch。既有測試跟著真正函式移動，避免再以來源字串切函式作唯一保證。
- 常數圖的 snapshot history 可以沿用。**快照歷史本身不是髒做法**；不能搬的是原型忽略宿主、版本、取消與資料保護的簡化語意。首輪無原生來源變更，Undo 仍需處理 in-flight Apply，再套用撤銷後的圖。
- 保留現有自動提交的相關行為與等待／失敗提示；不能用「先只做手動 Apply」默默規避競態。已提交、正在提交及本地更新分清，不把回覆當作新的工作圖覆蓋。
- 移動中由 RF 維持位置；放開只進一次圖歷史及既有保存排程。編譯可重用相同語意的已知產物，但不承諾改良目前宿主每次 Apply 的 GPU 工作；量測須將兩者分開。
- 最小新增入口使用 registry／catalog 真實內容，清楚標示本次已支援範圍。可集中列出當輪尚未驗收的能力，但不在 renderer 按節點名稱寫特例，不把篩選清單當完整產品表。

## 6. 每輪如何共同推進

不再按「核心完成 → 應用完成 → UI 完成」排三段。每輪使用既有工作 comment，寫一個操作例子與真正完成條件即可。

1. 沿真實操作追到最近的已用入口，只回答當輪需要的問題。
2. 正式 UI 立即調用現有 Interface；能直接用就不加中介。核心規則仍由核心檢查，不以 UI 看起來正確代替。
3. 看到缺口時，在最接近責任的 Module 補足；新增 Interface 必須指出本輪哪個正式 caller 使用它。只有測試替身或想像中的未來面板，不算真實 caller。
4. 同一批改動接回 caller，再驗模型、UI、交付與使用感受；留下暫時轉接就寫清用途與何時可刪。
5. 完成一條真正可用路徑後擴下一項，不因第一輪通過就宣告全產品完成。

「No interface without a real caller」不要求先寫會繞規則的 UI：同一個切片內可以先寫型別／測試，再接 consumer；只是不能把無 caller 的架構準備當獨立成果。單一 caller 也可有值得隱藏的複雜度，不必強造第二個 Adapter 才准寫 Module。

### 第一輪必須取得答案；其他保留 UNKNOWN

| 必須確認 | 理由 |
| --- | --- |
| target、origin、授權、圖 schema、catalog／compiler 來源一致 | 沒有它就無法知道自己在編輯和套用什麼 |
| 哪裡提交權威文件，草稿／位置／Undo 的提交時機 | 防止兩份作品及手勢半提交 |
| 一次交易如何聚合發布、保留未變項引用及限制幾何更新 | 正式 React caller 的第一輪效能驗收，不能只靠核心測試推定 |
| 四類節點真正的值、選單、Port 與命令入口 | 正式 UI 當下已在呼叫 |
| 連線預檢／提交、無效值、刪除／Undo 的完整性 | 直接影響資料與產碼 |
| 已送出快照、晚回覆、斷線、GPU 拒絕、保存重開 | 真實宿主寫入不能暫時省略 |
| 不支持的作品如何退出而不損失內容 | 首輪範圍小仍需安全入口 |

可以保持 UNKNOWN：全部節點的完整展示 schema、TextBlock／自由排列的最終欄位、所有面板的組合、資源／矩陣的所有配對、MAT／ISF 新入口細節、全套 Library 更新、Uniform live 傳輸選型、跨裝置最終效能、最終是否需要 Zustand、是否值得將 domain record 改成 RF 相容形狀。

UNKNOWN 不代表不用做，或假定能沿用。它到了下一個操作的讀寫／資料保護路徑，就必須釐清；其他未知保留在現有 STATUS／能力待辦，不另生「未知治理」清單。

### 接下來的產品路徑

第一輪後，建議依序用「動態 Math／Split 接孔與多輸出 → Uniform 單次編輯和原生歷史 → 真正 Subgraph 編輯」挑下一個現成場景，每次仍接正式 UI 和宿主。可依第一輪暴露的風險調整順序，不先寫三套完整規格。

面板仍在節點路徑後與人類討論；需要某面板時再確定其責任與第一個使用情境，不提前建所有面板 Interface。若 Uniform 的必要 UX 牽涉未定案面板，就在該時點討論，不臨時做假面板當交付。

Texture／Sampler、MAT／Vertex、ISF、Library 等既有產品目標仍在原有範圍追蹤。輪到一項就連帶完成所需 domain／host／UI，不恢復「先搬完全部核心」；無法成立就回報具體缺口，不以停在常數畫布為完成。全部必要能力及正常入口接管後才移除舊前端；不是無期限維持兩套 Editor。

## 7. 每輪的完成條件

完成指一項產品情境成立，不是多了幾個 Interface。首輪須全部回答下列問題；後續輪按實際涉及部分沿用。

### 行為與資料

- 正式 UI、離線測試和 compiler 使用相同接線／型別規則；不合法接線保留原線，不合法提交不改作品。
- 新增／刪除、值／型別、移動、接线替換與取消有對應 Undo／Redo；一個手勢一筆，無操作不清空 redo。
- 斷線保留工作圖；舊回覆不清掉後來的 dirty 狀態；衝突明示，不悄悄重讀覆蓋；過期操作不套到另一個 target。
- 送出的圖、GLSL 與綁定描述來自同一快照；TD GPU 確認、保存、重新開啟後一致。關頁再開、TOX 重載、TOE 冷開機分開記錄，不能互相冒充。
- 序列化保留合法未知欄位／未接管資料，排除 selection、measured、DOM、手勢等 runtime 欄位；不用白名單遺漏既有作品內容。
- 無 Manager 的 Family 原生能力不受 UI 遷移影響；此次改到相關宿主行為才補對應原生驗證，不能用前端 mock 宣稱通過。

### UX

- 數值框、選單、接孔與拖曳區的優先關係正確；編輯文字不拖節點，無關更新不丟焦點與草稿。
- 無效輸入／斷線／版本衝突／GPU 錯誤顯示實際失敗層及操作，不能都顯示「連不上」。
- 共用樣式只影響指定部位；vec4 預設色、RGBA 分量色、標題／型別文字各守原意；正式線和臨時線遵循同一規則。
- 縮放／平移位移正確、沒有回彈或手勢基準縮減；阻尼若納入，沿用既有反例驗證。Value Ladder 等重用能力不要求像素級仿 TD，但不能退化已確認的手勢語意。
- 人類能找到正式入口、知道它支持什麼、成功是否已套用／保存；不能依賴隱藏指令完成基本流程。

### 效能

以同一裝置、瀏覽器、production build、視口與固定圖量測；先留基準再改，不事後放寬。原型已有約 1ms 級的單次模型／投影觀察，**不是包含 React、繪製與 TD 的性能基線**。

#### 交易聚合與幾何更新（2026-10-06 人類補充，第一輪必驗）

**一個成功的 GraphDocument transaction，即使改動多個 node／edge，對 React consumer 也只提交一次完整的 document projection 更新。** 先用該交易的 GraphChanges 算完下一份 nodes／edges，再一起發布；consumer 不應看到「新 nodes＋舊 edges」或逐筆套用的中間作品。這裡的一次指應用層的邏輯發布，不是強制 React render／commit、StrictMode 或 RF 自動量測只執行一次。

- 未受影響的既有 node、node.data 及 edge 保持 reference identity（用 `===` 驗證）；容器陣列可以因內容改動而更新。若只有位置改動，node 可換引用而無關 data 留用。GraphDocument 複製了整份快照，不構成重建所有呈現項目的理由。
- 「未受影響」包含呈現依賴：線端點型別／樣式或接孔連接狀態確實改變的項目，允許更新；不能只看 node 是否直接被編輯。GraphChanges 不完整時可保守重算相關範圍，但不能因此無條件換掉所有不變項引用。
- **只有 Handle 結構或實際幾何改變，才需要考慮額外的 RF geometry invalidation。** 包含接孔新增／移除／排序／位置，或文字、控制項布局使接孔位移。值、顏色或型別標籤變更若未改變幾何，不額外呼叫 updateNodeInternals；不是所有 PortChange 都等於幾何改變。
- 優先沿用 RF 正常的拖曳／尺寸量測；需要明確通知時，在 DOM 提交後只處理受影響的 node ID，去重，不逐 edge 或全畫布通知。首次掛載的註冊／量測及 RF 自身必要更新不算違反此條件。
- no-op 或失敗交易不發布新的 document projection；錯誤／交付狀態可各自更新。Undo／Redo 恢復文件時亦走同一聚合發布原則，不能拆成逐節點回放。

在**正式 UI 真正使用的交易／發布入口**加入可重跑測試，並以瀏覽器確認幾何與 UX。測試訂閱既有 consumer 入口即可，不為計數另造事件平台。

| 案例 | 必須觀察到的結果 |
| --- | --- |
| 一次交易改至少兩個 node，並新增／替換／刪除多條 edge；另留無關節點與線 | 一次 document projection 發布，內容為完整交易結果；無關 node、data、edge 引用不變，連接狀態與線端點一致 |
| 批次刪除節點及相連線，再 Undo／Redo | 每次文件操作各聚合發布一次；無懸空中間畫面，沿用該操作的一筆歷史語意 |
| no-op；或先改候選值、後因不合法接線使交易失敗 | 零 document projection 發布，既有作品與呈現引用保留；失敗原因仍可顯示 |
| 純值／樣式變更，Handle 布局不變 | 零額外的顯式 RF geometry invalidation；焦點及草稿保留 |
| 首輪真正的型別／多分量布局使 Handle 位移 | DOM 提交後連線貼齊，只有受影響節點需要額外通知；自動量測已足夠就不重複通知。後續動態接孔切片再補新增／移除／排序案例，不先引入未用能力 |

**目前證據與未完成項：** 原始碼查核顯示 GraphChanges 已一次回傳整個交易的 node／port／edge 變化；評估版 model.ts 也先 project 再 publish，並留用部分未變項引用。以目前生成的核心 bundle 執行單次交易，已驗到 2 個 node 變更及 4 個 edge 變更（兩次替換），complete=true、無 PortChange；no-op 與失敗交易保留原文件亦通過。這只是核心聚合檢查，產物仍有第 2 節記載的來源同步限制。

**規劃時的未完成項（後續 Refactor.15 的正式 session／browser 驗證見 STATUS）：** 當時正式 React 的聚合發布／引用 identity／幾何驗收尚未執行。評估版 NodeCard 的 geometry signature 包含完整 controls 等描述，觸發條件可能超出實際幾何變化；不能原樣搬入後便宣稱符合。第一輪優先直接使用 GraphChanges，在真實 caller 補必要處理與上述測試；目前沒有證據需要新增 event bus、第二套 diff 或通用 abstraction。這個要求不授權改寫核心成增量引擎，也不要求繼續修改評估版。

| 操作 | 首輪量測／接受方式 |
| --- | --- |
| 小圖與约 100 線图改一個值 | 固定腳本重複至少 30 次，記 p50／p95、長樣本；分開核心交易、資料準備、React commit、Layout／Paint、compiler、網路、TD apply。先和原型同圖局部操作對照，再和 Refactor.14 比完整交付，不能比較不同範圍的總耗時 |
| 連續拖曳／平移／縮放 | 記 frame interval 和掉幀；拖曳中無文件交易／compile／HTTP per-frame 工作。參考實際刷新週期 T，前端互動 p95 應落在一個 frame budget 內，且不比同條件原型產生可重複卡頓 |
| 單次數值／型別提交 | 區分正常的必要變更與框架內部 render。檢查無關卡片的 DOM identity、焦點、草稿與線幾何；不要求任何 React 元件都完全不 render，也不先要求 O(1) |
| 長任務與回歸 | 新增且可重複的超過 50ms 主執行緒任務需定位；新路徑若比適用基線增加超過量測波動的實際延遲，查明來源，不以 FPS 顯示上限結案。frame budget 是首輪工程預算，不是全平台承諾 |
| 靜止／關閉 | 稳定後記錄至少 30 秒；動畫、草稿監聽及無必要 UI 更新停止。無 Editor／無 RTC 的 TD 待機和原生作品成本分開，不能看到 HTTP thread 活著就推定零成本或高成本 |

若超標是现有 GraphDocument 的 clone／changesBetween，就先改善這條已量到的路徑；若是資料引用／订閱，修 consumer 接入。不要預先更換整個 model 或做完整依賴引擎。改一值允許有限全圖掃描，只要實際成本符合產品要求；真正要防的是無關重建及不成比例的成本。

弱機、Safari、觸控等未測就保留未測，不能把首輪內嵌 Chromium 的結果當最終支援聲明。不能將宿主編譯延遲藏進「前端慢」，也不能以新前端流暢掩蓋 TD 待機問題。

### Human Takeover Test

**第一個正式切片完成後，請人類在隔離工作副本、不使用 AI／代理提示下，完成一项維護工作。** 這是實際驗收活動，本文件不能預先宣告通過；不要求每個小 commit 都由人類接管。

首選任務：用現有 SDK 新增一個名字／UUID 不同、可用於此 TOP 路徑的 unary 節點，例如呼叫既有 GLSL 函式的節點。可使用 repo 文件、IDE、TypeScript 診斷和普通官方文件；只交付需求、既有開發入口及測試命令，不提供逐檔解答。完成後須在正式頁可建立、連接、產碼並通过測試。這測到「既有能力擴充」，不冒稱也證明新型別或新控制項好做。

人類也可改選：在可退回副本修改一條 connection policy 並驗證 compiler 相容，或修一個當輪真实發現、此前不熟悉的 bug。規則試驗不自動成為產品政策變更。陌生 bug 須有可重現症狀，不臨時捏造一個只為容易通過的 bug。

在既有 review comment 記：

| 觀察 | 怎麼記 |
| --- | --- |
| 找到入口多久 | 從讀需求到指出正確來源的時間；記走錯入口／生成物的次數 |
| 改動責任範圍 | 記實際責任區及檔案；節點定義＋註冊／建置＋測試不是三份業務規則。若需修改 renderer、host 和 compiler 名稱分派則查因 |
| 無關閱讀 | 為完成任務不得不讀的模組，哪些是必要背景、哪些是耦合造成 |
| TypeScript 指路效果 | 是否定位缺欄位／命令／型別，是否反而要用 any 或強制斷言逃掉問題 |
| tests 的信心 | 人類能否找到並執行相關測試、解釋失敗；通過後能否在正式 UI 重現成果 |
| 接管結果 | 獨立完成／卡在哪裡／需要何種提示；請人類口頭說明定義→操作→產碼／顯示路徑 |

建議以 10 分鐘定位、45 分鐘完成小型擴充作**初始觀察窗口**，不是對人的能力打分，也不是所有任務的統一門檻。超過窗口記錄阻礙，不由 AI 偷偷代做後算成功。若時間不合適可另約；在完成前明寫「Human Takeover 未驗證」，不阻擋不依賴其結果的安全工作。

通过標準是可獨立完成、相關測試及正式路徑成立，且沒有被迫修改無關業務分派。失敗先修最近的入口／文件／型別／耦合，再請人類試一次；不藉此全面重寫文件體系。簡單新增節點通過後，後續真正遇到陌生 bug 時再累積維護證據。

## 8. 退回、fallback 與控制工程規模

- 每輪依既有本地 commit 和版本流程留可退回點；不建立 B 專用 role、gate、lifecycle 或 handoff。B 的執行更新既有 STATUS；A 原文保留比較，不並行維護其進度。
- 首輪保留舊入口與可用資產快照；切換前保留未提交文件。未完成提交／手勢不能直接換 renderer；先完成或明確取消，不能悄悄丟掉草稿。同一包的新舊入口使用同源核心與 bootstrap；整包退回則連同對應的測試宿主 bootstrap／程式版本一起核對，不能只換 HTML 留下 catalogHash 不相容。
- 範圍外作品在入口階段明示不支援；使用者可選舊入口開啟其支持的同一份文件。正式新路徑發生錯誤時不能靜默改走舊 compiler／另一個 writer。
- Apply 逾時不代表 TD 沒做；沿既有回覆／版本查明結果，再送下一份。程式退回、TD 最後成功產物和本地草稿分開保存；不要用重載頁面作資料復原。
- 首輪盡量不改保存 schema／host protocol。若後續共享 RF 相容結構需要改序列化，必須隨那個真实功能提供 roundtrip 與資料退回驗證，不靠「形狀相近」略過。
- 評估版原地保留；正式程式可採用已證明且責任合適的控制項／工具函式，連同適用測試移入。不要因「不可整包搬」而把有用程式全部重寫，也不要搬 EvaluationModel、硬編碼場景或例外色票。
- 一个新增 Interface 在當輪沒有正式 caller，就先不合入；不要用未來面板或測試替身替它背書。也不先建立多 renderer 支援、全能 store、通用排程器或事件平台。
- 若第一輪因抽取 app.js 越搬越廣，收回到常數圖的 state／graph history／apply 路徑，用真实反例確定最小依賴；不能為保持「小」刪掉資料保護，也不能順手搬完所有宿主能力。
- 遇到模組重複時，先看是否同一規則；資料欄位改名、UI 草稿和 domain 交易不是需要全部消除的重複。只合併當前案例證明相同的責任。
- 每輪收尾刪除本輪已被替代的臨時路徑，記剩下舊入口服務的實際能力。若每輪只加 Adapter、不增加可用功能、不移除任何被替代責任，立即縮回具體產品情境。

B 案的完成路徑是：**一條正式可用能力逐步擴大，直到接管完整產品，然後關閉舊入口。** 不以「所有 Interface 已整理完」當完成，也不把永久保持一個小型 TOP playground 當成功。

## 9. A／B trade-off comparison

| 比較項目 | A：核心／應用先整理，正式 UI 後接 | B：正式切片共同迭代 |
| --- | --- | --- |
| 實際工程代價 | 前期盤點與契約整理較多；適合缺口已明確且多 consumer 確實要用的部分 | 較早付出建置、宿主、歷史與 UI 整合；少寫未用 Interface，但可能多次局部調整 |
| 技術風險 | 可先隔離核心驗證；正式 UI／宿主組合問題可能較晚出現 | 組合風險提早可見；需限制切片及保護已用入口，避免邊接邊堆補丁 |
| feedback speed | 模型回饋快，人類完整操作回饋較晚 | 第一輪就有真實產品回饋；不是第一天就完成所有功能 |
| 架構學習能力 | 較依賴既有規格與盤點推導，之後由 consumer 校正 | 用真實 caller、失敗案例及 Human Takeover 修正；要防首個簡單場景過度概括 |
| 未知能力處理方式 | 先整理較廣的能力群與依賴；可能提早發現跨領域衝突，也可能花時間回答尚未需要的問題 | 只解當輪必要未知；其他保留 UNKNOWN，風險在後續仍可能遇到結構性缺口 |
| 完成產品的路徑 | 先完成選定核心／應用契約，再逐區接管 UI 與完整整合 | 每輪完成一條含 UI／核心／宿主的操作，累積覆蓋後關閉舊入口 |
| 長期維護風險 | 未使用或過寬 Interface 可能成為負擔；若契約需求正確，後續接入較一致 | 臨時轉接與局部解可能累積；靠實際 caller、每輪刪替代路徑及人類接管驗證控制 |

**依目前 repo，我偏向 B。** 關鍵不是它較少規劃，而是已有真實核心、可用宿主與成功的 RF 評估；接下來最缺的是三者在正式路徑共同工作所提供的證據。A 中版本一致、交易保護、規則單一來源等必要順序保留；不需要把整套核心／應用整理完成，才開始取得這份證據。

