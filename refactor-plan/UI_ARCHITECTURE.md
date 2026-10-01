# UI 與佈局

本文整理 UI、Editor、佈局容器、功能面板與預設操作流程的責任。採用本輪最後討論的層級與圖持有關係，供下一步邏輯檢驗使用；方法名稱與尚未確認的生命週期細節不視為完整 API。總覽見[重構計畫入口](README.md)。

## UI 與 Editor

Graph 物件保存作品資料，Editor 提供編輯操作及上下文，UI 是狀態的呈現與操作入口。UI 可查詢模型與 Editor，也可呼叫其公開操作；不把 UI 顯示中的值變成第二份圖資料。

Canvas、Parameter、Source 列表、OP Parameter、Preview、說明及診斷等功能可由面板模組提供。Canvas 是基本內建能力，也採模組化；新增面板功能不應要求重新改寫整套佈局。精確面板類別名稱與首版功能清單仍可細修。

UI 的 Parameter 面板是呈現與編輯入口，與模型的 Parameter 編輯描述物件不同。面板查詢目標物件的接口、Parameter 及樣式，依規格建立控制項。

## 管理層級與名稱

目前採用的關係如下。這是物件的持有與管理關係，不是每個元素必須如何巢狀排列在畫面上的限制。

```text
UI
├─ 全域標題列與上下功能列
├─ Manager
└─ Layout
   └─ 水平或垂直的二分分割樹
      ├─ Pane
      │  └─ Tabs
      │     ├─ Tab
      │     │  └─ Canvas（一種 Panel）
      │     └─ Tab
      │        └─ Preview（一種 Panel）
      └─ Pane
         └─ Tabs
            └─ Tab
               └─ Parameter（一種 Panel）
```

| 名稱 | 責任 |
| --- | --- |
| Layout | 分割樹、各區域的位置、大小與比例；調整、保存、載入及預設佈局的能力 |
| Pane | Layout 分割樹末端的一個區域，可為空，持有分頁集合 |
| Tabs | Pane 的分頁集合，提供列舉、查找、排列與目前分頁的入口 |
| Tab | 持有一個 Panel 實例及分頁資訊，也保存 linkGroup 等設定 |
| Panel | 功能面板的共同角色與契約；實際物件是 Canvas、Parameter、Preview 等 |
| Widget | 可供各處使用的基本 UI 元件 |
| Manager | 組合既有能力，提供產品預設流程與跨面板協調 |

Pane 本身就是分割樹末端的區域，不另增加一個相同責任的空區域物件。Panel 在這裡指功能內容，不再同時表示 Layout 割出的容器。

Module 是提供功能的程式模組之統稱，不是 Tab 與 Canvas 之間另一個必要物件。Panel 的共用契約要採 class、interface 或組合實作，尚未定案。

查詢形狀以以下方式示意，並非完整簽章：

```ts
pane.tabs;              // 分頁集合
pane.tabs.active;       // 目前顯示的 Tab
pane.tabs.active.panel; // Canvas、Parameter 等實際面板
```

目前先用 active 表示某個 Pane 的可見分頁，不再增加同義的 current 真相。各 Pane 可同時有 active Tab；目前取得操作焦點的 UI 區域，以及目前操作的編輯上下文，是另外的狀態。

## 管理關係與實際位置分開

分頁列可以顯示在區域的上、下、左或右，也可由外部 UI 控制某個 Pane 的 Tabs。畫面上方的分頁按鈕可操作中央內容，不必因管理關係而限定相鄰位置。

全域標題列與功能列屬於 UI 外層；Pane 提供共用分頁與容器能力；各 Panel 可以提供自己的工具、控制項及內容。共用工具列區域與模組提供內容的精確契約尚待定義。

Tab 移動到另一個 Pane 時，可保留其 Panel 實例與狀態。單一分頁可以隱藏分頁列，顯示 Canvas 不要求同時顯示分頁標籤。是否提供拖曳、分割或隱藏選項，由產品流程決定，不改變底層具有這些能力的方向。

## Manager 是協調與快捷入口

Manager 可決定新開圖要顯示在哪個 Canvas、何時新增或切換分頁、哪些 Parameter 跟隨選取，以及產品預設的面板數量與位置。按鈕、快捷鍵、CLI 或拖曳互動都可呼叫相同能力。

Manager 不是強制的唯一入口。自訂操作可直接呼叫 Layout、Tabs 或 Panel 的公開方法，組合另一套流程。資料結構本身必須遵守的限制放在實際持有物件中；Manager 提供的產品規則不取代底層驗證。

Layout、Pane、Tab 及 Panel 提供必要的查詢與變更通知。Manager 透過它們取得狀態，不另外維護一份能獨立修改的佈局或面板清單。直接修改也應讓上層及相關訂閱者知道；不因略過 Manager 就失去通知。

Manager 的責任限於 UI 流程協調，不取代 Graph.updates、History、宿主 Binding 或整體通訊排程。

## 共用 Widget 與模組私有 UI

共用 Widget 可包含文字顯示、Text Field、Numeric Field、Slider、Icon、Button、選單、切換控制與 Tag 等基本元件。它們可用在面板、節點視圖及功能列，不需要都知道 Graph 或 Node 的內部結構。

Panel 模組可以使用共用元件、主題與排版能力，也可在自己範圍內提供私有元件與樣式。自訂內容仍透過正常查詢與操作入口讀寫狀態，不能另造圖資料或繞過模型規則。NodeView 的共用與自訂邊界見[節點模組與型別](NODE_DEFINITIONS.md)。

Widget 清單、精確名稱、UI 函式庫、呈現技術及每個控制項的契約尚未選定。此處確定的是共用能力與模組私有內容可以並存。

