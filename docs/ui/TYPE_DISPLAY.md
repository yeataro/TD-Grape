# 型別顯示與接線轉換

Header 的型別控制表示目前選擇的配置：一般 Math 是 Auto／運算型別，Scalar／Vector 是值型別，Convert 是目的型別。它不保證等於輸出型別；例如 Length 對 vec4 運算仍輸出 float，Compare 對 int 比較仍輸出 bool。結果的具體型別以輸出接孔為準。

固定型別建值節點不提供型別切換。Scalar／Vector 的預設主標題保持不變；選單與接孔顯示具體型別。Graph Function 保留函式識別與實際輸出接孔。

連線有轉換時，輸入顯示來源與接收型別，例如 `int → float` 或 `float → vec4`。線使用來源型別色，接孔使用需求型別色；Parameter 解釋純量展開。未接線輸入顯示需求型別，不相容接線依現有驗證標示。

鎖定 vec4 的 Multiply 可以接受兩個 float，產生相應的 vec4 constructor；指定運算型別不等於禁止所有輸入轉換。Auto 推導與接線轉換是兩件事，詳見 [Math Auto](MATH_AUTO.md)、[型別契約](../architecture/TYPE_CONTRACT.md)與[專案用語](../GLOSSARY.md)。

Compare 的比較方式放在 Body 首列，顯示 A > B 等完整式；Header 使用共同的 Auto／型別入口，預設主標題維持 Compare。來源引用則以來源名稱辨識，見[值與來源模型](../architecture/VALUE_MODEL.md)。

改型別顯示不應修改來源、接線或運算意義。瀏覽器驗證使用隔離 fixture；不把測試圖寫回使用者 Shader。歷史 test_type_display 的實測紀錄只代表當時版本，最新驗證見[TESTING](../development/TESTING.md)。
