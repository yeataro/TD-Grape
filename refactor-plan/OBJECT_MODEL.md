# 圖與編輯器

本文整理已確認的模型層級及編輯責任。狀態、範圍與其他主題見[重構計畫入口](README.md)。API 片段只表達約定中的使用方式。

## Graph 與 Stage

Graph 表示完整的 Shader 圖作品，有自己的身分、名稱、種類及圖內共用資料。Graph 的種類包含 TD TOP、TD MAT 與 ISF；Stage 是 Graph 內的集合成員，不為了表示不同 Stage 而建立兩張互不相關的 Graph。

TOP、MAT 與 ISF 的圖模型都保留 Vertex 與 Pixel Stage。某個 Stage 可使用宿主或產碼器的預設實作，介面以 Pixel 為主不代表模型禁止 Vertex。各圖種類的幾何、資源與可用節點範圍仍有差異。ISF 的 Passes 是圖上的執行與緩衝設定，不是包住 Stage 的容器，詳見[產碼與目標相容](GENERATION_AND_TARGETS.md)。圖的說明與中繼資料應隸屬於圖，具體採用 documentation 或 metadata 等欄位留待細修。

對外可直接建立單張 Graph，再依名稱取得其中 Stage。全域圖清單的登記及移除方式尚未定稿。

```ts
const graph = new Grape.Graph({ name: "MyMaterial", type: "mat" });
const pixel = graph.stage("pixel");

graph.stages;             // 所有 Stage
pixel.node("multiply1");  // 這個 Stage 裡的節點
```

## Network 與 Stage 的關係

Network 是節點與接線的共通容器，管理自己的 Nodes、Edges，以及建立、移除、查詢與接線操作。Stage 繼承 Network，再加入階段種類、所屬 Graph、階段能力與輸出要求等責任。

Stage 的能力規則與節點的可用範圍共同參與驗證；它不需要列舉所有可用節點，也不直接負責生成全部程式碼。詳細規則見[接口與接線](TYPES_AND_CONNECTIONS.md)。

子圖定義持有內部 Network。內部 Network 可以再包含引用其他子圖的節點；子圖不是另一個固定 Vertex 或 Pixel 的 Stage。

## Stage 接口與跨階段傳值

跨 Stage 的傳值定義獨立於 Source，由 Graph 持有兩端共用的身分、名稱、DataType 及傳遞設定。寫入與讀取端引用同一份定義；每個 Stage 的 Edge 仍留在自己的 Network，不用跨 Stage 的 Edge 表達傳值。這個定義的正式類別名與集合 API 尚未確定。

Stage 接口在畫布上的表示仍是 Node，包含在 `network.nodes` 中。Node 引用或投影對應接口定義，實際 Input／Output 仍歸 Node，Edge 可以照一般規則追溯端點所屬節點。接口定義不因此承擔節點顯示或整體產碼責任。

Stage 必要的接口節點由 Stage 建立，可移動，但不能透過一般刪除操作移除。這項限制由模型層保證，不只隱藏 UI 刪除按鈕。必要節點的不可刪除性，不表示其中所有使用者自訂接口都永遠不可增減；細部規則待定。

從 Network 內部看，輸入邊界節點提供 Output，輸出邊界節點接收 Input。節點的生成行為與 Generator 負責將這些接口對應到 Shader 輸入／輸出。子圖自身的邊界節點也使用普通 Node 與接口規則，但不等同 Stage 的輸入／輸出節點。

## 子圖定義與使用實例

一顆子圖節點是使用實例，同時引用共用的 Subgraph NodeType 與一份圖內子圖定義。NodeType 提供建構接口、驗證與產碼的行為；子圖定義提供本身的接口規格及內部 Network。不是每建立一份使用者子圖，就另外註冊一個新的 NodeType。詳細分工見[節點模組與型別](NODE_DEFINITIONS.md)。資料分工如下：

| 歸屬 | 內容 |
| --- | --- |
| 使用實例 | 外部節點的 ID、名稱、位置、實際接口、輸入值與外部連線 |
| 共用定義 | 子圖接口、內部節點、內部連線與內部節點的位置 |

