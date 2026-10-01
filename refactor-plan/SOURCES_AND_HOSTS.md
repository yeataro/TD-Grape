# 來源與宿主

Source 描述圖所需要的來源。它與引用來源的 Node、值的 DataType、宿主的實際輸入是不同層次。本文件以最新討論的分工為準；API 拼法仍可細修。總覽見[重構計畫入口](README.md)。

## Source 的歸屬與分類

Source 宣告屬於 Graph，可理解為圖的來源表頭。符合條件的 Stage 與子圖透過節點引用它，不需要在每個使用位置重複建立宣告。

來源種類可有各自的子類，但保留共通的 Source 入口及列表。Uniform 是來源種類；float、vec3、mat4 等是 DataType，不因數值型別不同就各建一種 Source 子類。

目前已確認 Uniform 子類及按種類分類的方向。Resource、Attribute、Constant 等完整子類清單，以及 Sampler 與 Resource 的關係尚未逐項定案。

所有種類的 Source 在同一張 Graph 共用名稱空間，不可重名。例如 Uniform 和貼圖來源不能同時叫同一個 name。Source 的 name 與引用它的 Node 的 name 分別屬於 Graph 與 Network，不要求兩者相同。

## 列表與查詢的命名方向

使用者提出的規則是：`Source.Uniform` 表達子類，`sources` 表達全部來源，`source.Uniforms` 表達 Uniform 列表；其他種類照同樣規則，並可依 type 等條件搜尋。

這裡確認的是「子類、總列表、分類列表、單一查找、條件搜尋」各有清楚入口。類別入口與某張 Graph 的資料入口如何拼接，以及大小寫、單複數的完整 API 尚未定稿。尤其分類列表必須指向某張 Graph 的來源，不能因掛在 Source 名下就變成全程式共享的實例列表。

先前討論過的單一查找形狀如下；它們仍須與分類入口整合：

```ts
graph.sources;
graph.source("uColor");
graph.sourceById(id);
graph.findSources(query);
source.graph;
```

查找沿用其他物件的原則：name 查找與 ID 查找明確區分，條件搜尋回傳集合。分類入口引用同一批 Source，不另保存容易不同步的來源副本。

## Source 如何出現在畫布上

Source 不轉換成 Node，也不因出現在畫布上而失去原本的宣告。建立一顆來源引用節點，讓它持有 Source 引用並提供輸出接口。

```text
Graph
├─ Sources
│  └─ uColor：Uniform
└─ Pixel Stage
   ├─ color1：來源引用節點 ──引用──→ uColor
   └─ color2：來源引用節點 ──引用──→ uColor
```

兩組責任分開：Uniform 是 Source 的子類；來源引用節點是 Node 的一種，暫稱 `SourceNode`。Source 不需要繼承 Node。引用節點有自己的 ID、名稱、位置、接口及連線，共同的來源設定仍放在 Source。

建立操作曾用以下方法名示意，尚未固定其簽章：

```ts
const source = graph.source("uColor");
const node = stage.createSourceNode(source);

node.source === source; // 引用同一個 Source
```

- Source 可先存在列表，不必已放到任何畫布上。
- 同一 Source 可被多顆節點引用，且各自遵守使用 Stage 的限制。
- 複製引用節點，預設仍指向同一 Source。
- 需要獨立的來源設定時，另行複製 Source，再建立或改接引用。
- 刪除引用節點不自動刪除 Source；直接刪除仍被引用的 Source 時，如何提示與處理尚未決定。

## Source 與 Stage 的關係

來源種類宣告哪些 Stage 可以引用它；種類或實例的設定也可能使有效範圍縮小。來源引用節點依據其 Source 的限制接受驗證；節點本身另有需求時一起檢查。

Graph 可以保存一個來源，不表示每個 Stage 都能引用它。子圖內的來源引用也須在實際使用的 Stage 上下文中驗證。完整種類與 Stage 對照表尚未填寫，不把候選子類名稱當成已確認的支援清單。

## 預設輸入與實際輸入

對宿主在執行期提供的資料，已確認的界線是：**Source 定義預設輸入；實際輸入由宿主及其使用者來源提供。**

| 資料 | 歸屬及意義 |
| --- | --- |
| Source 宣告 | 圖內的名稱、DataType、種類與相關設定 |
| Source 預設輸入 | 圖可定義的初始化或重設依據；不是宿主目前正在使用的值 |
| 宿主實際輸入 | 使用者輸入、動畫、貼圖或其他外部供值，由執行環境管理 |
| 編輯器收到的實際狀態 | 宿主回報，用於呈現目前狀態；不因收到回報就覆寫 Source 預設值 |

`source.defaultValue` 可表達這個方向。Source 不因介面能編輯數值，就必須保存代表宿主即時輸入的 currentValue。Source 的 Parameter 若綁定預設值，編輯的就是預設值；控制宿主目前輸入是另一個操作。

此處也不同於 Input 的 localValue：未接線 Input 的本地值屬於圖內計算設定，詳見[接口與接線](TYPES_AND_CONNECTIONS.md)。

對 Uniform、貼圖等執行期來源，產碼不需要知道當下的實際內容；Shader 執行時仍使用宿主供應的資料。常量、特化設定等可能影響產碼或編譯的來源，需要另訂規則，不能直接把所有來源都套成 Uniform。

## Standalone 與宿主移轉

未來若提供 Standalone 執行環境，它也扮演宿主角色，管理自己的實際輸入狀態。這不表示其介面上的數值自動成為圖內 Source 的新預設值。

