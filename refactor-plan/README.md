# Grape 重構計畫

整理日期：2026-10-01。

本資料夾記錄重構討論已確認的物件、責任與能力邊界，供後續細化及驗證架構使用。這些是未來設計，不代表功能預覽版已實作，也不是開始遷移、部署或發布的指令。

**決策以這輪對話的最新確認為準。** 舊程式及舊文件可作參考，不決定新架構，也不用來填補未決答案。名稱與程式片段表達責任及查詢形狀；未明確確認的簽章、格式、演算法與預設值仍可調整。

## 閱讀入口

| 文件 | 內容 |
| --- | --- |
| [圖與編輯器](OBJECT_MODEL.md) | Graph、Stage、Network、子圖、編輯上下文、命名與查找 |
| [節點模組與型別](NODE_DEFINITIONS.md) | NodeModules、NodeType、註冊與初始化、共用規格、行為與 UI 分工 |
| [接口與接線](TYPES_AND_CONNECTIONS.md) | DataType 作用域、Input、Output、Parameter、Edge、轉換與 Stage 限制 |
| [來源與宿主](SOURCES_AND_HOSTS.md) | Source、樣式、預設與實際輸入、Host、Connection、Target、Binding |
| [產碼與目標相容](GENERATION_AND_TARGETS.md) | Generator、ISF 圖與 Pass、TD 承載、方言節點轉換與相容處理 |
| [操作與更新](UPDATES_AND_HISTORY.md) | Change、Operation、History、Graph.updates、必要更新、一致狀態與協作擴充 |
| [驗證與診斷](DIAGNOSTICS.md) | 各層驗證、errors／warnings、保存與產碼門檻、status／log |
| [待討論事項](OPEN_QUESTIONS.md) | 尚未確認的契約、方法、策略與交付範圍 |

## 已確認的設計方向

- 產品名稱與主要入口是 `Grape`；`Graph` 表示一份完整 Shader 圖作品。
- 主要語言為 TypeScript，核心能力可供瀏覽器及 Node.js 使用。圖與節點模型不依賴 DOM 或某個 Editor。
- 先分清物件持有的資料、可執行的操作及引用關係，再展開實作。接受為清楚分工增加程式碼，不以不斷擴大的節點特例分支承擔所有能力。
- 節點能力由集中管理的 `NodeModules` 提供，初始化成共用的 NodeType 物件後登記。簡單計算可由表格建構，其他能力可由分開維護的 TS 模組直接定義。
- 正式修改經過共用的模型修改與變更通知入口。History、產碼與同步各自使用變更資訊，不互相充當必要前提。
- 先保留立即、累積、限頻、操作結束或手動更新的能力，依產碼、宿主編譯與連線的實測成本選擇策略；本輪不固定頻率或自動調整演算法。
- 優先處理 TouchDesigner，接著 ISF，再考慮 FFGL。現在仍聚焦 Shader；泛用 JavaScript 邏輯節點等另一種產品方向不列為必要架構。

## 已確認的淺層關係

以下是主要擁有與引用關係，不是完整 class 或正式 API 清單。複數集合及控制物件的最終拼法仍可細修。

```text
Grape
├─ nodeModules              模組資訊與初始化入口
├─ nodeTypes                已登記的 NodeType
├─ dataTypes                共用型別
├─ generator
│  ├─ top
│  ├─ mat
│  └─ isf
├─ graphs
│  └─ Graph
│     ├─ stages
│     │  └─ Stage extends Network
│     │     ├─ nodes ──引用──→ NodeType
│     │     │  ├─ inputs
│     │     │  ├─ outputs
│     │     │  └─ parameters
│     │     └─ edges
│     ├─ sources
│     ├─ dataTypes           本地定義，查詢可往父級
│     ├─ 圖內子圖定義
│     │  └─ 內部 Network
│     ├─ passes              ISF 特化設定；不包住 Stage
│     ├─ history
│     └─ updates
├─ hosts
│  └─ Host
│     ├─ connection
│     ├─ targets
│     └─ bindings
├─ diagnostics              診斷收集與歸屬的責任入口
└─ editor                   引用模型，持有導覽、選取與互動情境
```

NodeType 的生成行為可供 Generator 查詢；節點、來源及型別登記是不同責任。模組目錄不必與 nodeTypes 的每個項目一對一。

Graph 內各物件的狀態合起來就是當前圖，不再建立一份 Editor 專屬的運算真相。History 與 Updates 是 Graph 持有的執行期間能力，不因此必須寫入匯出的圖。保存圖、匯出程式碼、交付宿主與宿主成功編譯，是不同動作。

## 決策與命名的狀態

沿用 Grape、Graph、Stage、Network、Node、Input、Output、Parameter、DataType、Source、Edge；本輪以 **NodeType** 表達共用節點定義，以 **NodeModules** 表達模組入口。NodeDefinition 是較早草案的名稱，不與 NodeType 再分成兩層必要物件。

Host、Connection、Target、Binding 的責任已確認。Operation 取代這輪早期的 Edit 暫稱，表示一次圖修改操作；Change 表示修改事實，History 管理復原，Updates 管理待處理工作與時機。這裡的 Operation 不等於節點的數學運算選項。

Wire、Link 仍是接線顯示樣式，不作為底層 Edge 的別名。`SourceNode`、註冊表實作名稱、方法大小寫與精確簽章仍可調整；診斷與 Session 的資料結構未定稿。

## 與舊草稿的關係

[早期物件草稿](../docs/discussions/next-project-draft/OBJECT_MODEL_DRAFT.md)只保留為背景。本計畫不採用以 GraphDocument 包住每個 Stage 各一張 Graph 的層級；不將 Pass 放在 Stage 上面；不以隱藏替換產碼實作代替明確的方言節點轉換；不讓 History 負責產碼與同步排程。

舊部署筆記不自動成為這次規格。Electron、PWA、離線儲存、原生 WebGL 預覽及 FFGL 的實作和發布時程仍另行決定。多人協作目前保留責任位置與必要擴充點，未承諾本輪實作。

已解決的問題寫入對應主題，已被取代的描述移除；其餘集中於[待討論事項](OPEN_QUESTIONS.md)。
