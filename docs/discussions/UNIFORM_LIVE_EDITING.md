# Uniform 連續編輯與按需同步評估

2026-09-18。狀態：原始碼調查、隔離瀏覽器重現與官方機制核對；尚未修改產品傳輸或來源控制方式。這是獨立於 Matrix 的調查評估，不將候選方案當成已批准的實作。

## 問題與能力邊界

- Uniform 已在 TD 建立，即使圖內沒有引用它，編輯器修改其原生目前值仍是正確行為。
- 希望 Slider／Value Ladder 拖曳期間，TD 能連續接收值，預覽隨之變動。放開手勢時保證最終值完成，整次手勢只形成一筆 Undo。
- 原生參數仍決定目前值及控制模式。編輯器不為連線而取代使用者的 Expression、Export 或 Bind，不新增每幀數值精度檢查或超限回退。
- TD 執行 Shader 所需的資料流，與網頁為顯示數字而訂閱的資料流分開。來源一直變動，不代表編輯器一直需要接收它。
- Uniform 的值更新不等同來源新增／改型，也不等同 Graph Constant 或 Spec Constant 的修改成本。

### 已確認要求：持續同步不得造成整體介面反覆閃動

使用者明確要求將此問題記為後續功能的驗收條件，避免連續通訊之後，所有數值框、Parameter 編輯區、Inputs／Sources 新增及引用入口、Apply Shader 和其他編輯按鈕持續一起閃動。此要求適用於未來 HTTP／WebSocket 或其他連續同步方式，不是某一個 Uniform 欄位的外觀特例，也不表示現在就實作通訊重構。

- 普通同步與手勢中間值更新，不得反覆切換整體 `nativeMutationBusy`、無關控制項的 disabled／inert 或停用樣式。
- 驗收同時檢查亮度／顏色、焦點、正在輸入的草稿，以及控制項能否操作。單純移除透明度樣式卻仍反覆鎖住操作，不算解決。
- 分別測瀏覽器 → TD 連續寫入、TD → 瀏覽器變更回傳，以及雙向同時有活動的情境；不能只測放開後的一次提交。
- 真正的唯讀、缺失來源、衝突或結構修改仍應有正確狀態；不要為了消除閃動而隱藏問題或移除必要互斥。
- 目前普通 TD → 瀏覽器讀值不走全域寫入等待流程。未來風險在於沿用錯誤的共用流程，不能籠統推論「一直同步必然一直閃」。

## 已查明的現況

檢查位置：`src/editor/inspector.js` 的 `nativeInputFields`、`nativeSourceRequest`、`receiveNativeSources`、`renderNativeSourceValues`，`src/editor/graph_ui.js` 的 `renderGraphEditActions`，`src/editor/app.js` 的 `renderHistoryActions`，以及 `src/editor/style.css` 的 disabled 規則。

| 階段 | 現在的行為 |
| --- | --- |
| 拖曳中 | Scrub／Value Ladder 只更新本地欄位，沒有傳送 Uniform 值。 |
| 放開 | 一次 `POST /api/source-value`，設定 busy，Inspector inert，欄位 disabled。 |
| 等待 | 共用 busy 狀態停用多處控制項；一般按鈕 opacity 降至 0.4，數字框降至 0.48；部分工具列另以文字／底色表現停用。輸入焦點離開。 |
| 完成 | 解除 busy，恢復各控制項可用狀態及外觀，記錄一筆歷史，再做一次 `GET /api/sources`。 |
| 回覆帶來 revision 變更 | 可能重新 render 並重建 Inspector。單純同 revision 更新不必重建。 |

隔離 headless 重現：Scrub／Value Ladder 各測同 revision 與變 revision，共四例；回覆加入人工 600 ms 延遲。四例均觀察到上述 disabled／opacity 切換；同 revision 保留原 DOM，變 revision 才替換；沒有數值回跳。這證實一條足以產生回報閃動的路徑，不是實際網路延遲量測，也不表示所有閃動都來自同一原因。

使用者後續明確指出是多處一起閃：其他數值、Parameter 區域、Inputs 新增／引用按鈕及 Apply Shader。原始碼可追到同一個 `nativeMutationBusy`：`renderHistoryActions` 停用 Apply／Reload／Undo／Redo、畫布 `.node-inline-values input`，並將 Inspector 設為 inert；`renderGraphEditActions` 更新 Paste／Group／Delete 等編輯按鈕；`renderNativeSourceValues` 另更新 `[data-input-reference]`／`[data-input-create]` 與原生來源欄位。inert 本身不等同降低透明度，具體視覺變化取決於各控制項 disabled 樣式。最初只以數字框的 48% 解釋，未完整涵蓋這個共用狀態的影響範圍。

