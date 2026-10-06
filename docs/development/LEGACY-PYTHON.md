# 舊 Python 現況清單

最後更新：2026-10-07。給人類看的盤點：重構中還剩哪些 Python、在哪裡、誰在用、去向為何。舊核心會在重構中**逐步**退場，不是一次性移除；TD 網路裡用 annotate 框標示同一套分類，兩邊須一致。

## 歷史（待查證）

以下是人類 2026-10-07 口述，**尚未用 git 歷史與文件查證**，查證後改寫並標明根據。

- 原架構：核心用 Python 寫、在 TD 執行，TD 也提供網頁；圖的權威在 TD，瀏覽器只是快照。
- 同步問題實際不大，Legacy 版目前沒發現大 bug；編輯慢後來以「編輯完再一次更新」解決，但編輯運算有時拖累 TD 效能。
- **遷移主因是擴充性**：節點綁在單一推導鏈，結構複雜，每加新東西就要全部動一遍。搬到前端後，TD 不承擔編輯運算、不管狀態同步，擴充也容易。
- 核心已遷到 TS 網頁端，但仍有舊功能留在 Python。
- 遷移途中又發現前端效能問題，研究後採用 React Flow；與 GPT 討論後改為前端也逐片更新、保留舊編輯器（B 案）。

## 分類

| 類別 | 意思 | TD annotate |
| --- | --- | --- |
| 常駐 | 本來就該在 TD 的宿主程式，一直保留 | 維持原有框，不加 Legacy |
| 共用・待更新 | 舊核心，新舊入口都會用到；之後重寫或搬走，框內寫去向 | 黃框 `Legacy · 共用・待更新` |
| 舊入口專用・待遷移 | 只有舊編輯器在用，但功能要保留，關閉舊入口前要搬到新入口 | 橘框 `Legacy · 舊入口專用・待遷移` |
| 只給舊入口 | 舊入口關掉時一起刪 | 待定（尚未出現） |
| 沒人用 | 沒有任何呼叫，人類確認後刪 | 待定（尚未出現） |
| 已斷 | 舊版有、新版沒接上（例：舊編輯器匯入時的 `POST inspect`） | 無 OP，只記在本頁 |

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

## 尚未整理

- `src/core/` 其餘 6 檔（`sgrape_core.py`、`sgrape_composites.py`、`sgrape_document.py`、`sgrape_library.py`、`sgrape_legacy_nodes.py`、`sgrape_voronoi.py`）：不在 GrapeManager，誰在用待查。
- TOE 內其他 Python DAT：`remote_panel`（91）、`masters`（6）、每個 Grape Family 內約 15 個、`GrapeEditor`（已確認與 repo 一致，屬常駐）。`tdfam`（162）為外部套件，不納入。
