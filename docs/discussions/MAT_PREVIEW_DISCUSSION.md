# Sgrape MAT 預覽成本 — 討論筆記

2026-09-10。使用者擔心每個 Sgrape MAT 額外 Render Preview 的累積成本，提出先保留預覽能力、評估讓 Preview 使用 MAT 本身。最後明確表示先當作討論：本筆記不授權直接更換現有 Viewer、刪除 Render、停用驗證或改動目前工程。其餘已授權開發照原順序推進。

## 0.6.2 的實際結構

- 每個 MAT 有 material（GLSL MAT）、preview_geometry、preview_camera、preview（512×512 Render TOP）。新建程式位於 src/td/runtime/sgrape_runtime.py 的 make_scene。
- Shader COMP 的 opviewer 指向 preview，並開啟 Viewer；MAT 不是目前的縮圖來源。
- 網頁 PNG API 強制 cook preview，透過 numpyArray(delayed=False) 讀回並在 CPU 編碼 PNG。這些工作和 Shader 本身的 GPU 渲染需分開評估。
- 網頁在隱藏頁面或相關面板未顯示時會停止既有參數輪詢。MAT 的輪詢預覽依參數快照變化刷新，TOP 另外有約每秒更新；編輯或手動操作也可能直接要求預覽。不能把「網頁沒輪詢」等同「TD Viewer 不再觸發渲染」。
- validate_material 目前也依賴這個場景進行 cook／錯誤與編譯檢查，候選是部署期間臨時建立並清除。顯示預覽與編譯驗證是兩個需求，不能因精簡預覽而暗中撤掉驗證。

以上為來源檢查，沒有測量本輪 GPU 時間或多 MAT 負載；Render TOP 存在不表示每一個都每幀重繪。

## 建議方向，尚未決定／實作

1. **TD 節點縮圖**：優先評估 Sgrape MAT 的 Operator Viewer 指向內部 material，使用 MAT 原生 Viewer。核對顯示、Vertex 變形／貼圖／透明度及實際成本，不先宣稱它完全等同 Render TOP 的畫面。
2. **網頁預覽**：保留可選能力；評估只為目前正在編輯的 MAT 按需使用一個共用場景，或由使用者指定既有 Render TOP 作觀察來源。後者顯示使用者自己的場景，也仍可能有讀回／PNG 成本。
3. **未顯示或未編輯的 MAT**：目標是不因工具自己的預覽而持續增加運算。若只是改了 COMP Viewer，但網頁或其他引用仍讀原 Render，便尚未真正解決問題。
4. **候選驗證**：保留既有失敗保護，另評估能否共用／按需建立最小驗證場景；先確認不同 GLSL 變體的實際編譯要求，與 SHADER_STAGING.md 的結論一起驗收。

MAT 定義的是套用到幾何體的材質，並非直接的 TOP 影像。推論：原生 MAT Viewer 仍需顯示材質結果，不能把「沒有額外 Render TOP 節點」當成「沒有任何渲染成本」。如何將該 Viewer 的畫面提供給網頁、是否可直接重用，尚未驗證，不宣稱已可替代現有 PNG 路徑。[官方 MAT 說明](https://derivative.ca/UserGuide/MAT)

## 後續驗收

比較單個與多個 MAT、TD 網路可見／不可見、網頁預覽開／關、靜態與動畫來源。分別記錄 cook 次數、CPU／GPU 時間、讀回與 PNG 時間和記憶體，並核對移除主元件後材質獨立渲染、TOX 重載及編譯失敗仍保留正式輸出。官方建議利用 Performance Monitor／Probe 定位瓶頸，不能只靠 Render 數量判定實際損失。[官方效能指南](https://derivative.ca/UserGuide/Optimize)

目前保持 0.6.2 行為；未承諾原生 Viewer 替換或共用預覽的時程。


## 單螢幕與按需取圖補充

使用者接受編輯變動時按需讀取，也要求考慮單螢幕使用者。已比較普通 WebGL／WebGPU 的界線、Electron 原生共享貼圖、TD WebRTC 編碼注意事項及 Web Render 的方向，詳見 GPU_PREVIEW_OPTIONS.md。優先考慮編輯器內按需快照，原生 GPU sharing／動態串流列後續研究；尚未改實作。


## 使用者補充：TD 自訂分割版面（2026-09-10）

使用者說明這是嘗試性的議題，不必繼續深究 GPU 傳输。可將 TD 的 Web Browser／Web Render 與視窗作為其中一種宿主方式，或讓編輯器與原生預覽存在於 TD 的 Pane／Panel 分割配置，由單螢幕使用者自行安排版面。

在編輯器旁已有原生 Viewer 或輸出畫面的情境，編輯器自己不一定還要提供重複 Preview。應把「編輯器」、「可選預覽」與「宿主／視窗配置」分開看待，避免假設單螢幕使用者必須依賴網頁內建預覽。

TD 內嵌宿主是可選方案，不拿它取代通用瀏覽器入口，也不將特定 TD 版面作為所有人的前提。普通瀏覽器情境仍可保留先前討論的按需預覽方向。Pane／Panel 的最終實作形式、是否提供預設版面及預覽開關尚未定案。

本次僅加入研討：不改目前 UI、TD 版面或預覽，不建立 Web Render／視窗，不繼續擴大 GPU／串流研究。後續需要處理預覽時，再根據實際工作流程取捨。


## Web Render 宿主的成本與 Non-Commercial 限制（2026-09-10）

使用者補充 Web Render 可能增加 TD 主執行緒負擔，並受到 Non-Commercial 解析度限制。這兩項納入宿主選擇的取捨，仍僅討論，不測改目前工程。

需要精確區分：官方說明 Web Render 以獨立的 CEF 瀏覽器程序處理網頁，並將結果交回 TD；不能把網頁 JavaScript 與排版全部算作 TD 主執行緒。TD 端仍有 TOP cook、接收畫面、顯示合成及互動轉送等工作，CPU／GPU／同步的實際影響須量測；不能先宣稱一定多佔多少主執行緒時間。Windows 的 shared texture 可減少部分交換成本，並非整個宿主零成本。[Web Render TOP 官方說明](https://derivative.ca/UserGuide/Web_Render_TOP)

官方列出的 Non-Commercial 一般影像解析度上限為 1280×1280，Web Render 把整個網頁畫成 TOP 時也必須考慮這個上限。推論：若把這張 UI 貼圖放大到較大的高 DPI 視窗，文字與節點邊緣的清晰度可能受影響；視窗面積增加不等於 TOP 產生更多像素。未在本輪測量具體 DPI 與尺寸的結果。[TouchDesigner Non-Commercial](https://derivative.ca/UserGuide/TouchDesigner_Non-Commercial)

外部普通瀏覽器的 DOM／畫布 UI 本身不經過 Web Render TOP，因此不承受這個 TOP 影像尺寸上限；來自 TD 的影像仍遵守其版本限制。這進一步支持保留通用瀏覽器入口，TD 內嵌宿主作可選整合。


## 決策更新：內嵌編輯器已列入後續實作

2026-09-10 使用者確認可選的內部瀏覽器為後續實作之一，主要承載於 TD Pane，支援類似 Blender 的同一工作版面組合體驗。內嵌功能不再只是「是否做」的討論；外部瀏覽器保留。細節與驗收見 MILESTONES.md 的「可選的 TD Pane 內嵌編輯器」。Preview、GPU 傳圖與串流仍獨立討論；本次沒有更動程式或 TD 工程。