擴充隔離診斷已使用當時同步主版本 `5c087ec`，分別在 Professional／Cool 外觀重現：同一次 Uniform 提交讓 Apply／Reload、Inputs 的四個新增與兩個引用按鈕、Parameter 的十三個 input／七個 button，以及三個無關畫布數值框一起切換停用狀態。Cool 模式的 Apply 光暈因 `#apply:enabled` 規則由原值切到 none 再恢復；浮動 Undo／Redo 則改背景／文字色。兩例均同 revision、Inspector childList mutation 為零，仍重現整片閃動；各一次 POST、一次 Undo、無頁面錯誤。Custom Parameters 沒有可見實例，尚未對其欄位作同等重現。

使用者進一步觀察到只有瀏覽器 → TD 的修改會閃，TD → 瀏覽器的普通值更新不會。原始碼與此一致：讀取用的 `refreshNativeSources` 設 polling flag，不進入寫入的 busy／disabled 流程；單純回填目前值不切換可寫狀態。若來源模式、結構或連線狀態改變，仍可能更新可寫性或重建畫面，不能延伸為任何 TD 端修改都絕不閃動。

Uniform 不是唯一與 TD 相連的功能。已同步主倉的 Spec Constant 共用 `nativeInputFields`／`nativeSourceRequest`；自訂參數的 `customRequest`、公開 Uniform／Sampler 控制的 `writeUniformInput` 也會設定 native mutation busy 並更新欄位 disabled。因此同類副作用需依共享流程盤點，不能只修 Uniform 特例。這些其他入口是程式碼核對，尚未逐項完成瀏覽器重現。一般節點本地值則經圖修改／Apply 路徑，不等同直接寫原生參數。

伺服器的普通 `source-value` 處理流程，依 `sgrape_runtime.history_operation`、`sgrape_sources.write_value/snapshot`、`sgrape_history.capture/attach`，合計呼叫三次 sources sync、兩次完整 snapshot、兩次 history capture；瀏覽器隨後 GET 又增加一次讀取路徑。`locate` 每次重建 native rows，逐來源查找的部分為 O(來源數 × 原生列數)。`sync` 還進入整圖 Python 驗證／產碼。這些都是程式路徑與複雜度，尚無毫秒成本結論。

普通 Uniform 值寫入本身不改 graph revision，也不呼叫 Shader deploy。結構同步若順便發現原生來源新增、刪除或改名，才可能改 revision。不能把這條路徑的 Python 產碼稱作每次都在 GPU 重新編譯。

目前 HTTP 使用工作執行緒接收請求，TD 的 `tick` 在主執行緒每輪至多處理兩個一般 job。不是每個 HTTP 等待都在阻塞 TD 主執行緒；但 job 內的完整來源掃描與歷史整理確實在主執行緒進行。

**結論：**閃動與連續性先是編輯流程問題。WebSocket 適合持續雙向通訊，但把現有 `source-value` 原封不動搬上 WebSocket，仍會保留停用欄位、完整掃描及逐次 Undo 的問題。

## Python 物件 Binding 的適用範圍

