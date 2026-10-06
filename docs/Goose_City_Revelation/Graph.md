張麻子把 Graph 往堂上一扔。

「聽說你是 canonical。」

Graph 說：

「是。」

「整個專案都聽你的？」

「編輯狀態聽我的。」

「Export 呢？」

「用我。」

「Connector 呢？」

「也用我。」

張麻子點點頭。

「好大的官。」

——

師爺趕緊說：

「縣長，不一樣。Export 跟 Connection 是它的能力顯現。」

張麻子轉頭。

「能力顯現？」

「對。」

「這四個字挺漂亮。」

「有問題？」

「我一聽漂亮話，就想查帳。」

——

張麻子問 Graph：

「你會 export？」

「……」

「我問你，你自己會不會？」

「Exporter 會。」

「那他媽就不是你的能力。」

師爺一愣。

「怎麼不是？」

「Exporter 沒了，它還會嗎？」

「不會。」

「那叫誰的能力？」

「……Exporter 的。」

「Graph 是什麼？」

「Exporter 操作的對象。」

「這不就完了？」

——

師爺急了。

「可是從產品語意上，可以說 Graph 具有 export capability。」

「可以。」

「那——」

「但是架構上別信這句話。」

「為什麼？」

「因為這句話再講半年——」

張麻子在白板上寫：

`graph.export()`

又寫：

`graph.connect()`

再寫：

`graph.generate()`

最後補了一個：

`graph.savePublishConnectCompilePreviewDeploy()`

「看見沒有？」

師爺不說話。

「你說的是產品語言。」

「嗯。」

「程式聽久了，會當真。」

——

黃四郎在旁邊笑了。

「張麻子，你這就吹毛求疵了。」

「是嗎？」

「Graph 本來就是核心。」

「核心？」

「對。」

「所以什麼能力都往它身上掛？」

「方便。」

張麻子笑了。

「黃老爺。」

「嗯。」

「你這輩子最大的本事，就是把『方便』兩個字說得像設計原則。」

——

他重新問：

「Export 怎麼辦？」

師爺這次小心了。

「Exporter 讀取 Graph。」

「讀什麼？」

「Snapshot。」

「然後？」

「產生輸出。」

「產完能不能扔？」

「能。」

「下次能不能從同一份 Graph 重新產？」

「能。」

「結果一樣？」

師爺停了一下。

「理論上。」

槍上膛了。

「我不問理論。」

——

師爺擦汗。

「還會受 generator version、target、設定影響。」

「哦。」

「可能還有 module registry。」

「哦。」

「某些 target 有 environment。」

張麻子笑了。

「那你剛才說誰是 source of truth？」

「Graph。」

「再說一次。」

「……Graph 加顯式設定。」

「還有呢？」

「Generator version。」

「還有呢？」

「Capability registry。」

「這不就出來了？」

——

張麻子把槍放回桌上。

「Graph 可以是**編輯語意的 canonical state**。」

「對。」

「但別吹成宇宙真理。」

「……對。」

「Export 的真實輸入如果是 Graph + Target + Registry + Version，那就把這幾樣東西明著擺桌上。」

「為什麼？」

「因為藏起來的 dependency——」

他敲了敲桌子。

「最喜歡半夜當皇帝。」

——

接著審 Connector。

「你幹什麼的？」

Connector 說：

「連 Host。」

「你存 Graph？」

「不存。」

「好。」

「我有 cache。」

張麻子抬頭。

「什麼 cache？」

「為了 diff，只留上一版。」

「能扔嗎？」

「能。」

「扔了會丟資料嗎？」

「不會，只是下次全量送。」

「那還行。」

Connector又說：

「我還存 connection state。」

「什麼 state？」

「Connected、Disconnected、Last Error、Host Capability……」

「這是誰的？」

「我的。」

「會不會寫回 Graph？」

「有時候 UI 要顯示。」

槍又上膛了。

——

師爺趕快說：

「只是顯示！」

張麻子看他。

「顯示在哪？」

「節點上。」

「那你是把 runtime connection status 寫進 document？」

「……」

「存檔嗎？」

「可能。」

「重開還在？」

「可能。」

「沒連 Host 的時候，那個 `connected=true` 算什麼？」

沒人說話。

張麻子笑了。

「遺照。」

——

「所以聽清楚。」

「Connector 的 session state，可以有。」

「UI 可以投影。」

「但別因為畫面想畫一個綠點，就把綠點塞進 Graph 的永久戶籍。」

「那 UI 怎麼拿？」

「問 Connector。」

「每次都問？」

「或者訂閱 derived state。」

「那不就是另一份 state？」

「是。」

師爺一驚。

「那不是多 source of truth？」

「又來了。」

——

張麻子拍桌。

「多份 state 不犯法。」

「什麼時候犯法？」

「兩份 state 都宣稱自己有權決定同一件事。」

——

他在桌上擺四塊牌子。

**Graph：設計內容。**

**Exporter：轉換。**

**Connector：傳輸與連線生命週期。**

**Host：實際執行。**

「四個人。」

「都有 state。」

「都可以是真的。」

「但是——」

張麻子指著 Graph：

「Host 現在跑幾 FPS，你別管。」

指著 Connector：

「節點應該叫什麼，你別管。」

指著 Exporter：

「連線斷沒斷，你也別管。」

最後指著 Host：

「使用者畫布上擺了什麼——」

「更輪不到你管。」

——

黃四郎慢悠悠地說：

「那如果 Host 可以反向修改參數呢？」

屋裡靜了。

張麻子看他。

「好問題。」

師爺說：

「那就同步回 Graph？」

「憑什麼？」

「因為 Host 改了。」

「Host 改了 runtime。」

「對。」

「誰說 runtime 改了，document 就得改？」

「……」

「如果產品規格說要同步呢？」

「那就同步。」

「怎麼同步？」

「Connector 寫 Graph。」

砰。

桌上的茶杯碎了。

——

「錯。」

「那怎麼辦？」

「Connector 提交一個明確的 edit request。」

「誰執行？」

「擁有 Graph 編輯權的那一層。」

「有差嗎？」

「有。」

「差在哪？」

「一個叫越權。」

「另一個呢？」

「走正門。」

——

師爺終於明白了。

「所以 Connector 可以帶消息回來。」

「對。」

「但不能趁 Graph 睡覺自己改戶口。」

「對。」

「Exporter 也不能養自己的 Graph。」

「對。」

「UI 也不能因為方便，偷偷變成另一份 document model。」

「對。」

「Framework 可以持久化 UI state？」

「可以。」

「那 UI state 到底誰的？」

「UI module 定義語意，Framework 提供保存能力。」

「Framework 能不能解釋它？」

「最好不能。」

「能不能順手改？」

「更不能。」

——

師爺沉默了一會。

「那我們原來的設計，算過關嗎？」

張麻子沒回答。

他看著桌上的架構圖。

很久。

「現在還不能說。」

「為什麼？」

「因為你們一直說『能力顯現』。」

「這句有什麼問題？」

「太好聽。」

「……」

「我要看 code。」

「看什麼？」

「Graph 有沒有 import Exporter。」

「Connector 有沒有偷偷保存 document。」

「Exporter 有沒有隱藏 registry。」

「UI state 有沒有混進 project state。」

「Host 回傳值有沒有繞過 edit boundary。」

「Cache 扔掉以後，系統還是不是同一個系統。」

「這些都沒有呢？」

「那你可以站著。」

「有一個呢？」

「查。」

「很多呢？」

張麻子笑了。

「那你不是能力顯現。」

「那我是什麼？」

「你是三百一十七個物件——」

他把架構圖翻過來。

「又準備分家。」
