# 區網連線

使用者依工作環境自行決定是否開放其他裝置編輯。TD-Grape 主元件的 TD-Grape 參數頁提供 **Allow LAN Connections**，預設關閉；選項會跟著元件保存。Grape 不自動調整防火牆、路由、VPN 或 Tailscale 設定。

## 使用

1. 在 TD-Grape 主元件開啟 Allow LAN Connections。
2. 從唯讀的 **LAN URLs** 複製其中一個完整網址（包含 `#` 後的連線碼），在可連到該電腦的裝置開啟。多個 IPv4 介面會列出多行網址，包含系統提供的區網與 VPN 位址。
3. 入口預設開啟此管理元件所屬的第一份 Shader；進入後可使用既有 Shader 選單切換。本機 Open Editor／Open in Browser 照常使用。
4. 關閉選項後只接受本機直接連線。此開關不管理使用者另行架設的轉接服務；既有私人 Remote 代理及其固定網址仍獨立存在。

網址是帶連線碼的入口。頁面進入後會把連線碼移入該分頁的 sessionStorage，故請複製 TD 顯示的完整網址。原有 Shader 首次使用新來源功能仍需先套用／完成既有版本審閱。

## 切換行為

- 關閉時監聽 `127.0.0.1`；開啟時監聽 `0.0.0.0`（IPv4）。只重新建立 HTTP 監聽服務，不重啟 TD、不重新產碼、不重新整理 Shader，也不清空工作佇列。
- 保留連接埠和目前連線碼。切換綁定失敗時回復先前模式與入口並顯示錯誤，不默默換埠。
- 已載入頁面的原有輪詢會恢復連線；不重新載入圖，因此保留未套用草稿、選取及 Undo 歷史。失敗的寫入不自動重送。
- 開關不判斷工作環境是否適合開放；實際是否可達仍由工作環境決定。正常關閉 TD 或重開服務的新工作階段會產生新連線碼，需使用當次連結。

## 共用功能與驗證

本機與區網直接使用同一份 Editor 資源、HTTP/JSON API 與 PNG 預覽，沒有第二份遠端功能允許清單。數值 Uniform、COMP 自訂控制、圖編輯與高解析圖示都沿用既有實作。

Host 必須符合連線實際抵達的本機 IPv4 位址與埠；Origin（若有）須為同一 HTTP 來源。保留連線碼、JSON 格式與大小檢查，拒絕跨站、重複 Host／Origin／Content-Length 及 Transfer-Encoding。首版提供數字 IPv4 網址，不新增任意 DNS 別名、CORS 或 IPv6 選項。LAN HTTP 缺少原生 randomUUID 時使用 getRandomValues 產生 UUID v4；既有鍵盤剪貼簿途徑保留。

## 已完成的驗證（2026-09-12）

- 7 項真實 HTTP listener 測試：本機預設、驗證、重複開關、共用資料、失敗回復、佇列及網址。
- 96 項既有來源、產碼、版本審閱、文件保護與 MAT／TOP 相關 Python 檢查。
- Windows TD 2025.32820 的隔離 MAT／TOP：同機經區網與 Tailscale 位址讀寫原生 Uniform、建立／編輯自訂 Bind 控制、PNG 預覽及圖示資源；驗證拒絕無碼與錯誤來源。
- 真實 Chrome LAN HTTP 頁面確認 UUID 相容、兩個瀏覽器入口共用參數，以及切換後保留草稿／歷史並恢復連線。
- 獨立 TOX 保存重載確認選項保留及圖／GLSL 不變。測試結束關閉區網。

跨位址驗證均在同一台主機完成，尚未由第二台實體裝置或 macOS 驗收。不因此自動變更使用者防火牆。私人代理未更動，區網直接功能請使用 LAN URLs，而非舊代理網址。

另外兩組 Function／個人庫 JavaScript 模型檢查通過。`test_editor_edits.js` 與 `test_import_ui.js` 的舊模擬案例在本輪修改前、後均於相同斷言失敗，未列入通過數；本輪未修改這兩份測試。
