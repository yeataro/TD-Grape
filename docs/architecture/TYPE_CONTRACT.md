# 0.8.5 型別值形狀

契約 version 1 新增 `types` 描述表，每項含 `family` 和 `components`。目前僅 float 家族、1–4 個分量；numericTypes 的四項順序和 conversion 表不變。hash 包含新增描述，但 catalog／definition revision、編譯結果和 semantic hash 不因這個 UI/runtime 資料改變。

核心 type_components／filled_value 和 literal 讀取該表。前端 setTypeContract 驗證完整分量資料並做深拷貝，無效 refresh 保留上次契約；新 UI 不自行猜測缺少描述的舊回應。Parameter 與 Function 預設值轉形、Uniform 預設值、runtime 公開參數分量數都使用資料。節點型別下拉依該定義的 variants，Function 邊界介面沿用自己的宣告。

這只建立可擴充的共用形狀，不代表完整 overload resolve、Auto、跨家族 cast 或整數控制項已完成。現有 float 格式／範圍／明確 splat 保持。測試含496對 port、雙向 Create、所有預設輸入口、參數轉形、無效資料保護及138張舊圖運算基準。

以下保留最初契約說明：

# 型別與連接埠的共用契約 — 0.6.1

編譯核心提供一份版本化的純資料契約，供編輯器繪製 port、判斷接線與篩選 Create。接線手勢不需要額外 HTTP 請求。這一批保持 float／vec2／vec3／vec4 的既有能力，不新增整數、布林或一般 overload 推導。

## 規則歸屬

- `sgrape_core.py` 的 `CONVERSIONS` 是型別轉換的來源。相同已知型別可直接相連；float 到浮點向量使用明確 GLSL constructor splat。其他配對被拒絕，包含兩個未知型別碰巧都顯示 `?` 的情況。
- 核心驗證連線與產生轉換表达式都讀同一張表。既有可接受圖的 vertex、pixel、bindings、hash、診斷與 port 資料保持一致。
- `resolved_ports` 解析 builtin 的實際 port 型別；`type_contract()` 由此生成每個定義可用的型別變體。UI 不再另行推導 builtin 的 `T`／`D`：直接取用核心解析的變體。
- Parameter 與 Function port 的型別選單、Create 的型別篩選都讀取契約中的數值型別列表。Uniform 的 port 依宣告所選型別取對應變體；沒有有效宣告時保留 `?` 錨點，不能把它當作相容型別接線。
- Function Call／Input／Output 的介面仍来自該 Shader 的 Function 定義，核心在完整圖驗證時核對介面與巢狀內容。這不是任意 Function 的伺服器端增量解析服務。

契約經既有帶認證的 state API 傳給 UI，不新增路由、腳本資源或可執行程式。`version` 表示資料結構版本，`hash` 用於一致性核對；它不是安全簽章。UI 拒絕不支援的版本／不完整規則，失敗時保留之前的契約，不使用私藏的備用型別表。

## 相容性與性能

既有 31 個節點的 `definitionUuid`、`revisionHash` 及四個 Library Function 快照均保持不變。契約是衍生資料，不寫入 Graph，也不改既有 schema。

契約在讀取 Shader 狀態時生成，接線、Create 與畫布繪製在瀏覽器記憶體中查表；沒有逐幀或每次滑鼠移動的網路解析。完整編譯和 TD 候選驗證仍是最後的判定。

## 驗證

- 44 個核心／文件／型別測試、編輯與匯入 handlers、Function／Personal 模型、194 個中英鍵通過。
- 138 張基準圖的完整編譯結果與 0.6.0 指紋一致；包括各 builtin、型別、MAT／TOP 範例與 Library Function。這批用於相容性；所有 Shader 運算的完整像素覆蓋仍參照既有測試。
- 496 組 builtin／節點型別／宣告型別的核心和 JavaScript port 解析一致。雙向 Create 的候選集合完整吻合，未知型別及無效契約也有驗證。
- 36 項 TD 檢查：MAT／TOP 分別驗證 7 組合法轉換的像素及 9 組拒絕的配對，另核對 state 契約與讀取無副作用。14 組渲染最大誤差 0.0029411763；MAT 排除相機留白、TOP 檢查全圖。初次測試誤將 MAT 留白當作 Shader 像素，修正測試範圍後通過。
- 真實瀏覽器驗證 Float→vec4、vec4 篩選 Create 並自動接 Add、vec4→float 拒絕、Input 反向 Create Uniform、雙語與 512×512 預覽。使用點擊 port 再點空白處的既有入口；本修補未重測拖曳手勢。

下一步仍是 catalog／emit 的版本契約、歷史解析與 migration，然後分階段增加整數／布林。const lattice、矩陣、Varying 與進階 TD builtins 尚未因這次整理而成為已支援功能。

0.6.3 更新：catalog／emit 版本資料與唯讀歷史查核已建立，見 CATALOG_CONTRACT.md；版本選擇與 migration 仍待後續。
