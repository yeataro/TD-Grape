# 共用色彩面板（0.8.273）

功能預覽版的 Color 節點、Color Uniform（節點／Parameter／Sources）、OP Parameter 色彩控制，以及 Note／Group Frame 的自訂色彩，使用同一個網頁色彩面板。所有入口皆不呼叫瀏覽器原生 `input[type=color]`。新增模組為 `src/editor/color_picker.js` 與 `.css`，透過既有 embedded/source maps 載入；沒有更動重構專案。

## 介面

- 標頭中央是一組色票、色面、畫面滴管按鈕；右方是非即時模式的 Apply 與所有模式都有的 ×。
- 桌面寬 320px、目前顏色 100×100px；加號疊在目前顏色右上，不占色票列。44 格 TD 參考常用色；HEX 旁有六格本次頁面工作階段的儲存色，不寫入圖或持久設定。
- 色票／色面共用上方空間。色面可選方形、圓形、三角形；圓形依可用區域的短邊畫圓，不拉成橢圓。
- H/S/V 與 R/G/B 同時顯示並雙向連動。Hue 為 0–360 度，S/V 與 RGB 以 0–1 表示，不使用 0–255 作為數值欄的產品單位。
- RGB 不显示 A，HEX 是六碼；RGBA 顯示 A，HEX 是八碼（含 FF）。RGBA 貼六碼 HEX 保留目前 Alpha，失焦／Enter 正規化為八碼；RGB 貼八碼視為無效輸入。未完成或無效輸入不寫入模型，Apply 不可用。
- 開啟與取消不把 HDR／負數或高精度值量化。色票、HEX 與可見色面是一般顯示範圍；只有明確選色才改值。CSS 的 Note／Frame 色彩在其 adapter 轉 HEX 時限制在 0–1。
- 滴管只在環境提供 `EyeDropper` 時啟用。取消或晚到回覆不寫入已關閉的面板。API 不可用時禁用並提供提示，不退回有相容問題的原生選色視窗。

## 提交與取消

| 入口 | 編輯中 | 點外面 | Apply | ×／Escape |
| --- | --- | --- | --- | --- |
| Color Uniform | 即時寫入 TD actual values | 接受目前值 | 不顯示 | 嘗試還原整個面板開啟前的值 |
| 精確綁定至一個 Uniform 的 OP 色彩控制 | 同上，共用該 Uniform authority | 同上 | 不顯示 | 同上 |
| 節點常數、未綁定 OP 色彩、Note／Frame | 只改面板草稿 | 取消草稿 | 一次提交 | 取消草稿 |

一個 Uniform 面板工作階段是一個 grouped live gesture。RGB／RGBA 使用其實際型別的分量數；TD 原生 Color 可能保留第四個參數槽，RGB 編輯不能寫到該槽。較少分量的色彩入口補顯示分量，但送出只包含該 Uniform 真正擁有的分量。

OP 控制不能只憑名稱推測是否為 Uniform：依來源身分、分量數與每個已解析的 control path 完整匹配。後續 Bind／Unbind 改變此映射時，入口重新判定模式，舊面板失效。

## Authority、Undo 與失效

- 整組分量在寫入前驗證原生參數身分、模式、可寫性及 expected value；全部通過才寫。共享同一個實際 control 的分量若要求不同值，拒絕整組操作。寫入拋錯時回復已寫分量。
- 即時更新合併等待中的中間值，維持序號與單一 writer。接受後保留一個 live receipt／browser History step，以及一個 TD 原生色彩 Undo；不把每次拖曳加入 History。
- 成功 Cancel 還原開啟前全部分量，不留下新 Undo；未改值的開關也保留既有 Redo。
- 若 script、automation、外部 UI 或 TD Undo 改值，使 basis 失效，Cancel／Undo 不得覆蓋外部值。回報衝突並保留目前 actual values。沒有本地修改時，`receipt: null` 也不代表還原成功；取消回覆明確帶 `cancelled`、`cancelConflict`（如有）及最新 values/components。
- 色彩操作不改 Graph、Graph revision 或 dirty state。既有 live history dispatch 保持；這不是重構專案的 Mixed History 實作。
- 換圖、來源身分／型別變更、Anchor 移除、離線或唯讀狀態會阻止後續寫入。舊 load/socket/gesture 回覆不能改新圖、History 或新面板 pin。
- 面板按鍵不冒泡到 Canvas 的刪除／Undo／新增節點快捷鍵。原生文字編輯的本地操作仍可使用。
- 節點數值欄失焦導致的普通重繪保留色票焦點與已開面板 anchor；切換 Inspector 目標／Tab 會使舊面板失效。

## 驗證入口

設定 `PYTHONPATH=src/core;src/td/runtime;tests/unit`（Windows）後：

```text
python -m unittest test_color_values test_history test_uniform_color_live
python tests/integration/test_editor_launch.py
python tests/integration/test_node_browser_metadata.py
python tools/dev/check_locales.py
```

瀏覽器測試使用環境的 Playwright 與 Chromium/Edge（`PLAYWRIGHT_MODULE`、`CHROME_EXECUTABLE`），不把依賴或原始截圖放入產品：

```text
node tests/browser/test_custom_color_picker.cjs src/editor STATE_JSON REPORT_DIR
node tests/browser/test_color_labels.cjs src/editor STATE_JSON REPORT_DIR --color-only
node tests/browser/test_inline_vector_values.cjs src/editor STATE_JSON REPORT_DIR --color-only
node tests/browser/test_source_color_ui.cjs src/editor STATE_JSON REPORT_DIR
node tests/browser/test_custom_color_editor_live.cjs REPO_ROOT REPO_ROOT PRIVATE_WORK REPORT_DIR
```

最後一項建立可清除的獨立 TD fixture，不修改使用者 Shader；它以真實 HTTP／WebSocket 操作色彩面板並觀察 TD 參數、receipt、Graph 與 Undo。fixture 更新資料透過既有私人開發橋接，不加入產品 API。

原生測試另有 `tests/td/test_uniform_color_live.py`、`test_color_palette.py`、`test_uniform_live.py`。使用 Windows TD 2025.32820 與 Edge 的結果不等於所有 CEF、Safari、iPad 或作業系統已驗證；尤其滴管可用性依執行環境而定。
