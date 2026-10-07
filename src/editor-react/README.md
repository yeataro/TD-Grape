# 新編輯器（唯一入口）

自 Refactor.24 起是唯一的編輯器入口；舊入口已移除（Refactor.25）。目前能打開 TOP／pixel 的 52 個常用節點（`supportedDefinitions`）；新增選單由核心決定（`creatableDefinitions`：扣掉已淘汰 `float`／`vec2`／`vec3`／`vec4` 與 Color Output）。不含 Uniform、子圖、Frame。

Grape OP 的 Edit 打開 `/shader/<Grape OP id>/`（`/?target=<id>` 亦可）。頁面是 [index.html](index.html)；靜態檔（文字 `locales.json`、圖示、manifest）在 [static/](static)；核心產物在 [src/generated/](../generated)；產品版本在 [src/version.json](../version.json)。建置把三者都放在網址根目錄。不同頁同時寫同一份圖會受宿主 revision 保護，不會合併兩張活動圖。

## 找責任入口

| 要處理的事情 | 入口 |
| --- | --- |
| 節點規則、接孔、型別、GLSL | [core-ts/nodes](../core-ts/nodes)、[node_module.ts](../core-ts/node_module.ts)、[values.ts](../core-ts/values.ts) |
| 編輯協調：文件操作、Undo、每次修改完成即產碼、保管編輯狀態 | [editor.ts](editor.ts) 的 `Editor` |
| 與 TD 交換作品：讀取、送出排程、晚回覆、失敗分類與重試、衝突、保存 | [host_sync.ts](host_sync.ts) 的 `HostSync` |
| 把一筆 GraphChanges 轉成 RF nodes／edges | [projection.ts](projection.ts) 的 `project` |
| 模組描述如何畫成卡片／值欄位、模組宣告的 spare 接孔 | [NodeCard.tsx](NodeCard.tsx)、[NumberField.tsx](NumberField.tsx) |
| 額外 Handle 量測通知 | [geometry.ts](geometry.ts)；外框尺寸／拖曳沿用 RF |
| React Flow 沒提供、自己補的畫布互動（Q29「自己泡茶」；一功能一檔，滿 3 個再收進資料夾；RF 日後提供即可換回） | [RightDragSelect.tsx](RightDragSelect.tsx)（右鍵拖曳框選） |
| 開圖、最小工具列、草稿恢復提示、TD 不在時的提示與衝突選擇 | [main.tsx](main.tsx)；分類與重試在 [host_sync.ts](host_sync.ts) 的 `classify`／`recover` |
| 現有 HTTP 協定及失敗層 | [host.ts](host.ts)；TD 契約在 [host_api.py](../td/runtime/host_api.py) |
| 首輪已接管範圍、既有生成核心的型別入口 | [core.ts](core.ts) |

值與接線只呼叫 Editor → GraphDocument／Network。卡片與 RF 不持有第二張可獨立改寫的作品。RF selection、measured、viewport、拖曳和輸入草稿是暫態；拖曳放開／欄位提交才記錄一筆圖歷史。

`project` 先準備完整 nodes 與 edges，再由 Editor 發布一次。`GraphChanges` 提供候選範圍；無關項目保持引用。它仍有有限的全圖遍歷與快照成本，並非增量計算引擎。改值不等於接孔幾何改變；額外 invalidation 只補同尺寸下接孔增刪或位移，RF 自己處理尺寸觀察。

型別選單暫時重用既有 `editor_contract` variants；規則來自真正 NodeModule。`supportedDefinitions` 只是本轮覆盖清單，不是另一套 registry。通用模型和 compiler 本輪沒有改動。新入口的同源 HTTP／歷史協調只覆蓋當前 caller，沒有抽象尚未接入的面板、Uniform live 或 Library。

## 開發與驗證

在 refactor repo 根目錄使用 Node **20.19+ 或 22.12+**（本輪實測 25.5.0）：

```text
npm ci
npm run build:core
npm run check:core
npm run test:core
npm run check:editor
npm run test:editor
npm run build:editor -- --out ../work/refactor/editor-service/web
node tests/browser/test_react_editor.cjs ../work/refactor/editor-service/web ../work/refactor/react-first-slice
```

Browser 測試使用 production bundle、真正 RF 與可控制故障的 HTTP 替身；預設本機 Chrome 路徑可用 `CHROME_PATH` 覆寫。它不等於 TD/GPU 證據。正式 TD 上選擇此輸出資料夾並使用 Editor Service 的 **Update Embedded** 或外部來源 **Reload**。不要把 TypeScript 源碼直接匯入 TD。

核心組裝器從 `core-ts/nodes/` 讀模組，產生 `src/generated/` 的 `wire_planning.js`／bootstrap。React 只以 type import 接型別、執行同一生成核心；不能只改 TS 卻用舊 bundle/hash。建置把編輯器、Remote Panel 前端及第三方授權放入同一資產包，沒有第二個正式 web server。

`test_react_session.cjs` 可用 `REACT_PERF_REPORT` 環境變數保存 102 節點／101 線樣本；`benchmark_react_editor.cjs BUILD PROTOTYPE_BUILD REPORT` 使用該報告中的同圖，對照已另建置的評估版，並量 30 秒待機。這些測試工具不進產品 bundle。

## 保存與恢復

- 數值提交後排程套用；Apply 立即送出。正在送出的快照固定；晚回覆只確認那份快照，再送之後的新修改。
- HTTP 結果不明／revision 衝突時停止自動重送，圖仍可編輯。按「檢查連線與版本」只查狀態；外部版本不同時保留草稿，不能直接覆蓋。
- 瀏覽器 sessionStorage 只作本頁暫存，不是持久 Library。重新開頁有草稿時先明確選擇；無法暫存時可下載。套用成功不等於 TOE 已保存。
- `保存 TD 專案` 使用原有宿主 save，不聲稱替使用者備份所有外部資產。

舊 UI 仍有自己的原流程，因為它還服務其他能力；當下一個正式切片接管其用途時再移除對應責任。不要借此長出新的通用 Application framework。

## 本輪驗收入口

實際部署、提交、證據與限制在 [STATUS](../../docs/development/STATUS.md)。Human Takeover 依 [B 案](../../docs/development/REFACTOR_REACT_FLOW_PLAN_B.md#human-takeover-test) 實測；自動測試不能代替人類獨立維護證據。面板、完整動態接孔、Uniform／原生歷史、Subgraph、MAT／ISF、弱機／Safari／觸控及完整 TOE 冷啟動不因首輪 TOP 通過而視為完成。
