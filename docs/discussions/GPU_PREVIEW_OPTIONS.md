# TD → Web 預覽傳輸：按需更新與 GPU 共用

2026-09-10；討論與文件調查，未實作／未做效能測試。基準是本機 TouchDesigner 2025.32820、TD-Sgrape 0.6.2。

使用者補充：必須照顧單螢幕編輯情境，不能把預覽成本問題簡化成要求使用者另外開著 TD 視窗。編輯有變動時才按需讀取是可接受方向；探索影像盡可能保留在 GPU、傳到 Web 介面的方案，但不要過度依賴環境。這份筆記細化 MAT_PREVIEW_DISCUSSION.md，尚未改變現有預覽。

## 先區分目標

「純 GPU」在這裡應理解為避免完整像素 GPU → CPU → GPU 的往返與 CPU 影像壓縮，不代表 CPU 完全不參與控制、同步、封包、視窗事件，也不保證 GPU 內部沒有複製或格式轉換。

| 情境 | 最值得優先考慮 | 主要代價與狀態 |
| --- | --- | --- |
| 普通瀏覽器、低頻編輯預覽 | 編輯後按需快照、合併請求、快取最後結果 | 仍有讀回及壓縮，但只在需要時付出；開發與部署負擔較低，尚未測量各方案成本 |
| 本機專用桌面視窗、流暢預覽 | 原生 GPU texture sharing → Electron sharedTexture → VideoFrame | 有機會省掉 CPU 像素讀回和編碼；需原生橋接、同步與平台驗證，API 為實驗性 |
| 本機普通瀏覽器或遠端流暢預覽 | 原生硬體編碼 → WebRTC → 瀏覽器 video | 仍有編碼／解碼及網路成本，需確認真實硬體路徑；TD 內建 WebRTC 不可直接當成 NVENC |
| 未來整合在 TD 同一視窗 | 網頁編輯區＋旁邊的 TD 原生預覽區 | 可以避開 Shader 影像進入 DOM；需重新做宿主版面與輸入，不是現在的普通瀏覽器方案 |

目前建議優先做按需更新的設計；GPU 共用與即時串流保留為可選後續模式。不能在未量測前宣稱某路徑在所有預覽大小／頻率下最省。

## 普通 WebGL／WebGPU 的界線

