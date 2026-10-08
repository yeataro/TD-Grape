# 開發流程

TD 原生 Console、GLSL 診斷及掛起排查見 [開發技巧：外部擷取 TD 原生 Console](TD_NATIVE_CONSOLE.md)。

1. 在 TouchDesigner 開啟 `src/td/TD-Grape-dev.toe`。TOE 中的管理元件會啟動產品 Editor 服務。
2. 修改 `src/` 中的程式。`source_files.json` 集中記錄實際位置；不要另建第二份平行 src。Manager 內的 DAT 由 [install_native_manager.py](../../tools/jobs/install_native_manager.py) 從 repo 寫入；網頁資產用 `/dev_tools/grape_editor` 的 `DevMode()`／`Deliver()`（見 AGENTS.md）。舊的 `embedded_sources.json` 與 `refresh_sources.py` 描述舊 Manager，已於 2026-10-08 清理第 5 條刪除。
3. 要在 TD 啟用本機開發橋接，在 Textport 執行：

```python
from pathlib import Path
exec((Path(project.folder) / '../../tools/dev/bootstrap.py').resolve().read_text(encoding='utf-8'))
```

4. 在專案根目錄的外部終端以 `python tools/dev/submit_job.py <job.py>` 送出開發工作。

開發橋接只從本機工作目錄讀取工作請求，不新增網路服務。它接受本專案 `tools/dev/jobs`、`tests/td`，以及對應私人 `work/jobs` 中的 Python 工作。產品 Web API 不提供這個介面。

產品版本只寫在 `src/version.json`（2026-10-08 起；舊的 `sgrape_runtime.py` `PRODUCT_VERSION` 已刪）。以下為歷史紀錄：版本交付時同步核對 `runtime/sgrape_runtime.py` 的 `PRODUCT_VERSION`、`editor/index.html` 的標題列 `.brand-version` 與 About `.about-version`；三者應顯示相同產品版本，不能只更新 TD 端。2026-09-19 使用者回報標題仍停在 0.8.90，此核對納入後續交付步驟。

refactor 分支的前端識別採 `0.8.276 Refactor.N`，從 `Refactor.1` 開始逐次遞增；數字基準仍與 `PRODUCT_VERSION` 一致，重構序號用來辨別前端交付，不作 Shader 編譯格式版本。標題列、About 與瀏覽器分頁都顯示這份識別，舊 main／Legacy 的 DEV 標示維持原樣。

`Refactor.2` 的狀態列固定顯示 `GLSL Generation`：前端 TypeScript（新）或宿主 Python（舊），並區分目前圖的待產碼、產碼中、已產碼與失敗。待產碼只代表選定路徑；成功依真正完成的工作記錄，晚回覆不把較新圖標為成功。前端產碼完成不等於 TD 已成功套用，套用／連線結果仍由一般狀態訊息顯示。程式碼對話框與 GLSL 面板使用相同路徑選擇；尚未支援的整份圖繼續走 Python。

Refactor.3 依人類回饋恢復原狀態列高度及位置；一般訊息與產碼路徑同行，移除箭頭及按鈕底色，直接點文字展開歷史。展開清單與可點擊狀態區等寬，窄螢幕使用可用寬度；時間與訊息同行，目標路徑保留在該筆提示。保留本分頁最近 200 筆，相鄰相同訊息合併計數；重新整理後清空，不寫入作品或 Undo。長清單可捲動，Escape／關閉按鈕／點外部可收起。隔離瀏覽器回歸入口：`node tests/browser/test_status_history.cjs EDITOR_SOURCE STATE_JSON REPORT_DIR`，沿用 `test_glsl_code.cjs` 的 Playwright fixture；不對 live TD 寫圖。

目前開發交付依使用者已確認的約定：每一批可交付修改完成必要驗證後，即同步 TD、核對現有 Shader 保留、保存 TOE 並提交交付紀錄，主動回報可 review 的內容，不累積到所有子任務完成才交付。使用者允許在任務需要時使用電腦；開始操作介面時說明用途，結束時明確告知已用完，並區分滑鼠鍵盤操作與背景檔案／測試／TD 同步。詢問是否用完是在確認工作狀態，不代表要求停用電腦或暫停交付；暫停依使用者明確指示。來源同步與重新整理使用者正在編輯的網頁分開處理，不要為了載入新版 UI 擅自丟棄未提交草稿。

正式來源 TOE 不保存私人遠端代理、正在執行的開發 runner、網址憑證或機器路徑。私人開發環境的完整 checkpoint 應存到私人工作區；更新正式 TOE 時使用 `tools/dev/jobs/save_source_project.py`，它會暫時移除已辨識的私人助手並在保存後恢復目前工作環境。

任何來源搬移後，先跑可攜測試，再在另一個位置重開 TOE 驗證。來源檔移動不改變序列化的舊名稱或 UUID。

## 舊 Manager 時代的段落（已移除）

原本這裡記錄舊管理元件的網路配置、原生元件改名、管理元件參數、Master 同步與共享預覽，以及對應的工具（`arrange_native_networks.py`、`rename_native_components.py`、`refresh_sources.py`、`sync_masters.py`、`save_source_project.py`、`migrate_shared_preview.py`）。這些工具與舊 runtime 已於 2026-10-08 清理第 4、5 條刪除（design-interview Q48）；原文見 git 中 `319e830` 之前的本檔。

仍在的：Remote Panel 模組用 `tools/dev/jobs/build_remote_panel.py` 重建（說明見 `src/remote_panel/README.md`）；`masters`／`family_callbacks` 暫留到「建立 Grape OP」那一輪（Q6、Q16）。
