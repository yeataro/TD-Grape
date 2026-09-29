# TD-Grape

[English](README.md)

TouchDesigner 的 GLSL TOP／MAT 節點式 Shader 編輯器。

透過瀏覽器編輯節點圖、產生 GLSL、預覽 TouchDesigner 的執行結果並調整參數，用於影像處理與材質製作。

![TD-Grape 節點式 Shader 編輯介面](https://github.com/user-attachments/assets/95fcf86b-d066-4cdf-8b25-ea2c9e91bf74)

## 專案狀態

**功能預覽版開發中，尚未進入 Alpha。**

目前先以完成功能預覽版、整理操作流程與驗證既有功能為主。這個階段完成後，預期將進行較大規模的架構重構，重新整理編輯器、產碼器與宿主整合之間的分工。

重構範圍與時程尚未確定，操作介面與圖資料格式仍可能調整。版本變更及升級注意事項會在 [Releases](https://github.com/yeataro/TD-Grape/releases) 說明；詳細開發狀態與設計紀錄請由[文件索引](docs/README.md)進入。

部分功能與跨平台驗證仍未完成。

## 介面語言

目前支援 **English、繁體中文、日本語、Français、한국어** 五種介面語言。可在標題列或 **AA（語言與介面大小）** 面板切換，瀏覽器會記住選擇。

節點種類、分類與 GLSL／TD 技術名稱保留原文；使用者命名及 TD 原生參數標籤也不隨介面語言翻譯。詳細規則見[介面語言說明](docs/ui/LOCALIZATION.md)。

## Shader 的保存與相容性

TD-Grape 產出的是靜態 GLSL 程式碼。已產生並套用的 Shader，只要保留執行所需的 TD 節點、貼圖與參數綁定，即使不再使用 TD-Grape 編輯器，或移除了管理主節點，仍可繼續運作。

此項承諾限於已驗證的 TouchDesigner 版本範圍；跨版本升級可能需要調整。圖的編輯與重新產碼仍需要 TD-Grape。

## 安裝與開啟

1. 安裝並開啟 TouchDesigner。
2. 前往 [Releases](https://github.com/yeataro/TD-Grape/releases)，從該版本的 **Assets** 下載 `.tox` 元件。
3. 將 `.tox` 拖入 TouchDesigner 的 **Network Editor（節點網路畫布）**，加入 TD-Grape 管理元件。
4. 在 Network Editor 按 **Tab**，開啟 **OP Create Dialog**。

   ![TouchDesigner 的 Grape 元件建立選單](https://github.com/user-attachments/assets/b837b4f6-215b-4fee-a301-e3b730b77243)

5. 在 **Grape** 分類中，建立用於紋理／影像處理的 **Grape TOP**，或用於材質的 **Grape MAT**。
6. 選取剛建立的元件，在其參數頁按下 **Open Editor**，開啟瀏覽器編輯介面。

   ![從 Grape 元件參數頁開啟瀏覽器編輯器](https://github.com/user-attachments/assets/2a47ddcd-9e2f-407a-9d67-9403452cb62c)

## 開發文件

專案也探索如何讓節點定義更容易被理解、維護與擴充，並保留程式碼、介面、規格與設計討論，作為後續整理的基礎。

- [文件索引](docs/README.md)
- [開發說明](docs/development/DEVELOPMENT.md)
- [測試說明](docs/development/TESTING.md)

文件中的歷史提案與討論保留作為參考，不代表已實作功能或確定的交付計畫。

## 創作與協作

- **專案發起、需求、設計取捨與審查：** [@yeataro](https://github.com/yeataro)
- **初始規格書協作：** Fable 5.1
- **程式實作與後續修訂：** OpenAI Codex（GPT-6 Astra）與 [@yeataro](https://github.com/yeataro) 協作完成。

這份署名記錄人類與 AI 工具各自參與的工作。

## 第三方致謝

本專案使用 [TDFam](https://github.com/dotsimulate/TDFam)，由 **Lyell Hintz（[dotsimulate](https://dotsimulate.com)）**、**Dan Molnar（[Function Store](https://www.functionstore.xyz/link-in-bio)）** 及其他貢獻者共同開發。感謝他們提供的開源基礎。

TDFam 提供 TouchDesigner 自訂 operator family 的相關基礎能力，採用 **Apache-2.0** 授權。相關資訊見隨附的 [LICENSE](src/third_party/TDFam/LICENSE) 與 [NOTICE](src/third_party/TDFam/NOTICE)。
