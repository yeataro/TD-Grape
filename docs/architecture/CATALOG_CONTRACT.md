# 節點 Catalog 與版本來源（0.6.3）

`src/library/node_catalog.json` 是隨產品提供的節點資料表，TD 主元件內嵌為 `node_catalog` Text DAT。Python 核心與 TD 讀取相同內容；TOX 可獨立攜帶它，不依賴開發電腦上的來源路徑。既有 31 個節點的 UUID、revisionHash、介面與預設值保持一致，4 個 Function 庫快照亦未改寫。

## 已建立的資料契約

- `schemaVersion` 控制資料格式；`catalogVersion` 標示這份資料的版本。
- 每份 definition 保留原始 `definitionUuid` 與內容 `revisionHash`。
- `emitter.id`／`emitter.version` 指向核心已實作的 Python 產碼器，另有 `emitterAbiVersion` 和 `targetShellVersion`。JSON 不提供可任意執行的 Python／GLSL 模板。
- `catalog_contract()` 提供穩定排序的版本清單與 hash；產出元件的 manifest 保存 `catalogContractHash`，Update Shaders 會據此檢查是否需要更新。Hash 用於一致性核對，不是安全簽章。

檢查過 v0.1.0 至 v0.6.2 的 13 個本地封存 tag，保存其中 18 份真實舊定義和來源 tag。這些定義與現在的差別只有說明文字索引；輸入口、輸出口、stage、預設值等運算介面相同。歷史定義若有不同運算介面，載入器會拒絕把它直接別名到目前產碼器。

這個歷史清單只證明定義介面與來源。它不承諾重新產生所有舊版 compiler 的完整 GLSL；舊版 TD shader 外殼與實作重播尚未完成。

## 升級政策已確認（2026-09-10）

使用者已選擇「先提示差異，確認後才升級；確認前保留上次成功輸出」。詳見 [UPGRADE_POLICY.md](UPGRADE_POLICY.md)。下方描述的是 0.6.3 至 0.8.1 的既有程式；新確認流程尚待實作，不能把本次規格決策誤報為已交付。

## 查核與部署的界線

帶認證的 state API 新增 `catalogContract`、`definitionReview`；匯入檢查也回傳 `definitionReview`。查核涵蓋根圖和未使用的 Function，區分 `exact`、`compatible_history`、`unversioned`、`unresolved_revision`、`unresolved_definition`，以及 Function 介面／呼叫標記。查核不改原圖、接線、revision 或庫快照。

**本版不改變既有版本升級政策。** 原始規格允許相同 UUID 使用目前定義；因此已知 UUID 但不認識 revision 時，現有編譯器仍使用目前實作。API 會標示差異，UI 尚未顯示新的版本提示。未知 UUID 仍不能編譯，外來 archive 僅保留資料，不執行其中程式。

政策已選定：要求接受後才升級，确认前保留最後成功 Shader；不再採自動改變運算行為的方向。完整版本選擇、deprecated、舊實作封存／重播、migration 與畫布修復仍待後續。這批只完成可追蹤的資料基礎，不將待決方案視為已實作。

## 驗證

57 個本地核心／文件／型別／catalog 測試通過，其中既有 138 張圖的完整編譯指紋、496 組跨語言 port 規則維持一致。4 組 JavaScript 模型測試與 205 個中英文字鍵通過。TD 2025.32820 的 22 項內嵌 catalog／TOX 檢查和 24 項 runtime／實際 MAT、TOP 輸出檢查通過。

主元件移除後與重載後、獨立 MAT／TOP TOX 的輸出像素差皆為 0；17 個內嵌來源逐一一致。Graph、Shader ID、Uniform 值／Expression／Bind 保留。17 項本機 HTTP 檢查確認新 API 與完整頁面資源；私人 gateway 17 項檢查從同一電腦經 Tailscale IP 通過。

本版沒有新瀏覽器點擊流程或以新 TD 程序重開最終乾淨 TOE；不可將 HTTP 與 TOX 驗證描述成這兩項驗收。