WebGL 的 bindTexture 接受自身 context 的 WebGLTexture；別的 context 的物件會被拒絕，API 沒有讓普通網頁直接帶入另一個 native process 的 DirectX／OpenGL texture handle 的入口。這是 API／程序間資源交換的界線，不只是裝了 WebGL 就能解決。[Khronos WebGL 規範](https://registry.khronos.org/webgl/specs/latest/1.0/#5.14.8)

WebGPU 的 importExternalTexture 接受 HTMLVideoElement 或 VideoFrame；名稱中的 external 並不表示接受 TD 的原生 GPU handle。把影片畫進 WebGL／WebGPU，只處理瀏覽器收到影像後的使用方式，不會替我們完成 TD → 瀏覽器這段。[MDN API 說明](https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/importExternalTexture)

在 WebGL 重新執行一份 Shader 也不是這題的直接解答：會多一份渲染，還要供應動態貼圖、幾何與 TD builtin，無法自然保證和 TD 本身相同；本輪不採這個方向。

## 本機 GPU sharing 的具體候選

Spout 支援 Windows 程序之間的 GPU 貼圖交換，提供 DirectX／OpenGL 的 native SDK。普通網頁不能直接呼叫該 SDK。[Spout2 原始專案](https://github.com/leadedge/Spout2)

Electron 的 sharedTexture API 可匯入平台共享貼圖並以 VideoFrame 傳給 renderer。Windows 使用 NT HANDLE；官方接口標為 Experimental。官方設計文件提到以 Chromium SharedImage／GpuMemoryBufferHandle 承接 native texture，並指出相關介面生命週期變動快速。[Electron sharedTexture](https://www.electronjs.org/docs/latest/api/shared-texture)、[官方設計文件](https://github.com/electron/electron/blob/main/shell/common/api/shared_texture/README.md)

可研究的架構是 `TD TOP → Spout／DirectX native bridge → Electron sharedTexture → VideoFrame → 同一份網頁編輯 UI`。這是根据接口能力提出的組合，尚未在 TD-Sgrape 接通，不是直接可用的套件。須驗證 handle 種類／跨程序 duplication、GPU adapter 一致、texture format、寫入與讀取同步、尺寸改變、alpha／色彩和生命週期。Spout 的共享 handle 不能未核對就當成 Electron 要的 NT HANDLE。

這條路有機會省去完整像素讀回和 PNG／影片編碼，但需專用桌面宿主與 native bridge。維護成本、安裝體積、GPU 複製及 driver 行為也要算；不承諾 zero-copy 或適用遠端。一般 Chrome／Safari 仍需另一條傳輸路徑。

## WebRTC 的 TD 特有注意事項

Video Stream Out TOP 總覽說明使用 NVIDIA hardware encoder；但其 codec 說明把 H.264 等對應到 RTMP／SRT，而 TD 官方 Palette:webRTC 文件明確指出 WebRTC operators 使用 Libwebrtc 的編解碼器、該路徑沒有硬體編解碼支援。不能把總覽的 NVENC 宣告延伸成「WebRTC 也一定用 GPU」。本機 2025.32820 隨附 Video_Stream_Out_TOP.htm 也沒有提供可證明 WebRTC 硬體路徑的說明。[Video Stream Out TOP](https://derivative.ca/UserGuide/Video_Stream_Out_TOP)、[Palette:webRTC 注意事項](https://derivative.ca/UserGuide/Palette:webRTC)

因此若後續目標是真實硬體編碼，需以指定 TD build 實測，或評估 `TD shared texture → native hardware encoder／sender → WebRTC` 的外部橋接。NVENC 支持註冊外部分配的 DirectX 資源作為輸入，提供避免先讀回整張像素的基礎；仍需串流封包、瀏覽器 codec 協商與硬體解碼驗證。[NVIDIA NVENC 指南](https://docs.nvidia.com/video-technologies/video-codec-sdk/13.1/nvenc-video-encoder-api-prog-guide/index.html)

遠端時 CPU 仍參與傳輸和控制；色度取樣、alpha、色彩／HDR 精度與延遲也要驗收。這條路用於動態觀察，不能取代 TD 原始像素的數值驗證。私人 Tailscale HTTP gateway 也不會自動轉發所有 WebRTC media／ICE traffic；若真的採用，才另做連線方案，不在本輪修改現有入口。

## Web Render TOP 的方向別弄反

Web Render TOP 的 Use Shared Texture 是把 Chromium 產生的網頁畫面交回 TD 的 GPU 貼圖路徑；它不是把任意 TD TOP 注入網頁 WebGL 的公開接口。官方說明 Windows 使用 Direct3D 11 shared texture，多 GPU 要留意使用相同顯卡。[Web Render TOP](https://derivative.ca/UserGuide/Web_Render_TOP)

單螢幕的替代宿主設計可以是在 TD 一個視窗內放網頁編輯區和原生 Viewer／TOP 區，讓預覽直接留在 TD；這避免 Shader 影像傳進 DOM，但不是普通瀏覽器裡的同一實作。若要採用，需獨立評估 UI 互動、尺寸與畫面一致性。

## 按需預覽的建議行為

- 預設保留編輯器內的最後一張結果，清楚標示為快照；不要求第二個螢幕。
- 圖的有效內容／目前參數有變動，合併連續拖動後再要求一張；不把每個 Cook 當成 PNG 觸發。
- 同時最多一個影像請求，期間有新修改只保留最新需求；服務端亦應避免重複產生同一份快照。移動節點等不改影像的操作可跳過取圖。
- 預覽收合或頁面隱藏時停止自動取圖，重新展開抓一次；提供手動更新讓動態來源可觀察某一幀。
- CPU 成本若仍明顯，再依數據評估 GPU 端先縮圖、讀回等待、PNG 壓縮級別／背景壓縮。降低 PNG 壓縮強度可換取更大資料量；只是移動 CPU 工作到背景不會消除它。
- 連續動態觀看另設明確模式與上限，先測量需要的更新率，不把即時串流強加給只需編輯後看結果的使用者。

以上為待實作設計，不是 0.6.2 的現況宣告。驗收應比較操作延遲、UI 更新、GPU／CPU 時間、主執行緒等待、記憶體與位元組；目前沒有新增任何 runtime、網路服務或安裝依賴。


## 最新研討範圍

2026-09-10 使用者指定不必再深究傳輸，這是嘗試性議題。TD Web Browser／Web Render、視窗與使用者自訂 Pane／Panel 分割可讓編輯器旁直接顯示原生輸出；在該配置下不需要重複的編輯器內建 Preview。保持通用瀏覽器入口，詳細補充見 MAT_PREVIEW_DISCUSSION.md。以上均未實作，暫不擴大 GPU／串流研究。
