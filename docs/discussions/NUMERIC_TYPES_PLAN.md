# 最新使用者決定（2026-09-10）

新 Math 節點預設 Auto，可手動鎖定；舊圖保持已存型別。本決定取代下方歷史段落的「Auto 待決」，已完成並通過模型、瀏覽器、編譯器與 TD 數值驗證，詳見 MATH_AUTO.md。

使用者希望以輸出型別作為節點的主要識別，避免改輸入造成不明確的下游變動。現行 float → vecN 是顯式產生 vecN(value) 的 splat，兩個 float 接入已鎖定 vec4 Multiply 仍合法並輸出四分量。介面要區分輸出型別、輸入來源型別及轉換，不可把所有輸入口籠統改成 any；Auto 解析、已連下游的衝突處理與顯式鎖定需共用同一合法簽名契約。先補清楚顯示，再實作推導，不回寫舊圖。

# 顯式數值型別：下一批實作依據

目前產品只支援 float／vec2／vec3／vec4。0.8.5 增加共用 family／components，沒有啟用新型別或 Auto。本文件是下一批設計及實測紀錄。

GLSL 分成浮點、帶號整數、無號整數與布林家族。不同函式有不同簽名；例如 abs 有整數版本，而 min／max／clamp 包含整數與無號整數。只看函式名稱能否編譯不足以判定回傳型別，因為可能經過隱式數值轉換。依據：[GLSL 4.60 規範，Common Functions](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.html#common-functions)。

在 Windows／TD 2025.32820 的隔離 GLSL TOP 已實測九例：

| 測試 | 結果 |
|---|---|
| ivec4 + int | 每個分量加上純量，結果正確 |
| uvec4 的 scalar clamp | 四個分量結果正確 |
| -7 / 2，帶號整數 | 得到 -3 |
| 4294967295u 與十六進位對照 | 相等 |
| (-2147483647 - 1) 與最小 int 對照 | 相等 |
| bvec4 選擇兩組 ivec4 | mix 選到對應分量 |
| ivec4 明確轉 vec4 | 分量正確 |
| uint v = abs(1u) | TD 拒絕，不能當成 uint 回傳的 overload |
| bool 相加 | TD 拒絕 |

七個可編譯案例都讀回整張輸出，對白色通過標記的最大差為0。這些是專用研究 GLSL，沒有進入產品 emitter。測試區已移除；結果在 research/value085-native-results.json。

## 推進順序

1. 建立有限的顯式型別資料、literal 編碼與 JSON 值驗證；涵蓋 int／uint 範圍及 bool 真正布林，禁止以 truthiness 或浮點四捨五入偷偷接受輸入。增加對應向量與明確 Cast 的節點候選，原有圖與 revision 保持可核對。
2. 按節點列出合法 overload，UI、Create、port 與 compiler 都由同一表決定。不要將所有型別塞入每個 math 節點。跨家族只透過使用者選擇的 Cast，Auto／隱式自動推導仍待決。
3. 再核對 TD GLSL MAT／TOP 的整數 Uniform 參數列與 bool 投影、Expose 參數型別、預設值／目前值、Expression／Bind／Undo；使用真正動態更新和端點值驗證精度，避免把 uint 最大值經 float32 中轉。
4. 然後才接常數分類、requiresConst／spec constants；矩陣是否納入1.0仍需決策，迴圈不在這批。

使用體驗：維持單一操作節點加明確 Type 選項，顯示確實解析出的 port 型別；型別切換只在合法選項間進行，接線不相容要清楚顯示錯誤，既有連線及上次成功輸出保留。這是實作起點，不宣稱新型別或所有GLSL overload已支援。
