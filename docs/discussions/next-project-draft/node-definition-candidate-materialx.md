# Grape（未定）節點定義候選 01：環境清單、子集、具體簽名與模板

文件版本：2026-09-22.r1。

狀態：**下一個開源專案 Grape（未定）的結構草稿；專案名稱尚未定案。這是一種供推導與審查的候選，尚未定案，尚未實作。**

搭配 [初始交接](node-definition-handoff.md) 閱讀。交接中的目標與授權界線優先；本文件提供可拆解、修改與否決的起始材料。MaterialX 是本次作者指定加入的外部對照，不使其架構成為本專案規則。

## 1. 這一種候選如何組織資料

同一節點保存一份識別與顯示資料，環境清單指出可用的子集；子集保存合法簽名與產碼內容。兩個環境可以引用相同子集，以免把相同資料抄兩份。

```text
節點
├─ 顯示資料
├─ 選項資料
├─ 環境 → 可用階段、可用子集
└─ 子集 → 完整簽名、產碼能力與內容
```

這裡以 Compare 為例，因為它能同時展示選項資料與兩種不同產碼形狀。**Compare 是結構檢查例子，不是第一輪必做節點。**

以下用 JSON 表達候選資料，沒有選定正式編輯介面或檔案格式。型別先用完整具體簽名表示，不在這份候選中另設泛型書寫語法。只展示 float 與 vec2／vec3／vec4 的比較；這不是宣告本專案完整的型別支援範圍。

## 2. 一份完整的候選節點資料

```json
{
  "schemaVersion": 1,
  "id": "compare",
  "display": {
    "label": "Compare",
    "help": "比較兩個值；向量輸出各分量的比較結果。"
  },
  "options": {
    "op": {
      "default": "lt",
      "choices": [
        { "id": "lt", "label": "<",  "data": { "symbol": "<",  "function": "lessThan" } },
        { "id": "le", "label": "<=", "data": { "symbol": "<=", "function": "lessThanEqual" } },
        { "id": "gt", "label": ">",  "data": { "symbol": ">",  "function": "greaterThan" } },
        { "id": "ge", "label": ">=", "data": { "symbol": ">=", "function": "greaterThanEqual" } },
        { "id": "eq", "label": "==", "data": { "symbol": "==", "function": "equal" } },
        { "id": "ne", "label": "!=", "data": { "symbol": "!=", "function": "notEqual" } }
      ]
    }
  },
  "environments": {
    "webgl2": {
      "stages": ["fragment"],
      "subsets": ["scalar", "vector"]
    },
    "td_glsl_top": {
      "stages": ["fragment"],
      "subsets": ["scalar", "vector"]
    }
  },
  "subsets": {
    "scalar": {
      "signatures": [
        {
          "id": "float",
          "inputs": {
            "a": { "type": "float", "default": 0.0 },
            "b": { "type": "float", "default": 0.0 }
          },
          "outputs": {
            "out": { "type": "bool" }
          }
        }
      ],
      "emit": {
        "capability": "glsl.expression",
        "output": "out",
        "code": "({{input.a}} {{option.op.symbol}} {{input.b}})"
      }
    },
    "vector": {
      "signatures": [
        {
          "id": "vec2",
          "inputs": {
            "a": { "type": "vec2", "default": [0.0, 0.0] },
            "b": { "type": "vec2", "default": [0.0, 0.0] }
          },
          "outputs": {
            "out": { "type": "bvec2" }
          }
        },
        {
          "id": "vec3",
          "inputs": {
            "a": { "type": "vec3", "default": [0.0, 0.0, 0.0] },
            "b": { "type": "vec3", "default": [0.0, 0.0, 0.0] }
          },
          "outputs": {
            "out": { "type": "bvec3" }
          }
        },
        {
          "id": "vec4",
          "inputs": {
            "a": { "type": "vec4", "default": [0.0, 0.0, 0.0, 0.0] },
            "b": { "type": "vec4", "default": [0.0, 0.0, 0.0, 0.0] }
          },
          "outputs": {
            "out": { "type": "bvec4" }
          }
        }
      ],
      "emit": {
        "capability": "glsl.expression",
        "output": "out",
        "code": "{{option.op.function}}({{input.a}}, {{input.b}})"
      }
    }
  }
}
```

這份例子把純量比較寫成運算子、向量比較寫成分量比較函數；向量結果為對應的布林向量。這符合 GLSL ES 3.00 的運算子與向量比較函數規則。本例中的向量 `eq` 採分量比較，不是向量 `==` 所回傳的單一布林值。[GLSL ES 3.00 §5.9、§8.7](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf)

