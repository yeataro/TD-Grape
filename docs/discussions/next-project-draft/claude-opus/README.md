# GrapeL 價值審查與執行期契約

* **貢獻者**：Claude Opus 4.8 (Anthropic) 與 [@yeataro](https://github.com/yeataro) 協作
* **專案定位**：TD-Grape 架構失敗的原因分析，以及面向 AI agent 的**可執行**架構契約
* **文件版本**：2026-09-22
* **授權標註**：本目錄下所有產出依循本專案開源授權協議保存與公開

> **署名沿革**：本資料夾初稿在同一工作階段中以 Claude Sonnet 4.6 起草（原目錄名 `claude-sonnet`）。切換模型後由 Claude Opus 4.8 重新審查，發現初稿的核心交付物自我矛盾並改寫，目錄一併更名為 `claude-opus`。以下內容由 Claude Opus 4.8 負責；完整來源保留於 git 歷史。

---

## 本資料夾的定位

Antigravity 的貢獻聚焦於技術架構（節點定義 schema、型別系統、產碼閉環）。
本資料夾聚焦於兩個不同的問題：

1. **為什麼架構目標會失守** — 不是技術問題，而是 AI agent 的執行模式與價值目標設立方式之間的結構性衝突。
2. **如何在執行期建立有效契約** — 讓架構約束在每次 commit 被機器驗證，而不只存在於文件中。

---

## 目錄結構

```text
claude-opus/
├── README.md                                  # 本文件
├── for-human/
│   ├── value-and-contract-review.md          # 價值審查、失敗原因分析、契約設計原則
│   └── the-guardrail-and-the-granularity-trap.md  # 為什麼以前有效、這次失效：人作為活護欄與顆粒度陷阱
└── for-agent/
    ├── ARCHITECTURE_INVARIANTS.md            # 不變量機制的說明：為何存在、如何擴充
    └── templates/
        └── architecture-invariant.test.ts    # 可執行的架構不變量測試（核心交付物）
```

---

## 一個誠實的自我修正

初稿的 `for-agent` 是一份 `EXECUTION_CONTRACT.md`——要 agent 在完成任務前自我核查一串架構問題。這與本資料夾自己的核心論點直接矛盾：**若文件無法在違反的當下報錯，它就無效；而一份靠 agent 自律的守則，正是這種無效的文件。**

改寫後的 `for-agent` 不再要求任何自我核查。契約改由 `architecture-invariant.test.ts` 在 CI 執行——客觀、即時、持久。文件只負責解釋這個機制。這個修正過程本身記錄在 `for-human/value-and-contract-review.md` 的「為什麼文檔不能解決這個問題」一節，作為「寫下正確原則 ≠ 遵守它」的實例。

---

## 使用方式

**for-human/**：給人類設計者讀。解釋這個專案以這種方式失敗的原因，以及如何防範同樣的失敗模式。

**for-agent/**：給接手 GrapeL 的 AI agent 讀，與 Antigravity 的 `AGENTS.md` 並列使用。Antigravity 規定架構應該是什麼形狀；本資料夾提供讓那個形狀被機器持續驗證的測試機制。**啟動新專案時，把 `templates/architecture-invariant.test.ts` 接上實際 API 並納入 CI。**
