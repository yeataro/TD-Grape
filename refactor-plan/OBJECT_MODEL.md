# 圖與編輯器

本文整理已確認的模型層級及編輯責任。狀態、範圍與其他主題見[重構計畫入口](README.md)。API 片段只表達約定中的使用方式。

## Graph 與 Stage

Graph 表示完整的 Shader 圖作品，有自己的身分、名稱、種類及圖內共用資料。Graph 的種類包含 TOP、MAT；Stage 是 Graph 內的集合成員，不為了表示不同 Stage 而建立兩張互不相關的 Graph。

MAT 類型的 Graph 包含 Vertex 與 Pixel Stage。圖的種類決定需要哪些 Stage；其他種類或未來擴充的具體表格尚未展開。圖的說明與中繼資料應隸屬於圖，具體採用 documentation 或 metadata 等欄位留待細修。

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

## 子圖定義與使用實例

一顆子圖節點是使用實例，引用一份子圖定義。兩邊的資料分工如下：

| 歸屬 | 內容 |
| --- | --- |
| 使用實例 | 外部節點的 ID、名稱、位置、輸入值與外部連線 |
| 共用定義 | 子圖接口、內部節點、內部連線與內部節點的位置 |

複製使用實例，預設仍引用同一份定義。若需要獨立編輯內部內容，另有建立獨立副本的操作；巢狀子圖要複製多深尚未決定。

資源庫原件與圖內使用的定義分開辨認。內建或個人資源庫的內容進入圖後，應能以圖內副本或匯入快照的身分使用；修改圖內共用定義不等於直接修改資源庫原件。引用同一份圖內定義的實例會一起看到定義變更。版本更新、在地化時機等完整政策仍待細化。

導覽路徑例如 `MyMaterial / Pixel / NormalMap1 / Decode1`，表示從哪些使用實例進入內部 Network。多條導覽路徑可能到達同一份共用定義，不代表每條路徑各有獨立內容。

## Editor 的操作上下文

`Grape.editor` 作為目前編輯器的操作入口。Graph 可離開編輯器獨立存在及接受程式操作。編輯器保有目前正在看的圖、Stage、Network 與選取狀態，而非另建一份圖的運算資料。

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

每張 Graph 有自己的編輯歷史；同一張圖的多個編輯視圖共用該歷史。Undo 不是只存在某個畫布元件裡的功能。

UI 與程式修改模型時使用相同的操作、驗證及變更通知機制。正常編輯預設可撤銷；載入與初始化等操作可以明確排除。修改不應直接繞過模型規則去任意更改集合。

一次使用者操作可以組成一筆歷史，例如一次滑桿拖曳，或一次建立多顆節點及其接線。撤銷刪除節點時，需要能恢復該節點及受影響的接線。Undo／Redo 也會通知所有相關視圖更新。

歷史紀錄需要足以還原前後狀態，單純發出「值已改變」事件不足。以可逆變更為主、必要時搭配局部快照是討論方向；尚未固定儲存演算法、套件或跨次啟動的保存政策。

## 一般節點的定義仍待討論

Node 已確定是圖內可操作的節點物件。是否由共用 Node 實作搭配 NodeDefinition、哪些情況另外使用 Node 子類，尚未回答。

本文件不把「普通節點全部共用同一個 class」或「每種節點各有 class」定為規則。來源引用的關係已確認，詳見[來源與宿主](SOURCES_AND_HOSTS.md)；它不自動決定所有其他節點的實作架構。
