import { typedNode, input, output, payload, values, type NodeControl } from '../node_sdk';

const catalog = {
  "definition": {
    "key": "boolean_operation",
    "label": "Boolean Operation",
    "inputs": {
      "a": "bool",
      "b": "bool"
    },
    "outputs": {
      "out": "bool"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {
      "type": "bool",
      "operator": "&&"
    },
    "inputDefaults": {
      "a": false,
      "b": false
    },
    "descriptionKey": "help.boolean_operation",
    "nodeType": "sgrape.builtin.boolean_operation",
    "targets": [
      "top",
      "mat"
    ]
  },
  "emitter": {
    "id": "boolean_operation",
    "version": 1
  },
  "browser": {
    "category": "logic",
    "source": "glsl",
    "aliases": [
      "and",
      "or",
      "xor",
      "&&",
      "||",
      "^^",
      "boolean",
      "bool",
      "布林運算"
    ],
    "glslName": "&&, ||, ^^",
    "secondaryCategories": [],
    "categoryPath": [
      "logic"
    ]
  }
};

const operators = ['&&', '||', '^^'];
// Shown as words, the legacy node names' (human 2026-10-11); the graph keeps the GLSL operator. 選單顯示英文字（同舊產品節點名，人類）；圖裡存 GLSL 運算子。
const words: Record<string, string> = {'&&': 'AND', '||': 'OR', '^^': 'XOR'};
const control = (operator: string): NodeControl => ({
  kind: 'select', key: 'operator', label: 'booleanOperation.operator', command: 'operator', value: operator,
  options: operators.map(value => ({value, label: 'A ' + words[value] + ' B', literal: true}))
});
const operatorOf = (n: {params: Record<string, unknown>}) => String(n.params.operator ?? '&&');
// Legacy Boolean And / Or / Xor as one node with an operator menu, laid out as Compare (Refactor.82, human 2026-10-11).
// Bool vectors too, component by component (new; legacy took single bools; human: the family is fixed and in = out, so
// it stays simple). GLSL's &&, || and ^^ take no vectors, so a vector is rebuilt from its components. The title's menu
// chooses the type, as for not (Q73). 舊產品的 Boolean And／Or／Xor 合成一個節點、用選單選運算，版面同 Compare（R.82，人類）。
// 也收 bool 向量、逐分量算（新行為；舊產品只收單一 bool；人類：家族固定、進出同型別，所以單純）。GLSL 的 &&、||、^^
// 不收向量，所以向量逐分量拆開再組回。標題列選型別，同 not（Q73）。
export default typedNode(catalog, {
  types: ['bool', 'bvec2', 'bvec3', 'bvec4'],
  ports: t => [input('a', t, false), input('b', t, false), output('out', t)],
  validate: n => { if (!operators.includes(operatorOf(n))) throw Error('Invalid boolean operator'); },
  edit: (n, command, data) => {
    const value = String(payload(data));
    if (command !== 'operator' || !operators.includes(value)) throw Error('Invalid boolean operator');
    n.params.operator = value; return n;
  },
  presentation: n => ({inlineControls: [control(operatorOf(n))]}),
  emit: (n, c) => {
    const t = String(n.params.type ?? 'bool'), op = ' ' + operatorOf(n) + ' ', a = c.input('a'), b = c.input('b');
    if (t === 'bool') return {outputs: {out: '(' + a + op + b + ')'}};
    const parts = 'xyzw'.slice(0, values.count(t)).split('').map(k => a + '.' + k + op + b + '.' + k);
    return {outputs: {out: t + '(' + parts.join(', ') + ')'}};
  }
});
