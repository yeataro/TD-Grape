# Uniform 同步邊界研究與方案比較

2026-09-20；研究基準 0.8.154／29b9be5。研究階段沒有修改產品、部署或保存 TOE；使用者先前的「是否只需釐清邊界」是問題，不是方案定案。後續使用者明確同意「照方案先試一個版本」，0.8.155 實作 B 的第一步，見第 7 節。

## 結論與證據範圍

目前證據支持小範圍整理「Uniform 可編輯判斷、來源讀數接收與失效處理」，不需先分割圖文件或導入區塊同步。只刪掉 dirty／submitBusy 等條件不足以完成工作；這些條件承擔的責任需要明確分開並保留真正必要的核對。

第 1–6 節保留研究時的問題、建議及驗收範圍。研究由現有程式、隔離瀏覽器與可清除的 TD 原生測試元件交叉確認；沒有把所有來源種類、跨視窗競爭或網路時序都宣稱已驗證。

- 瀏覽器：10 種圖編輯狀態、10 種保護旗標，另重現同 revision 的舊快照覆蓋新讀數，以及草稿與來源快照版本分離。使用原程式與隔離 API fixture，沒有修改 readiness 函式來取得結果。
- TD：9 項 Apply／原生來源情境，使用真實 Parameter、現有 Live／Gesture、deploy 與回滾；傳輸出口採記憶體記錄，沒有模擬實際網路延遲。測試元件在 finally 清除，核對當時四份使用者 Shader 的 state、graph、manifest、GLSL 前後相同。
- 報告：Documents 工作區 `reports/uniform-protection-review/browser-boundaries/findings.json`、`native-findings.json`；原生原始報告在私人 `work/reports/uniform-protection-review/native-boundaries/`。

## 1. 現況的責任分工

| 資料／操作 | 實際所有者與現有核對 |
| --- | --- |
| 正在編輯的圖 | 瀏覽器工作副本，保存草稿與基準 revision；送出後仍可有更新的本地編輯。 |
| TD 保存的圖文件 | TD state 的 graph＋revision；完整 Apply 以 expected revision 防止覆蓋另一份圖。原生來源同步也能更新宣告並增加 revision。 |
| Shader 編譯結果 | TD 的 GLSL／manifest／實際 TOP 或 MAT；它與瀏覽器草稿、來源剛同步的圖文件不保證每一刻相同。 |
| 來源身分 | 圖的 declaration ID 對應既有原生 registry，再定位 TD Parameter；不是靠畫布上有幾個 Uniform 節點來建立實體。 |
| Uniform 即時值 | TD 原生 Parameter；Binding 追到實際可寫的 master。Expression／Export 或最終不可寫目標拒絕修改。Constant master 可以可寫，不能以「是 Master」直接停用。 |
| 網頁讀數 | 來源 HTTP 快照與 WebSocket 即時訊息目前會更新同一份 components；不是圖文件中的預設值。 |
| Undo／Redo | 圖歷史、source-scoped 原生 checkpoints、live gesture receipts 已分工，仍共用操作順序及部分版本核對。 |

程式位置：`app.js` 的 `performApplyGraph`／`undo`；`inspector.js` 的 `receiveNativeSources`／`nativeSourceRequest`；`sgrape_sources.py` 的 `sync`／`snapshot`／`write_value`；`sgrape_live.py` 的 `Source`／`Gesture`；`sgrape_history.py` 的 `restore`。

## 2. 已確認的問題與限制

### 2.1 全域可編輯判斷把圖差異當成來源失效

`sourceReady()` 受圖草稿、Apply、原生操作、錯誤與快照 revision 限制。`uniformValueReady()` 只額外放行 `hasShaderChanges()` 認為是 layout 的情況，而且沒有來源 ID／分量參數。`renderNativeSourceValues()` 先算一次 valueReady，再套給所有 Uniform。