## 3. 每一部分負責什麼

| 資料 | 此候選中的解釋 |
|---|---|
| `schemaVersion` | 定義格式的版本；本例的 1 只是候選標記，不宣告版本遷移制度。 |
| `id` | 節點的穩定識別，供引用；不作未描述的語意分派。 |
| `display`、選項的 `label` | 顯示與說明內容。修改名稱不改變運算；消費端可選擇不同 UI 入口。 |
| `options` | 可選資料與預設值。`id` 是選項識別，`data` 是模板使用的內容；不是可執行的回呼。 |
| `environments` | 明確列出該環境能用哪些子集及階段；沒有項目就不提供。本例的環境名稱及階段範圍都是待審查的起始選擇。 |
| `subsets` | 共享節點身分、但可有不同介面與行為的內容單位。此例以純量／向量區分，沒有把它規定成所有節點的分類方法。 |
| `signatures` | 每一筆都是完整的輸入輸出關係，不能將不同筆的接孔型別任意重組。順序不在此被賦予 Auto 優先規則。 |
| `default` | 未接線時的型別化資料值；由共用字面值處理轉為 GLSL，不能靠 UI 顯示文字充當程式碼。 |
| `emit` | 明確說出引用哪個產碼能力、產生哪個輸出，以及節點本身提供什麼內容。 |

概念上先以環境篩選，再在其可用子集中處理合法簽名；資料實際用引用方式共用，不要求物理上複製到每個環境底下。若兩個環境確實有不同產碼內容，可以先用兩個明確子集表達，而不用新增隱藏環境判斷。

`webgl2` 與 `td_glsl_top` 只是本候選的環境識別；不能用名稱猜測全部宿主能力。宿主版本、方言前言、資源綁定與原生編譯由對應環境資料及整合部分負責，尚未在這份節點資料中完成設計。

## 4. 候選能力的界線：glsl.expression

這是一個**待審查的具名能力**：將節點資料給出的單一 GLSL 運算式，作為一個已知型別輸出的 initializer。它適合本例這種無副作用、單一輸出的純運算；不是所有節點的通用容器。

它的最小契約為：

1. 呼叫時已具備環境、合法的具體簽名、選項值及輸入結果。選擇過程與 Auto 策略在本候選外另行推導。
2. `{{input.a}}` 取得 a 的已產生結果；`{{option.op.symbol}}` 取得所選 op 記錄的 `data.symbol`，其他鍵同理。只允許這兩種明確查找，不加入任意程式執行、條件或迴圈語法。
3. 未定義的選項、接孔或模板欄位要報錯。不能因找不到資料就猜測、換子集或採用另一個運算。
4. 共用核心負責型別核對、字面值格式、符號分配與必要的括號處理；此能力依輸出型別組成宣告及 initializer。符號名稱由核心產生，不在節點表中固定。
5. 節點表維護者負責模板的運算內容。結構檢查不能保證任意 GLSL 文字正確；完整語法與宿主可用性仍須由相應的原生編譯確認。

例如，選 scalar／float／lt，可以得到這種片段；名稱僅為說明：

```glsl
bool cmp_0 = (value_a < value_b);
```

選 vector／vec3／ge，則為：

```glsl
bvec3 cmp_1 = greaterThanEqual(vector_a, vector_b);
```

以上是依候選資料推演的輸出片段，不是已執行的編譯結果，也不是完整 shader。

常數資格不由「寫成運算式」自動推定。這份候選尚未決定常數規則的欄位與處理方式；沒有授權補上通用 GLSL 求值器。多輸出、有副作用或其他特殊需求也不應塞進這個能力的未描述行為。

## 5. 人類如何維護它

新增一個同樣適用於這些簽名的比較選項，只需增加一筆選項資料；純量與向量各自的產碼形狀由已有兩個模板處理。新增一種型別，則增加一條經查證合法的完整簽名。若新選項只對部分型別合法，不能只增加顯示選項後讓編譯器碰運氣，必須提出如何在資料中表達適用範圍。

節點定義編輯器可以把這些資料呈現為基本資料、選項列表、環境適用清單、子集、簽名與產碼內容的編輯區；具體版面不由這份 JSON 規定。這些資訊也能供搜尋、型別選擇與其他入口共用。

介面保存的應是上述資料本身，能完整讀回；不能另外維護一份「這個選項實際代表什麼」的 UI 分支。首要檢查是：改選項內容或模板後，差異是否能從定義讀到，以及產碼端是否只依已描述的機制處理。

