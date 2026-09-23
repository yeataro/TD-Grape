# Switch 多路選擇

0.8.204 的簡單多路選擇節點叫 **Switch**；完整 **Switch Case** 留待後續設計。

- 輸入由上至下為 Default、Index、Case 0、Case 1……，末端保留灰色待新增接孔（Spare Port）。新節點從 Case 0 開始，拖線到待新增接孔便建立下一個 Case；目前上限 16 個 Case。
- Index 僅接受 int。負數及不符合任何 Case 編號的值輸出 Default。
- Default 接入型別決定輸出與全部 Case 的型別。未接 Default 時，可在參數頁選擇預設型別；接上後選單停用。
- Case 只接受完全相同型別，不隱式轉換。Default 或上游改變型別時，已存在且不再符合型別的 Case 線自動斷開；型別變更與斷線可一起 Undo。新拖入的不相容 Case 線直接拒絕。
- 支援現有 scalar、vector、matrix 值型別，包含整數、布林、雙精度。Array、Struct、Sampler 與其他資源型別不在這版範圍。

產碼使用 GLSL `switch` 與連續整數 Case，包含 Default 與各分支的 `break`。沿用目前先計算上游、再選擇值的架構；不承諾未選中上游會停止執行。Spec Constant 可作為 Index，但不依其預設值剪除其他 Case。

原有 If、Max 及四則運算保持分工。Math 後續已於 0.8.205 交付，見 [Math](MATH.md)。

## 驗證

- `tests/unit/test_switch.py`：現有全部值型別、負數／範圍外 Index、嚴格型別、動態接孔數及特化常數產碼。
- `tests/browser/test_switch.cjs`：接孔順序、待新增接孔、型別衝突、Default 推導、同次 Undo／Redo 與預設型別選單。
- `tests/td/test_switch.py`：TD 2025.32820 的 TOP 像素結果與不重編譯的執行期 Index 變更，以及 MAT Vertex／Pixel 編譯。MAT 項目只驗證編譯，不代表完整材質外觀驗收。