隔離瀏覽器的下列操作都沒有改變來源宣告，卻會使 uGain 不可編輯：流程外刪除、流程外 Combine 型別、流程內外分量名稱、引用節點自訂名稱、流程內常數值。移動節點則維持可編輯，與 0.8.153 修正一致。

這裡不能只新增「無關操作白名單」。即使確實改變運算結果，也不代表 Parameter 已失效；判斷主體應是要寫入的來源與分量。

### 2.2 重新編譯未必替換 Parameter

`sgrape_sources.configure()` 已有保留既有原生列、Par、Expression、Export、Bind 的路徑。原生研究結果如下；同一個測試中，先開始 uGain 手勢、寫入 0.41，執行 Apply，再嘗試寫入 0.51。

| 操作 | 實際 GLSL 改變 | uGain 仍是同一個 Par | 既有手勢繼續寫入 |
| --- | --- | --- | --- |
| 移動節點 | 否 | 是 | 成功 |
| 刪除流程外節點 | 否；仍走完整套用路徑 | 是 | 成功 |
| 流程外 Combine 改型別 | 否；仍走完整套用路徑 | 是 | 成功 |
| 流程內改分量名稱 | 否 | 是 | 成功 |
| 流程內改常數值 | 是 | 是 | 成功 |
| 引用節點改自訂名稱 | 是 | 是 | 成功 |
| 新增另一個來源 | 否 | 是 | 中斷 |
| 另一個來源改名 | 否 | 是 | 本次直接呼叫測試成功 |
| 注入 Apply commit failure 並補償回滾 | 最終恢復原 GLSL | 是 | 本次成功 |

限制：改名與回滾結果只代表這次直接呼叫、回呼排程與測試圖；不能据此取消所有 metadata 通知，也不能推論未知失敗或失聯後必然安全。TD API 與編譯在主執行緒；控制項保持可用不等於編譯時完全沒有處理延遲。

### 2.3 來源結構通知仍可能使無關手勢失效

`Source.check()` 除了直接核對 registry、Par 身分、名稱及型別，還要求整個 Shader 的 `metadata_epoch` 不變。列數變動會推進這個共用標記。

測試新增 uAdded 時，uGain 的 Par 完全相同，但共用 epoch 從 0 變 1，tick 清除了它的訂閱與手勢。這是另一個邊界，不是前端取消 dirty 判斷就會消失。來源列表變動可以觸發重查，不必直接等同所有原生目標已變；重查時仍須檢查原生列搬移、Par 替換與 Binding 最終目標。

### 2.4 graph revision 不能排序即時數值

`uniformLive.acceptValues()` 更新快照內的 components；`receiveNativeSources()` 則接受 revision 不小於目前圖 revision 的整份快照，沒有獨立的值先後規則。

重現順序：revision 100 的 HTTP 快照含 0.25 → 較新 live 值 0.9 已顯示 → 延遲的 HTTP 快照到達且 revision 仍是 100 → 畫面退回 0.25。這是瀏覽器讀數回退；本測試沒有因此把 TD 的值改回去。後端 expected-value 核對仍可拒絕過期寫入。

另一項重現：本地有常數草稿時收到 revision 101 的來源快照，草稿被保留，瀏覽器圖的基準 revision 仍是 100，而來源快照已是 101。這種分離本來可以存在；不能为了讓值解鎖就把草稿基準改成 101，否則下一次整份圖提交可能掩蓋真正的圖衝突。

### 2.5 多個布林入口的語義不一致

`uniformValueReady()` 先接受 `sourceReady()`，再考慮較嚴格的 layout 分支。當圖乾淨且快照 revision 相符，單獨設置 conflicted／applyNeedsReview／connectionInterrupted 並不必然讓第一條路徑失敗。這是現有 gate 的隔離旗標結果，不是聲稱每種組合都已在實際網路中到達，也不等於後端會接受錯誤寫入。