## 6. MaterialX 的實際例子：Add

以下對照 AcademySoftwareFoundation/MaterialX 官方倉庫的 `main`，於本次工作查閱。連結指向上游分支，會隨上游變動；以下節錄保留本次看到的內容，不宣稱為固定版本快照。

### 6.1 節點定義寫接孔、型別與預設資料

這是實際的 float Add 定義節錄，沒有改寫屬性；省略所屬文件的根元素與其他節點。[官方節點定義](https://github.com/AcademySoftwareFoundation/MaterialX/blob/main/libraries/stdlib/stdlib_defs.mtlx#L1573-L1577)

```xml
<nodedef name="ND_add_float" node="add" nodegroup="math">
  <input name="in1" type="float" value="0.0" />
  <input name="in2" type="float" value="0.0" />
  <output name="out" type="float" defaultinput="in1" />
</nodedef>
```

其中兩個 input 的 `value` 是輸入預設值；輸出的 `defaultinput` 是 MaterialX 的另一項介面語意，不能將它直接翻譯為我們例子的輸入 default，也不能當作正常加法模板。

### 6.2 對應實作寫 GLSL 內容

對應的 GLSL implementation 以 nodedef 引用上面的定義；此例的加法就在 sourcecode 屬性中。[官方 GLSL 實作表](https://github.com/AcademySoftwareFoundation/MaterialX/blob/main/libraries/stdlib/genglsl/stdlib_genglsl_impl.mtlx#L183)

```xml
<implementation name="IM_add_float_genglsl" nodedef="ND_add_float" target="genglsl" sourcecode="{{in1}} + {{in2}}" />
```

兩段節錄來自 MaterialX 專案貢獻者的程式碼，授權為 [Apache-2.0](https://github.com/AcademySoftwareFoundation/MaterialX/blob/main/LICENSE)。

### 6.3 共用程式怎麼使用這份內容

在 MaterialX 的 SourceCodeNode 路徑中，程式讀取 sourcecode 或來源檔案；沒有指定函式名稱時使用內聯模式。它解析模板裡的輸入名稱，取得上游結果；未連接的輸入可先產生具體型別的暫存值，再組成輸出宣告與指派。加法符號的內容來自實作資料。[SourceCodeNode.cpp](https://github.com/AcademySoftwareFoundation/MaterialX/blob/main/source/MaterialXGenShader/Nodes/SourceCodeNode.cpp#L50-L165)

因此，這份資料能支持類似以下的產碼形狀；這是說明性改寫，不是 MaterialX 實跑結果：

```glsl
float result = input_1 + input_2;
```

MaterialX 整體還有已註冊的原生實作分派：依 implementation 名稱查找工廠，未命中才使用來源碼實作路徑。因此，不能從這個 Add 例子推出其整個產碼器都只依模板工作。[ShaderGenerator.cpp](https://github.com/AcademySoftwareFoundation/MaterialX/blob/main/source/MaterialXGenShader/ShaderGenerator.cpp#L281-L338)

此處可借鏡的是「定義合法介面、資料寫運算內容、共用機制產生語句」的分工。沒有決定採用 MaterialX 的型別、檔案拆分、註冊優先序或其他架構。

## 7. 請先審查的候選選擇與限制

下列都是這份候選新提出的具體做法，不因出現在文件中就成為已定規則：

- **環境引用共享子集。**這能減少重複，但大量環境特有差異是否仍清楚，需要用具體需求檢查。
- **選項資料置於節點層。**本例所有選項適用所有簽名；較窄的適用範圍仍需推導，不能假裝已被處理。
- **具體簽名逐筆書寫。**這份例子容易讀回，不代表大型節點的維護成本已解決；也沒有裁定長期的泛型表示方式。
- **單一輸出的運算式能力。**這是一個小範圍候選。常數性、多輸出、特殊實作的正式表示與引用契約尚未定案。
- **環境及階段範圍。**本例選 WebGL 2 與 TD GLSL TOP 的 fragment 使用情境，僅為最小比較；尚未核實特定 TD 版本的完整 profile，也未做 TD／WebGL 原生編譯。
- **簽名選擇與圖。**Auto、隱含轉換、Cast 工作流、子集切換對接線的處理，以及節點實例的保存形狀，都沒有被此例默認決定。

**接手者的任務是檢查這個候選是否能成為最基本結構，提出修正及必要理由，等待作者確認。不是照著這份例子立即開始實作。**
