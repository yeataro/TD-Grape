# TD-Grape

TouchDesigner 的 GLSL MAT／TOP 節點編輯器。圖、參數關聯與產生的 Shader 保存在 TD 專案中，Web Editor 提供編輯介面。

目前產品版本 **0.8.6**，持續開發中，尚未進入 Alpha。此開發版加入 Inputs 來源清單與統一的 Parameter 編輯流程；不產生公開發佈套件。

## 開啟開發專案

以 TouchDesigner 開啟 **`src/td/TD-Grape-dev.toe`**。在 Grape MAT／TOP 的參數頁按 **Open Editor**。服務由 TD 啟動；跨裝置編輯可由管理元件的 **Allow LAN Connections** 控制。

這份原始碼專案可以整個複製到其他位置，不需要舊專案資料夾、Agent 工作資料或外部私人代理。TOE 內保存目前可運行的程式；修改原始碼後，要透過開發工具更新內嵌 DAT，再保存 TOE。詳細流程見 [開發說明](docs/development/DEVELOPMENT.md)。

目前已在 Windows、TouchDesigner 2025.32820 驗證。macOS 為目標平台，仍需實機驗證。

## 目錄

| 位置 | 用途 |
| --- | --- |
| `src/td/` | 正式開發 TOE、TD 執行程式與內嵌來源對照表 |
| `src/core/` | 圖資料、GLSL 編譯與參數模型 |
| `src/editor/` | Web Editor、樣式、翻譯與網站圖示 |
| `src/library/` | 節點定義資料 |
| `src/assets/` | 原始品牌素材 |
| `src/third_party/` | 第三方授權與來源說明 |
| `tests/` | 核心、UI、TD 測試及可攜測試資料 |
| `tools/` | 開發、驗證與素材建置工具 |
| `docs/` | 使用、開發、功能與設計文件 |
| `agent/` | 通用 Agent 工作入口與協作規則 |
| `dist/` | 交付檔位置；打包與安裝方式另行決策 |

## 驗證與文件

安裝 Python 3.11+ 與 Node.js 後，在專案根目錄執行：

```text
python tools/dev/run_tests.py
```

此命令使用這份專案的程式與測試，不啟動 TD，也不寫入使用者的 Shader。瀏覽器與 TD 實測的操作另見 [測試說明](docs/development/TESTING.md)。

- [文件索引](docs/README.md)
- [目前能力與未完成範圍](docs/development/STATUS.md)
- [資料結構與保存邊界](docs/development/PROJECT_LAYOUT.md)
- [Agent 工作入口](agent/README.md)
- [TDFam 第三方說明](src/third_party/TDFam/NOTICE)

TD-Sgrape 是本專案的舊名稱。既有 TD OP 路徑、序列化身分及內部模組名稱仍保留相容性；資料夾遷移不批次改寫既有圖中的引用。
