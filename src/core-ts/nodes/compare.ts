import { typedNode, input, output, payload, type NodeControl } from '../node_sdk';

const catalog = {
  "definition": {
    "key": "compare",
    "label": "Compare",
    "inputs": {
      "a": "T",
      "b": "T"
    },
    "outputs": {
      "out": "bool"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {
      "type": "float",
      "operator": ">"
    },
    "inputDefaults": {
      "a": 0,
      "b": 0
    },
    "descriptionKey": "help.compare",
    "definitionUuid": "sgrape.builtin.compare"
  },
  "emitter": {
    "id": "compare",
    "version": 1
  },
  "browser": {
    "category": "logic",
    "source": "editor",
    "aliases": [
      "comparison",
      "greater",
      "less",
      "equal",
      "bool",
      "condition",
      "比較"
    ],
    "glslName": ">, >=, <, <=, ==, !=",
    "secondaryCategories": [],
    "categoryPath": [
      "logic"
    ]
  }
};

const operators = ['>', '>=', '<', '<=', '==', '!='];
const control = (operator: string): NodeControl => ({
  kind: 'select', key: 'operator', label: 'compare.operator', command: 'operator', value: operator,
  options: operators.map(value => ({value, label: 'A ' + value + ' B', literal: true}))
});
// A logic node, drawn in the logic group (legacy graph_ui.js:142). 邏輯節點，畫成邏輯色組（照舊產品）。
export default {...typedNode(catalog, {
  types: ['float', 'int', 'uint'],
  ports: t => [input('a', t), input('b', t), output('out', 'bool')],
  validate: n => { if (!operators.includes(String(n.params.operator ?? '>'))) throw Error('Invalid comparison operator'); },
  edit: (n, command, data) => {
    const value = String(payload(data));
    if (command !== 'operator' || !operators.includes(value)) throw Error('Invalid comparison operator');
    n.params.operator = value; return n;
  },
  // One operator menu, at the top of the body as legacy (human 2026-10-09: it was shown twice).
  // 一個運算選單，放在本體開頭，同舊產品（人類：原本出現兩次）。
  presentation: n => ({selectorLabel: 'vector.inputType', inlineControls: [control(String(n.params.operator ?? '>'))]}),
  emit: (n, c) => ({outputs: {out: '(' + c.input('a') + ' ' + String(n.params.operator ?? '>') + ' ' + c.input('b') + ')'}})
}), colorGroup: 'logic'};
