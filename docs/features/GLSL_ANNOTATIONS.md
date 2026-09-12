# GLSL Label／Comment — 2026-09-12

本輪採一份帶註解的產碼：原生編譯、Editor 顯示與匯出使用相同 GLSL。版本維持 0.8.5。

- `ui.label` 產生上方 `// Label: …`；`ui.comment` 產生下方 `// Comment: …`，後續各行仍為獨立行註解。節點 ID、GLSL 變數名及宣告名稱不因 Label 改變。
- 普通節點包住其產出行；Split 這類內嵌表達式節點在對應展開順序標示註解，不為註解另造 GLSL 變數。未參與輸出的節點維持不產碼。
- Subgraph 的每個呼叫實例在首次／最後一次產出的位置標示自己的 Label／Comment；內部節點與 Function Input／Output 的文字也保留，接口文字不隨每個埠重複。這些標示不新增 GLSL 作用域。
- 行號來源對照隨註解重算。Subgraph 展開後仍定位到原本函式及內部節點；同一函式多次呼叫各自保留實例註解。
- 換行、Unicode 行分隔與控制字元正規化。每行加 `//`，並處理行尾反斜線，避免 GLSL 的續行規則吃掉後一行程式。`*/`／`#error` 等輸入保持為註解。
- 移動節點不改 GLSL。Label／Comment 仍不改圖的語意雜湊，但實際產碼內容／編譯指紋會改變，因此會重新編譯，符合本輪決策。

驗證：96 項 Python 檢查，涵蓋新註解案例及相關原有編譯、診斷、文件與來源測試；6 項 TD 原生 MAT／TOP 案例，驗證中文、多行、特殊文字、像素一致性、純註解編輯重新編譯，以及實際插入錯誤後的內部節點定位。測試使用獨立元件並清理，四份使用者 Shader 的圖與 GLSL 保持原样。

原生入口：`tests/td/test_glsl_annotations.py`，在 TD 執行環境提供 `GRAPE_TEST_SOURCE`、`GRAPE_TEST_OUTPUT`。`tests/unit/test_saved_state.py` 的測試假物件同步改為只對存在的 document DAT 回傳模組，避免把新增 sources DAT 誤當 document。

此項沒有決定畫布標題的 Label／Library／本地來源資訊位置，也沒有決定 Buffer 顯示名要放入 GLSL 的哪個位置；DAT Out 仍為後續功能。現有 Shader 將於下一次套用使用帶註解的產碼，未在部署時批次改寫或另存 TOE。
