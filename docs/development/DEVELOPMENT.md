# 開發流程

1. 在 TouchDesigner 開啟 `src/td/TD-Grape-dev.toe`。TOE 中的管理元件會啟動產品 Editor 服務。
2. 修改 `src/` 中的程式。`source_files.json` 集中記錄實際位置，`embedded_sources.json` 記錄管理元件 DAT 對應。不要另建第二份平行 src。
3. 要在 TD 啟用本機開發橋接，在 Textport 執行：

```python
from pathlib import Path
exec((Path(project.folder) / '../../tools/dev/bootstrap.py').resolve().read_text(encoding='utf-8'))
```

4. 在專案根目錄的外部終端執行：

```text
python tools/dev/submit_job.py tools/dev/jobs/refresh_sources.py
```

開發橋接只從本機工作目錄讀取工作請求，不新增網路服務。它接受本專案 `tools/dev/jobs`、`tests/td`，以及對應私人 `work/jobs` 中的 Python 工作。產品 Web API 不提供這個介面。

更新工具比較實際來源內容，只更新有變更的 DAT，並保留目前的圖、Shader 身分與連線。更新內嵌程式後仍需保存 TOE。變更編譯契約時應依升級流程處理既有 Shader，不以整批重建掩蓋相容問題。

目前開發交付依使用者已確認的約定：每一批可交付修改完成必要驗證後，即同步 TD、核對現有 Shader 保留、保存 TOE 並提交交付紀錄，主動回報可 review 的內容，不累積到所有子任務完成才交付。使用者取回電腦操作不等於暫停背景來源同步；需要暫停時以使用者明確指示為準。來源同步與重新整理使用者正在編輯的網頁分開處理，不要為了載入新版 UI 擅自丟棄未提交草稿。

正式來源 TOE 不保存私人遠端代理、正在執行的開發 runner、網址憑證或機器路徑。私人開發環境的完整 checkpoint 應存到私人工作區；更新正式 TOE 時使用 `tools/dev/jobs/save_source_project.py`，它會暫時移除已辨識的私人助手並在保存後恢復目前工作環境。

任何來源搬移後，先跑可攜測試，再在另一個位置重開 TOE 驗證。來源檔移動不改變序列化的舊名稱或 UUID。

## TD 內部網路配置

2026-09-15 完成管理元件與 TOP／MAT 模板的第一輪位置整理：管理元件按執行控制、編譯與來源、Web UI、TDFam 分區；TOP 依來源 → 輸入 → Shader → 輸出排列；MAT 分開貼圖來源、Shader DAT／MAT、預覽場景。控制與保存資料放在下方，長來源名稱之間留出額外空間。

這是供人工接著調整的一次性整理。產品啟動、更新或 Apply 不會呼叫重排工具；使用者後續移動的位置應保留。TDFam 第三方元件內部不在此次整理範圍。

只有明確要重新排列時才執行：

```text
python tools/dev/submit_job.py tools/dev/jobs/arrange_native_networks.py --report td-layout/manual-pass
```

此工具只改 TD OP 的 `nodeX`／`nodeY`，不更新 Web Shader 圖或編譯內容。修改前驗證間距，修改後比對節點、接線、參數、DAT 內容、storage 與顯示設定；不通過則還原位置。原座標、規劃座標與比對結果寫到私人工作區的報告目錄。透過 `save_source_project.py` 另行保存 TOE。


## 原生元件名稱

開發 TOE 的管理元件為 `TD_Grape`，模板為 `masters/grape_top` 與 `masters/grape_mat`。新增的使用者組件仍叫 `Grape_TOP1`／`Grape_MAT1`。`master_template()` 優先尋找新名稱，也接受舊模板名稱；TDFam 的 `op_type`、storage keys、圖 UUID 與舊檔案識別碼維持相容。

既有開發工程的改名使用 `tools/dev/jobs/rename_native_components.py`，只針對這三個已知 OP，遇到新舊模板同時存在會停止。它會先備份管理元件，保留 OP 身分、接線、參數、Shader DAT 與人工位置，檢查 TOP 輸出及 TDFam 的新舊名稱查找；失敗時還原名稱。產品啟動不會自動替使用者改名。

`tests/td/test_native_naming.py` 驗證 TOP／MAT 建立入口、原生編譯、回到管理元件的解析，以及舊模板相容；測試組件於結束時移除。改名後仍透過 `save_source_project.py` 保存正式 TOE。

同輪清理 TOP 模板中已確認未使用的 `input_fallback`、`shader_pixel`、`shader_info`、`shader_compute`，並清空未使用的 Compute DAT 引用。保留實際產碼 `pixel_shader`、編譯檢查 `compile_info` 及仍被流程引用的輸入鏈；清理前後編譯與 TOP 圖像相同。Output／Common 的參數模板與輸入鏈簡化等待人工設計，尚未套用。


## 管理元件參數分類

