# 自訂參數：操作面板與浮動編輯器

2026-09-23，0.8.197。此規格取代舊版在側邊卡片內新增、移除與切換 Style 的流程。

## 操作與編輯入口

「Custom Parameters／自訂參數」側邊面板顯示目前 Shader COMP 的原生自訂頁面、名稱及路徑。按原生頁面順序提供分頁，操作目前值、色彩、開關、選單及 Pulse；原生唯讀、停用與受 TD Expression／Export／Bind 控制的項目不被覆寫。此面板不編輯參數定義。

右上鉛筆開啟「Customize Parameters／編輯自訂參數」。這是可移動及調整大小的浮動視窗，不遮暗背景、不封鎖畫布。上方為 Pages 與 Parameters 清單，下方編輯選取項目的 Label 與 Default；Style／Size 只顯示。頁面可新增、改名、拖曳排序及刪除空頁。

Pages 與 Parameters 均可拖曳排序；參數拖到另一個頁面可跨頁移動。拖到清單項目上為插入其前方，拖到清單底部為移至末尾。Escape 取消拖曳。

## 從來源建立控制

- 只從**來源面板**拖曳 Uniform 或 Spec Constant 到 Parameters 清單。畫布拖曳不建立自訂參數。
- 支援數值純量與向量；Graph Constants 不支援。Matrix、Array、Buffer、Sampler 與 Attribute 不在此次新增控制的範圍。
- 沒有獨立 Add Parameter、Style／Size 選擇器。控制形態由來源決定：一般浮點使用 Float、帶符號整數使用 Int、布林純量使用 Toggle、Color 使用 RGBA 與對應分量數。
- TD 原生 Int 無法承載完整 `uint` 範圍，因此 `uint`／`uvec` 使用 Float 控制，值仍須是合法無號整數；自動開啟 Clamp Min，最小值 0，並以 4294967295 為上界。這不改變既有 GLSL 原生 Uniform 傳輸的精度限制。
- 重複拖入同一來源，移動**同一個**控制，保留名稱、Label、值、Default 與綁定，不建立第二個 Binding Master。
- 移除一項只刪除自訂參數，來源保留最後值。反向刪除來源時，既有自訂參數保留。

控制以 TD 原生 Bind 連到 GLSL OP 來源。COMP、來源面板及畫布引用操作同一份值；儲存的 last 僅供失去控制時復原，不是第二份可編輯值。特化常數採同一機制，其值變動仍遵守特化及 Shader 更新規則。

## 保護及自動更新

Grape TOP／MAT、Output、舊 Sgrape 名稱及包含系統保留參數的整頁受到保護：不出現在浮動編輯清單，不接受來源拖入、改名、刪除、排序或定義編輯。操作面板仍顯示其功能。Apply 不再把系統頁面強制移到最後，保留原生頁面順序；使用者頁面排序只置換可編輯的位置。

來源型別／分量數改變時，自動調整控制 Style／Size，保留控制名稱、頁面、Label、仍存在分量的值與設定，新增分量採來源預設。需要更換形態時會重建原生 ParGroup，因此外部 Bind 或 TD 驅動造成的衝突會在 Apply 前拒絕並回報；不以解除外部控制處理。保留值或 Default 不符合新型別時也拒絕。已知 Bind 可檢查，任意外部 Python 字串參照仍無法全面推導。

形態變更納入 Apply 的還原處理。失敗會恢復控制定義、來源綁定與 Shader 保存內容。原生快照及 revision 防止過期視窗覆寫；數值編輯沿用 TD Undo。結構編輯不冒充畫布 Undo。

既有 Expose 控制沿用原生 Par 及設定；一般 Apply、頁面移動及改 Label 不重建控制。原生改名的來源綁定恢復機制保留。

## 本輪界線

Help、Enable Expression、Read Only、Section、Range／Clamp 等進階定義欄位仍交由 TD 原生編輯器操作。Web 會讀取相關值、可寫狀態及範圍，但不提供這些定義的編輯器。Style／Size 不可手動改，並不代表把 TD 參數設成 Read Only。觸控手勢留待另輪排查。

操作與浮動視窗沿用既有 Layout 所屬的側邊面板；這不是新增 Shader Stage。

## 驗證

- `tests/td/test_parameter_editor.py`：TOP／MAT 保護頁、重複拖入、跨頁排序、四種特化常數、uint 下限、色彩批次寫入、來源形態更新、Apply 失敗還原、外部 Bind 拒絕與過期寫入。
- `tests/td/test_custom_parameters.py`：保留舊 Expose 遷移、原生雙向 Bind、改名、Default、Apply 還原與刪除語意。
- `tests/td/test_parameter_layout.py`：原生 Par、Expression、Default、頁面順序及系統項目分組保留。
- `tests/browser/test_custom_parameters.cjs src/editor state.json sources.json controls.json report`：側邊操作、非模態浮窗、畫布鍵盤操作、來源拖入、清單拖曳、取消與雙語。sources／controls fixture 由上述原生測試輸出；可用 `PLAYWRIGHT_MODULE`／`CHROME_EXECUTABLE` 指定本機工具。

原生實測平台為 Windows、目前安裝的 TouchDesigner。未宣稱 macOS 或觸控已驗證。
