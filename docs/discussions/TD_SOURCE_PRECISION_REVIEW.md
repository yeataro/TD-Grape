# TD Parameter 與 Shader 輸入精度

2026-09-20，隔離實測 TD 2025.32820。此筆記用來區分來源限制，不改動 Double 的可見性或既有圖的型別。

測試值為 `0.5 + 2**-30`，即 `0.5000000009313226`；轉成 IEEE 754 float32 後為 `0.5`。

| 位置 | 結果 |
| --- | --- |
| 自訂 Float Parameter | 保留 `0.5000000009313226` |
| Geometry COMP 原生 Translate X Parameter | 保留同一數值 |
| GLSL TOP 原生 Vector X Parameter | 保留同一數值 |
| 原生 Parameter 的 Python Expression | 保留同一數值 |
| Vectors → `uniform float` → GPU 計算殘差 | 殘差為 0，傳入後已失去上述額外精度 |
| 同樣 Vectors 配置 → `uniform double` | TD 警告 Uniform 未被指派；本次沒有成功傳入 double |

GPU 測量在 Shader 內先計算 `(value - 0.5) * 2^30`，再寫入 RGBA32 float TOP，因此不是用輸出 Texture 的精度去判斷輸入的細微差值。double 路徑有未指派警告，其像素值不能作為有效數據。

結論：不能將 TD Parameter 本身定義成只有 32-bit 精度；Parameter 儲存／求值與原生 Shader 傳入路徑是兩層。這次結果僅涵蓋上述原生 Vectors 路徑，不概括其他 Buffer、Attribute、矩陣或 TD 版本。TOP Texture 每分量格式的限制也不應直接套到其他來源。

測試僅建立並清除臨時網路，沒有更動既有使用者圖。私人原始結果位於 `work/reports/source-precision/parameters/result.json`、`work/reports/source-precision/shader/result.json`；測試程式留在相同私人工作區的 `jobs/probe_parameter_precision.py` 與 `jobs/probe_shader_precision.py`。

Double 入口是否降低顯著度／隱藏，依使用者指示留到來源功能完成後另行審查。本測試不代表已批准移除 Double 能力。