複製使用實例，預設仍引用同一份定義。若需要獨立編輯內部內容，另有建立獨立副本的操作；巢狀子圖要複製多深尚未決定。

資源庫原件與圖內使用的定義分開辨認。內建或個人資源庫的內容進入圖後，應能以圖內副本或匯入快照的身分使用；修改圖內共用定義不等於直接修改資源庫原件。引用同一份圖內定義的實例會一起看到定義變更。版本更新、在地化時機等完整政策仍待細化。

導覽路徑例如 `MyMaterial / Pixel / NormalMap1 / Decode1`，表示從哪些使用實例進入內部 Network。多條導覽路徑可能到達同一份共用定義，不代表每條路徑各有獨立內容。

## Network 依賴與子圖限制

普通 Edge 的資料依賴不可形成循環；子圖定義也不能直接或間接引用自己。同一份子圖被多個實例使用不屬於遞迴。正常建立連線或引用時拒絕形成循環；匯入的非法資料保留供修復，回報 Error 並阻止產碼。

Network 檢查資料依賴，子圖引用關係另檢查定義遞迴。Shader 內明確的迴圈能力與跨幀 Pass／緩衝回饋是不同機制，不能讓普通 Edge 成環後交由 Generator 猜測執行順序或初始值。

Source 類節點與 Stage Input／Output 節點不得放入子圖 Network。子圖需要的外部資料透過自己的 Input 傳入；子圖自身的接口節點可存在。此限制與選單分類分開，完整放置規則見[接口與接線](TYPES_AND_CONNECTIONS.md)。

## 已開啟的圖與 UI 視圖

`Grape.graphs` 持有目前開啟／載入的 Graph 物件，是查詢已開啟圖的入口。Editor 不另維護一份具獨立權威的開啟圖名單，UI 也不以可見 Tab 列表決定哪些圖存在。

每張 Graph 是獨立作品，目前不增加將多張圖另存為一份 Project 的必要層級。執行期間的 graphs 集合不因此成為另一種必須保存的作品格式；跨次啟動如何恢復已開啟項目仍待設計。

Canvas 引用其中一張 Graph 的編輯上下文，透過 Editor 操作。它可以切換顯示另一張已開啟的圖，也可有多個 Canvas 顯示同一張圖。Tab 與 Graph 不綁死為一對一。

關閉 Tab／視圖、結束編輯與卸載 Graph 是不同能力。沒有可見 Canvas 不自動表示圖已結束編輯或須被移除；也不由最後一個 Tab 關閉推導這些操作。Manager 可組合產品流程，具體保存提示、上下文保留與卸載條件尚待細化。UI 分工見[UI 與佈局](UI_ARCHITECTURE.md)。

## Editor 的操作上下文

`Grape.editor` 作為目前編輯器的操作入口。Graph 可離開編輯器獨立存在及接受程式操作。Editor 提供操作功能與編輯上下文；UI 讀取狀態並提供操作入口，兩者不是同一層。

編輯上下文引用目前的 Graph、Stage、Network 與選取狀態，不另建一份圖的運算資料。Canvas 可以呈現上下文，但不因此持有 Graph 的生命週期。多個上下文的正式容器、與 Editor 實例及視圖的對應方法仍待細化，不預設每個 Canvas 必須建立一整套 Editor。

```ts
editor.activeStage;
editor.activeNetwork;
editor.selection;
```

在 Stage 根層，activeStage 與 activeNetwork 指向同一個 Stage 物件。進入子圖時，activeNetwork 改為子圖的內部 Network；activeStage 保留此次使用位置的階段上下文。

同一份子圖定義可以出現在不同 Stage。不能因目前從 Pixel 進入，就永久將定義改成只屬於 Pixel。多個編輯視圖可以操作同一張 Graph，但有不同的瀏覽位置與選取狀態。

## 選取集合與主要選取物件

選取由 Editor 的選取物件管理。它引用實際模型物件，可同時包含多個物件，並指定其中一個為主要選取物件。

```ts
editor.selection.items;    // 所有選取物件
editor.selection.primary;  // 主要選取物件；沒有選取時為 null
editor.selection.set([a, b]);
editor.selection.add(c);
editor.selection.clear();
```

