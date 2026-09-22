# 領域物件模型與邊界合約守則 (DOMAIN_OBJECT_RULES.md)

文件版本：2026-09-23.r1  
閱讀對象：接手 GrapeL 專案實作的 AI 智能體。  
本文件為強約束規格，所有實作代碼必須通過本文件定義之靜態檢查與合約邊界。

---

## 一、 四大核心架構鐵律

### 鐵律 1：領域層零 DOM 依賴 (Zero DOM in Domain Core)
* `src/core/`（包含 `Graph`, `Node`, `Port`, `NodeValue`）的任何檔案中，**嚴格禁止引用或出現任何瀏覽器環境識別符**：
  - 嚴禁：`document`, `window`, `HTMLElement`, `Element`, `Event`, `MouseEvent`, `Touch`, `CSS`, `canvas`.
* **檢查標準**：`src/core/` 必須能在 Node.js (v20+) 原生環境下無 polyfill 獨立執行單元測試並通過。

### 鐵律 2：值與展現能力嚴格分離 (Value-Presentation Decoupling)
* `NodeValue<T>` 是唯一狀態真身；所有 UI 組件（`Slider`, `ValueLadder`, `ColorBar`）均為 `ValuePresentation`。
* **單向依賴**：`Presentation` 依賴 `NodeValue`，`NodeValue` 絕不可感知或反向依賴任何 `Presentation` 或 UI 組件。
* **禁止 DOM 狀態私藏**：不得在 DOM 元素（如 `<input>`）上直接保存業務資料（如不可依賴 `input.value` 作為真身），所有狀態變更必須寫回 `NodeValue.set()`。

### 鐵律 3：第一類運行時物件與 API 先行 (First-Class Object & API First)
* 節點在記憶體中必須是封裝良好的物件實例，不得以裸字典（raw object literals）或純 DOM 拼裝。
* 任何圖拓撲操作、數值讀寫，必須提供公開 API 方法（例如 `graph.createNode()`, `node.input(name).value.set()`）。
* 嚴禁外部模組直接穿透操作內部私有資料結構（如 `_nodes.delete()` 或直接修改內部陣列）。

### 鐵律 4：宣告式構建與工廠收攏 (Builder Pattern Enforcement)
* 建立節點與配置接孔必須透過 `NodeBuilder` 或工廠方法，禁止在各處分散手寫 `new Port()` 或隨機組裝接孔。
* 節點卡片幾何與 UI 裝配必須透過 `GraphUIBuilder`，保證畫布卡片與 Inspector 側邊欄 100% 共用相同的 Presentation 實例。

---

## 二、 依賴方向規則 (Import Direction Rules)

```
[Tooling / Extractor / CodeGen] ───► [Core Domain (Graph, Node, Value)]
                                            ▲
[Presentation / UI Widgets]    ─────────────┘ (僅允許 Presentation 引用 Core)
```

1. **合法引用**：
   - `src/ui/` -> 可以引用 `src/core/`。
   - `src/codegen/` -> 可以引用 `src/core/`。
   - `src/tools/` -> 可以引用 `src/core/`。
2. **非法引用（違者立即判定不合格）**：
   - `src/core/` -> **嚴禁引用** `src/ui/` 或任何外部渲染層。
   - `src/codegen/` -> **嚴禁引用** `src/ui/`。

---

## 三、 標準最小 TypeScript 介面合約 (Minimal Interface Contracts)

智能體實作時，核心類別必須滿足以下介面合約：

```typescript
// 1. 純資料狀態模型
export interface IValueOptions<T> {
  default: T;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
}

export interface INodeValue<T = number> {
  get(): T;
  set(val: T): void;
  clamp(val: T): T;
  onChange(listener: (val: T, prev: T) => void): () => void;
  readonly options: Readonly<IValueOptions<T>>;
}

// 2. 接孔與節點
export type PortDirection = 'input' | 'output';

export interface IPort {
  readonly name: string;
  readonly direction: PortDirection;
  readonly dataType: string;
  readonly node: INode;
  readonly value?: INodeValue<any>;
  isConnected(): boolean;
}

export interface INode {
  readonly id: string;
  readonly definitionId: string;
  title: string;
  position: { x: number; y: number };
  input(name: string): IPort;
  output(name: string): IPort;
  readonly inputs: ReadonlyMap<string, IPort>;
  readonly outputs: ReadonlyMap<string, IPort>;
  connectTo(outputName: string, targetNode: INode, inputName: string): IConnection;
}

// 3. 圖拓撲
export interface IConnection {
  readonly from: IPort;
  readonly to: IPort;
}

export interface IGraph {
  createNode(definitionId: string, customId?: string): INode;
  removeNode(id: string): void;
  connect(from: IPort, to: IPort): IConnection;
  disconnect(connection: IConnection): void;
  getNodeById(id: string): INode | undefined;
  readonly nodes: ReadonlyArray<INode>;
  readonly connections: ReadonlyArray<IConnection>;
}

// 4. 展現能力契約 (View Layer)
export interface IValuePresentation {
  readonly targetValue: INodeValue<any>;
  mount(container: HTMLElement): void;
  unmount(): void;
  refresh(): void;
}
```

---

## 四、 智能體驗收檢查清單 (Agent Verification Checklist)

在提交任何相關代碼前，智能體必須確認滿足下列項目：

- [ ] **無 DOM 污染測試**：在純 Node.js 環境中直接載入 `Graph` 並建立節點、連線、設值，不報 `document is not defined` 錯誤。
- [ ] **無硬編碼節點分支**：全專案任何 `.ts` / `.js` 中，不得出現 `node.definitionId === 'add'` 或 `port.name === 'r'` 等特例分支邏輯。
- [ ] **雙向綁定共用測試**：建立 1 個 `NodeValue`，同時掛載於 2 個不同的 `IValuePresentation`，修改任一處，另兩處同步更新。
- [ ] **提取器提取閉環**：`GraphExtractor.extract(graph)` 能在不依賴任何 DOM 的前提下，輸出純 JSON Snapshot 並通過產碼編譯。
