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
