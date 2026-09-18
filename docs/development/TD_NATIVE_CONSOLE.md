# TD 開發技巧：從外部擷取原生 Console

適用於 Windows，已在 TouchDesigner 2025.32820 實測。當 TD 掛起時，不要繼續依賴 TD 內部選單開啟診斷視窗；事先開啟原生 Console，再由獨立程序保存訊息。

## 為什麼不是單純把 stdout 寫入檔案

`TOUCH_TEXT_CONSOLE=1` 讓 TD 啟動時建立原生 Windows Console。它不是 Python Textport。此次實測從 PowerShell 啟動並重新導向 stdout／stderr，兩個檔案仍為空，但原生 Console 已有 Python 版本、Grape family 註冊與 updater 訊息。因此不能把標準串流重新導向成功當作底層 Console 已經被擷取。

專案工具 `tools/dev/capture_native_console.py` 使用另一個程序：

1. 依 TD 的 PID 呼叫 Windows `AttachConsole`。
2. 以唯讀權限開啟 `CONOUT$`，取得文字緩衝區大小。
3. 用 `ReadConsoleOutputCharacterW` 讀取文字，保存為 UTF-8。
4. 釋放連線，約每秒再讀一次。

它不發出滑鼠／鍵盤輸入、不使用 OCR、不在 TD 主執行緒執行 Python，也不修改圖或 Shader。每次讀取會核對原程序的啟動時間，防止 TD 結束後 PID 被其他程序重用。控制程序保留自己的 Console；每次讀取由短生命週期的無視窗子程序負責，因此控制程序可用 Ctrl+C 停止。

## 使用方式

在專案根目錄開啟 PowerShell。把第一行改成實際安裝路徑；已有 TD 在執行時不要重複啟動，重開會失去尚未保存的內容。

```powershell
$tdExe = 'C:\Program Files\Derivative\TouchDesigner.2025.32820\bin\TouchDesigner.exe'
$toePath = (Resolve-Path 'src/td/TD-Grape-dev.toe').Path
$env:TOUCH_TEXT_CONSOLE = '1'
$tdProcess = Start-Process -FilePath $tdExe -ArgumentList ('"' + $toePath + '"') -WindowStyle Normal -PassThru
$capturePath = Join-Path '..\work' ('td-console-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
python tools/dev/capture_native_console.py $tdProcess.Id --output $capturePath
```

環境變數只作用於這個 PowerShell 及之後由它啟動的子程序，不修改 Windows 永久設定。等待 TD 的原生 Console 開啟後執行最後一行；若已啟動，只要知道該次 PID 且它有原生 Console，也能單獨執行擷取工具。

```powershell
Get-Process TouchDesigner | Select-Object Id, MainWindowTitle
python tools/dev/capture_native_console.py 12345 --output ..\work\td-console-manual
```

`12345` 是示意，需換成實際 TD PID；每次使用新的輸出目錄。原生 Console 通常先於主要編輯視窗建立，`MainWindowTitle` 可能是空字串，不能單靠它判定啟動失敗。

輸出檔：

| 檔案 | 內容 |
| --- | --- |
| `console.log` | 最近一次讀到的文字 |
| `history.log` | 偵測到的變化；若捲動、清除或重排，另存完整快照 |
| `status.json` | PID、最後讀取時間、成功／失敗與停止原因 |
| `snapshot.json` | 子程序最近一次讀取結果 |

可用另一個終端 `Get-Content <輸出目錄>/history.log -Tail 60 -Wait` 查看新增內容。預設最多一小時、約每秒一次；`--seconds 600 --interval 0.5` 可調整。Ctrl+C 或在輸出目錄建立名為 `stop` 的檔案會停止擷取，**不會關閉 TD**。歷史檔超過 32 MiB、連續五次無法讀取也會停止；單次讀取最多五秒。

## GLSL 與掛起的診斷

使用者提供的技巧：部分 GLSL 編譯失敗會在原生 Console 輸出包含 TD 補入宣告的 Shader，可用來對照真正送入編譯器的內容。不同失敗路徑未必輸出完整原始碼；`Info DAT` 的編譯結果仍需另行保存。若需要故意造成編譯錯誤，使用隔離、可丟棄的測試節點，保留使用者圖與最後成功的 Shader。

Console 擷取只能保存已經輸出的訊息，不是攔截每一筆原始 stream。有限緩衝區可能在兩次輪詢間被大量訊息蓋過；讀取中若同時捲動或調整大小，快照也未必完全一致。記錄時間是擷取時間，不一定是原始輸出時間。TD 主介面掛起時，外部讀取仍可能取得先前文字；若程序或 Console 已消失，則只能保留先前落盤內容，無法補救已遺失的訊息。

另一個必要輔助是把測試進度直接寫到檔案並 `flush()`：在 native `cook()`、編譯驗證、Render cook、`destroy()` 的前後留下階段標記。專案的 development runner 會暫存 Python stdout／stderr，單純 `print()` 不代表掛起時外部就能看見它。Console 與階段記錄用途不同，應一起保存。

開發橋接 request 逾時不會自動取消請求。TD 無回應時先不要疊加新測試；確認 identity 後停放未回覆的請求，避免恢復後自動執行。不要只因視窗沒有回應就認定前一個已回報成功的 GPU 測試失敗，應以報告和階段記錄定位。

若 Console 沒有新訊息，可另用 [py-spy](https://github.com/benfred/py-spy) 從外部讀取 Python 呼叫堆疊：`py-spy dump --pid <TD的PID>`。2026-09-19 在 TD 2025.32820／內嵌 Python 3.11.10 實測成功，將陣列來源測試的停點定位到 `prepare_managed_top_slots` 的 `connect()`，不必在掛起的主執行緒執行新程式。它是選用的開發工具，非產品依賴；此次只讀 stack，未使用 `--locals` 或完整程序記憶體 dump。Python stack 可以指出停在哪個原生呼叫，不能單靠它證明 TD 內部的鎖、驅動或 C++ 根因。

此工具和原始記錄屬於開發診斷，不打包進正式 TOE，不把機器路徑／測試記錄提交到產品來源。擷取期間保留原生 Console；不要用它的關閉按鈕來停止擷取，關閉 Console 可能連同 TD 程序一起結束。

## 參考

- [Derivative：TOUCH_TEXT_CONSOLE](https://docs.derivative.ca/Variables)
- [Derivative：Console Mode 與 Native 模式](https://docs.derivative.ca/Dialogs%3APreferences_Dialog)
- [Microsoft：AttachConsole](https://learn.microsoft.com/en-us/windows/console/attachconsole)
- [Microsoft：Console handles 與 CONOUT$](https://learn.microsoft.com/en-us/windows/console/console-handles)
- [Microsoft：ReadConsoleOutputCharacter](https://learn.microsoft.com/en-us/windows/console/readconsoleoutputcharacter)
