import { typedNode, input, output, values } from '../node_sdk';

const catalog = {
  "definition": {
    "key": "if",
    "label": "If",
    "inputs": {
      "condition": "bool",
      "true": "T",
      "false": "T"
    },
    "outputs": {
      "out": "T"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {
      "type": "float"
    },
    "inputDefaults": {
      "condition": false,
      "true": 1,
      "false": 0
    },
    "descriptionKey": "help.if",
    "definitionUuid": "sgrape.builtin.if"
  },
  "emitter": {
    "id": "if",
    "version": 1
  },
  "browser": {
    "category": "logic",
    "source": "editor",
    "aliases": [
      "branch",
      "conditional",
      "select",
      "ternary",
      "條件",
      "選擇"
    ],
    "glslName": "?:",
    "secondaryCategories": [],
    "categoryPath": [
      "logic"
    ]
  }
};

// A logic node, drawn in the logic group (legacy graph_ui.js:142). 邏輯節點，畫成邏輯色組（照舊產品）。
export default {...typedNode(catalog, {
  types: values.types,
  ports: t => [input('condition', 'bool', false), input('true', t, 1), input('false', t), output('out', t)],
  emit: (_n, c) => ({ outputs: {out: '(' + c.input('condition') + ' ? ' + c.input('true') + ' : ' + c.input('false') + ')'} })
}), colorGroup: 'logic'};
