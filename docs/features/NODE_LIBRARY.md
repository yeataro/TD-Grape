# 0.3 常用數學節點與 Filter Functions

13 個新節點都支援 float、vec2、vec3、vec4，適用 Vertex／Pixel。Dot Product 和 Length 的輸出為 float，其餘保留輸入數值型別。名稱保留英文，右側 Help 提供中英文及延伸閱讀。

| 節點 | 用途／預設值 |
| --- | --- |
| Subtract、Divide | 差值與比例；Divide 的未連接除數為 1 |
| Minimum、Maximum、Clamp | 限制範圍；Clamp 預設 0–1 |
| Smoothstep | 平滑遮罩；edge0 = 0、edge1 = 1 |
| Absolute、Fraction | 對稱與重複；Fraction 的負值會包回非負小數部分 |
| Power、Cosine | 曲線與週期；指數預設 1，Cosine 使用弧度 |
| Dot Product、Length、Normalize | 向量運算；Normalize 預設非零輸入 |

選取節點，在 Settings 切換型別。未連接 Input 的 Parameter 與編譯值共用節點定義；已手填的值仍保留，連線時以連線來源為優先。Divide 不自動改寫零除數，Power 不自動截斷負底數，Normalize 不替零向量猜方向；相關輸入限制在 Help 明示。

## 四個 Sgrape Library Function

| Function | 行為 |
| --- | --- |
| Tint | 保留先前來源版本及行為；Color × Tint，包含 alpha |
| Invert | RGB = 1 − RGB，保留 alpha |
| Contrast | RGB = (RGB − Pivot) × Contrast + Pivot，保留 alpha；1 保持原色，0 得到 Pivot |
| Color Clamp | RGB 限制於 Minimum／Maximum，保留 alpha |

Contrast 不進行色彩空間轉換或自動裁切 HDR 值。Color Clamp 的上下界應保持有效順序。它們是可查看的 Function 圖，支援 Palette 拖入、浮動 Create、來源重用與本地化；不引入另一種黑盒濾鏡。

雙擊只查看不複製；首次內容修改才在當前 Shader 本地化，引用同一定義的調用一起更新。修改後 Help 回到通用 Function 說明，避免仍拿原始濾鏡說明代表已改動的內容。Make Independent 與跨 Shader 隔離延續既有行為。

## 驗證證據

- 19 個本地測試，涵蓋舊核心／Function／Input 及新增型別、JSON 保存、UI／編譯預設值一致性。
- TD 2025.32820：13 節點 × 4 型別共 52 個實際像素案例，另有 5 個 Filter／透明度案例；最大允許誤差 0.012，包含 8-bit 量化與既有 TD dither。
- 向量數學測試用不相等的分量，經加權 Dot 映射到可讀取的 float；四分之一顯示倍率避免測試被輸出裁切。此為數值驗收，不是 GPU 效能基準。
- 真實瀏覽器確認 Divide 的 float／vec4 除數預設值、vec4 拉線新增 Dot Product 並輸出 float、中英文 Help、兩個 Contrast 調用本地化。TD 像素同步確認兩個調用一起改變，另一個 Shader 與來源庫保持原值。
- 新增節點和本地 Function 保存到 TOX 後重載，圖資料及像素一致。舊 18 個節點定義、Tint 來源快照、三個舊示例產碼均保持相容。

完整紀錄：reports/math030-pixel-tests.json、math030-ui-tests.json。這輪沒有迴圈實作；Sgrape TOP 為接續工作，不屬於 0.3 的已完成功能。