主要選取物件屬於目前集合，可供參數面板等單一對象介面使用；整組選取可供移動、複製、刪除等群組操作使用。如何在增減選取時指定下一個 primary，仍是後續互動細節。

## 身分與名稱

| 名稱 | 已確認的意義 |
| --- | --- |
| id | 用於保存與引用的穩定身分；更名不改變它。圖內物件的 ID 以 Graph 為唯一性範圍 |
| name | 所屬範圍內唯一、適合人使用的名稱；例如 Node 在自己的 Network 內唯一 |
| label | 可重複的顯示與搜尋文字，不用來唯一定位物件 |
| tags | 搜尋與組織條件，不承擔唯一身分 |
| Shader 符號 | 產碼使用的識別字，與顯示名稱分開處理 |

Source 的名稱跨所有來源種類，在同一張 Graph 內唯一。各種物件的 ID 格式、接孔是否以 ID 或穩定鍵識別、名稱大小寫及自動避開重名的細節尚未決定。

一般查找以 name 為預設。ID 查找使用明確的方法，不猜測一個字串到底是 ID、name 或 label，也不在 name 找不到時自動改找 label。

```ts
network.node("multiply1"); // 依目前 Network 內的 name，回傳單一物件或 null
graph.nodeById(savedId);    // 明確按 ID 查找
network.findNodes(query);  // 搜尋，回傳集合
```

複數屬性提供集合，單數入口取得個別物件。Graph、Stage、Node、Input、Output、Parameter 與 Source 的列表和查找沿用這個方向；不因此固定所有方法的最終拼法。

## 共用搜尋入口

`findNodes(query)` 作為圖模型的共用搜尋入口，編輯器搜尋面板使用同一套比對能力。介面負責搜尋範圍、輸入方式、結果呈現及選取定位。

- 純文字搜尋使用明確列出的可搜尋欄位，例如 name、label、tags，不遞迴搜尋物件的所有內部屬性。
- ID 不納入預設的模糊文字搜尋；唯一 ID 查找有獨立入口。
- 搜尋回傳集合，即使只有零筆或一筆；同一物件命中多個欄位仍只出現一次。
- 保留指定欄位、多條件與 AND／OR 等條件組合的能力，使用者介面仍以簡單輸入為主。
- query 可以承接文字或結構化條件。模糊、通配符、正則模式及其 UI 尚未定案，先不另開一套只供介面使用的搜尋 API。

搜尋跨越共用子圖時，結果如何包含不同使用路徑及定位資訊，仍需細化。

## 編輯歷史與修改入口

Graph 內 Node、Edge、Source 等物件的狀態合起來就是圖本身。修改 Node 已經是在修改圖，不必再將資料抄回另一份 Graph 或 Editor 的狀態。

每張 Graph 持有自己的 `history`；Stage、圖內子圖及來源的修改包含在同一張圖的歷史中。同圖的多個 Editor 共用歷史，但各自保有導覽、視角及選取。

Editor 負責把手勢轉成模型操作及界定 Operation 的範圍。例如一次拖曳形成一個操作；滑鼠移動時仍可逐批更新畫面。腳本可使用相同的修改入口，不需要 Editor 存在。

UI 與程式修改須使用共同的寫入、驗證及通知機制；可由屬性的 setter 或方法提供。正常編輯預設可復原，載入等操作可以排除。確切方法、複合屬性防止繞過寫入的方式仍待細化。

Operation、Change、History 及 `Graph.updates` 的責任，還有 Undo 與必要更新的關係，統一見[操作與更新](UPDATES_AND_HISTORY.md)。History／Updates 不因由 Graph 持有就必須隨圖匯出。Grape 層級若需要復原新增或刪除整張圖，再討論全域 History，現在不預設增加。

## 節點與定義的關係

Node 引用可查詢的 NodeType，能追溯來源模組。初始化後的定義可被多顆 Node 共用，個別設定、接口與連線仍各自保存。模組、註冊表、行為與 UI 分工見[節點模組與型別](NODE_DEFINITIONS.md)。

來源引用節點指向 Graph 的 Source；子圖節點引用共用 Subgraph NodeType 及圖內子圖定義；Stage 接口節點引用對應接口定義。這些關係不強制所有 Node 都繼承同一套複雜子類樹。