反過來，`nativeSourceError` 是整體錯誤欄位，個別來源請求失敗也可能影響全部控制項。另有 `ignoreValueWrite=true` 使數值送出時保留正常外觀、實際仍短暫 inert 的設計。因此需分別表達「目標可寫」「請求等待中」「來源失效」「圖保存衝突」，不能只加另一層 OR 來放行。

## 3. 方案比較

| 方案 | 能解決什麼 | 問題與範圍 | 建議 |
| --- | --- | --- | --- |
| A. 放寬全域 gate，或把更多修改歸類為 layout | 部分灰掉可快速消失 | 無法涵蓋真實編譯而來源不變、舊快照回退及共用 epoch；也容易讓改型別／換來源的草稿繼續寫舊目標。 | 不作完整方案。 |
| B. 保留整份圖傳輸，局部整理來源可編輯狀態、讀數接收與失效範圍 | 對應本次回報，沿用已存在的來源 ID、原生身分檢查與歷史 | 需改少數現有前後端接點與測試；不只是 CSS 或刪掉一個 if。 | 建議。 |
| C. 拆圖結構／layout 文件、區塊版本與增量傳輸 | 可處理之後的大圖傳輸或協作需求 | 要處理跨區塊刪除、接線、來源、Undo、提交原子性與舊檔相容；單獨做仍不能解決值讀數的順序。 | 本問題沒有足夠必要性。 |

## 4. 建議 B 的具體邊界

### 4.1 判斷對象改為一個來源／分量

現有 sourceReady 暫保留為來源結構操作的保守入口；数值入口改為接受 declaration ID／分量的共用判斷。畫布、Inputs、Parameter、Color picker 與 live begin 都使用同一份判斷結果，不能只解除 disabled 而 request 仍拒絕。

應確認：目前 Shader／載入世代有效；該來源已存在；草稿中的來源定義與原生對應相容；該分量模式及最終目標可寫；沒有該來源自己的配置或失效待核對。名稱、型別、sequence、缺失標記、Binding／舊 expose 造成的目標變化都需被涵蓋；不要只比較名稱與型別。

dirty、無關節點差異及 Apply 中本身不構成失效。真正正在改這個來源定義時仍暫停它；不把新草稿的型別或來源偷偷套到舊原生目標。

### 4.2 保留圖的版本保護，分開調值路徑

- 圖提交仍送整份 graph＋原基準 revision；外部圖衝突不自動重試覆蓋。
- Live 沿用伺服器已建立的來源訂閱與 Source／Gesture 身分核對。普通圖提交可以等待主執行緒处理，但不因 graph revision 增加就宣布全部来源失效。
- REST 調值保留目前的 revision 與 expected-value 核對。遇到自己的 Apply 在途，先排隊，回覆後取得／確認當前來源快照，再檢查同一來源與原先預期值。不能把舊 expected 值改成新值後盲目重送。
- 圖草稿的基準 revision、最新來源快照 revision 各有用途；不透過推進草稿基準來消除來源可編輯問題。未知來源身分與未知提交結果先核對，不能僅以 GLSL 一樣作為證明。
- 圖內容有誤或編譯失敗時，只要舊 Shader／Parameter 身分仍可靠，可保留其值操作；是否成功回滾需有實際依據，不能把所有 exception 當成安全回滾。

### 4.3 為來源快照與即時值指定接收規則

建議先採較小的改動：已成功訂閱且世代有效的來源，以 live 訊息維護其數值讀數；HTTP 列表刷新處理來源結構，不用較舊的 components 蓋回 live 讀數。兩種資料仍可放在現有來源 view model，不新增第二份來源清單。

新訂閱、斷線、重新連線、來源換型／換實體需要明確交接：丟棄舊訂閱世代訊息；確認 metadata 後重新訂閱或以新的 HTTP 讀取接手。REST 寫入成功後，也不能接受寫入前已發出的舊讀取覆蓋結果。