## Graph 集合與 Canvas 目標

`Grape.graphs` 是目前開啟／載入圖的權威集合。Graph 不由 Tab 或 Canvas 持有生命週期；Editor 也不再維護另一份具獨立權威的開啟圖名單。編輯上下文引用其中的 Graph，並保存操作需要的導覽、Stage、Network 與選取狀態。

Canvas 顯示其中一張圖並透過 Editor 編輯。它可提供選擇已開啟圖的入口，從 Graph A 改為 Graph B；多個 Canvas 也可以顯示同一張圖。確切上下文容器與 Canvas／Editor 的關係仍需細化。

| 操作 | 改變內容 |
| --- | --- |
| 切換 Tab | 換成該 Tab 持有的功能面板或另一個 Canvas 實例 |
| 切換 Canvas 的 Graph | 保留 Canvas，改為顯示及編輯另一張已開啟的圖 |
| 開啟 Graph | 將圖載入 graphs；是否同時顯示 UI 由上層流程決定 |

Tab 與 Graph 不綁死為一對一。Manager 可以選擇開圖時新增 Canvas 分頁，也可以重用既有 Canvas；目前不固定每個產品入口的預設操作。

每張 Graph 是獨立作品，graphs 是執行期間的集合。本輪不增加將多圖另外保存為 Project 的必要層級。Layout 保存介面配置，不承擔作品內容的權威儲存。

## 切換編輯上下文與跟隨面板

Canvas 切換到另一張圖或另一個編輯上下文時，相關的跟隨面板需要重新取得目標。Parameter 顯示新上下文的主要選取物件；沒有選取時顯示未選取狀態，不能殘留上一張圖的選取內容。Source 列表則查詢該上下文的 Graph.sources。

目前操作的 Canvas／編輯上下文與鍵盤焦點分開。使用者點進 Parameter 調整值，不應因此失去它原本正在編輯哪張圖的關係。切換上下文也不等於必須將畫布中的節點置中或移動視角。

這是 Manager 可組合的預設跟隨能力。固定檢視某個物件、選取事件如何路由，以及多個上下文的確切通知順序仍需細化；不讓每個面板自行猜測應跟隨哪張圖。

## Tab 的連結群組

Tab 保留 `linkGroup` 屬性，供需要時查詢與連動。它不是 Graph 的 Edge，也不是 Wire／Link 接線顯示樣式。

- `0` 表示沒有指定連結群組。
- 相同的非零號碼表示同一個連結群組。
- 初期保留屬性能力、預設為 `0`，設定介面先隱藏。
- 屬性變更走既有通知能力；實際連動可由 Manager 或其他自訂流程使用。

例如 Canvas A、Source A、Parameter A 所在的 Tab 設為群組 1，Canvas B 與 Parameter B 所在的 Tab 設為群組 2，就能分別使用對應上下文，不必讓面板互相硬編碼引用。

目前討論的預設方向是：未指定群組的 Parameter 可跟隨目前操作的 Canvas，指定群組則依群組選擇上下文。這些是 Manager 可以提供的規則，不是寫入一個數字就自動完成的同步能力。多個 Canvas 同組、來源消失及其他詳細路由規則仍待確認。

Tab 移動時連同這份設定移動，Layout 保存時可收集它。現在不增加一個必要的群組管理 class，也不先展開完整的連結操作 UI。

## 視圖關閉與 Graph 生命週期

關閉 Tab／Canvas 視圖、結束編輯、卸載 Graph 與解除宿主 Binding 是不同操作。關閉最後一個可見 Canvas，不自動表示圖必須結束編輯、從 graphs 移除或斷開宿主。

Tab 提供共用關閉入口，Panel 可依自己的內容處理必要清理。例如 Parameter 解除對目標的追蹤，Canvas 解除視圖相關訂閱；Graph 的作品資料、History 與宿主關係不因此自動銷毀。

若產品希望「關閉圖」同時處理保存、結束編輯與關閉相關視圖，由 Manager 組合相應能力。關閉前的檢查／取消、隱藏與釋放、編輯上下文的保留時機，以及 Graph 卸載時如何處理仍被使用的引用，尚未定案。

先前「最後一個 Canvas 關閉即觸發圖結束編輯」的推論不採用。圖與視圖的存在狀態必須分開查詢。

## 佈局保存與初始化

Layout 提供調整、保存、載入及預設佈局的能力。保存時可收集 Pane、Tab 及面板所需的配置；Tab 順序、可見分頁與 linkGroup 不必因被收集而全部變成 Layout 自己操作的狀態。

Panel 私有狀態如何序列化、重新開啟時如何找回 Graph／Node／Host 引用，以及引用不存在時的處理，尚需設計。Layout 保存不自動等於保存 Graph、History 或宿主實際參數。

UI 初始化負責組合共用能力與面板模組，Manager 提供初始產品規則並使用預設或恢復的佈局。確切初始化順序與公開方法待定，不以讀取一份 Layout 代替整個 UI 初始化。

Canvas 裡的浮動面板也應可重用既有功能面板能力，不另外複製一份 Parameter 或 Preview 實作。其容器、所有權與保存位置仍需配合這份層級細化。

## 專注編輯與尚未定案的行為

專注編輯可由 Canvas 的入口呼叫 Manager，組合顯示／隱藏其他介面與調整佈局的能力。它究竟是臨時狀態、可保存狀態或如何恢復，使用者已明確保留，現在不指定。

本輪固定責任與擴充位置，不固定所有產品操作。整體邏輯檢驗與待細化事項見[待討論事項](OPEN_QUESTIONS.md)。
