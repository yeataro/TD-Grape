# 操作體驗待辦

這裡記錄機制本身合理、但使用體驗仍值得評估的情境；不代表已確認為程式錯誤，也不代表已接受為永久限制。

## Alpha 前 Uniform／Inputs 整理（2026-09-19，需求收集中）

使用者初步判斷 Alpha 前可能主要剩下 Uniform 與 Inputs 區域需要整理，部分功能可能需要重構，但尚未確定。後續由使用者逐步補充想法，再歸納範圍與方案；目前僅記錄，不視為完整 Alpha 待辦清單、發布條件或重構授權。

本輪焦點補充：使用者要求先回到目前 Alpha 版，回顧未完成工作與筆記；下方 Online／PWA、配對服務、網頁執行及 ISF 衍生方向暫不展開，不因討論而開始實作。此處不替衍生版本指定發佈階段，也不把全部歷史待辦列為 Alpha 必要条件。

近期工作回顧（以 0.8.119 交付與後續使用者回饋為準）：

- **Uniform 即時值首批已交付、實際驗收仍在進行。** scalar／vector／Color 雙向通道與完整產品入口測試已完成；使用者確認手機改值經 WebRTC 看預覽反應良好。使用者在 TD 直接改值回推手機的操作手感尚未回報，不能說兩個方向均已人工驗收。matrix／array 與一般 OP Parameter 的即時能力另界定，未包含在這批。
- **Uniform／Inputs／Sources 介面仍待整理。** 包含來源命名、引用圖示、來源控制資訊，以及 `uAbsTime` 值更新牽連固定說明區 paint 的既有觀察。圖示只有參考方向；尚無整體 UI 定案，不自動更名或重構。見 [Inputs 設計](INPUTS_UI_NEXT_ROUND.md) 與 [Uniform 觀察](UNIFORM_LIVE_EDITING.md)。
- **偶發卡頓仍待定位。** 已完成的空白點擊與布局同步改善不重列待辦；其他操作後平移掉幀、DevTools 與內建 FPS 差異仍未穩定重現，不據此推定 Uniform 或插值為原因。
- **偏好設定整理僅有筆記。** 平移／縮放 150 ms、Frame 333 ms 的時間已交付；桌面／平板預設開啟的方向尚未實作，等設定保存與舊偏好處理一併討論，Home 仍立即。
- **英文文案報告待 review；UI 共用報告依使用者要求暫放。** 都不是獲准修改的清單。iOS 新增節點搜尋框聚焦／縮放仍是只記錄的回報。
- **新磁碟暫存／增量保留／復原仍延後。** 圖同步效能首批與 Uniform 即時值首批已完成，不代表暫存或完整遠端 Parameter 管理已完成。

陣列（含 Array Create）已由使用者操作確認本輪功能正常並暫告一段落；搜尋效能與排序、矩陣四則／分層型別選單、右鍵分組與既有操作入口、工具列收納、Open Editor 不更動既有 Viewer、H／F 與插值、FPS 面板及重新整理缺 UI 的已交付修正，均不因舊文件的「待辦」用語重開。完整交付紀錄見 [開發狀態](../development/STATUS.md)。

### Common Sources 與 Custom Uniforms（分類整理中，尚未實作）

使用者最初採用 Common Uniforms／共通 Uniform 的名稱，詢問以 ISF、TD、Shadertoy 的共同能力應選哪些；後續指出現有 Texture Coordinates 也適合歸入這類，但它不是 Uniform。因此助手建議分類使用 Common Sources／共通來源，以共同的環境來源入口涵蓋時間、解析度、座標；保留 Uniform、varying、片段內建值各自的 GLSL 性質，不因分到同類就轉成 Uniform。

使用者明確指定原本自行建立與設定的 Uniform 類別改稱 Custom Uniform／自訂 Uniform；分類英文採複數 Custom Uniforms，單一項目為 Custom Uniform。此為 UI 分類命名方向，不更動 TD Parameter 所有權、來源 ID、圖引用、GLSL 宣告或控制模式；也不把 TD Built In 的全部內容直接併入 Common。實際入口、分類範圍與既有時間預置如何呈現仍隨本輪整理，未批次更名或遷移來源。

使用者認為 Graph Constants 的名稱不自然；助手建議簡化為 Constants／常數，將圖內定義與編譯期行為留在說明，尚待確認。使用者另接受特化常數的簡寫顯示名稱 Spec Constants；完整名稱 Specialization Constants 保留於提示與說明。此命名筆記不改動內部識別或原生 Constants 頁面的名稱，尚未修改產品文案。

使用者比較 TOP Inputs 改稱 Texture Inputs 或 Sampler Inputs，並要求先看 ISF 的取樣方式；補充 Texture 代表複合能力，包含來源本身的 info。助手因此建議 Texture Inputs／紋理輸入：同一來源提供取樣所需引用與尺寸等資訊，Sampler 保留為 GLSL 接孔／存取型別的描述。這是來源概念與分類命名，不表示新增一個必須打包到 GPU 的 struct，也不表示 sampler 無法供 textureSize 等查詢。名稱尚未實作，現有 TOP 來源與 info 對應保持。

