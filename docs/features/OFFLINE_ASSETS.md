# TD-Sgrape 離線圖示與字型評估

TD 隨附的 Material Design Icons 可以由 Sgrape 的本地 HTTP 服務提供給網頁，不需要 CDN 或對外網路。瀏覽器不會直接讀取 TD 安裝路徑；由服務只提供指定的字型資源，再以 CSS @font-face 使用。這個方法也能供經過遠端轉接的瀏覽器載入；私人轉接需另外允許該資源路徑。

本機 TD 2025.32820 的 Samples/Fonts 內有 MaterialDesignIconsDesktop.ttf、MaterialDesignIconsMeta.json 與 materialdesignicons-license.md，與 [Derivative 官方文件](https://derivative.ca/UserGuide/Material_Design_Icons) 相符。這份 TTF 為 1,041,060 bytes，metadata 有 6,029 個項目。獨立 Chromium 原型成功載入六個常用圖示，字型只取用一次，攔截非本地請求時仍正常；沒有改動產品 UI。

## 使用方式與成本

| 方式 | 好處 | 代價 |
|---|---|---|
| 從 TD 安裝讀取原 TTF | 直接沿用 TD 當前圖示庫，離線可用 | 首次約 1 MB；不同 TD build 的圖示版本可能不同，需檢查名稱／codepoint，缺少時有文字備援 |
| 隨產品封裝固定字型 | 各設備圖示一致，無安裝版本依賴 | 增加套件大小與字型授權附件；版本由專案維護 |
| 僅打包實際使用的 SVG | 少量按鈕通常更輕，樣式易控制 | 需另外確認選定圖示的來源與授權；不要混淆 Google Material Icons 與社群 MDI |

2026-09-10 最新 UI 規則見 UI_ICON_POLICY.md：禁止裝飾性 emoji，圖示使用一致的單色向量或正式圖示字型。本輪已用輕量 SVG 統一現有工具列符號與品牌標記；MDI 待完整圖示規劃選定後再接入。若重點是與 TD 使用同一個完整圖庫，可以採第一種方式，明確固定所需圖示對照與文字備援。只在載入／刷新資源時讀檔，不逐幀讀取；實際採用時另加快取與版本識別，不需要動到 Shader cook。

## 授權與字型

本機 MDI desktop 附件標示 SIL OFL 1.1，包含 Reserved Font Name 與 Google 圖示來源授權參考。若服務或封裝字型，應保留對應版本的完整 copyright／license；修改、轉格式或製作子集也須處理 Reserved Font Name。OFL 官方明確允許使用 @font-face 提供網頁字型，並要求分發字型時保留授權資料。[OFL 使用說明](https://openfontlicense.org/how-to-use-ofl-fonts/)

你提到 V 開頭的字型，很可能是 **Verdana**：本機原生 OP Create 的 font 欄確實是 Verdana，Windows Fonts 也已安裝，TD Samples/Fonts 內則沒有同名字型。這項判斷針對已檢查的選單，並不代表 TD 全部畫面只用一種字型。

Verdana 可放在 CSS font-family 優先序，由瀏覽器使用所在裝置已有的版本；未安裝的遠端設備會使用後備字型。它不涵蓋中文字形，仍需要 Microsoft JhengHei／平台中文備援。Microsoft 允許 CSS 指定 Windows 字型名稱，但一般 Windows 字型授權不含把字型檔複製到 Web server 或轉成 WOFF 的權利，因此本評估沒有複製或提供 Verdana 檔案。[Microsoft 字型 FAQ](https://learn.microsoft.com/en-us/typography/fonts/font-faq)、[Verdana 字型資料](https://learn.microsoft.com/en-us/typography/font-list/verdana)

建議先比較實際 Parameter、長節點名、中英混排及高 DPI 的排版，再決定是否將 Verdana 排到產品字型優先序前方。MDI 與 Verdana 目前只完成可行性與視覺原型，尚未更換產品字型。既有離線葡萄 SVG favicon 已同時作為頁首與 About 品牌標記，工具列改用自行繪製的 SVG。
