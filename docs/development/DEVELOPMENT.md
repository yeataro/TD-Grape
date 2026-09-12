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