TD 原生支援 Parameter 綁到 Dependency，以及 `(object, attribute)` 的 bind tuple。普通 Python attribute 不會自動具有變更通知；要達成雙向更新，該屬性必須 dependable。bind tuple 可經過 Python property setter；直接綁傳回的 Dependency 則不等同經過該 setter。[Binding](https://docs.derivative.ca/Binding)

Dependency 的值改變會使相依者需要重新計算；官方文件也列有 callbacks。它不是網路傳輸，也不能因此推論所有相關 Python 工作為零成本。直接更改包在其中的 list 成員不一定發出通知，需要適當的 dependable collection 或明確通知。[Dependency Class](https://derivative.ca/UserGuide/Dependency_Class)

如果將所有原生 Uniform 改綁編輯器的 Python 物件，該物件會成為新的 bind master，原先的來源模式便受到影響。這不符合本專案保留原生控制權的要求。它可以是未來明確建立、由 Grape 擁有的來源的一種實作選項，不能作為現有 Uniform 的透明替換。

單純的顯示鏡像不需要成為 Uniform 的 bind master。候選方式是觀察原有參數事件，把需要顯示的變更放到暫存佇列；該暫存是可丟棄的 UI 資料，不是另一份來源真值。是否使用 Dependency 作鏡像，需有實際相依者才有意義。

## 建議的更新協定

以下是實作設計候選，尚未啟用。

| 訊息 | 工作及回覆 |
| --- | --- |
| `subscribe`／`unsubscribe` | 指定已授權 Shader 的來源 ID 及需要的欄位。訂閱聯集可合併，但按瀏覽器會話管理生命週期。 |
| `begin` | 核對來源身分、結構世代、控制模式、可寫性及分量集合；解析實際可寫 Par／允許的 Bind master，保存起始狀態，取得短期手勢識別碼。 |
| `update` | 帶手勢 ID、遞增序號，以及 begin 時固定分量集合的完整最新值。每個手勢只保留最新尚未套用的更新；只處理這次修改的參數。若未來允許部分分量封包，必須改成按分量合併，不能只保留最後一包。 |
| `commit` | 自帶最終值和序號；保證最終值套用後才回覆完成。收束手勢並建立一筆歷史；相同手勢 ID／序號重送回傳既有完成結果，不重寫或新增 Undo。 |
| `cancel` | 若來源控制權與目前值仍屬本手勢，才回復起始值；有外部修改時停止並保留外部結果。 |
| `changed`／`applied` | 只回來源 ID、數值／模式差異、世代、版本及序號，不回整張圖。`applied` 表示 TD 接受值，不保證遠端預覽已顯示該幀。 |

- 瀏覽器立刻顯示自己的拖曳值；舊回覆不得覆蓋較新的本地手勢。處理中不使整個 Inspector inert，不用完整 DOM 重建表示值已更新。
- 不因一次數值寫入反覆切換無關按鈕、Inputs 新增入口及畫布數值框的停用樣式。需要互斥的 Apply／結構編輯另定明確的會話規則；不能只移除變暗 CSS，卻保留整個編輯器被短暫鎖住的行為，也不能直接解除互斥而破壞衝突保護。
- 瀏覽器先合併 pointer events，再以有上限的頻率傳送；後端再合併尚未套用的值。最終 commit 是必須確認的控制訊息，不隨一般中間值丟棄。
- TD 只在待處理集合非空時寫參數。可沿用既有主執行緒服務點，不新增一個掃描所有 Uniform 的每幀 Python 迴圈。每輪寫入有數量／時間預算，避免網路積壓拉長一幀。
- update 對主動輸入做訊息形狀、分量數與合法值檢查，並核對目標身分／可寫模式。這是處理一次編輯的邊界檢查，不是監管 TD 自行產生的每幀數值。
- 來源刪除、換 Shader、參數替換或外部改模式會使會話失效。對同一分量的多編輯者衝突需明確回報；不默默重接來源或強制覆寫。
- 數值手勢的 Undo 應記錄實際寫過的分量及 before／after，與既有瀏覽器歷史整合。不可把手勢期間他人修改的其他來源一起撤銷；TD 全域 Undo block 不能跨網路等待一直開著。
- 候選斷線政策：保留最後已套用值，把該段手勢收束成可撤銷編輯；重連讀實際目前值，不重播未確認的舊值。這個可見行為仍須確認，不能靠 timeout 擅自恢復外部值。
- 完成結果按會話短期、有上限地保留，處理 commit 成功但回覆遺失的情況；結果過期時明確回報無法確認並重新讀取，不把舊 commit 當成新的手勢。

## 雙向同步不表示所有數值一直回傳

目前 `uAbsTime` 預置寫入 `absTime.seconds` 表達式（`sgrape_sources.PRESETS`）。其 TD 執行不需要網頁參與。

候選顯示策略：一般顯示來源名稱、型別、控制模式及來源設定；活動編輯或明確需要顯示目前值的欄位才訂閱值。時間類來源不因一直變動而自動廣播；若使用者要求即時數值檢視，才為該來源啟用有上限頻率的唯讀顯示。不要用瀏覽器自行推算的時鐘冒充 TD 的精確值。

可見來源的原生變更可評估 Parameter Execute DAT：只監看指定 OP／參數，callback 記錄 dirty，再批次發送差異。它不主動 cook 被監看的 OP，因此不能承諾未 cooking 的動態來源也每幀更新；這有助於避免為 UI 強制烹調。[Parameter Execute DAT](https://derivative.ca/UserGuide/Parameter_Execute_DAT)

頁面隱藏、來源面板離開、Shader 切換或最後訂閱者離線時，取消不需要的數值訂閱。來源結構與模式變更仍需獨立失效通知，避免停止輪詢後遺漏原生改名、刪除或 Bind 變更。現有每秒 sources／自訂參數輪詢不可與新訂閱機制無意並行；替換須涵蓋其現有職責。

已有 `sgrape_parameter_links.onValueChange` 每次掃全部 owned links，服務原生控制改名／消失後的恢復。它不是數值 UI 訂閱，不能跟著面板關閉直接刪掉。若要避免連續寫入帶出全量掃描，需另做依 changed Par 定位相關 link 的等價優化，保留既有恢復行為。這也是本次評估識別出的必要相依工作。

## 傳輸與主執行緒

| 候選 | 優點與需驗證事項 |
| --- | --- |
| TD 原生 Web Server DAT | [已有 WebSocket 支援](https://derivative.ca/UserGuide/Web_Server_DAT)，免自寫 WebSocket 協定。可先作最小探針；Python 回呼的實際成本、訊息積壓及發送慢客戶端時的行為需量測。原生網路功能不等於回呼沒有主執行緒成本。 |
| 背景 WebSocket 服務＋有界佇列 | 可把 socket 等待與編碼處理移出 TD 主執行緒，在觸碰 TD 前合併更新；但增加生命週期、套件與部署維護，Python GIL 也不代表 CPU 工作與主執行緒完全隔離。若採用，應用成熟協定實作。 |
| 保留 HTTP，先拆出輕量手勢路徑 | 同樣能解決閃動及改善拖曳，不足以單凭 HTTP 判定無法連續更新；TD → Editor 的主動回傳仍需別的機制。適合作為量測對照。 |

評估順序建議先以原生 Web Server DAT 驗證相同的輕量訊息模型，再依主執行緒時間與壓力測試決定是否需要背景服務。Uniform 通道與 Remote Panel 預覽的 session、訂閱、開關分離；預覽關閉時仍能編輯 Uniform。是否共用底層 listener 是工程選擇，不讓預覽模組擁有來源控制權。

不在背景執行緒讀寫 OP／Par 或更新會通知 TD 相依者的物件；背景端僅持有普通 Python 訊息，實際 TD 操作回主執行緒。[Python threading in TouchDesigner](https://derivative.ca/UserGuide/Python_threading_in_TouchDesigner)

## 連線安全與負載

- 沿用產品已授權的本機／LAN 存取邊界；WS 握手及會話驗證需核對 Origin、憑證與 Shader 存取權，不能因 localhost 或已能看 Preview 就直接允許寫來源。
- 瀏覽器 WebSocket 的認證方式須配合實際 API；可考慮經既有認證 HTTP 換短期單次票證，避免長期憑證進 URL 日誌。這是設計候選，不新增另一套帳號。
- 只允許已授權 source ID 和窄化的數值命令，不接受任意 OP 路徑、Python expression 或 eval 內容。變更來源表達式仍屬另一個明確的既有編輯操作。
- 限制連線、活動會話、訊息大小、批次項目與待處理數量；慢客戶端的數值差異合併成最新值，控制回覆與最終提交不能無限堆積。classic WebSocket 不會自動替應用程式處理背壓。[MDN WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- 基本長連線維護與已有 runtime tick 仍有成本；目標是沒有不需要的 Uniform 掃描、數值求值、序列化和傳送，不能宣稱整個程序零成本。

## 實作前的最小驗證

1. 固定值拖曳、手填及多分量 Ladder：中途 TD 值會改，欄位不閃、不失焦，最終值一致，一次手勢一筆瀏覽器／TD Undo。
2. Expression／Export／Bind、原生手動更改、控制改名／刪除、多編輯器競爭：不取代原生來源，錯誤或取消不回滾他人修改。
3. 斷線、重連、來源切換、TD 暫停、慢接收端：有界積壓、不重播舊值，清理訂閱與編輯會話。
4. 分別量測總來源數與活動訂閱／寫入數：例如 1、100、1,000、10,000 個來源模型，固定只拖一項；能在 TD 建立的實際原生規模另記。測主執行緒耗時、最差幀時間、訊息與回呼次數及記憶體，不把合成資料測試當原生規模保證。
5. 未開 Editor、無訂閱、隱藏頁面及時間來源：新通道不產生全量數值掃描；既有 Bind 恢復成本另外列帳。測試中 GPU Shader、圖 revision 與既有來源關聯保持預期。

Sources 面板的呈現設計可依這份調查再展開；改名方向和來源引用圖示另記在 [Inputs／Sources UI 筆記](INPUTS_UI_NEXT_ROUND.md)，不與傳輸方案綁成同一次實作。
