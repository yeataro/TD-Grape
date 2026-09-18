# 值、節點與來源模型

2026-09-18 確認的產品規則。術語依 [專案用語表](../GLOSSARY.md)，交付與驗證狀態依 [STATUS](../development/STATUS.md)。本文件取代討論過的 Scalar.int／Vector.ivec3 自動標題方案。

## 使用入口

```text
我要使用一個值
├─ 節點自己持有的值
│  ├─ 固定型別：float / int / uint / bool / vecN / ivecN / uvecN / bvecN
│  └─ 可選型別：Scalar / Vector
├─ 多處引用同一個具名來源：Inputs
│  ├─ Graph Constant：值寫入產生的程式
│  ├─ Uniform：TD 提供執行時數值
│  ├─ Spec Constant：TD 提供特化值
│  └─ 資源來源：TOP Inputs / Samplers，依目標支援
└─ 使用運算結果：以接線連接運算節點
```

這是用途分類，不要求新增選單多加一層導航。Parameter 是編輯上述物件的介面，不是另一種值或來源。

## 固定型別與可選型別

固定入口完整涵蓋目前的 16 種純量／向量型別；向量分量數 N 為 2、3、4。固定節點不能改型別。Scalar 可選四種純量型別；Vector 可選十二種向量型別。兩類可共用值處理實作，但保存、複製與 Undo 必須保留固定／可選的身分。

Scalar 和 Vector 的預設標題保持不變，選型別或分量數不自動改標題。具體型別由型別選單與接孔呈現；使用者仍可手動設定自訂名稱。固定入口用具體 GLSL 型別名稱辨識。

| 搜尋 | 固定入口 | 通用入口 |
| --- | --- | --- |
| float / int / uint / bool | 同名固定型別 | Scalar |
| vec3 / ivec3 / uvec3 / bvec3 等 | 同名固定型別 | Vector |
| scalar / vector | 依搜尋匹配 | Scalar / Vector |

搜尋別名只決定哪些結果匹配，不把 Scalar 顯示成 int，也不讓查詢文字暗中改變 Scalar／Vector 的建立預設。相同型別、相同值的固定與通用節點具有相同運算結果。Color 保留既有 RGBA 編輯器、色盤與色彩來源能力，不因這次整理而刪除。

## 來源與引用

來源定義有穩定 ID；多個畫布引用指向同一份定義。修改來源影響全部引用，引用自己的位置與註記各自保存。複製本地值節點則得到另一份獨立的本地值。

來源引用標題回答「引用誰」，一般建值／運算節點標題回答「做什麼」。Uniform、Graph Constant、Spec Constant、Sampler 隨來源改名或改引用而更新標題，是來源引用類別的正常行為，不屬於一般節點型別切換更名。

| 值的歸屬 | 數值何時生效 | 共用關係 |
| --- | --- | --- |
| 本地節點值／未接線輸入值 | 值寫進產生的程式；編輯後依既有 Apply 流程更新 | 屬於該節點或該輸入 |
| Graph Constant | 產碼時採用圖宣告的值 | 同一 Shader 的多個引用 |
| Uniform | TD 原生參數提供目前值，可由 Expression／Bind／Export 驅動 | 同一來源的多個引用 |
| Spec Constant | 以 TD 原生特化機制提供目前值 | 同一來源的多個引用；生效時機不同於 Uniform |

跨 Stage 共用是不同 Stage 引用同一份 Grape 定義，各 Stage 仍有自己的 GLSL 程式；不是跨 Stage 傳遞一個區域變數。現行 MAT 編譯器的共同宣告策略不因入口整理而改動。Graph Constant 改稱 Global Constant 的 UI 命名仍待決，不由本文件暗中更名。

## 配置與畫布呈現

- Parameter 與畫布快捷控制操作同一份設定、驗證與 Undo。
- 型別配置、運算方式、顯示外觀與來源身分分開理解。型別選單不代表輸出一定與該型別相同。
- Compare 預設標題固定；右上角選 Auto／型別，Body 首列選 A > B 等完整比較式。Parameter 編輯相同設定。
- Compare 在 Auto 且沒有輸入接線時採 int；有接線時保留既有推導排序，其他節點預設不受影響。詳見 [Math Auto](../ui/MATH_AUTO.md)。
- Note 與 Group Frame 屬於編輯註記／組織功能。共用視覺語言不表示它們參與 Shader 運算。

## 能力與變更邊界

整理入口不能減少合法運算、型別、來源、Stage、分量操作、原生驅動、保存或 Undo 能力。可以整理重複快捷，但本次已決定固定／通用兩種入口並存，不能再以去重為由移除其中一種。

TD 原生數值傳輸可能失真，不因此在 Grape 另外禁止 TD 接受的整數值。已撤除額外 float32 精度、MAT uint 上限及負整數 Spec 限制；明確編輯操作的基本型別、有限值與 int32／uint32 範圍檢查仍存在。這次撤除没有新增或變更常駐監控。

尚未定案的接線轉換及背景工作策略見 [下一輪規則提案](../discussions/CONVERSION_AND_RUNTIME_NEXT.md)。用語定義不代替行為決策，提案不代表已實作。
