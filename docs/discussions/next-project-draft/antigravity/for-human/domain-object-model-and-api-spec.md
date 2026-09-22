# GrapeL 領域物件模型（DOM/DDD）與全程式化 API 架構手則

* **貢獻者**：Antigravity (Google DeepMind) 與 [@yeataro](https://github.com/yeataro) 協作  
* **適用對象**：人類架構師、系統設計者、前端與編譯器工程師  
* **文件版本**：2026-09-23.r1  
* **目的**：建立 GrapeL 的物件導向領域模型（Domain Model）、Value 與 Presentation（展現能力）解耦體系、Node 第一類運行時物件（First-Class Object）規範，並制定從「初期實驗（Day 1 Spike）」到「終局目標（Ultimate Framework）」的漸進式演進路線。

---

## 一、 從 TD-Grape 義大利麵代碼到領域驅動設計（DDD）的病理解構

### 1. 歷史教訓：DOM 義大利麵代碼的代價
在 TD-Grape 的歷史演進中，前端代碼經歷了極為劇烈的變更（Churn）：
* `graph_ui.js`（2,475 行）：變更 **103 次**
* `inspector.js`（1,300+ 行）：變更 **89 次**
* 兩者合計佔據全專案近 40% 的精力投入。

**根本病因在於缺少獨立的領域模型（Domain Model）**：
1. **節點沒有物件身分**：圖上的節點只是純粹的 DOM `<div>` 元素加上全域平鋪的字典（`browserData().nodes`），缺乏封裝、方法與生命週期。
2. **狀態與 DOM 深度混雜**：原生 `<input>` 元素被強行掛載非標準屬性（如 `entry.refreshNumericSlider`、`entry.numericRange`、`entry.setSyncedValue`），數值與渲染綁死在同一個函式內部。
3. **重複製造輪子**：畫布卡片（Card）與側邊欄屬性面板（Inspector）各自寫了一套拖曳事件監聽、數值天梯（Value Ladder）邏輯與樣式重繪，兩邊程式碼無法共用，改一處漏一處。
4. **外部自動化全盲**：因為節點「長在 DOM 裡」，外部 Script、TouchDesigner Python 橋接腳本或自動化測試若想修改一個數值，必須像網頁爬蟲（Web Scraper）一樣去模擬點擊或派發 DOM 事件，完全無法作為嚴謹的軟體函式庫使用。

### 2. 解決方案：四層正交物件導向體系
新架構嚴格依循領域驅動設計（Domain-Driven Design），將軟體能力自底向上劃分為四個完全正交的層級：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. Tooling & Automation Layer (軟體能力、Scripting API、序列化與產碼走訪器)   │
│    - GraphExtractor (Scraper), CodeGenerator, TouchDesignerBridge, ScriptAPI│
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. Construction & Builder Layer (宣告式組裝工廠與鏈式 DSL)                    │
│    - GraphBuilder, NodeBuilder, PortBuilder, GraphUIBuilder                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. Presentation / Capability Layer (展現能力層：數值視圖與互動手勢)           │
│    - ValuePresentation, SliderPresentation, ValueLadder, ChannelAtom        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Core Domain Layer (純領域模型：100% 獨立於 DOM，支援 Headless/Node/Python) │
│    - Graph, Node, Port, Connection, NodeValue<T>, DataType                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、 核心哲學：「Value 是 Model，Slider/Ladder 是 Presentation Capability」

這套架構最核心的抽象突破在於：**狀態本質是「值（Value）」，而「滑桿（Slider）」或「數值天梯（Value Ladder）」只是這個值在 UI 上的一種外在展現能力（Presentation Capability）。**

### 1. 核心模型：`NodeValue<T>`（真身）
`NodeValue<T>` 是一個純記憶體資料物件，**完全不依賴任何瀏覽器 API、DOM 或 CSS**。
* **職責**：
  - 儲存當前數值狀態（`raw: T`）與預設值（`defaultValue: T`）。
  - 維護數值邊界與階距（`min`, `max`, `step`, `precision`）。
  - 提供上下限約束方法（`clamp(val)`）。
  - 發布狀態變更事件（`onChange(listener)`）與髒標記（`dirty`）。
* **非職責**：不碰座標、不監聽滑鼠、不創建 DOM、不包含 CSS 類名。

### 2. 展現能力：`ValuePresentation`（外在化能力）
當使用者需要看見或透過互動修改這個 `NodeValue` 時，才掛載展現能力：
* **`SliderPresentation`**：提供一維水平滑桿渲染、觸控/滑鼠拖曳、進度條填色比率計算。
* **`ValueLadderPresentation`**：提供 TouchDesigner / Houdini 風格的數值天梯手勢（垂直選級距、水平調微觀數值）。
* **`ColorBarPresentation`**：將多個分量映射為即時色彩預覽色條。
* **`StepperPresentation`**：純數字加減箭頭或階距微調器。

### 3. 一份 Model，兩處共用（畫布卡片 vs Inspector）
```
                       ┌─────────────────────────┐
                       │   NodeValue<number>     │ (純狀態核心)
                       │   raw: 0.75             │
                       │   min: 0, max: 1        │
                       └───────────┬─────────────┘
                                   │
                 ┌─────────────────┴─────────────────┐
                 ▼                                   ▼
      ┌─────────────────────┐             ┌─────────────────────┐
      │  ChannelAtom (畫布)  │             │   Inspector (側邊欄) │
      │  - 掛載 Slider       │             │  - 掛載 Slider      │
      │  - 緊湊佈局          │             │  - 掛載 ValueLadder │
      └─────────────────────┘             └─────────────────────┘
```
**架構紅利**：
* 階梯拖曳手勢演算法與 Clamp 邏輯全專案只寫一次。
* 畫布卡片調值時，Inspector 自動同步（因為監聽同一個 `NodeValue`）；反之亦然。
* 跑單元測試時，完全不初始化 Presentation，直接對 `NodeValue` 進行斷言。

---

## 三、 節點作為第一類運行時物件（First-Class Object）與完整 API 設計

圖中被實例化的每一個節點，都是擁有獨立身分、生命週期與操作 API 的活物件（First-Class Object）。

### 1. 核心類別介面規範（以 TypeScript 為準，Python 可同構映射）

#### (1) `NodeValue<T>`
```typescript
export interface ValueOptions<T> {
  default: T;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
}

export class NodeValue<T = number> {
  private _raw: T;
  private _options: ValueOptions<T>;
  private _listeners: Set<(val: T, prev: T) => void> = new Set();

  constructor(options: ValueOptions<T>) {
    this._raw = options.default;
    this._options = options;
  }

  public get(): T { return this._raw; }
  
  public set(next: T): void {
    const prev = this._raw;
    const clamped = this.clamp(next);
    if (clamped !== prev) {
      this._raw = clamped;
      this._listeners.forEach(fn => fn(this._raw, prev));
    }
  }

  public clamp(val: T): T {
    if (typeof val === 'number') {
      let n = val;
      if (this._options.min !== undefined) n = Math.max(this._options.min, n);
      if (this._options.max !== undefined) n = Math.min(this._options.max, n);
      return n as unknown as T;
    }
    return val;
  }

  public onChange(fn: (val: T, prev: T) => void): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }
}
```

#### (2) `Port` 與 `Node`
```typescript
export type PortDirection = 'input' | 'output';

export class Port {
  constructor(
    public readonly name: string,
    public readonly direction: PortDirection,
    public readonly dataType: string,
    public readonly node: Node,
    public readonly value?: NodeValue<any> // 輸入孔可持有內聯值
  ) {}

  public isConnected(): boolean {
    return this.node.graph.isPortConnected(this);
  }
}

export class Node {
  public readonly id: string;
  public readonly definitionId: string;
  public readonly inputs: Map<string, Port> = new Map();
  public readonly outputs: Map<string, Port> = new Map();
  public title: string;
  public position: { x: number; y: number } = { x: 0, y: 0 };

  constructor(public readonly graph: Graph, id: string, definitionId: string) {
    this.id = id;
    this.definitionId = definitionId;
  }

  public input(name: string): Port {
    const p = this.inputs.get(name);
    if (!p) throw new Error(`Port ${name} not found on node ${this.id}`);
    return p;
  }

  public output(name: string): Port {
    const p = this.outputs.get(name);
    if (!p) throw new Error(`Port ${name} not found on node ${this.id}`);
    return p;
  }

  public connectTo(outputName: string, targetNode: Node, inputName: string): Connection {
    return this.graph.connect(this.output(outputName), targetNode.input(inputName));
  }
}
```

#### (3) `Graph`
```typescript
export class Graph {
  private _nodes: Map<string, Node> = new Map();
  private _connections: Set<Connection> = new Set();

  public createNode(definitionId: string, customId?: string): Node {
    const id = customId || this.generateId();
    const node = new Node(this, id, definitionId);
    this._nodes.set(id, node);
    return node;
  }

  public removeNode(id: string): void {
    const node = this._nodes.get(id);
    if (!node) return;
    this.disconnectAll(node);
    this._nodes.delete(id);
  }

  public connect(from: Port, to: Port): Connection {
    const conn = new Connection(from, to);
    this._connections.add(conn);
    return conn;
  }

  public get nodes(): ReadonlyArray<Node> {
    return Array.from(this._nodes.values());
  }

  public getNodeById(id: string): Node | undefined {
    return this._nodes.get(id);
  }
}
```

---

## 四、 外部腳本操作（Scripting）、提取器（Extractor / Scraper）與雙向同步

有了這套物件導向體系，「節點能隨時被外部調用、被腳本寫入、被提取器產生程式碼」的願景便能完全落地。

### 1. 無 DOM 模式的純腳本自動化（Scripting API）
無論是在 Node.js 執行單元測試、在命令列跑批次處理，或是透過 WebSocket 遠端調用，開發者都可以像操作普通軟體物件一樣操作節點圖：

```typescript
// 外部腳本範例：完全不需要啟動瀏覽器或載入 DOM
const graph = new Graph();

// 建立兩個節點並進行連線
const uColor = graph.createNode('uniform/color', 'uColor1');
const mix = graph.createNode('math/mix', 'mix1');

// 程式化設值
uColor.input('r').value?.set(0.8);
uColor.input('g').value?.set(0.2);

// 程式化連線
uColor.connectTo('rgba', mix, 'a');

// 驗證圖拓撲
console.log(graph.isPortConnected(mix.input('a'))); // true
```

### 2. 提取器／走訪器（GraphExtractor / Serializer / Scraper）
提取器的職責是**走訪活的 `Graph` 物件，提取純淨資料狀態，交給產碼引擎或持久化儲存**。它完全不依賴畫面呈現：

```typescript
export class GraphExtractor {
  public static extract(graph: Graph): GraphSnapshot {
    return {
      nodes: graph.nodes.map(n => ({
        id: n.id,
        definitionId: n.definitionId,
        position: { ...n.position },
        values: Array.from(n.inputs.entries())
          .filter(([_, port]) => !port.isConnected() && port.value)
          .map(([name, port]) => ({ port: name, value: port.value!.get() }))
      })),
      connections: graph.connections.map(c => ({
        from: { node: c.from.node.id, port: c.from.name },
        to: { node: c.to.node.id, port: c.to.name }
      }))
    };
  }
}

// 一鍵序列化並傳給編譯器
const snapshot = GraphExtractor.extract(graph);
const glslSource = CodeGenerator.compile(snapshot, environmentManifest);
```

### 3. TouchDesigner 雙向同步橋接（TouchDesignerBridge）
TouchDesigner 運行 Python，GrapeL 前端運行 TypeScript。透過這套 API：
* **TD -> GrapeL**：TD 的 Parameter 改變時，Python 透過 WebSocket 送出 `{ type: "SET_VALUE", nodeId: "uColor1", port: "r", val: 0.95 }`。GrapeL 接收後直接呼叫 `node.input('r').value.set(0.95)`。畫布卡片與 Inspector 自動透過監聽器重繪，代碼流暢無阻。
* **GrapeL -> TD**：畫布拖曳 Slider 時，`NodeValue` 觸發 `onChange`，即時將新數值發布回 TD 的 Custom Parameter。

---

## 五、 現有專案能力盤點與物件歸屬映射庫 (Feature Inventory)

將 TD-Grape 既有的所有能力，依照正交邊界歸納至新架構的物件中，避免功能遺漏：

| 現有 TD-Grape 功能項目 | 舊版實作位置（義大利麵） | 新版標準物件歸屬 | 職責與能力定義 |
| :--- | :--- | :--- | :--- |
| **數值水平拖曳** | `inspector.js` / `graph_ui.js` 硬編碼 | `SliderPresentation` | 負責一維滑桿比例計算、填色背景繪製、微小位移觸發。 |
| **數值天梯 (Value Ladder)** | `locales.json:ladder.hint`、全域 DOM 事件 | `ValueLadderPresentation` | 階梯微調演算法：垂直偵測十進位倍率（`10`, `1`, `0.1`, `0.01`），水平套用位移。 |
| **通道原子 (ChannelAtom)** | `numeric-slider` CSS 與原生 `<input>` 拼接 | `ChannelAtomWidget` | 數值欄位最小原子，封裝單一數值之顯示、雙擊鍵盤輸入與拖曳攔截。 |
| **向量分量群組 (VectorGroup)**| 散落各節點 card 結構 | `VectorGroupWidget` | 排列多個 `ChannelAtom`（XYZW / RGBA），統一管理標籤與網格佈局。 |
| **即時顏色預覽條 (Color Bar)**| 散落各處手動 style 設定 | `ColorBarPresentation` | 監聽多個分量 `NodeValue`，即時渲染 CSS `linear-gradient` / 色塊。 |
| **動態分量展開 (Split 節點)** | 前端 `if (key === 'split')` 暴力分支 | `DynamicPortResolver` (Core) | 依輸入型別語意自動展開輸出接孔清單，UI 只負責依接孔清單繪製。 |
| **預設配方 (Preset 如 Invert)**| 獨立節點定義、獨立 emitter | `NodePresetDefinition` (Core) | 預填特定參數並鎖定（如 `subtract(1.0, x)`），本體仍為基礎運算節點。 |
| **矩陣折疊卡片 (Matrix)** | 手寫 accordion HTML | `MatrixAccordionWidget` | 組合 3~4 個 `VectorGroup`，封裝可折疊面板展開手柄。 |
| **連線與吸附判定 (Hit Test)**| `graph_ui.js` 200+ 行幾何計算 | `GraphTopologyController` | 專門處理接孔座標計算、連線建立/斷開、相容型別高亮提示。 |

---

## 六、 漸進式演進矩陣：「初期實驗（Day 1）」vs「終局目標（Ultimate Framework）」

為了嚴格防止「第一天做太大導致失控」或「第一天寫死導致後期骨化」，下表明確定義**初期實驗（Day 1 Minimal Spike）**與**終局架構**的對照邊界：

| 維度 | 初期實驗（Day 1 Minimal Spike） | 終局目標（Ultimate Framework） |
| :--- | :--- | :--- |
| **圖與核心模型** | - 純記憶體物件 `Graph`、`Node`、`Port`、`NodeValue<number>`。<br>- 支援 2 個節點（`Scalar` + `Add`），無循環檢查。<br>- **100% 無 DOM 依賴，以單元測試為驗收基準**。 | - 完整拓撲排序、有向無環圖（DAG）循環偵測。<br>- 巨集節點（SubGraph）、動態多載（Overload Resolution）。<br>- 歷史狀態記錄器（Undo/Redo Command History）。 |
| **數值與視圖呈現** | - 實作單一原子組件 `<ChannelAtom>`。<br>- 實作最小 `SliderPresentation`，支援滑桿填色與水平拖曳。<br>- **在同一個頁面同時掛載於 Canvas 卡片與 Inspector，驗證 100% 代碼共用**。 | - 完整 `<VectorGroup>`、`<ColorWidget>`、`<MatrixWidget>`。<br>- 完整支援中鍵/長按觸發的 `ValueLadderPresentation`。<br>- 畫布縮放與虛擬化渲染優化。 |
| **建構器 (Builder)** | - 實作最小 `NodeBuilder`：能透過鏈式呼叫配置 1 個輸入孔、1 個輸出孔與預設值。 | - 完整的 `GraphBuilder`、`GraphUIBuilder` DSL。<br>- 支援宣告式定義節點幾何、折疊狀態與客製化裝飾器。 |
| **外部 API 與產碼** | - 實作 `GraphExtractor.extract(graph)` 產出純 Snapshot。<br>- 泛型產碼器編譯為 WebGL 2 片元著色器（Fragment Shader）。<br>- 提供無 UI 腳本操作實例。 | - 完整的雙向 WebSocket RPC 伺服器，支援 TouchDesigner Python 即時連線。<br>- 支援 GLSL 4.5、ISF（Interactive Shader Format）多方言匯出。 |
| **交付與測試守則** | - **CI 強制執行架構不變量測試**：掃描 Core 層，發現任何 `document`、`window`、`HTMLElement` 或 `if (node.id === ...)` 立即紅燈。 | - 完整視覺迴歸測試（Visual Regression Test）與 TouchDesigner 實機整合測試。 |

---

## 七、 結論：讓架構在第一天就處於正確的形狀

遵循這份手則，未來的開發流程將徹底改變：
1. **地基永遠只有一個**：任何新功能（不管是新節點、新微調手勢或新型別），都必須能被安置於這四層正交體系之中。
2. **UI 永遠是消費端，不是產權人**：UI 只負責消費 `NodeValue` 的事件並觸發更新，任何業務邏輯嚴禁停留於 DOM。
3. **終局清晰，當下克制**：即使 Day 1 只寫 200 行代碼驗證單個節點與單個滑桿，它的介面、方法與抽象邊界，也與千行規模的終局系統完全同構。
