# Help 文件連結政策

2026-09-10 使用者最新決策：所有 TouchDesigner 相關 Help 統一連到 docs.derivative.ca Wiki 的對應段落，即使 User Guide 的 hash 有效也使用 Wiki。這是使用者的閱讀偏好；不把速度或完整性當成已量測的普遍結論。

- 連到最相關的真實章節；不能假造函式名錨點。每個新目標需驗證章節 ID 存在，並在全新瀏覽器頁面確認真的定位到標題。
- GLSL 運算與型別連到官方 HTML 的相關章節，不開整份 PDF，不用只有網站首頁的泛用連結。
- 標籤寫出主題。連結集中在 src/editor/locales.json，保留中英文說明和專有名詞；The Book of Shaders 依介面語言選目標。
- 保留可直接閱讀的節點說明；離線文件入口只是後續可選項。前提是能可靠確認 TD 離線文件存在且使用情境適合。遠端瀏覽器不能直接使用 TD 主機的本機檔案路徑；不為此新增任意檔案服務或複雜連線偵測。暫不實作。

| 主題 | Wiki 對應段落 |
|---|---|
| MAT Uniform | GLSL MAT／Parameters - Vectors Page |
| TOP Uniform | Write a GLSL TOP／Uniforms |
| MAT UV、TDPos | Write a GLSL MAT／Working with Geometry Attributes |
| TDDeform | Write a GLSL MAT／Working with Deforms |
| TDWorldToProj | Write a GLSL MAT／Vertex Shader Only Functions |
| Vertex Output | Write a GLSL MAT／Outputting gl_Position |
| MAT Pixel Output | Write a GLSL MAT／Pixel Shader_2 |
| TOP UV | Write a GLSL TOP／Pixel Shaders |
| TOP Sample Texture | Write a GLSL TOP／Sampling Inputs |
| TOP Pixel Output | Write a GLSL TOP／Output Swizzle |

GLSL HTML 目標是 GLSLangSpec.4.60.html 的 floats、vectors、vector-and-matrix-constructors、vector-components、vector-and-matrix-operations。四個新增 TOP Wiki 目標及五個 GLSL HTML 目標已在獨立新頁面驗證；MAT Wiki 目標於本輪前半驗證。

這是 0.8.5 封存後的文字修正，不改運算、Graph、port 或舊 ZIP／TOX／tag。現用 TD 僅更新 Help 資源，不另存 TOE；下一次正式更新及封版收錄。
