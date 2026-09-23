# 介面語言

0.8.219 支援 English、繁體中文與日本語，首次開啟仍以英文為預設。標題列及「語言與介面大小」的下拉選單使用同一份語言清單，切換後同步顯示，並以瀏覽器的 `sgrapeLanguage` 記住選擇。

英文是介面文案的基準。面板名稱、一般操作、提示與說明依選定語言翻譯，不使用「Parameter · 參數」這類雙語面板標題。品牌、API／GLSL 識別碼、型別、節點種類及 Wire／Link 等穩定技術名稱保留原文。使用者自行命名的節點、頁面、參數與來源不翻譯；TD 原生參數標籤亦維持宿主提供的內容。

0.8.220 起，新增節點的主分類／子分類與來源面板的分類名稱，在中文與日文介面都保留英文，例如 Editor、Math、Source、Common Sources、TD Built In、Custom Uniforms、Texture Inputs、Geometry、Matrices。側邊新增、浮動新增選單及分類路徑使用相同名稱。這項規則只適用分類；面板標題、操作按鈕及說明仍依介面語言翻譯。

| English | 繁體中文 | 日本語 |
| --- | --- | --- |
| Parameter | 參數 | パラメーター |
| OP Parameter | OP 參數 | OP パラメーター |
| Help | 說明 | ヘルプ |
| Sources | 來源 | ソース |
| Output Preview | 輸出預覽 | 出力プレビュー |
| Material Preview | 材質預覽 | マテリアルプレビュー |
| Layout | Layout | Layout |

介面文字集中在 `src/editor/locales.json`；內建來源的描述位於 `src/library/source_catalog.json`。新增文案時同步提供所有已登記語言，保持占位符、程式範例與參考連結。語言切換只更新介面，不改圖資料、參數名稱、接線、GLSL 或 Undo 歷史。日文字型依作業系統可用字型回退，不下載外部字型。

`tools/dev/check_locales.py` 檢查全部語系文字、UI 引用、來源描述、占位符與日文參考連結。`tests/browser/test_locales.cjs` 使用隔離 API fixture 驗證兩處選單同步、面板／動態提示、重新開啟記憶、回切英文及深淺色窄視窗顯示。

0.8.221 起，標題列的 About、Layout 入口／標題，以及畫布角落的 VERTEX STAGE／PIXEL STAGE 在所有語言保持英文；其餘面板與操作說明沿用上述翻譯規則。