`TD-Grape` 頁依序分組為建立 TOP／MAT、開啟 Editor／Browser、Update Shaders／Last Update，以及 Version。`Settings` 頁分組為 LAN／憑證／連線資訊、個人函式庫，以及 TDFam 註冊／狀態；組間使用 TD 原生分隔線。這些產品參數的標籤使用英文，原本的參數名稱、值、Expression 與 callback 保留。`arrange_manager_parameters()` 在啟動及整理模板時維持分類，僅處理已知管理參數；不移動節點或重編譯使用者圖。管理元件的 Version 顯示目前載入的 runtime 版本。

個人函式庫優先使用 Palette 下的 `TD-Grape/Functions`；若新目錄不存在但舊 `TD-Sgrape/Functions` 有資料，仍可讀取舊庫。此次已將開發環境的舊資料夾改名、更新參數 Expression，驗證檔案雜湊及讀入的函式相同；既有函式檔案格式與檔名保持相容。

Open Editor 在沒有 Shader 時自動建立 MAT 的行為仍待調整；允許尚未連接 Shader 的空白編輯器是討論中的方向，本次參數分類尚未改動該流程。

## Master 同步與 MAT 清理

2026-09-15 將兩份 Master 保留的預設圖同步至目前的 0.8.73 編譯器與 targetShellVersion 2。保留圖的節點、連線與位置，以及 TD OP 身分和既有參數值；不以重新建立範例圖取代人工編輯的模板。MAT 的 COMP Viewer 指向 `material`，網頁預覽由 `grape_material_preview` 擷取同一個 MAT。

MAT 移除四個已確認無引用的節點：重複的 `material_info`、舊 `asset_texture_main_image`，以及誤建立於 MAT 的 TOP Input 0 預設 Select／Movie File In。建立新 MAT 時重用原生自動產生的 Info DAT 作為 `compile_info`，並只為 TOP 加入預設 COMP 輸入資源，避免重新產生這些冗餘。有效的 Sampler 貼圖鏈、Shader DAT、`compile_info`、Render 驗證場景及控制同步助手保留；新增助手放到獨立位置，既有人工配置不變。

更新工具不再忽略 `reviewRequired`。普通 `prepare_masters()` 遇到需要確認的舊圖會明確報錯；已核對編譯變更、確定要升級產品 Master 時，再依序執行：

```text
python tools/dev/submit_job.py tools/dev/jobs/refresh_sources.py
python tools/dev/submit_job.py tools/dev/jobs/sync_masters.py --report master-sync
python tools/dev/submit_job.py tests/td/test_master_templates.py --report master-check
python tools/dev/submit_job.py tests/td/test_native_naming.py --report master-create-check
python tools/dev/submit_job.py tools/dev/jobs/save_source_project.py
```

`sync_masters.py` 只處理目前管理元件的兩份 Master，使用正常的候選圖驗證與 upgrade ticket 流程，並先備份模板。升級的舊內容保存在私人報告目錄，不把模板的 `upgrade_backup` 複製進之後新建的 Shader。使用者實例仍使用既有升級確認流程；產品啟動不自動執行此開發工作。

從 Master 開啟 Editor 會保留 Master 身分；複製到其他位置的組件才登記為新 Shader。新建組件仍預設只顯示自訂參數。來源刷新、模板同步與保存工具從專案根層尋找管理元件，支援此次將 `TD_Grape` 搬到根層後的開發工程。


## Shared preview integration (0.8.74)

Graph UI uses the manager's `remote_panel`. Rebuild that module before refreshing
manager sources: `build_remote_panel.py`, then `refresh_sources.py`. This updates
the same-origin ES module assets and the companion-port CSP. The transfer lease
and source selection are documented in `src/remote_panel/README.md`.

MAT creation no longer builds `preview_geometry`, `preview_camera`, `preview` or
`grape_material_preview` inside every shader. `validation_scene(comp)` borrows one
manager-owned rectangle/camera/render context during candidate validation and
final deployment, then releases its material reference, including on exceptions.
GLSL compile diagnostics and failed-deploy rollback remain intact. This renderer
is independent of the interactive Remote Panel target.

Run the explicit `tools/dev/jobs/migrate_shared_preview.py` for old authoring
Masters/instances after reviewing the change. It checks native references, saves
a private backup, removes only the recognized MAT scene/capture, and compares
saved graph data, retained node identities and positions. TOP's small `preview`
Resolution TOP is retained for its local COMP viewer and legacy PNG API.
Legacy MAT PNG requests lazily create manager-owned captures under
`snapshot_previews`; the normal Graph UI never creates or polls them. New copies
of Grape MAT therefore do not carry private validation/capture scenes. Use
`sync_masters.py` to bring template compiler metadata forward without a graph
schema upgrade. Do not increment catalog definitions for this UI/runtime change.


Remote Panel 0.1.4 adds `panel-size.js` to the companion module's embedded assets.
`refresh_sources.py` refreshes the HTTP asset snapshot even when no manager DAT
changed, so rebuilding only the companion module cannot leave stale JavaScript
at the editor origin. Rebuild the module, refresh sources, then reload the browser.
