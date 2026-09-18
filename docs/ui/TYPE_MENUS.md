# 型別選單

2026-09-19 使用者 Final Check 確認；0.8.105 實作。

- 第一層順序：Auto（適用時）、水平線、Floating、Integer、Boolean、Matrix、Double。沒有可選型別的類別不出現。
- Floating 只有 float、vec2/3/4。Integer 是 int、ivec2/3/4、水平線、uint、uvec2/3/4。Boolean 是 bool、bvec2/3/4。
- Matrix 先 mat2/3/4、水平線，再 mat2x3、mat2x4、mat3x2、mat3x4、mat4x2、mat4x3。
- Double 多一層 Floating／Matrix，分別放 double/dvec 與 dmat；矩陣尺寸排序與分隔相同。雙精度不混入第一層 Floating／Matrix。
- 一般短清單直接列出；單一普通類別不加無意義的母層。Double 保留精度／家族的層級。索引的 int/uint 仍是短清單。
- 圖中既有 Array／Struct／Sampler 型別保留完整身分；不是拆成其元素型別。未知但原本可選的項目保留在 Other，不因 UI 分類消失。

節點標題、Parameter、Convert、Array 元素型別、Graph Constant／Uniform 定義、Function 介面、GLSL Code 接孔及新增節點的型別篩選共用分類呈現。來源綁定與運算的合法型別清單仍由既有契約決定；此次不為 TD 原生 CHOP Array 或 Spec Constant 擴大宿主未支援的型別。

桌面側向開啟，靠右時反向展開；窄視窗在原位置進入下一層並可返回。分組導覽不提交；只有選中具體型別時使用既有 input/change 與 Undo 路徑。Escape、外部點擊、來源換圖／停用／移除取消選單，沒有切換動畫。原生 select 保存值與 change handler，無新增 TD 查詢或常駐同步。

驗證：`tests/browser/test_type_menus.cjs`、`test_select_menus.cjs`；尺寸／來源草稿／觸控僅聲稱隔離瀏覽器與模擬，不代替實體 iOS 測試。
