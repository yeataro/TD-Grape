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