ISF 對照：INPUTS 以 TYPE=image 宣告具名圖片來源，宿主準備底層紋理與宣告；Shader 使用 IMG_NORM_PIXEL(name, uv)、IMG_PIXEL(name, pixelCoord) 取樣，以 IMG_SIZE(name) 查該輸入的尺寸。ISF 以這層取樣介面適配宿主使用的 2D／rectangle 紋理，不應直接假定固定 sampler2D 與 texture() 可跨所有 ISF 宿主。音訊／FFT 也透過影像資料提供；標準 image 輸入不等於已保證任意 3D／Cube／Array sampler 能力。輸入來源尺寸與 RENDERSIZE／TD uTDOutputInfo 的繪製目標尺寸分開。此調查不要求現在實作 ISF 後端；參考 [ISF 輸入宣告](https://docs.isf.video/ref_json)、[圖片取樣與尺寸](https://docs.isf.video/ref_functions)、[宿主紋理差異](https://docs.isf.video/ref_converting)。

來源命名風格補充：使用者提出同一來源可有「通用／TD」兩套顯示名稱，以選擇器切換節點標題，類似既有「顯示自訂名稱」；不改能力、來源 ID、接孔、內容或產碼。別名必須指同一語意，不把行為不同的時間來源只改名當作等價。助手提出自訂名稱顯示優先、搜尋接受兩套名稱，這些仍屬候選規則，尚未實作。

TD 名稱風格補充：使用者要求共通來源切成 TD 風格時，以 TD 的 Python 來源名稱／表達式作為最顯眼的識別，而不是 GLSL 變量或 Uniform 名稱。例如 Absolute Time 的 TD 主標題應呈現實際來源 absTime.seconds，而不是 uAbsTime；Timeline Time 可依實際來源呈現 me.time.seconds。GLSL 名稱可保留為次要資訊，不因顯示切換修改真正的宣告或表達式。助手補充適用界線：無對應 Python 來源的 Shader 內建來源（如 UV）另定適合的標籤，不為統一風格虛構 Python 表達式；此處也不是替一般 Custom Uniform 套用共通來源命名。

分類入口的最新界線：使用者曾考慮連分類名稱一起切換，後續要求先保持入口穩定。通用／TD 名稱對應可以預先準備，但目前不啟用分類名稱的風格切換；分類歸屬與入口位置也不因顯示風格而變動。理由是使用者依賴熟悉的名稱與入口辨識位置，既有顏色不能完全取代這些線索。這不否定未來固定更名的討論，也不等於現在已實作節點標題切換；本次只記錄決策與可預留方向。

以下是調查後的候選建議，不是實作授權或跨宿主支援承諾；本輪先以影像 Shader（TD GLSL TOP）對照，MAT 的 render context 另行核對。

| 候選名稱 | 型別與目的 | ISF | Shadertoy | TD 映射界線 |
| --- | --- | --- | --- | --- |
| Time | float，Shader 使用的時間，單位秒 | TIME | iTime | 由宿主時鐘供值；時間軸與 Absolute Time 的起點、暫停／循環不同，不能默默合併 |
| Delta Time | float，相鄰渲染幀的時間步進，單位秒 | TIMEDELTA | iTimeDelta | absTime.stepSeconds 是 TD 全域步進，未必等於某個 TOP 的相鄰 cook／渲染間隔；不能用固定 1/FPS 冒充 |
| Frame | int，從零開始的渲染幀序號 | FRAMEINDEX | iFrame | me.time.frame／absTime.frame 是時間計數，會跳幀且起點不同；若要求渲染計數須另外對齊，不直接改名當作等價 |
| Resolution | vec2，當前繪製目標的像素寬高 | RENDERSIZE | iResolution.xy | TOP 可使用 uTDOutputInfo.res.zw，不是網頁 viewport／CSS 尺寸 |

上述是最初跨宿主對照，不是把時間限制為單一 Time 的定案。使用者後續希望細分 Absolute Time（Abs Time）、System Time、Timeline Time、Frame 與 Delta Time，並指出 TD 已有原生時間／CHOP 資料，應直接提供，無須自行計時或保存上一幀再求差。Delta Time 列入能力討論，不因前述語意差異而排除。

- Absolute Time：TD 的 absTime.seconds；保留 TD 的暫停規則，不描述成永不暫停的系統時鐘。
- Timeline Time：選定時間軸的時間，沿用宿主播放、循環、跳轉行為；目前 TD 預置使用 me.time.seconds。
- System Time：系統時鐘／日期時間的方向；輸出格式、時區及與 Date 的關係尚未定案，不默認為單一 Unix timestamp float。
- Frame：保留此能力；使用哪一時鐘的 frame、名稱及型別再界定，不強迫沿用助手先前提出的「從零起渲染次數」。現有 Timeline／Absolute Frame 不因本次討論改動。
- Delta Time：直接使用符合需求的宿主原生步進。已確認 absTime.stepSeconds 提供前後全域 frame 起點的秒數差；Feedback CHOP 的 Delta Time 開關可輸出自該 CHOP 上次 cook 以來的 dt。它們是可用原生來源的例子，尚未確認使用者所指的特定 CHOP，也不因此新增 Feedback 網路或假定其 cook 間隔等於 Shader 的 cook 間隔。此處須選定與說明來源，沒有自建計時器的需求。

Resolution 維持輸出尺寸；使用者已確認 uTDOutputInfo 與輸入貼圖資訊是不同來源，前者正好提供這項能力。Date（vec4，年／月／日／日內秒數）原為選配候選：ISF DATE、Shadertoy iDate，與上述 System Time 一併討論，月份起算、時區等慣例還需統一。共通來源不要求所有目標都新增實體 Uniform：可直接使用宿主既有符號，只在需要且被圖引用時建立必要供值。值由執行宿主維護，不靠網頁每幀輪詢再送回 TD；各目標對時間種類的可用性另行映射，不假定 ISF／Shadertoy 原生提供 TD 的全部時間軸能力。以上仍是能力整理，未實作或遷移現有來源。

Pixel Size（1/Resolution）及 Aspect Ratio（寬/高）可由 Resolution 推導，無需獨立供值；這裡的 Aspect Ratio 是尺寸比，不等於 Shadertoy iResolution.z 的 pixel aspect ratio。輸入貼圖尺寸留在各貼圖來源／查詢能力。Mouse／Pointer、音訊／FFT、Pass Index 及 Frame Rate 不列首批共同必備項：三方的提供方式或語意不同，須另外設計。UV／Fragment Coordinates 隨片段變動，不是 Uniform。

參考：[ISF 內建變數](https://docs.isf.video/ref_variables)、[ISF 輸入類型](https://docs.isf.video/ref_json)、[Shadertoy 官方編輯器 Inputs 說明](https://www.shadertoy.com/view/XsfcWj)、[TD GLSL TOP](https://docs.derivative.ca/Write_a_GLSL_TOP)、[TD Frame](https://docs.derivative.ca/Frame)、[TD absTime](https://docs.derivative.ca/AbsTime_Class)、[TD Feedback CHOP 原生 dt](https://docs.derivative.ca/Feedback_CHOP)。

### 靜態 Online 入口／PWA（假設性構想，未決定實作）

使用者提出 GitHub Pages 提供線上編輯器、PWA 安裝及 TOX 下載；TOX 可考慮完整 Portable 版或供 Online 前端連線的版本。使用者可指定本機、LAN 或遠端通道的 TD 位址。GitHub 僅分發前端與下載檔，瀏覽器直接與 TD 通訊，不因此要求雲端代管圖、產碼或轉送資料。

初步可行性：靜態託管足以執行前端；TD 端仍提供 API、Uniform 即時服務與預覽。現有前端使用同源 `/api/` 及網頁 hostname 推导 WebSocket，TD HTTP 拒絕跨站 Origin／Sec-Fetch-Site；需另設連線目標、明確授權與 CORS，並處理 Online 前端與已下載 TOX 的版本相容。若精簡 TOX，尚不能假設可刪除目前仍在 Python 的產碼能力。

主要待驗證點是 HTTPS Online 頁面連到本機／LAN HTTP、WS 的 mixed-content 與本地網路權限限制。Chrome 已提供部分本地請求的授權與 mixed-content 豁免，但不可據此推定所有瀏覽器、WebSocket 或 iOS PWA 均適用。PWA 安裝本身不解除瀏覽器的網路存取規則。可評估可信任的 HTTPS／WSS 入口（例如 Tailscale Serve），但這仍需端點／代理相容，且 HTTPS 不取代 CORS 或連線授權。後續若要驗證，可先以最小 Online 頁面測 HTTP、Uniform WebSocket 與 WebRTC，再決定打包方式；目前不調整產品或部署網站。

參考：[GitHub Pages 靜態託管](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)、[Chrome 本地網路存取](https://developer.chrome.com/blog/local-network-access)、[PWA 安裝條件](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)、[CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)、[Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve)。

#### 配對入口與離線啟動（需求補充，未決定實作）

使用者希望研究讓 TD 與 Online 網頁快速連接的入口，包括拖入 TOX 後的提示／彈窗、Parameter 上的說明、複製連線資訊，以及兩端均提供指引；尚未指定最終互動。另詢問 GitHub Pages 是否能提供 PWA，以及安裝後離線能否開啟。

候選建議（尚待審查）：TD Parameter 保留 Open Editor、Copy Connection 與手機可掃描的 QR 入口；網頁保留 Connect to TD 與貼上連線資訊入口。共用同一份配對資訊，由 TD 提供可用端點與短效配對授權，再由網頁顯示連線目標與結果；桌面直接開啟、手機掃碼、既有 PWA 貼上皆可使用。是否在初次拖入時提示另行決定，不把每次工程載入或節點複製自動彈窗當作既定行為。連結／QR 只簡化配對，不取代 HTTPS／CORS／網路可達性驗證；不能保證系統會把連結導向已安裝的 PWA。若使用只含短碼的跨裝置配對而不攜端點，仍須有可尋址的配對服務，不能視為 GitHub Pages 自帶能力。

GitHub Pages 的 HTTPS 靜態檔案託管可以提供 manifest 與 service worker，具備建置可安裝、可離線啟動 PWA 的條件；安裝與離線能力需各自實作，安裝本身不自動快取全部資源。首次線上載入後須完成必要前端／節點定義等資源的本機快取，離線入口也不能等待 TD 回應才初始化；快取更新需保持版本一致。圖的本機保存則另行設計，不能把快取介面等同保存使用者圖。PWA 安裝到使用者裝置，由瀏覽器／系統管理，安裝入口隨平台不同。若離線資源被清除，需重新下載。

離線能力分別看待：沒有 Internet 但本機／LAN 仍能連到 TD，完成快取的前端可繼續使用可達的宿主，前提是不依賴外部 signaling／授權服務；完全沒有 TD 連線時，可規劃瀏覽與編輯本機圖，但現有初始化、資料依賴須解耦。完全離線重新產碼與 WebGL 執行還需要本機可用的產碼器、執行器及所需資源，PWA 本身不會把現有 TD／Python 能力搬到瀏覽器。

參考：[GitHub Pages HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)、[PWA 安裝與平台差異](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)、[離線運作與快取](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation)。

### 僅協助直連的服務（延伸假設，未決定實作）

使用者補充：可考慮一個只協助 WebRTC 建立連線的中間服務，直連失敗時不回退至資料轉送。對應設計為 signaling 交換配對／SDP／ICE 資訊，可搭配 STUN 探索位址，不配置 TURN 資料中繼；業務資料与預覽在瀏覽器和 TD 之間直接傳輸。此服務需要另行部署，靜態 GitHub Pages 本身不提供動態 signaling。

取捨：不承担預覽／圖／Uniform 的中繼頻寬，但部分 NAT／防火牆環境可能無法連線，須明確顯示失敗；不保證透過 signaling／STUN 一定能直連。若圖操作與 Uniform 也要沿用 WebRTC，需透過 DataChannel 接入既有命令／回覆與即時值契約，不能假設現有 HTTP／WebSocket 會自動被打通。現有 Remote Panel 已使用 TD WebRTC DAT 的 DataChannel 接收操作，可作為評估基礎；不代表完整編輯器通道已具備。僅記錄構想，不啟動改造。

參考：[WebRTC signaling 與 peer connection](https://webrtc.org/getting-started/peer-connections)、[TURN 的資料中繼角色](https://webrtc.org/getting-started/turn-server)。

### 網頁執行、圖交換與 ISF 匯出（延伸假設，未決定實作）

後續釐清：此處的獨立 Online 版本不依賴 TD 安裝、啟動或連線，也不是操控 TD 時的遠端預覽。瀏覽器宿主自行供應來源值、紋理、資訊與必要函數，評估相容 TD GLSL TOP 常用環境；純靜態／離線方案也須讓產碼能力在瀏覽器可用。使用者指出自動產生 ISF 可接現成執行器，因而 ISF 除了匯出，也可作為 Online 執行中介候選。已查到官方列出的 [ISF-JS Renderer](https://github.com/msfeldstein/interactive-shader-format-js) 提供載入、輸入設定、紋理上傳與繪製介面；尚未驗證完整相容性或效能。ISF 2.0 是格式／宿主介面版本，與 GLSL／GLSL ES 版本分開，符合格式仍須符合所選執行器的底層能力。此可行性討論用來考慮目前 Sources 的呈現風格，不代表已決定宿主架構或啟動 Online 實作。

使用者補充釐清三種可組合的能力：在網頁執行 Shader、下載圖供 TD 使用，以及額外匯出 ISF。網頁執行不必以 ISF 為中介格式；ISF 是另外增加的輸出能力，不是整個產品或所有執行路徑必須採用的格式。圖仍是可編輯的圖資料，與產出的 Shader／ISF 分開。此方向新增的是產碼目標／執行宿主及圖交換能力，與前述 Portable／Online 前端託管及直連方式分屬不同層次，不要求互相取代。

需區分兩個成果：瀏覽器執行已產出的相容 Shader 可以不連 TD；要在沒有 TD 時繼續編輯圖並即時重新產碼，現有 Python 產碼能力還需能在瀏覽器或另一個獨立服務執行。若另外提供 ISF 執行能力，其宿主負責 JSON 輸入描述、時間／尺寸、材質及宣告的 pass／buffer 等執行資源；ISF 格式本身不保證任意桌面 GLSL 能在 WebGL 執行。可攜運算可共用圖能力，但 TD 專用函式、來源、Parameter／Python Expression、TOP／MAT 環境與 WebGL GLSL ES 能力差異需另外映射或標示不支援，不默默改變語義。此想法僅收集，不列入已確定 Alpha 範圍。

參考：[ISF 格式](https://docs.isf.video/)、[ISF 輸入描述](https://docs.isf.video/ref_json)、[ISF 開發者資源](https://isf.video/developers/)、[WebGL 2 規範](https://registry.khronos.org/webgl/specs/latest/2.0/)。

## 偶發卡頓與追蹤（2026-09-19，待調查）

使用者仍偶爾感受到卡頓，無穩定復現步驟，也不確定是否與 Uniform 有關。建議後續對齊卡頓時間與瀏覽器 Performance trace 的 JavaScript、layout／paint 及通訊事件，仿照 TD 即時效能排查；不以 FPS 數字單獨歸因。本輪優先完成 Uniform 連續雙向同步，不加入常駐效能探針或展開其他優化。

## 圖保存流程需求收集（2026-09-19，僅記錄，待統一歸納）

使用者要求先逐項收集抽象需求，最後再歸納整理；此輪不實作，也不提前確定技術方案。

已依後續授權整理成 [圖同步、暫存與 Shader 套用方案](GRAPH_SYNC_SAVE_PLAN.md)，供整合審查，尚未修改產品。下方保留需求來源；同步、暫存、工程保存的最新區分以方案及本節補充為準。

- 圖的磁碟暫存可作為保存功能的一個子任務：即使尚未儲存 TD 工程（`.toe`），圖資料仍可留存在 TD 資料夾內某個指定子資料夾。
- 確切路徑、寫入時機、暫存內容、保留及復原規則尚未決定，細節留待後續討論；目前的筆記不代表已具備此功能。

使用者補充：以下內容包含個人觀察、可能的抽象需求及候選解法，不代表已指定實作方案；可提出更合適的方法，最後再統一歸納。記錄時需區分觀察、目標與解法，不把討論中的分層直接升格為架構定案。

使用者進一步提出依變更影響區分觸發流程：

- **圖的功能內容**：接線、運算、型別及會影響產碼的參數；對應用語表的「圖的運算內容」。**圖的外觀資料**：位置、編輯器顏色、展開狀態、筆記等編輯資訊。兩者都可包含在圖文件內，不必因此拆成兩份檔案。
- 外觀變更需要更新畫面並使圖具有待同步變更，但是否／何時同步、暫存或存檔另訂，不能推定每次都保存。它不應為此產生 GLSL 或觸發 Shader 編譯；判斷依欄位的用途，不是所有節點參數都算功能變更。這裡的外觀指編輯器的呈現，不是 Shader 輸出的影像。
- 圖傳輸／保存／暫存、GLSL 產生、編譯驗證、正式套用與執行分開考慮；是否及何時觸發後續階段留待歸納。使用者認為外觀操作可能更頻繁，分流有機會減少不必要工作；改善幅度未量測，也未確認為既有卡頓的原因。

本輪程式核對與回應（用來釐清邊界，尚未實作新流程）：

- 現況 `deploy()` 先呼叫 Python `compile_graph()`，再依產物與目前目標判斷能否僅保存布局；因此已有「不更新 Shader」分支，卻仍未避開圖檢查與產碼工作。
- 需區分運算意義與 GLSL 文字：目前一般節點的 `ui.label`／`ui.comment` 會寫入 GLSL 註解；專用 Comment 節點則不參與產碼。因此不能直接把所有 `ui` 欄位視為同一類，註解文字更新與執行程式更新的責任仍待整理。
- 既有 Uniform 的執行期值可改變輸出，卻不需要改 GLSL 原始碼；此類更新要與圖外觀及產碼變更分開判斷，不能以「畫面有變」推導需要重新編譯。
- 如果「編譯檢查」實際交給 TD 的 GLSL 編譯器，它已包含編譯；之後概念上是正式套用／執行。現況候選目標與正式目標各做驗證，是實作安排，不是所有架構必然需要兩次編譯。
- 待處理的影響需累積：先改運算參數、再移動節點，不能因最後一次是外觀操作就漏掉尚未處理的產碼需求。外觀分流仍須保留必要的文件完整性與版本衝突檢查，不等於跳過所有檢查。

Uniform 責任邊界補充（使用者明確要求，尚未據此改實作）：

- 圖可描述 Uniform 物件的身分、型別、宣告及引用／接線關係，但不擁有 Uniform 的即時值，也不負責保存該值。值的實體在 TD 的 GLSL TOP／MAT Parameter；由 Expression、Export、Bind 或自訂控制驅動時，仍尊重 TD 的既有控制關係。
- 從瀏覽器修改時，是寫入 TD Parameter；從 TD 修改時，是瀏覽器讀回並呈現。兩個方向的純值變更都不應修改圖內容、增加圖版本、標記圖為未保存，或因此觸發圖保存／暫存／產碼。即時數值流的頻率不能變成圖保存頻率；TD 工程保存與數值操作的撤銷另屬各自責任。
- 新增／刪除／改名／改型別或改接線屬物件定義及引用變更，須與純值更新分開；現存宣告中的初始化預設值也不等於 TD 即時值。預設值的歸屬及既有資料格式留待後續整理，不在此默默決定刪除或遷移。
- 本輪只讀核對：`writeUniformInput()` 與 `refreshUniforms()` 未直接呼叫圖的 `mark()`；原生來源的 `reconcile()` 對已匹配的 Uniform 不因數值變動覆寫宣告的 `value`，純值變更不使 `sync()` 寫入圖。更新結束的 `scheduleGraphApply()` 仍以既有 `dirty` 為條件，不自行標記圖變更。來源結構變更另有同步路徑，不能一併停用。
- 現況仍包含來源掃描、`checked_state()` 圖檢查及操作歷史快照等共用工作；因此「純值更新未直接觸發圖保存」不代表整條路徑已完全解耦或適合高頻更新。本輪未做效能量測，後續 Uniform 通訊評估須保留這個區別。

方案整理期間的補充：

- 更新 TD 的 DAT、將小份圖 JSON 寫入磁碟、保存整個 `.toe` 是不同工作。使用者經驗為工程保存慢、文字檔保存快；不能用前者的成本推定後者，也不能把同步視為磁碟保存。
- 效能總量、請求完成延遲與主執行緒阻塞分開看；TD 原生與 Python 方法都應逐項核對是否同步執行。降低頻率不必然消除單次停頓，背景 I/O 也不表示圖序列化與宿主工作消失。
- 原則是非必要工作盡量不影響 TD 即時性；必要的圖合法性檢查與 GLSL 編譯可以付出成本，不以優化為名取消責任。
- JSON 大類別／區域監控、瀏覽器產碼、外部網路服務是使用者提供的候選方向，允許帶證據評估，不直接當作實作指令。現行方式的優點是 portable，使用者已更正不是「可行度最高」。
- 第一輪方案獲原則認可；暫存細節仍在討論。使用者提出在有限範圍內增量保存，取代助手先前只保留最新及上一份的建議，預期不會帶來額外成本。方案納入完整檢查點＋有界增量保留；具體範圍／粒度待定。工程回應是可望降低額外負擔，仍需核對編碼、整理及重播成本，未將零成本視為已驗證事實，也未實作。
- 使用者要求調查 Project UUID、增量保存改名、既有 Grape 身分，以及複製工程分支共用暫存位置的碰撞。官方公開 Project API 未找到可依賴的持久 UUID；TD `OP.id` 不跨重開穩定，Grape 則已有 storage 內的 Shader／Manager ID。工程副本仍會帶走這些 ID，不能單靠它們辨識分支。
- 調查與候選規則已補入方案第 10 節：暫存跟隨工程資料夾，按精確工程檔名及獨立寫入紀錄分組，再用 Shader ID 定位圖。改名／另存開新紀錄並記錄已觀察到的前後關係，不猜尾端編號、不靜默合併／復原；代價是多一份檢查點及跨分組歷史，仍待審。此次只讀程式及官方文件，未改產品、未開啟／保存 TD 工程。
- 使用者進一步詢問能否先做圖同步及效能、延後新增暫存。相依性核對：可分開；建議 A／B／C 先驗收，Uniform 路徑 E 獨立接續，D 暫存延後，F 通訊另審。保留既有 DAT／草稿／手動保存能力，不新增待用的磁碟佇列或排程；尚無新跨重啟復原保障。這是方案順序建議，並非使用者已授權產品實作。
- 使用者澄清不要求消除所有卡頓，而是要求功能與現在一致，並請助手預先檢查其他副作用。方案據此加入功能等價硬性驗收表：撤回 Label／Comment 延後更新 GLSL；保留現有排程、草稿保護及 Save TD 行為；首批 B／C 縮小，完整工作圖遷移與新政策另審。核對到的重點包括 Undo／在途回覆、外部來源及 Shader DAT 改動、損壞 state／升級保護、焦點與快取生命週期；不確定能等價的情境沿用完整路徑，不以效能收益抵銷回歸。此輪仍僅調查／更新方案。

## H／F 置中快捷鍵（2026-09-19，0.8.113 已實作）

原先提出多選時 H 置中選取、單選待定；後續使用者改採簡單的 F／H 兩個鍵，不引入 Shift+F。規則為 H 置中整張圖，F 有選取節點時置中選取（單選／多選皆適用），沒有選取節點時與 Home 相同、置中整張圖。H 不隨選取狀態改變。原為平移／縮放阻尼驗收前的旁支筆記，後續使用者明確授權併入本輪修改，已沿用圖快捷鍵路由實作；不將使用者對 TD／Unity 快捷鍵的回憶視為已驗證的外部規格。

命名補充：使用者希望 H 的短按鈕名稱為 **Home**，F 考慮 Frame／Focus；建議採 **Frame**，讓 Focus 保留給既有 Focus Graph，Home 不再接 All。完整提示補充用途，例如 Home：`Fit all nodes in view`，Frame：`Frame selected nodes, or all nodes if none are selected`。名稱與快捷鍵可分開維護；0.8.113 已採短名稱 Home／Frame，完整範圍放在 tooltip、無障礙提示與快捷鍵說明；右鍵選單也顯示 H／F。先前「無選取時 F 不動作」的建議已由使用者的 Home 回退規則取代。

決策理由（使用者經驗）：使用 TD 約十年，幾乎沒有使用 Shift+H／Shift+F；帶修飾鍵使這類視圖操作較不容易成為順手習慣，也降低主動使用的意願。因此本專案優先用 H／F 兩個單鍵涵蓋整圖總覽與選取內容，讓 F 依選取狀態回退 Home，減少需要記憶及組合按鍵的操作。這是本次視圖導航的取捨，不推廣為所有修飾鍵都不適用，也不依此推論其他使用者的 TD 操作習慣。

快捷鍵邊界（使用者確認）：H／F 沿用既有圖快捷鍵的焦點與互動隔離規則；文字／數值輸入、重新命名、程式碼或其他可編輯內容，以及輸入法組字時，不觸發畫布導航，也不攔截原有輸入行為。實作時共用現有判斷，不另建忽略編輯焦點的全域按鍵處理。0.8.113 已由隔離瀏覽器驗證輸入、組字、修飾鍵與手勢隔離；不改寫文字欄位本身的按鍵處理。

## 畫布插值體驗 review（2026-09-19，0.8.114）

使用者實測平移與縮放未感受到此功能本身造成可察覺的顯示效能下降，縮放尤其順暢；既有編輯操作後偶發低 FPS 的情況，插值可能讓停頓更容易被察覺。這是主觀觀察與待驗證解釋，不作為排除插值成本或確認其他瓶頸的證據。250 ms 平滑感明顯，100 ms 幾乎感受不到過渡但能提升質感；繼續試用後決定平移／縮放預設 150 ms。

Frame 過渡預設 333 ms；Home 永遠立即顯示整圖，以工作效率為主。F／Frame 有選取時置中選取，無選取時與 Home 目的範圍相同，但仍遵循 Frame 的過渡開關與時間，兼顧聚焦／展示。設定名稱採 **Frame 過渡（F）／Frame transition (F)**，以快捷鍵避免與影格、群組框混淆。兩組開關仍預設關閉，已有瀏覽器時間保留；Reset 使用新預設。沿用同一段動畫程式及既有中斷清理，不增加另一套動畫或 TD 同步機制。

2026-09-19 後續預設方向（僅記錄，尚未實作）：使用者同意平移／縮放阻尼與 Frame 過渡可改為預設開啟；桌面與平板預設開啟，手機開或關皆可，暫不限定。使用者主觀感受手機／平板原本的操作已比桌面滑順，這不是裝置效能量測結論。時間維持 150／333 ms，Home 仍立即定位；目前程式的兩組預設仍為關閉。此筆記不要求立即修改，也尚未決定如何處理已保存的瀏覽器偏好。

後續澄清：先保留上述方向，待設定檔與偏好保存方式整理時再一起評估預設及既有設定的處理；本筆記不授權現在調整預設或重整設定機制。

## DevTools FPS 與實驗面板讀數差異（2026-09-19，使用者觀察，未重現）

- 畫布靜止時，DevTools Frame Rate 曾顯示約 18 FPS、時間線多為黃色；同時內建面板約 120 FPS、1% Low 116.8、Min 109.9。沒有操作時未感到明顯卡頓。
- 使用者更正：當時是「平移畫布」才恢復正常讀數，不能把縮放也列為已確認觸發條件。
- 後續回報：編輯節點位置後，讀數又恢復正常。恢復持續多久、精確操作序列及原因尚未確認，不能只以靜止時不需更新畫面作為完整解釋。
- 再次回報：恢復後又出現低讀數，使用者無法確定觸發條件。因此「移動節點後恢復」只是一度觀察到的先後關係，不能視為穩定恢復方法或因果證據。

內建面板量測 `requestAnimationFrame` 回呼間隔，不代表 GPU 完成或實際呈現幀率；120 FPS 不能單獨排除渲染／合成端問題。依 [Chrome 官方說明](https://developer.chrome.com/docs/devtools/rendering/performance)，DevTools 黃色表示部分呈現的幀，不應直接解釋為閒置。此處只記錄觀察與量測界線；若後續調查，需對照異常靜止、平移、操作後恢復的 Performance 時序，再判定是哪個階段或統計差異，尚未授權據此修改產品。

## 左側新增節點清單重建（2026-09-19，僅記錄，非急修）

在 0.8.111 原始碼確認，一般節點改型別、拖曳結束透過 `change()` → `render()` → `renderLibrary()`，以瀏覽器既有資料重新建立左側清單；不是每次向 TD 重新同步節點目錄。一般位置／數值／型別修改通常不影響清單內容，具備縮小更新範圍的空間。

使用者實際操作尚未看到這項重建帶來明顯效能下降，認為值得記錄即可。撤回先前「高優先度」的判斷：保留為待量測的改善候選，不視為已確認的重大瓶頸，也未授權立即修改。若之後實作，須保留子圖定義、Stage／子圖路徑、函式庫、語言與唯讀狀態等相依更新，避免清單／按鈕事件引用過期資料。

另有「選取並操作節點後，平移畫布偶發嚴重掉幀」的未穩定重現回報；兩者因果關係未確立，依使用者要求等更多操作紀錄再調查。這些觀察與已修正的空白點擊全圖重建分開追蹤。

## UI 元件共用調查（2026-09-19，排在 Array Create 完成後）

- [x] Array Create 完成後，調查既有 UI 元件是否有應共用卻分別實作的情況。
- [ ] 使用者 review [UI 元件共用調查報告](UI_COMPONENT_REUSE_AUDIT.md)，再決定修改範圍。

0.8.104 Array Create 已交付，調查完成；確認 Array 節點／Parameter 的 Escape 行為差異與樣式覆蓋遺漏，另列來源綁定及選單重複候選。產品 JS／CSS 未因本調查修改，優先建議的 A＋B 也仍待審。

工作順序：Array 長度控制共用修正（0.8.103 已交付）→ Array Create → 本調查。使用者只授權調查，未授權依調查結果修改或重構 UI。

檢查數值／整數輸入、下拉、按鈕、選單等元件的 JavaScript 建立與互動邏輯，以及 CSS 樣式。報告應附實際位置、可觀察的外觀／行為差異、可共用的既有元件及建議優先順序；區分合理的情境差異與無意的重複，不以外觀相近就認定必須合併。先交使用者 review，再另行決定是否修改。

## 英文介面文案審查（2026-09-19，待使用者 review）

- [ ] 審查英文名稱精簡與用語一致性建議，再決定要實作哪些項目。

狀態：調查已完成，使用者只批准列入待辦，尚未 review，未批准修改產品文案。之後使用者詢問「還有什麼事情可以做」時，可提出這項審查作為候選；不能因此自動開始更名或實作。

調查基準為 0.8.101／`5696fc0`：盤點 952 個英文語系項目、82 個基礎節點與 4 個內建圖函數名稱，提出 63 項候選（37 項可見介面、10 項術語／狀態、13 項提示／輔助名稱、3 項準確性問題）。完整對照為本次對話交付的《English UI audit.md》與 CSV；數量表示調查候選，不表示全部接受或逐項完成實機排版驗證。

例如 `Show Custom Names → Custom names`、`Visual Capability → Visual effects`、`Add reference to graph → Add reference` 均仍待審。保留必要的操作／目的地差異；Function／Subgraph 等術語及依狀態顯示的動作名稱另行確認，不全域替換節點定義或 ID。模式切換不做過渡已是確定行為，舊的一秒過渡提示列入文案修正候選，尚未藉這次調查改動。

## 右鍵選單補齊既有操作（2026-09-19）

使用者新增筆記：右鍵選單可使用二級選單，補齊目前適用的既有功能，明確包含自動排列及將選取區域置中。沿用工具列／快捷鍵的既有操作與選取範圍，依情境提供入口；具體分類與版面於實作時整理。此筆是後續 UI 工作，不中斷目前陣列工作。

0.8.95 已實作：排列的二級選單共用全部既有排列動作；新增選取區域置中、建立／移入／移出群組框的適用入口。支援滑鼠、觸控點選及方向鍵／Escape，視窗邊緣改向與捲動；選取或所在子圖已改變時不執行過時動作。7 組 Chromium 瀏覽器檢查通過，涵蓋 Undo、唯讀、窄畫面、觸控列高及群組框操作；非實機 iPad 驗證。其他工具列收納仍是獨立工作。

0.8.96 依 review 補上水平分隔線，主選單依新增、複製／貼上／複製副本／重新命名、收合／展開／排列／置中、群組框／Subgraph、刪除分組。情境隱藏整組時不留空白或重複分隔線；鍵盤只巡覽操作項目。

0.8.98 依 review 新增檢視分組：置中整張圖（H）、置中選取、專注編輯／恢復版面、進入／離開瀏覽器全螢幕。沿用現有操作，無選取及唯讀仍可使用整圖檢視；全螢幕使用原生支援與 busy 判斷，顯示目前的狀態及圖示。9 組 Chromium 檢查通過，包含實際進出瀏覽器全螢幕與圖／Undo 歷史不變。Undo／Redo、自訂名稱、GLSL 是否進右鍵選單仍未定案，這輪保留原工具列入口。

## Network Editor 工具列收納與導航位置（2026-09-19，依最新筆記）

目的：Stage 按鈕與子圖路徑列（進入 Subgraph 的 location／breadcrumb）保持穩定位置，不因其他功能提早換行；兼顧觸控操作。

- 優先評估由快捷功能區退讓：空間足夠時展開，空間不足時按完整功能分組收進下拉選單，例如 Undo／Redo 必須一起保留或收合。
- 前一筆「顯示自訂名稱」與「GLSL」合併為下拉圖示，納入此收納方向，不固定要求永遠收合。其他入口可容納 Network Editor 相關功能／設定，不限定為 Display；名稱、圖示與分類仍待設計。
- 0.8.99 review 修正：空間足夠時「顯示自訂名稱」與「GLSL」直接顯示；真的有工具收入下拉時，才顯示下拉入口。先前把「常駐」解讀成無內容也保留入口，造成無用途的空選單，已移除；不預留不存在的按鈕寬度，也不因此提前收合。
- 規格需逐項／逐組標註「常駐」或「可收納」，參照系統工具列及 Adobe 工具列的方式，不把所有功能一律自動隱藏。Stage、子圖路徑列為常駐；顯示自訂名稱／GLSL 可收納。完整分類見下方 Workspace layout。
- 適用範圍必須明確指定：只有規格明訂具備這種工具列收納能力的區域才套用，不推廣成所有面板、按鈕群或介面的通則。
- 同樣的分組收納方式可供其他快捷功能區參考。選取工具列目前尚未過長；日後可考慮，但是否自動收合尚未決定。

使用者明確指定以這筆後續說明為主。0.8.97 已實作頂部工具列試行：Stage、路徑與「節點編輯器工具」下拉常駐；GLSL、自訂名稱、選取操作、編輯操作、框選、Undo／Redo 依此順序整組退讓。設定已將操作交給浮動選取工具列時，不把它搬回頂部或下拉。完整逐組分類、測量方式與範圍見 [Workspace layout](../ui/WORKSPACE_LAYOUT.md)；下方狀態列上拉仍未實作。

上述 0.8.97 的常駐空入口已由 0.8.99 修正。7 組工具列檢查通過，包含剛好容納所有工具的邊界寬度、縮窄／放寬切換、焦點可達及原操作回歸。

## 狀態列上拉收納（未來方向，2026-09-19）

若日後右下角狀態功能列的快捷入口不足，可參照系統列，以一個上拉選單收納。目前空間尚足，只記錄方向，不實作，也不新增常駐入口。

## 局部複製 Auto 節點後的型別攔截（2026-09-18）

狀態：使用者回報，暫緩調整。

選取有內部連線的 Fraction、Split、Combine，複製後貼上，出現「未套用此操作，已保留原圖。分量範圍或接孔配置無效；請確認起始接孔與輸出型別。」原本 Split 為 Auto · vec4，Y／Z／W 接往 Combine；選取外的上游連線不會一併複製。外部連線移除後 Auto 重新推導型別是可能原因，尚未完成重現與確認。

使用者認為這是合法的錯誤攔截，需另評估的是貼上體驗，例如保留複製時的解析型別、提示使用者調整型別，或提供其他操作。不要取消有效驗證，也不要因此默默鎖定所有 Auto 節點。這輪先記錄，不針對此情境修改。

回報截圖：`codex-clipboard-242cca2a-4401-43ac-96e1-df06a16379d5.png`、`codex-clipboard-dbf03f62-b8cb-4163-b76c-a33213344e80.png`。
