# GrapeL 最小節點定義規範 (Minimal Node Definition Spec)

文件版本：2026-09-22.r3  
閱讀對象：負責實作編譯器核心與 Schema 驗證的 AI 智能體。

---

## 一、 節點定義資料形狀 (Node Definition JSON)

每個節點為一份獨立的 JSON 檔案，結構如下：

```json
{
  "$schema": "https://grapel.org/schemas/node-definition.v1.json",
  "schemaVersion": 1,
  "id": "string",
  "display": {
    "label": "string",
    "help": "string"
  },
  "options": {
    "<optionKey>": {
      "default": "string",
      "choices": [
        { "id": "string", "label": "string" }
      ]
    }
  },
  "environments": {
    "<envId>": {
      "stages": ["vertex" | "fragment"],
      "subsets": ["<subsetId>"]
    }
  },
  "subsets": {
    "<subsetId>": {
      "signatures": [
        {
          "id": "string",
          "inputs": {
            "<portName>": { "type": "string", "default": 0.0 }
          },
          "outputs": {
            "<portName>": { "type": "string" }
          }
        }
      ],
      "signatureTemplates": [
        {
          "types": ["vec2", "vec3", "vec4"],
          "inputs": {
            "<portName>": { "type": "$T", "default": 0.0 }
          },
          "outputs": {
            "<portName>": { "type": "b$T" }
          }
        }
      ],
      "emit": {
        "capability": "glsl.expression",
        "mappings": {
          "<optionKey>": {
            "<choiceId>": "<glslString>"
          }
        },
        "outputs": {
          "<portName>": "string (模板表達式)"
        }
      }
    }
  },
  "presets": {
    "<presetId>": {
      "display": { "label": "string", "help": "string" },
      "targetSubset": "<subsetId>",
      "fixedInputs": { "<portName>": 0.0 },
      "exposedInputs": { "<portName>": "<exposedName>" }
    }
  }
}
```

---

## 二、 欄位與責任邊界

1. **`options`**：純語意枚舉，僅宣告有哪些選項及顯示名稱。嚴禁包含任何目標語言的代碼字串。
2. **`subsets`**：特定能力或拓撲特化單元。
   * `signatures`：完全具體的簽名。
   * `signatureTemplates`：同構簽名範型。`$T` 會在載入時由核心展開為具體簽名。
   * `emit.mappings`：將 `options` 的選項 ID 映射為本子集專用的代碼字串。未在此定義的選項視為非法。
   * `emit.outputs`：字典結構，鍵為輸出口名稱，值為替換模板。
3. **`presets`**：純資料配方。由 UI 解釋為快捷節點，產碼器將其視為一般節點實例加上固定輸入值。

---

## 三、 環境清單形狀 (Environment Manifest)

```json
{
  "$schema": "https://grapel.org/schemas/environment-manifest.v1.json",
  "environment": "string",
  "version": "string",
  "supportedStages": ["string"],
  "supportedTypes": ["string"],
  "capabilities": ["string"]
}
```
* **職責**：環境清單由系統全域維護。節點定義載入時，核心檢查節點所使用的型別與 capability 是否屬於該環境白名單。
