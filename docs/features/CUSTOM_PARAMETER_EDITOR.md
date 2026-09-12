# Native custom parameter editor — 2026-09-12

第二階段接續原生 Uniform 來源，版本維持 0.8.5。

## 已實作

- 獨立「自訂參數」工具面板，可移動、合併分頁。四／五面板舊 Layout 自動加入同級工具，保留位置、分組和尺寸。Parameter 只保留選取節點；Uniform 的舊 Expose 操作改由來源面板「加入自訂參數」承接。
- 直接讀寫 COMP 自訂頁面：新增、改名、排序、刪除空頁。控制可建立、調整 Label／頁面／順序、分別編輯目前值與重設預設值、解除連動與刪除。Grape 功能參數受到保護。
- 可建立沒有圖中引用的 Float、Vector 2／3／4、RGBA、Integer、Toggle、Text 控制。這些是 COMP 控制類型，不代表圖編譯器新增 int／uint 支援。
- Uniform 可選擇現有頁面並建立實際 COMP 控制與原生 Bind。名稱按 TD 自訂參數規則產生並避開衝突，Label 保留來源名稱。COMP、Grape UI、GLSL OP 原生 Bind 都操作同一個控制值。
- 現有四分量、常值模式的 Float／RGBA 控制可切換樣式，保留值、預設值、範圍、Label、頁面、排序、預設模式與 Grape 連動。已知外部 Bind 會阻止更動分量名稱；任意外部 Python 字串參照無法全面推導，仍遵循 TD 的名稱參照限制。
- 舊 numeric Expose 遷移保留既有 Par 物件及控制設定；只接管舊版生成的直接參數引用，不改使用者另設的 Expression／Export／Bind。產碼不再重設已遷移控制的頁面、Label 或預設值。
- 刪除 Uniform 與刪除控制是不同操作。刪除控制／解除連動保留 Uniform 最後有效值，原生 reset default 不變；刪來源保留 COMP 控制。來源缺失仍保留圖中引用與接線。
- 每個 Shader 內嵌小型連動事件處理器；關閉網頁、沒有管理元件以及 TOX 重載後，原生改名／刪除仍可處理。以原生 Bind 為正常數值來源，儲存的 last 僅用於斷開時復原，不作雙份可編輯資料。
- 結構與數值編輯都檢查原生快照與 Shader revision，避免過期頁面覆寫；數值寫入接續原生 Undo 保護。結構操作沒有冒充畫布 Undo，非同步結構變更不重播舊圖歷史。

## 驗證

81 項 Python 回歸、19 項原生來源回歸、18 項 MAT／TOP 自訂參數案例、6 項瀏覽器操作案例；另驗證無網頁的原生改名／刪除與獨立 TOX 重載。涵蓋套用失敗回復、外部 Bind 保護、三處雙向數值、Label／預設值保存、舊 Layout 與舊 Expose 遷移。

- 原生：`tests/td/test_custom_parameters.py`、`tools/jobs/test_custom_parameter_reopen.py`，提供 `GRAPE_TEST_SOURCE` 與 `GRAPE_TEST_OUTPUT`；重載案例為跨 frame 驗證，讀取產出的 JSON 結果。
- 瀏覽器：`tests/browser/test_custom_parameters.cjs src state.json sources.json controls.json output`；可用 `GRAPE_PLAYWRIGHT`、`GRAPE_BROWSER` 指定本機套件／瀏覽器。

## 本階段界線

新增來源連動目前涵蓋 float／vec2／vec3／vec4 Uniform。Sampler 的獨立來源與控制迁移、Attributes／Buffer／Constant 等來源面板、彙總引用及 int／uint 圖運算繼續實作。既有 Texture 的來源／Expose 控制暫留於選取節點工具；現有 OP 路徑自訂參數不在本階段的通用控制卡內編輯，避免繞過資源路徑檢查。因此「所有 Expose 已完全替換」尚不能宣告完成。

已保存工作檔的圖／GLSL 維持原樣，未另存使用者 TOE。來源與控制需先套用 Shader 初始化；既有版本審閱仍有效。遠端私人預覽代理未納入新 API，請由 TD 的 Open Editor 使用這些工具。

原生參考：[ParGroup](https://derivative.ca/UserGuide/ParGroup_Class)、[Parameter Execute DAT](https://derivative.ca/UserGuide/Parameter_Execute_DAT)、[Page](https://derivative.ca/UserGuide/Page_Class)。目前驗證平台為 Windows TD 2025.32820。

區網補充（2026-09-12）：啟用主元件的 Allow LAN Connections 後，可使用 [LAN URLs](LAN_ACCESS.md) 直接使用全部原生來源／控制 API。舊私人代理仍不轉送這些新入口，兩者網址不同。
