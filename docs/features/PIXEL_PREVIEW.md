# Pixel Stage Preview

Preview 是暫時性的 Pixel Stage 節點，供 MAT／TOP 檢查中間計算結果。它與 Color Output 共用綠色角色，節點呈半透明；搜尋 `Preview` 可建立，空白的相容 GenType 建立／拉線選單優先列出它。每個根 Pixel Stage 只有一個，重新建立會移動原節點；可刪除並 Undo。Vertex 和 Subgraph 內不提供此節點。

## 輸出行為

| 輸入 | 主色彩 RGBA |
| --- | --- |
| scalar | `(x, x, x, 1)` |
| vec2 | `(x, y, 0.5, 1)` |
| vec3 | `(x, y, z, 1)` |
| vec4 | `(x, y, z, w)` |

接受 float、int、uint、bool、double 的純量及 2／3／4 分量向量。非 float 先轉成同尺寸 float；不做 normalize 或 clamp。矩陣、陣列、結構與資源型別不接受。未連接時無效果。

Preview 只覆蓋 Color Output 的主色彩／Buffer 0，其他 buffers、Vertex、原有 finishing、discard／depth 邏輯保留。正式 Color Output 的原始運算與 bindings 仍保留；原圖連線不因預覽而改寫。

## 暫時生命週期

- Preview 在目前瀏覽器工作區的圖與 Undo 中存在，但不進入正式 Graph、session draft、JSON 匯出或 PNG 內嵌 Graph 資料。PNG 畫面可以呈現當下預覽節點，內嵌圖不含它。
- 切換至另一張圖、重新載入／替換圖、關閉或重新載入頁面時結束預覽，恢復最近一次成功保存的正式輸出。單純切換 Vertex／Pixel、進出 Subgraph、移動面板仍是同一張圖。
- 關閉頁面以 keepalive 盡力通知；收不到通知時，TD 主執行緒在 15 秒 lease 到期後恢復正式輸出。TD 暫停或無法執行 callbacks 時，恢復會等到主執行緒繼續運作。網頁背景 timer 被暫停也可能使 Preview 到期。
- 同一 Shader 的另一個 Editor 不能默默接管有效的 Preview session。舊工作區的晚到 Apply、end 或 heartbeat 不得覆蓋新工作區。
- 若 TD 的來源結構／History 在 Preview 外改變正式圖的 revision，該 Preview 會失效；不以舊快照重新配置新的圖。可在取得新狀態後重新建立 Preview。
- 正式圖修改仍依原來的 Apply／revision／native History 契約保存。預覽恢復只處理 shader 與 sampler／TOP 路由，不倒回目前 live Uniform 值。

## TD 保存與獨立 Shader

套用時先驗證正式與 Preview shader；保存的 Graph、state、manifest/hash 均指向正式圖。臨時輸出與其 session 保留在 runtime 記憶體。Shader 另保留只含正式 shader／路由的恢復資料及獨立 Execute DAT，供 module 重啟或單獨複製／載入 TOX 時恢復；不需要原 Manager 或瀏覽器。

`onProjectPreSave` 同步恢復正式輸出，`onProjectPostSave` 只在原 session 仍有效時恢復預覽。Editor 的 Save TD Project 也使用同一對 suspend／resume。保存回呼不可用時拒絕啟用 Preview。恢復失敗保留 marker 並重試，不宣稱已還原。不能可靠快照的 exported sampler／TOP 路由會拒絕預覽，保留原輸出。

## 驗證入口

- `tests/unit/test_pixel_preview.py`：型別轉換、singleton、MRT／原始 bindings、正式圖投影。
- `tests/unit/test_pixel_preview_lifecycle.py`：真實 compiler／deploy 與假 TD I/O，保存、lease、晚到請求、回滾、停止服務。
- `tests/unit/test_pixel_preview_recovery.py`：獨立 native 路由快照與恢復；不改 Uniform 值。
- `tests/browser/test_pixel_preview.cjs`：建立、搜尋、實際拉線、刪除與 Undo。
- `tests/browser/test_pixel_preview_lifetime.cjs`：正式保存投影、工作區離開、過期／晚到回覆與 Undo 生命週期。
- `tests/browser/test_pixel_preview_gpu.cjs`：真實 compiler GLSL 的 WebGL2 數值 smoke；不等於 TD／MAT MRT／double 的原生驗證。
- `tests/td/test_pixel_preview_lifecycle.py`：可清除的原生 MAT／TOP、40 組 GPU 數值、MRT、保存回呼、到期／刪除及無 Manager 的 TOX 載入／貼圖重定位。保存回呼 pulse 不等於實際 TOE serialization。

實際 TOE 保存及各平台驗證結果依交付紀錄標示，不以 mock 或 WebGL smoke 當作 TD 原生驗證。
