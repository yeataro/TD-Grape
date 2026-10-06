# 舊 Python 現況清單

最後更新：2026-10-07。給人類看的盤點：重構中還剩哪些 Python、在哪裡、誰在用、去向為何。舊核心會在重構中**逐步**退場，不是一次性移除；TD 網路裡用 annotate 框標示同一套分類，兩邊須一致。

## 歷史

人類 2026-10-07 口述，同日以 git 與 workspace 文件查證。git 從 2026-09-12 的 0.8.5 起算，更早的經過沒有紀錄。✅＝有文件／程式佐證；◐＝部分佐證；人類＝只有人類陳述。

| 經過 | 查證 | 根據 |
| --- | --- | --- |
| 原架構：核心用 Python 在 TD 執行（推導、驗證、子圖展開、產 GLSL），網頁由 TD 提供 | ✅ | [可行性評估](../../../TD-Grape-in-place-refactor-feasibility-2026-10-04.md) 第 77、120 行：`sgrape_core.py` 的 `compile_graph`；「核心從宿主移到前端」 |
| 圖的權威在 TD，瀏覽器是快照 | ✅；新架構改為**依範圍定義** | 設計訪談 Q8b：TD 仍保存可重開的圖，搬走的是**運算**（推導、驗證、產碼）。2026-10-07 Q28 定案：編輯器內部 GraphDocument 是唯一權威；編輯器與 TD 之間，TD 保存已送達的圖與 Shader；編輯不等 TD |
| 同步實際沒有大問題，Legacy 目前沒發現大 bug | 人類 | 文件中沒有正反證據 |
| 編輯慢以「編輯完再一次更新」解決；問題是拖累 TD 效能 | ◐ | 650 ms 合併送出在 git 起點（0.8.5）已存在，無法查到加入時間。STATUS 2026-09-19「同步效能 A／B／C」（0.8.115–0.8.116）進一步減少 TD 端 Python 產碼：純布局變更從 6 次產碼降到 0 次 |
| **遷移主因是擴充性**：節點綁在推導鏈，加新東西要全部動 | ✅ 內容；「主因」為人類排序 | 設計訪談「已確認的人類意圖」列出擴充性、核心移到前端、效能、保留體驗等並列目標；[可行性評估](../../../TD-Grape-in-place-refactor-feasibility-2026-10-04.md) 第 84 行：同一流程跨越全域 Graph、Stage、選取、History、render 與 Host 回覆；[性能歸因](../../../work/in-place-refactor-design/object-model-causal-attribution-2026-10-04.md)：「解除節點對中央長串特例與推導流程的耦合」 |
| 核心已遷到 TS，部分舊功能仍在 Python | ✅ | 本頁下方盤點 |
| 遷移途中發現前端效能問題 → 採用 React Flow | ✅ | [性能歸因](../../../work/in-place-refactor-design/object-model-causal-attribution-2026-10-04.md)：接線約 200 ms，主要花在全量重建 DOM 卡片與量尺寸；設計訪談 Q24（先提 Vue）→ Q25（2026-10-06 人類試用後採 React／React Flow） |
| 與 GPT 討論後改為前端也逐片更新、保留舊編輯器 | ✅ | 設計訪談 Q26：人類要求實作者（Codex，GPT 系）依 repo 實況另推方案，接受 [B 案](REFACTOR_REACT_FLOW_PLAN_B.md)；A 案保留比較 |

## 分類

| 類別 | 意思 | TD annotate |
| --- | --- | --- |
| 常駐 | 本來就該在 TD 的宿主程式，一直保留 | 維持原有框，不加 Legacy |
| 共用・待更新 | 舊核心，新舊入口都會用到；之後重寫或搬走，框內寫去向 | 黃框 `Legacy · 共用・待更新` |
| 舊入口專用・待遷移 | 只有舊編輯器在用，但功能要保留，關閉舊入口前要搬到新入口 | 橘框 `Legacy · 舊入口專用・待遷移` |
| 只給舊入口 | 舊入口關掉時一起刪 | 待定（尚未出現） |
| 沒人用 | 沒有任何呼叫，人類確認後刪 | 待定（尚未出現） |
| 只剩測試／工具 | 不在 TOE 執行，只被測試（如以舊 Python compiler 當對照基準）或建置工具引用 | 無 OP，只記在本頁 |
| 已斷 | 舊版有、新版沒接上（例：舊編輯器匯入時的 `POST inspect`）；或 TOE 裡的 OP 依賴已移除的舊程式 | 有 OP 時暗紅框 `Legacy · 已斷：…`；無 OP 只記在本頁 |

## `/TD_Grape/GrapeManager`（已整理 ✅）

TOE 內 DAT 與 repo 檔案於 2026-10-07 逐一比對，內容一致。DAT 由 [install_native_manager.py](../../tools/jobs/install_native_manager.py) 從 repo 寫入；位置與 Legacy 框也由它維護，重跑不會打亂分組。

**常駐**

