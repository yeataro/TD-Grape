# 自訂參數：操作面板與浮動編輯器

2026-09-23，0.8.198。此規格取代舊版在側邊卡片內新增、移除與切換 Style 的流程。

## 操作與編輯入口

「OP Parameter」側邊面板顯示目前 Shader COMP 的原生自訂頁面、名稱及路徑。按原生頁面順序提供分頁，操作目前值、色彩、開關、選單及 Pulse；原生唯讀、停用與受 TD Expression／Export／Bind 控制的項目不被覆寫。此面板不編輯參數定義。

右上「編輯自訂參數」文字按鈕開啟「Customize Parameters／編輯自訂參數」。這是可移動及調整大小的浮動視窗，不遮暗背景、不封鎖畫布。上方為 Pages 與 Parameters 清單，下方編輯選取項目的 Label、Default、Range Min／Max、Minimum／Maximum 與 Clamp Min／Max；Style／Size 只顯示。頁面可新增、改名、拖曳排序及刪除空頁。刪除位於每列最右側的 ×；非空頁停用，沒有確認對話框。預設浮窗在畫面中央，寬約 34%、高 75%，有最小尺寸及邊框，可自行縮放。

Pages 與 Parameters 均可拖曳排序；參數拖到另一個頁面可跨頁移動。拖到項目上半部插入其前方，下半部插入其後方；插入線標示位置，拖到清單底部為移至末尾。Escape 取消拖曳。

## 從來源建立控制

- 只從**來源面板**拖曳 Uniform 或 Spec Constant 到 Parameters 清單。畫布拖曳不建立自訂參數。
- 支援數值純量與向量；Graph Constants 不支援。Matrix、Array、Buffer、Sampler 與 Attribute 不在此次新增控制的範圍。
- 沒有獨立 Add Parameter、Style／Size 選擇器。控制形態由來源決定：一般浮點使用 Float、帶符號整數使用 Int、布林純量使用 Toggle、Color 使用 RGBA 與對應分量數。
- TD 原生 Int 無法承載完整 `uint` 範圍，因此 `uint`／`uvec` 使用 Float 控制，值仍須是合法無號整數；自動開啟 Clamp Min，最小值 0，並以 4294967295 為上界。這不改變既有 GLSL 原生 Uniform 傳輸的精度限制。
- 重複拖入同一來源，移動**同一個**控制，保留名稱、Label、值、Default 與綁定，不建立第二個 Binding Master。
- 移除一項只刪除自訂參數，來源保留最後值。反向刪除來源時，既有自訂參數保留。

控制以 TD 原生 Bind 連到 GLSL OP 來源。COMP、來源面板及畫布引用操作同一份值；儲存的 last 僅供失去控制時復原，不是第二份可編輯值。特化常數採同一機制，其值變動仍遵守特化及 Shader 更新規則。

## 保護及自動更新

Grape TOP／MAT、Output、舊 Sgrape 名稱及包含系統保留參數的整頁受到保護：不出現在浮動編輯清單，不接受來源拖入、改名、刪除、排序或定義編輯。操作面板仍顯示其功能。新增或排序使用者頁面時，使用者頁面置於系統具名頁面之前；系統頁的相對順序、內容與參數身分保留。一般 Apply 保留既有原生頁面順序。此規則取代 0.8.197 的固定系統頁位置，依作者希望自訂控制優先顯示的裁定。

來源型別／分量數改變時，自動調整控制 Style／Size，保留控制名稱、頁面、Label、仍存在分量的值與設定，新增分量採來源預設。需要更換形態時會重建原生 ParGroup，因此外部 Bind 或 TD 驅動造成的衝突會在 Apply 前拒絕並回報；不以解除外部控制處理。保留值或 Default 不符合新型別時也拒絕。已知 Bind 可檢查，任意外部 Python 字串參照仍無法全面推導。

形態變更納入 Apply 的還原處理。失敗會恢復控制定義、來源綁定與 Shader 保存內容。原生快照及 revision 防止過期視窗覆寫；數值編輯沿用 TD Undo。浮動編輯器的定義修改使用獨立的 Undo／Redo（最多 50 步；管理元件重載後清空），不與畫布或 TD 原生 Undo 混用。浮窗內非文字輸入焦點使用 Ctrl/Cmd+Z、Ctrl/Cmd+Shift+Z 或 Ctrl/Cmd+Y；文字輸入保留文字自身的撤銷。TD 的合法定義修改同步回來，但較早的定義歷程暫停，避免覆寫外部修改；介面顯示原因。單純數值變動不使定義歷程失效，撤銷 Label、Range 或恢復刪除控制時保留目前值。若恢復 Clamp 將改變目前值，拒絕該次撤銷並保留現況。

控制名稱從來源名稱產生，依 TD 規則轉成首字大寫、其餘小寫的合法名稱，衝突加數字。自動 Label 將底線換空白、第三個字元起的大寫字母前加空白、首字大寫：`baseColor` → `Base Color`、`base_color` → `Base color`、`uBaseColor` → `UBase Color`；不刪除或假設 U 前綴。既有 UUID Expose 名稱在僅有受管理 Bind 時原地改名、更新登錄並重新綁定；存在外部 Bind 時保留舊名。任意外部腳本內字串名稱无法全面辨認。既有 Expose 控制沿用原生 Par 及設定；一般 Apply、頁面移動及改 Label 不重建控制。原生改名的來源綁定恢復機制保留。

## 本輪界線

Help、Enable Expression、Read Only、Section 等進階定義欄位仍交由 TD 原生編輯器操作。Web 讀取其值與可寫狀態。數值控制建立時，Range 按目前值推算：0–1 採 0–1、3 採 0–10、-3 採 -10–0；可再編輯。Web 拉桿沿用一般數值控制的跨量級行為，只有真正的 Clamp 限制可拖範圍；型別合法性仍由後端驗證。未支援完整還原的非數值原生參數形態請在 TD 刪除。Style／Size 不可手動改，並不代表把 TD 參數設成 Read Only。觸控手勢留待另輪排查。

操作與浮動視窗沿用既有 Layout 所屬的側邊面板；這不是新增 Shader Stage。

## 已知問題

頁面切換、增刪、排序或 Label 變更會重建受影響的操作清單；目前沒有逐列更新全部結構變動。Default／Range 等不改變操作清單結構的修改保留其 DOM，不再要求刷新所有來源或觸發 Apply。這是 UI 刷新上的已知問題，不是數值寫入錯誤。

## 驗證

- `tests/td/test_parameter_editor.py`：TOP／MAT 保護頁、重複拖入、跨頁排序、四種特化常數、uint 下限、色彩批次寫入、來源形態更新、Apply 失敗還原、外部 Bind 拒絕與過期寫入。
- `tests/td/test_custom_parameters.py`：保留舊 Expose 遷移、原生雙向 Bind、改名、Default、Apply 還原與刪除語意。
- `tests/td/test_parameter_layout.py`：原生 Par、Expression、Default、頁面順序及系統項目分組保留。
- `tests/browser/test_custom_parameters.cjs src/editor state.json sources.json controls.json report`：側邊操作、非模態浮窗、畫布鍵盤操作、來源拖入、清單拖曳、取消與雙語。sources／controls fixture 由上述原生測試輸出；可用 `PLAYWRIGHT_MODULE`／`CHROME_EXECUTABLE` 指定本機工具。

原生實測平台為 Windows、目前安裝的 TouchDesigner。未宣稱 macOS 或觸控已驗證。