將 Standalone 的設定轉移到另一個宿主時，可以將該設定作為目的端的初始或預設輸入。這份轉移資料不因此取得持續覆寫目的端使用者輸入的權限。具體預設值的保存位置、目的端不支援的資源如何處理，以及移轉格式仍待設計。

共同來源列表描述的是同一批邏輯來源，內容可以依執行環境不同。例如同一個貼圖來源，在 TD 由使用者指定香蕉，在 Standalone 指定葡萄；兩者不必同步內容。

已確認的更新原則是保留宿主既有的使用者輸入，不因更新圖的程式或來源預設而自動覆寫。首次建立時採用預設、明確重設或套用設定時替換實際值，是後續流程設計的基礎；新增、刪除、改型別及不可轉移資源等情況仍須細化。

## 身分與排序

Source ID、列表順序與宿主綁定是三個不同概念：

| 概念 | 責任 |
| --- | --- |
| Source ID | 圖內及移轉資料可用的穩定來源身分；宿主不一定直接使用它 |
| 列表順序 | 圖保存的排列，可供介面、匯出及宿主使用 |
| 宿主綁定 | 決定來源對應哪個實際參數、資源或輸入位置 |

排序有意義，但是否影響執行行為由宿主的綁定方式決定。按名稱或穩定身分綁定時可能不受影響；按順序分配輸入位置時可能需要重新對應。

圖模型保存及提供順序，並能通知順序變更。宿主整合層負責解讀這個變更；不能一概認定排序只影響顯示，也不能強制所有宿主都按列表順位改變輸入。

## Host 與通訊責任

後續討論採用 Host、Connection、Target、Binding。Host 代表可辨識的宿主實例，不只是宿主軟體種類；同一台機器及同一區網都可有多個 TD 實例。未來 FFGL 的 Plugin 實例或 Grape 自己的執行環境，也可按這個角色描述，不強制等同一個 OS 程序。

```text
Grape.hosts
└─ Host
   ├─ connection
   │  ├─ connect()
   │  └─ disconnect()
   ├─ targets
   └─ bindings
      └─ Binding
         ├─ graph
         ├─ target
         └─ sync(result)
```

Connection 負責建立及維持通訊管道、請求與回應。建立物件與真正連線是不同動作；宿主也有自己的通訊端點，雙方可依需要發起訊息。

Target 表示具體接收位置，例如某個 TD OP；其種類與能力是屬性，不能只靠「MAT」這個種類唯一辨認它。Binding 表示 Graph 與該 Host／Target 的對應，負責交付、接收確認及參數回報。`sync()` 是 Binding 的能力，不另增加一個已定案的全域 Sync 或 Sink 管理物件。

不同 Binding 保留各自的待交付與確認狀態。架構容納多個接收對象，不把圖綁死到目前單一連線；同圖多目標的產品介面及控制權仍待細修。斷線時 Graph 仍可編輯。

## 交付內容與回報

完整圖資料、產碼結果、來源需求／綁定描述，以及宿主即時參數值，分開處理。Generator 結果提供宿主需要的程式與描述；宿主不必遍歷完整編輯圖才能套用。完整圖仍可按宿主需求另行保存或同步。

Grape 更新目標後，宿主回覆套用結果；宿主參數被使用者更改時，可主動回報。這些回應不能再次被當作新的使用者輸入而來回重送。實際值回報也不能直接覆寫 Source 預設值。

送出請求不等於成功編譯或套用；Binding 需要能辨認對應請求與結果、處理失敗及區分過期回報。更新頻率、累積及版本進度的原則見[操作與更新](UPDATES_AND_HISTORY.md)，精確協定尚未定稿。

Source 名稱、排序或 style 變更是否需要更新宿主參數、綁定表或 GLSL，依宿主契約與產碼依賴判定。一般節點位置或名稱不預設觸發宿主 Shader 重編譯。

## 連線與部署的能力邊界

以宿主開啟帶有連線資訊的編輯器網址作為預設配對方向；編輯器位置可依部署配置，複製貼上配對資訊也保留作為入口。配對須能區分具體實例，不能只用機器 IP 代表唯一宿主。

這不固定通訊協定、認證或防火牆處理，也不承諾瀏覽器可任意掃描區網。WebRTC、原生 App、靜態網站及 PWA 的具體實作另行評估。架構保持編輯圖與連線分離，沒有連線也能操作模型；瀏覽器、檔案或其他空間的持久儲存方案尚待選擇。

## ISF 來源的對應

ISF 的公開 INPUTS 類型與 GLSL 型別及控制項不是任意獨立組合；例如 ISF `long` 對應 GLSL `int`，可提供數值與顯示標籤的列表。Grape 的 style 再由宿主適配映射，不能保證每種自訂 UI 都能原樣輸出到 ISF。參考 [ISF JSON 規格](https://docs.isf.video/ref_json.html)。

ISF 的 `audio` 與 `audioFFT` 都以圖像／2D texture 供 Shader 取樣；X 是時間樣本或頻率格，Y 是音訊通道。FFT 由宿主提供，不是把同一份資料直接定義為 Uniform 陣列或 Texture Buffer。一般 mesh／頂點索引輸入不在目前採用的 ISF 2.0 可攜範圍內。參考 [ISF 音訊](https://docs.isf.video/primer_chapter_8.html)與[Vertex Shader](https://docs.isf.video/primer_chapter_5.html)。