| OP | 做什麼 | repo |
| --- | --- | --- |
| GrapeManagerExt | 編輯協調總入口 | `src/td/runtime/grape_manager_ext.py` |
| host_api | 接收網頁請求 | `src/td/runtime/host_api.py` |
| host_requests | 請求排隊、交給 TD 主執行緒 | `src/td/runtime/host_requests.py` |
| request_pump | 每幀處理排隊請求 | 安裝程式直接寫入 |
| native_family | 把前端產碼套用到 Family | `src/td/runtime/native_family.py` |
| host_artifact | 檢查前端產碼結果 | `src/td/runtime/host_artifact.py` |
| host_document | 保存圖文件 | `src/td/runtime/host_document.py` |
| native_values | 寫入 TD 數值、Undo | `src/td/runtime/native_values.py` |
| validation | GPU 驗證空間 | — |
| status | 狀態顯示 | — |

**共用・待更新**

| OP | 做什麼 | repo | 去向 |
| --- | --- | --- | --- |
| sources | Uniform 來源管理（含「有節點引用就不准刪」） | `src/core/sgrape_sources.py` | 留在 TD，重寫 |
| sgrape_source_catalog | 讀取來源定義 | `src/core/sgrape_source_catalog.py` | 留在 TD，重寫 |
| source_catalog | 來源定義資料，TS 核心也讀同一份 | `src/library/source_catalog.json` | 前後端共用資料 |
| history | 原生參數 Undo 紀錄 | `src/core/sgrape_history.py` | 待討論 |
| parameter_links_source | Uniform 與元件參數綁定 | `src/core/sgrape_parameter_links.py` | 留在 TD，重寫 |

**舊入口專用・待遷移**

| OP | 做什麼 | repo |
| --- | --- | --- |
| parameters | 元件自訂參數頁編輯；新入口目前只呼叫 state／apply／save | `src/core/sgrape_parameters.py` |

## `/TD_Grape` 其他部分與 repo 其餘 Python（2026-10-07 盤點 ✅）

方法：以 TD MCP 將 TOE 內每個 DAT 與 repo 檔案逐字比對（忽略換行差異），再以 `git grep` 查 repo 內引用。

**TOE 內（`/TD_Grape` 這一層）**

| OP | 內容 | 判定 |
| --- | --- | --- |
| `GrapeEditor` | `editor_service*.py`、`editor_folder_callbacks.py` 5 份，皆與 repo 一致 | 常駐 |
| `GrapeManager` | 見上節 | 已整理 |
| `remote_panel` | 13 份與 [src/remote_panel](../../src/remote_panel) 一致；另 107 個 DAT 為 TD 內建元件（annotation、cameraViewport 等）的內部程式，非本專案 | 常駐 |
| `masters`（`grape_mat`、`grape_top`） | 舊式 Grape OP 範本；`controls` 是 [shader_controls.py](../../src/td/runtime/shader_controls.py)，Open Editor 要呼叫舊的 `runtime`（`sgrape_runtime`），TOE 中已不存在 | **已斷**（TD 暗紅框） |
| `family_callbacks` | [family_callbacks.py](../../src/td/runtime/family_callbacks.py)：TD 選單建立 Grape OP 後的 `onPostPlaceOp` 呼叫舊 `runtime` | **已斷**（TD 暗紅框）：依程式判斷，從選單建立 Grape OP 會失敗，**未實測** |
| `tdfam` | TDFam 外部套件 | 不納入 |
| `IconGen`、`icon`、`licenses` | 保護區／授權 | 不動 |

各 Grape OP 內：`GrapeControls/editor_control` 為新式 [native_family_controls.py](../../src/td/runtime/native_family_controls.py)（常駐）；`GrapeControls/parameter_links` 為 `sgrape_parameter_links.py` 副本（共用・待更新，同 GrapeManager）。

**repo 裡、但不在 TOE 執行的 Python**

| 檔案 | 誰還在用 | 判定 |
| --- | --- | --- |
| `src/core/sgrape_core.py`、`sgrape_composites.py`、`sgrape_document.py`、`sgrape_library.py`、`sgrape_legacy_nodes.py`、`sgrape_voronoi.py` | 只有 Python 單元測試、TD 測試、部分 integration 測試（以舊 Python compiler 當對照基準，例如 `tests/unit/top_compiler_oracle.py`），以及建置工具 `tools/build/build_textured_material_presets.py`、`sync_node_browser.py`、`tools/dev/check_locales.py` | 只剩測試／工具 |
| `src/td/runtime/sgrape_runtime.py`（舊編輯器宿主） | 測試；`tools/dev/prepare_cold_start.py` 讀它的 `PRODUCT_VERSION`；被 `masters`／`family_callbacks` 依賴但已不在 TOE | 只剩測試／工具（其依賴者已斷） |
| `frontend_artifact.py`、`pixel_preview_recovery.py`、`sgrape_live.py` | 只被 `sgrape_runtime.py` 或測試引用 | 只剩測試／工具 |
| `editor_launch.py` | 被 `shader_controls.py`、`manager_controls.py` 引用（皆舊式路徑） | 只剩舊式路徑 |
| `manager_controls.py`、`tdfam_menu_colors.py`、`controls.py` | 只在對應表（`src/td/embedded_sources.json`、`source_files.json`） | 沒人用（待人類確認） |

**要人類決定的**：(1) 從 TD 選單建立 Grape OP 是否真的壞了、要不要先實測；(2)「只剩測試／工具」的舊 Python，是保留當對照基準，還是等 TS 測試涵蓋後移除；(3) 「沒人用」三檔是否刪除。
