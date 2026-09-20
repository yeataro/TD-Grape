# UV 初始化錯誤報告

日期：2026-09-20。受影響版本：0.8.150、0.8.151。修正版本：0.8.152，已同步 TD 並保存 TOE。

## 使用者要求與影響

原始要求是讓 **Uniform Color 與 Color RGBA 共用分量名稱規則**，沿用既有設定與建立 Split 的行為。這不應影響其他來源節點的初始化。

實作共用名稱解析時，引入 UV 節點的初始化回歸。圖內只要含固定 UV 來源，畫布繪製就可能中斷，顯示「無法讀取型別規則，請從 TouchDesigner 重新開啟編輯器」。重新開啟仍執行同一段錯誤程式，因此不能恢復。這是阻斷正常載入的重大錯誤，不是尚未完成的功能，也不是使用者操作問題。

## 已確認的原因

0.8.150 的 `vectorNames()` 改為呼叫共用的 `nodeComponentNames()`。後者會辨識固定 UV 節點並回傳 `uv`；接著前者為確認二分量，從 `params.type` 或 Uniform 來源宣告取得型別。

固定 UV 節點的 `params` 本來就是空物件，也沒有 Uniform 宣告。它的 `vec2` 型別在節點定義的固定輸出口。這條路徑漏讀固定輸出口，最終呼叫 `typeComponents(undefined)`，觸發 `contract.invalid`。

實際堆疊為：

```text
initializeEditor → load → render → renderCards
→ portRow → applyPortColorHint → vectorPortLabel
→ vectorNames → typeComponents(undefined)
```

錯誤文字共用「型別規則」訊息，容易誤認為資料下載失敗。唯讀擷取目前四個 Shader 的型別規則後，全部通過原有契約驗證；以 0.8.151 原始碼在隔離瀏覽器重現，則能得到與使用者畫面相同的錯誤及上述堆疊。

責任在此次實作：我把僅為 Uniform Color 補接的名稱規則接進畫布共用函式，卻沒有檢查固定型別來源與宣告型來源的資料差異。需求本身不需要這個錯誤或額外限制。

## 修正方式

`vectorNames()` 依序讀取節點型別參數、來源宣告型別，以及節點定義的固定輸出口型別。固定 UV 因此能取得既有的 `vec2` 描述，維持 U／V 顯示。

只修正顯示名稱所需的型別取得方式。沒有關閉契約驗證、改寫既有圖、變更數值、接孔 ID、接線或 GLSL，也沒有回退已確認的 Uniform Color／Color RGBA 功能。尚未交付的 Uniform 外觀保存保護調整已另行保留，不混入熱修正。

## 為什麼原本測試沒攔下

原有分量測試覆蓋 Color Uniform、Color RGBA、一般向量、Split／Swizzle、STPQ、Undo／Redo 與重新載入，但啟動樣本以 Color 圖為主，沒有固定 UV 節點。其他 UV 命名測試使用帶有 `params.type=vec2` 的一般向量，也未涵蓋固定 UV 的空參數情況。這是測試覆蓋缺口；可攜測試通過並不足以證明實際圖能載入。

## 修正後驗證

- 新增固定 UV 圖的真正初始載入、頁面重開、選取及自動 Split 回歸；U／V 標籤與 x／y 接孔 ID 均正確。
- 使用目前 Grape_MAT1、Grape_TOP1、Grape_TOP2、Grape_TOP3 的實際圖副本在隔離瀏覽器載入，分別完整繪製 4、25、30、4 個節點，沒有型別規則錯誤。
- Uniform Color／Color RGBA 共用分量命名的 8 組回歸通過。
- 507 項 Python 測試、14 項附加檢查及完整可攜檢查通過。

瀏覽器重現及驗證報告位於 Documents 工作區 `reports/contract-load/`。TD 唯讀擷取位於私人工作區 `work/reports/contract-load/inspect/`；正式同步、來源核對與 TOE 保存結果記錄在 [STATUS.md](STATUS.md)。

交付核對：37 份嵌入來源、10 份服務資產一致；四份使用者 Shader 保留。實際使用中的瀏覽器未被強制重新整理。
