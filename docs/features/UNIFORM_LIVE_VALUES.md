# Uniform 即時數值（0.8.118）

2026-09-19：先交付 Uniform 連續編輯，再從實際需求抽出共用能力；不先建立完整 TD 遠端 OP／Parameter 管理架構。開始前固定 `checkpoint/pre-uniform-live-0.8.117`（`c9212f6`，含已驗證 TOE）。

## 本批範圍

- 原生 scalar／vector／Color Uniform 的四個數值分量，包括 dormant 分量；Grape 擁有的 Bind 可編輯原本 COMP master。
- Slider、Value Ladder 拖曳中更新 TD；文字／bool 提交也使用同一連線。TD 保有值與控制模式的所有權；Expression／Export／非本產品擁有的 Bind 不被改寫。
- 圖存檔、產碼、Shader apply、Spec Constant、矩陣 driver／literal 編輯、CHOP 路徑／資料、舊 Expose 介面保持既有管道。這不是「所有 TD 狀態都已改成 WebSocket」。

## 通訊與成本

HTTP 維持既有入口；經過現有 Host／Origin／token 驗證的 `live-ticket` 簽發 10 秒、一次性、指定 Shader 的 ticket。原生 Web Server DAT 提供獨立 WebSocket port；不自行實作 WebSocket framing，不依賴外部套件。直連 LAN／Tailscale 使用同一主機的這個 port；若使用反向代理，還需轉發它。連線錯誤不關閉 HTTP 編輯器。

所有 TD API 仍在主執行緒。`begin → update → commit/cancel` 固定原生 Par identity、型別、控制模式與初值。瀏覽器最多一個 update 在途，其餘移動合併成最新值；commit 攜帶最終值，不依靠最後一個 pointermove。更新不解析圖、不掃全部來源、不產碼、不保存圖。UI 不套全域 busy／inert／disabled。

僅有選取的來源訂閱時，每秒至多 30 次讀取該來源四個分量，內容改變才回傳。來源名稱／型別由按需建立的 Parameter Execute DAT 通知；每秒只比較固定幾個 sequence 的 block 數以補新增／刪除。連線正常且圖版本相同時，停用原本一秒一次的完整 sources polling。需要新版本或 inventory 改變時才取完整快照。最後一個訂閱關閉時移除 observer；沒有 live client 時 tick 立即返回。

第一次實作曾用每秒掃名稱／型別，在 200 來源的實測為約 26 ms，因此未交付該版本。改成事件後，同 fixture 的 sequence 數檢查加選取值讀取約 0.07 ms；100 次分量更新平均約 0.013 ms、最大約 0.037 ms。這些是該機 TD 端測量，不含網路、瀏覽器或使用者自行附加的 driver／callback 工作，不代表跨裝置延遲保證。

## Undo、衝突與連線恢復

- 手勢結束只記一筆瀏覽器 history 與 TD Undo；TD Undo block 不跨網路等待。
- Escape 在值仍屬於本手勢時恢復初值；外部改值／改 mode／換 Par 後保留外部狀態並拒絕覆寫。同分量同時只允許一個 writer。
- 斷線保留 TD 最後接受的值並結束手勢。瀏覽器以 gesture ID 經 HTTP 查回回執，不重播 buffered values。Undo/Redo 的 HTTP request ID 可辨識重試；回執在記憶體中有界保存（256 手勢／128 次恢復），不寫進圖或 TOE。
- 頁面退到背景關閉即時連線；回到前景重新取票、讀快照與訂閱。保留圖草稿；不重新載入整頁。
- 顯示 `Uniform live`／連線中／即時連線中斷；斷線仍可單次 HTTP 改值，圖編輯不被停用。
- 新增／移除來源、換型別或 control 等結構變動可中止正在進行的手勢；重新確認來源後再編輯。模組重載後過期的 native history 會明確拒絕，不靠名稱猜測新 Par。

## 驗證與後續

- `tests/td/test_uniform_live.py`：200 來源成本、ticket 重播拒絕、gesture／Undo／Escape／斷線回執、外部衝突、owned Bind／master mode 變更、原使用者 Shader 保留。
- `tests/browser/test_uniform_live.cjs`：按住即更新、一次 history、取消、慢回覆合併／最終值、文字輸入、TD 值回傳、連線故障與圖狀態隔離。
- `tests/browser/test_uniform_wire.cjs`：獨立 TD fixture 的原生 WebSocket 連線、雙 subscriber、同分量 writer 衝突。
- 真實 iOS／平板的操作手感由使用者驗收；本批不宣稱已完成實機 iOS 測試。

後續以同樣契約擴充其他可即時編輯的宿主值；matrix／array／通用 Parameter 頁面仍各自界定，不把值、來源結構、圖文件混成同一種更新。
