# 接線合法性實驗

實驗功能 → 節點與接線 → **接線合法性**。設定只保存在目前瀏覽器的
`sgrapeExperimentsV1`，不寫入圖或 Layout，也不產生 History。

| 模式 | 候選預檢時機 |
| --- | --- |
| 開始接線時判斷全部 (`all`) | 保留原本流程：起拖時收集已渲染且未停用的畫布／浮動 Parameter 接孔，全部做合法性檢查。 |
| Hover 時才判斷 (`hover`) | 起拖只收集候選；直接命中或進入吸附範圍時才檢查。相同接孔／model revision 的答案只在當次手勢內重用。 |
| 只判斷畫布範圍內 (`viewport`，預設) | 先用畫布與接孔的 client rectangle 篩選，再做原有檢查；平移、縮放、尺寸、捲動、model revision 或接孔 DOM 改變時更新。 |

## 不變的規則

- 三種模式的滑鼠與觸控拖線都呼叫同一個 `connectionProblem`；放開時仍經
  `connectPorts` 的完整檢查與既有 `change` 交易。沒有新增直接寫 edge 的路徑。
- 畫布外節點仍在完整圖中參與型別、循環、常數限制及其他正式驗證。
- 浮動 Parameter 接孔獨立參與，不能因為其所屬節點在畫布外而被剔除。
- 直接命中非法接孔不會跳接旁邊接孔；空白處吸附仍找範圍內最近且未被遮擋的合法接孔。
- 幾何以 CSS client pixels 比較，不乘 `devicePixelRatio`；保留滑鼠 14px、觸控 22px 吸附邊界。
- 取消、放開、失去 capture、切圖及觸控轉雙指導覽會清理當次候選 session。
- 點一下起點、再點一下終點的連接方式保持原本流程。

## 如何比對

用同一張大圖、同一視野與同一組接孔，依序切換三項：比較按下接孔時的延遲，
以及第一次碰到目標時的延遲。切換選項會取消進行中的接線，不改圖的內容。
`all` 是原行為的比對組；舊偏好缺少新欄位時採用 `viewport`。

這項實驗只改候選預檢。每幀 `wires()` 重畫線條，以及 Combine／Replace 的
component preview 計算仍存在。Hover 模式可能把一次完整檢查的延遲移到首次命中目標，
不是取消最終檢查，也不保證所有拖線卡頓都消失。

## 驗證入口

設好既有 `PYTHONPATH=src/core;src/td/runtime;tests/unit` 後執行：

```text
python -m unittest test_wire_validation
```

- `test_wire_candidates.js`：使用真實候選／hit-test 函式、假 DOM 幾何及計數式
  validator，驗證三模式、可見範圍、浮動接孔、吸附、Router、觸控半徑、更新與清理。
- `test_wire_validation_model.js`：使用當前 catalog 與真實 planner／交易，驗證三模式的
  成功提交、單次 History、畫布外循環、預檢後狀態變更的正式拒絕，以及 locked type 拒絕。

這些不是 TD／GPU 效能測量。瀏覽器互動驗證與實際 TD 同步／保存需在交付紀錄中分開標示。
