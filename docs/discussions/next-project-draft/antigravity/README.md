# GrapeL 專案重構審查與交接包

* **貢獻者**：Antigravity (Google DeepMind) 與 [@yeataro](https://github.com/yeataro) 協作  
* **專案定位**：TouchDesigner 節點式 Shader 編輯器下一個開源專案 **GrapeL** 的前期架構審查、概念重構與智能體交接包  
* **開源聲明**：本目錄下所有產出均為開源專案之協作貢獻，嚴格遵守開源精神公開、透明與具名記載  
* **文件版本**：2026-09-23.r1  

---

## 目錄架構與分工原則

為徹底避免「人類的哲學思考與探索過程」污染「下一代 AI 智能體的純淨工作上下文」，本資料夾嚴格實施**受眾物理隔離**：

```text
docs/discussions/next-project-draft/antigravity/
├── README.md                          # 本導航與開源具名宣告
│
├── for-human/                         # 【人類閱讀專用】深度架構審查、概念辨析、UI 討論與歷史草稿
│   ├── architectural-review.md        # 依照 AGENTS 規約的架構審查報告（嚴肅剖析子集、方言與舊專案病因）
│   ├── ui-widget-design.md            # 畫布四大卡片幾何原型與三層原子積木（ChannelAtom）設計
│   ├── domain-object-model-and-api-spec.md # 物件導向領域模型、Value 與 Presentation 解耦、全程式化 API 手則與漸進演進矩陣
│   └── original-drafts/               # 【歷史存檔】重構前期的原始交接草稿、MaterialX 候選案與探索筆記
│       ├── node-definition-handoff.md
│       ├── node-definition-candidate-materialx.md
│       ├── node-definition-future-notes.md
│       └── node-definition-AGENTS.md
│
└── for-agent/                         # 【智能體專用】極致純淨、零歷史雜訊、可直接交接的啟動包
    ├── AGENTS.md                      # 強制工作守則與四條不可逾越的架構紅線 (Architecture Guardrails)
    ├── DOMAIN_OBJECT_RULES.md         # 領域物件模型與邊界合約守則（零 DOM 依賴、單向依賴與最小 TS 介面）
    ├── SPEC_MINIMAL_SCHEMA.md         # 最小節點定義與環境清單純資料規範
    ├── BOOTSTRAP_TASK.md              # 第一階段（Day 1）單節點純資料產碼閉環任務與啟動 Prompt
    └── templates/                     # 供智能體驗收測試的純淨 JSON 範本
        ├── compare.json               # 解決了簽名膨脹與選項耦合的標準節點範本
        └── webgl2-manifest.json       # 環境層級的型別與能力白名單宣告
```

---

## 兩大分區的使用方式

### 1. 人類維護者（For Humans）
* 請閱讀 [`for-human/`](for-human/)。
* 包含對舊專案 500KB 義大利麵代碼的病理分析、為什麼原先的「子集」概念讓人感到不乾淨、方言與多載的本質拆解、原子積木手感設計，以及**如何以物件導向領域模型與全 API 化的方式構建活系統**。

### 2. 下一個 AI 智能體（For Agents）
* 當您準備啟動下一個獨立專案會話時，**請僅將 [`for-agent/`](for-agent/) 的內容複製或引入新專案中**。
* 新 Agent 絕不應看到舊專案的 1,800 行 `elif`、舊前端代碼或未決的複雜常數傳播推導，確保其在第一天以極簡、宣告式且泛型的方式完成第一階段產碼閉環。
