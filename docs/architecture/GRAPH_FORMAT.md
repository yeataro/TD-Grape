# 圖格式（grape-graph 1）

決策來源：design-interview **Q44**；完整討論與理由見 workspace 的 `work/in-place-refactor-design/graph-structure.md`。型別定義在 [`src/core-ts/model.ts`](../../src/core-ts/model.ts)。

核心直接操作讀進來的文件（JSON 本身），`Node`／`Edge` 等物件只是查詢與修改它的窗口，所以**檔案裡的欄位名就是程式裡的名字**，不另加翻譯層。

## 結構

```json
{
  "format": "grape-graph",
  "version": 1,
  "target": "top",
  "declarations": [],
  "subgraphs": [],
  "structDefinitions": [],
  "stages": {
    "pixel": {
      "nodes": [
        { "id": "color", "nodeType": "sgrape.builtin.color",
          "params": { "value": [1, 1, 1, 1] }, "ui": { "x": 80, "y": 120 } },
        { "id": "pixel_out", "nodeType": "sgrape.builtin.pixel_out",
          "params": {}, "ui": { "x": 440, "y": 120 } }
      ],
      "edges": [
        { "id": "color_output", "from": ["color", "out"], "to": ["pixel_out", "color"] }
      ]
    }
  }
}
```

| 位置 | 欄位 | 說明 |
| --- | --- | --- |
| 圖 | `format`、`version` | 必有。`grape-graph`＋格式版本（對應 ISF 的 `ISFVSN`）。 |
| 圖 | `target` | `top`／`mat`。 |
| 圖 | `declarations` | 一張清單，每筆以 `kind` 區分（來源、全域常數、日後的內建值、TOP 貼圖輸入…）；每種 kind 的欄位由其模組規定。 |
| 圖 | `subgraphs` | 子圖定義：`id`、`name`、`scope`（`local`／`library`／`personal`）、`origin`（來自哪裡）、`descriptionKey`、`stages`、`targets`、`inputs`、`outputs`、`graph`。 |
| 圖 | `structDefinitions` | 自訂 struct。 |
| 圖／子圖 | `description`、`comment`、`userVersion` | 選填。說明（對應 ISF `DESCRIPTION`）、筆記、作者自訂版本字串（對應 ISF `VSN`）。 |
| 網路 | `nodes`、`edges`、`ui` | `ui` 為畫面資料（如 `groups`）。 |
| 節點 | `id`、`nodeType`、`params` | 必有。`nodeType` 是節點種類代號（如 `sgrape.builtin.add`）。 |
| 節點 | `name`、`inputValues`、`comment`、`ui` | `name` 產碼時當 GLSL 名稱；`comment` 產成 GLSL 註解；`ui` 只放長什麼樣子（位置、`componentNames` 等）。 |
| 接線 | `id`、`from`、`to` | 必有。`id` 是不重複的字串，新接線由核心隨機產生（`e`＋32 位十六進位），先後沒有意義。 |
| 接線 | `ui` | Link／Wire 樣式（`{ "style": "link" }`）。 |
| 任何一筆 | `extensions` | 擴充資料，按擴充包 ID 分放（參考 glTF）。 |

## 讀圖規則

- **格式識別**（`formatProblem`）：`format` 不是 `grape-graph` → 不是新格式（舊圖交給匯入器）；`version` 比目前新 → 不寫回、提示更新 Grape；缺 `target`／`declarations`／`stages`、節點缺 `id`／`nodeType`、接線缺 `id` → 資料不完整。編輯器對前兩種以外的情況才提供「換成預設圖」（遷移期便利）。
- **不認得的資料原樣保留、程式不讀**（Ghost 原則，ADR 0004、Q37）：不認得的欄位、`extensions`、不認得的節點種類都跟著存回去。讀檔程式永遠不刪資料。
- 產碼指紋不含 `ui`、`comment`、接線 `id`／`ui`、`description`／`userVersion`：這些不影響產出的程式。

## 舊格式（schemaVersion 1）→ grape-graph 1 對照表

開發工具 [`tools/dev/old_graph.cjs`](../../tools/dev/old_graph.cjs) 照這張表轉換（測試 OP 的一次性轉換、舊 Python 對照組的測試案例）；日後的舊圖匯入器實作同一張表。新位置還沒定的欄位**原樣保留**並列為待處理，不丟。

| 舊 | 新 | 備註 |
| --- | --- | --- |
| `schemaVersion: 1` | `format: 'grape-graph'`、`version: 1` | |
| `functions` | `subgraphs` | |
| 子圖 `source` | 併入 `origin` | `origin` 已有值時保留 `origin` |
| `typeDefinitions` | `structDefinitions` | |
| `topInputs`（非空） | TOP 貼圖輸入的 `kind` | **貼圖輸入那一輪定**；目前轉換工具拒絕 |
| 網路 `edgeSequence` | 刪除 | |
| 接線缺 `id` | 補隨機 id | 既有 id 不改 |
| 節點 `definitionUuid` | `nodeType` | |
| 節點 `revisionHash` | 刪除 | 「節點實作改版」另議（Q44 預演補充） |
| 節點 `ui.comment` | `comment` | |
| 節點 `ui.label` | 刪除；有內容且不同於 `name` 時併入 `comment` | |
| 節點 `ui.typeMode: 'locked'` | 刪除 | 等於預設 |
| 節點 `ui.typeMode: 'auto'` | 待處理（原樣保留） | 自動型別做回來時定正式欄位，不放 `ui` |
| 宣告 `sourceMissing` | 刪除 | TD 狀態，不屬於圖 |
| 宣告 `nativeSequence` | 刪除；`'color'` → Uniform 的 `color: true` | 頁面由 TD 從 `kind`＋`type` 推算；「是不是顏色」是 Uniform 欄位（design-interview Q51：只有 vec3、vec4，沒寫＝不是顏色） |
| 節點 `sgrape.builtin.uniform` | → `sgrape.builtin.declaration`（參數 `declarationId` 不變） | 舊式 Uniform 節點退休，一律用引用宣告節點（Refactor.44） |
| 宣告 `initialDriver` | 待處理 | 改為內建值 `kind`（暫稱 `builtin`），Uniform 那一輪定 |
| 宣告 `exposeName` | 待處理 | 拆成參數名稱＋標籤，Uniform 那一輪定 |
| 宣告 `defaultSource`／MAT 的 `source` | 待處理 | 合併為 `defaultTexture`，貼圖輸入那一輪定 |
| `grapeFallbackSampler` | （不在存檔裡） | 舊產碼器暫時副本裡的保險；新產碼器內部處理 |

## 尚未實作（依「新抽象要有當輪真實 caller」延後）

- 每種宣告 `kind` 由模組規定欄位（`constant`：`value`；`uniform`：`value`、選用 `color`；`topInput`：`defaultTexture`）。未知欄位在 `extensions` 外時的警告還沒做。
- 子圖「攤平／函式」屬性：攤平功能尚未存在。
- 作者、分類欄位：等分享功能。
- 節點擴充包 ID 格式、警告的顯示方式。