若實作中證明必須同時任意混用兩條通道的數值，才補伺服器可比較的 per-source generation／sample sequence；不能用到達順序、瀏覽器時間或 graph revision 猜值的新舊。暫不需要改持久化圖 schema 或導入整套多版本同步框架。

### 4.4 來源列表變動先重查，再縮小失效範圍

第二步處理 metadata_epoch：保留「列表需要重查」訊號；在 reconcile 後，用現有 ID、registry、實際 Par 與 Binding 目標核對已訂閱來源。未改變的來源可以更新核對依據，變動的來源停止手勢、刷新或重新建立訂閱。

這項核對安排在來源結構變動時，不放到每次滑桿值更新掃描整份列表。移動／刪除原生列可能影響鄰居，不能只看這次 action 指定的 ID；結果應依實際前後身分計算。

### 4.5 沿用操作歷史的分工

保留 live receipt、source-scoped checkpoint、原始欄位 delta 與圖歷史顺序。待送值、取消、Apply 成功／失敗後的 Undo／Redo 必須一起驗證；不以同步成功時的整張圖覆蓋較新的瀏覽器草稿。

目前没有證據要求重寫整套 Undo。若測試發現局部改動無法保住跨操作順序，再單獨提出必要擴展，不能先假定可刪除 historyBusy。

## 5. 建議實作順序與可交付範圍

1. **先處理本次已回報的普通圖編輯**：來源／分量判斷、Apply／REST 交錯、快照與 live 讀數順序。涵蓋數值 Uniform 與 Color 的共用控制，保留來源結構操作及 Spec Constant 等原有不同語義。這一步完成後應解決流程內外節點修改使未變來源灰掉的問題。
2. **再處理來源結構改變的局部恢復**：新增／改名／刪除／移動原生列只使实际受影響來源失效。這是原生研究額外確認的邊界；第一步若尚未完成它，須明確保留目前結構變動時的短暫重查限制，不能宣稱所有來源互不影響。
3. **獨立評估不必要的重編譯**：流程外修改造成相同 GLSL 卻仍走完整套用，可另改善效能。它不應是讓 Uniform 保持可用的前提，也不和本輪一起修改 compiler hash 的定義。

主要接點是 `app.js`、`inspector.js`、`uniform_live.js`，以及 `sgrape_live.py` 的來源失效／核對。只有需要回傳可靠確認資訊時才補 `sgrape_runtime.py`／`sgrape_sources.py`；不先更動編譯器、節點定義、圖格式、TD 拓樸、整套歷史或來源建立規則。

## 6. 驗收要求

| 情境 | 預期 |
| --- | --- |
| 本次回報的流程內外刪除、常數值、型別、名稱、分量名稱 | 未變來源能開始／持續／結束操作；來源定義真的變動時例外。 |
| 自己的 Apply 回覆延遲、值寫入先後交错 | 不發舊版 REST、不失值、不覆蓋新草稿，等待與失效區分。 |
| 同 revision 舊快照落後於 live 值／REST 寫入 | 讀數不回退；顯示與下一次 expected 值一致。 |
| 新增其他來源（第二步） | 可確認未變的原生目標保留操作；真正被移位／重建者停止。 |
| 本來源改型、刪除、移位、同名重建、Binding 換目標 | 拒絕寫到舊目標；不以相同路徑／名稱當成同一個 Par。 |
| TD 外部改值、另一個視窗同時編輯 | 保留原生值比較／單一分量寫入者規則，不暗中重試覆寫。 |
| 編譯失敗、部分配置失敗、回滾、斷線未知結果 | 只在重新確認後恢復；不假定所有失敗都沒有副作用。 |
| 切換 Shader、訂閱交接、頁面隱藏／重開 | 舊世代訊息和待送值不能流入新對象。 |
| Graph／Value／Source 的 Undo／Redo 交錯與取消 | 順序、欄位範圍及外部改值保護維持。 |
| Matrix／Array／Buffer／Attribute／Spec Constant | 原有來源設定、型別與數據限制不被一般 Uniform 放行邏輯擴散。 |

