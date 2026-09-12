# TD-Sgrape 原生 OP 配色

2026-09-10：依使用者確認，MAT／TOP 都使用 Sgrape 色系，向各自 TD 原生家族色靠近，但不直接使用原生家族色。

| 元件 | 第一組色票 | RGB（0–1） |
|---|---|---|
| TD-Sgrape 主元件／Family Tab | 葡萄紫 | 0.48, 0.33, 0.67 |
| Sgrape MAT | 偏暖的灰紫 | 0.57, 0.46, 0.58 |
| Sgrape TOP | 偏冷的藍紫 | 0.47, 0.42, 0.71 |

本機 TD 2025.32820 的原生 MAT 為黃金色（0.625, 0.58, 0.28），TOP 為較暗的紫色（0.41, 0.36, 0.575）。色票是目前選定的固定設計值，不會每幀追蹤或改動 TD 全域主題。後續可依使用者實際觀感調整。

## 已完成

原生色票集中於 `src/td/runtime/sgrape_runtime.py` 的 `OP_COLORS`。主元件、範本、主元件建立、TDFam PlaceOp 建立的 Shader，以及既有 Shader 註冊都共用這份設定。`FamManifest/OpInfo.op_color` 同步，避免複製後取回舊色。圖內 port／分類色仍由 `style.css` 獨立控制。

TDFam 實際新增 MAT／TOP 已驗證，正式元件與範本顏色一致；原有 Graph、revision、Shader ID、GLSL、Uniform 值／Expression／Bind 均保持一致。清理了驗證元件，TDFam 和私人遠端入口保持 Ready。

## OP Create 選單配色已完成

現在 Sgrape MAT／TOP 的 OP Create 按鈕分別採用暖灰紫／藍紫，與生成元件共用 OP_COLORS。僅在本管理元件註冊的 Sgrape layout 內加入 Table COMP 每格背景色資料表；依實際 opType 身分配色，並不以 Generator／Filter 當作 Shader 類型。普通背景使用色票的 0.72 倍，hover 使用原色票；原有搜尋高亮、disabled 字色、邊框及其他家族保留。

實作位於 src/td/runtime/tdfam_menu_colors.py，內嵌為 menu_colors DAT。使用原 TDFam callbacks 產生其他樣式，可恢復原 callback。來源 row 重排、搜尋及狀態切換由 DAT 相依自動更新；沒有全域主題輪詢。啟動時至多嘗試十次註冊／掛接，以涵蓋 TD 延遲初始化；未知 layout 保留 TDFam 原樣式與可用的新增功能，並留下配色狀態供診斷。相容性已驗證於目前 TDFam 與 TD 2025.32820，未宣稱未來所有 build 均支援。

10 項真實 TD 選單資料／搜尋／卸載／其他家族保存檢查，以及 3 項延遲啟動／重試上限檢查通過；實際 OP Create GUI 已目視核對。第一個新程序測試曾出現啟動掛接未辨識，加入有限重試後，新程序驗證通過。

## 重新啟動與保存

乾淨 TD-Sgrape-v01-test.38.toe 保存於 2026-09-10T04:40:59.740588，內含 19 個來源 DAT。驗證另開相同已保存內容、額外帶一個唯讀啟動 probe 的工程：新程序自動恢復 TDFam 配色／服務，19 個來源 hash、正式 Shader 圖、revision、ID、GLSL、Uniform 值與模式一致。TOP 像素差 0；MAT 最大差 0.003921598（約一個 8-bit 色階）。兩個 Shader 的 authenticated state／shaders／preview 路由與新 UI 資源皆通過。原 port 被原程序佔用時，新程序選擇其他可用 port。

驗證副本不含私人 helper、bridge 停用，驗證後自動結束；原 TD 程序及原遠端入口保留。乾淨 .38.toe 不含 probe。此為 v0.6.3 後的開發檢查點，舊 ZIP／TOX／tag 保持原封存內容，產品顯示版本暫仍為 0.6.3。

[TD Table COMP](https://derivative.ca/UserGuide/Table_COMP) 說明各格樣式值可由 DAT 提供。[TDFam OpInfo 規範](https://github.com/dotsimulate/TDFam/blob/main/docs/manifest-reference.md#opinfo) 說明生成元件的 op_color；兩者分開處理。
