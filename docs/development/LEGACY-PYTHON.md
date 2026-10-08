# 舊 Python 現況清單

最後更新：2026-10-08（清殘留第 4 條，判斷規則見 design-interview Q48）。給人類看的盤點：重構中還剩哪些 Python、在哪裡、誰在用、去向為何。舊核心會在重構中**逐步**退場，不是一次性移除；TD 網路裡用 annotate 框標示同一套分類，兩邊須一致。

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
| next_family | 執行編輯器送來的請求：核對信封、GPU 驗證、存圖（圖是不透明文字） | `src/td/runtime/next_family.py` |
| validation | GPU 驗證空間 | — |
| status | 狀態顯示 | — |

**待人類刪除**

| OP | 說明 |
| --- | --- |
| sources | 舊 Uniform 來源管理（`src/core/sgrape_sources.py` 的副本）。2026-10-08 起沒有任何程式載入；刪除時被權限檢查擋下，留給人類在 TD 手動刪。需求照 Q41 重做 |

2026-10-08 已刪（Q48 清理第 2、4 條）：native_family、host_artifact、host_document、native_values、history、parameters、sgrape_source_catalog、source_catalog（資料檔 `src/library/source_catalog.json` 仍由 TS 核心使用）、parameter_links_source，以及兩個 Legacy 框。

## `/TD_Grape` 其他部分與 repo 其餘 Python（2026-10-07 盤點 ✅）

方法：以 TD MCP 將 TOE 內每個 DAT 與 repo 檔案逐字比對（忽略換行差異），再以 `git grep` 查 repo 內引用。

**TOE 內（`/TD_Grape` 這一層）**

| OP | 內容 | 判定 |
| --- | --- | --- |
| `GrapeEditor` | `editor_service*.py`、`editor_folder_callbacks.py` 5 份，皆與 repo 一致 | 常駐 |
| `GrapeManager` | 見上節 | 已整理 |
| `remote_panel` | 13 份與 [src/remote_panel](../../src/remote_panel) 一致；另 107 個 DAT 為 TD 內建元件（annotation、cameraViewport 等）的內部程式，非本專案 | 常駐 |
| `masters`（`grape_mat`、`grape_top`） | 舊式 Grape OP 範本；`controls` 是 [shader_controls.py](../../src/td/runtime/shader_controls.py)，Open Editor 要呼叫舊的 `runtime`，已不存在 | **暫留**（Q48）：TDFam 的 `Opcomp` 指向這裡。出口：「建立 Grape OP」那一輪（Q6、Q16）換成新格式範本 |
| `family_callbacks` | [family_callbacks.py](../../src/td/runtime/family_callbacks.py)：TD 選單建立 Grape OP 後的 `onPostPlaceOp` 呼叫舊 `runtime` | **暫留**（Q48）：TDFam 的 `Callbackdat` 指向這裡；從選單建立會失敗（依程式判斷，未實測）。出口同上 |
| `tdfam` | TDFam 外部套件 | 不納入 |
| `IconGen`、`icon`、`licenses` | 保護區／授權 | 不動 |

各 Grape OP 內：`GrapeControls/editor_control` 為新式 [native_family_controls.py](../../src/td/runtime/native_family_controls.py)（常駐）。測試 OP `Grape_TOP_React` 的舊 `parameter_links`／`parameter_lifecycle` 與舊 storage 已於 2026-10-08 刪除（內容備份在 workspace `work/refactor/cleanup-4/`）；舊格式的 `Grape_TOP_Refactor` 未動（舊圖樣本）。

**repo 裡、但不在 TOE 執行的 Python**

| 檔案 | 誰還在用 | 判定 |
| --- | --- | --- |
| `src/core/sgrape_core.py`、`sgrape_composites.py`、`sgrape_document.py`、`sgrape_library.py`、`sgrape_legacy_nodes.py`、`sgrape_voronoi.py` | 只有 Python 單元測試、TD 測試、部分 integration 測試（以舊 Python compiler 當對照基準，例如 `tests/unit/top_compiler_oracle.py`），以及建置工具 `tools/build/build_textured_material_presets.py`、`sync_node_browser.py`、`tools/dev/check_locales.py` | 只剩測試／工具 |
| `src/td/runtime/editor_launch.py` | 目前沒有呼叫者 | **留**（Q48：符合新架構，Q45 決議 App 視窗與偵測預設瀏覽器會用到） |

2026-10-08 已刪（Q48 清理第 4 條）：`sgrape_runtime.py`、`sgrape_live.py`、`pixel_preview_recovery.py`、`frontend_artifact.py`、`manager_controls.py`、`tdfam_menu_colors.py`、`controls.py`，以及只測它們的單元測試 13 檔、TD 測試 8 檔、`tools/dev/prepare_cold_start.py` 與 `tests/td/cold_start_probe.py`；4 個 integration 測試拿掉「舊 TD 接收端」那段（與 legacy 編譯器比對的部分保留）。需求（選單顏色、建立按鈕、個人資料夾等）已記在需求盤點與 Q45。

**仍待處理**：舊 Python 核心（`src/core`）與用它的測試、對照表 `embedded_sources.json`／`source_files.json`（描述舊 Manager 配置）屬清理第 5 條。