以上是待實作的驗收條件，本輪 9 項原生與隔離瀏覽器研究不代表整張表已通過。實作後需使用實際 Editor→TD 連線與刻意延遲回覆驗證，而不只依賴直接呼叫或 CSS enabled 狀態。


## 7. 0.8.155 第一版實作

使用者批准先試 B 的第一步。本版保留完整圖文件、Apply、編譯語義與圖 revision 保護，沒有導入區塊同步或第二份來源清單。

- 數值 Uniform／Color 按來源 ID 與分量核對。草稿的名稱、型別、native sequence、expose、缺失狀態須與原生快照相符；來源自己的定義改變時暫停該來源。一般節點的刪除、接線、常數值、顯示名稱、分量標籤與 Apply 本身不再讓未變動來源灰掉。Matrix／Array／Buffer／Attribute／Spec Constant 與來源結構設定沿用原入口。
- REST 調值等待本視窗 Apply 成功，再讀取來源、核對身分並用新的來源 revision 送出；原始 expected component 不修改。Apply 失敗則取消待送值並重新確認來源。確認後可以恢復數值，圖衝突及草稿基準仍保留。確認時若乾淨圖接收到外部圖更新，不把外部更新記進調值的 Undo。
- 已訂閱來源由 WebSocket 維護 components，HTTP 更新 metadata。HTTP 讀取、訂閱回覆若早於後續寫入／Undo／通道交接，不能覆蓋新結果。來源快照 revision 不得倒退；图草稿 revision 不隨之偷偷推進。
- 全量 UI 重畫時，新控制項尚待首次可見性量測不代表來源離開畫面，因此保留舊訂閱至量測完成。真正移出畫面仍退訂。已提交且仍聚焦的數字欄位可跟隨確認讀數與 expected 值；尚在輸入或拖曳的值保留。
- 原生 component 多一個只存在於 session 的不透明 identity，核對實際 Par、Binding 最終目標及捕獲的 owner ID／parameter index。實測 TD 可讓舊 Par wrapper 指向同名重建物件，單靠路徑或 isSamePar 不足。REST、live gesture 與後續 native Undo 共用此核對；identity 不存進圖或 TOE。
- Undo／Redo 保留既有 source checkpoint、live receipt 與欄位範圍，只共用來源讀數的接收規則及讀取失效界線。

隔離測試涵蓋來源局部 gate、semantic Apply 與 REST 排隊、較新草稿、外部改值、Apply 衝突、HTTP／live／subscribe 的延遲回覆、通道交接、型別模式與 source/history 回歸。TD 測試另檢查 200 個來源、100 次手勢更新，不在每次更新掃描清單或編譯；真正重新產碼仍保留 Par，同路徑、同值的 Binding master 重建會拒絕舊 REST 與既有手勢。完整 Editor→TD 測試使用獨立元件，在 loopback／私人網路刻意延遲 Apply 及 HTTP 來源回覆，驗證手勢、REST、讀數、重開與圖／值 Undo、Redo；測試結束移除元件，核對使用者 Shader 未變。

報告：Documents 工作區 reports/uniform-boundaries-155/ 與 reports/uniform-boundaries-155-portable.log；TD 報告 work/reports/uniform-boundaries-155/。完整交付檢查與測試數量另記 docs/development/STATUS.md。

**仍保留的限制：**原生來源列表變動的共用 metadata_epoch 重查／失效機制尚未局部化，新增、刪除或移動原生列仍可能短暫影響其他來源。來源設定與失聯等狀態未確認前仍暫停操作，REST 寫入的短暫 inert 與歷史序列化仍保留。本版不宣稱所有來源結構變動、任意網路時序或外部圖衝突下的全部歷史操作都互不影響。Phase 2 及跳過無效重編譯仍是後續獨立工作。
