import { typedNode, input, output } from '../node_sdk';

const catalog = {
  "definition": {
    "key": "not",
    "label": "not",
    "inputs": {
      "value": "bvec2"
    },
    "outputs": {
      "out": "bvec2"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {
      "type": "bvec2"
    },
    "inputDefaults": {},
    "descriptionKey": "help.not",
    "definitionUuid": "sgrape.builtin.not",
    "targets": [
      "top",
      "mat"
    ]
  },
  "emitter": {
    "id": "not",
    "version": 1
  },
  "browser": {
    "category": "logic",
    "source": "glsl",
    "aliases": [
      "not"
    ],
    "glslName": "not",
    "secondaryCategories": [],
    "categoryPath": [
      "logic"
    ]
  }
};

export default typedNode(catalog, {
  types: ['bvec2', 'bvec3', 'bvec4'],
  ports: t => [input('value', t), output('out', t)],
  // Input and output are the same type, so the title's menu chooses both (Refactor.81.4, design-interview Q73).
  // 輸入輸出同型別，標題列的選單兩端一起選（R.81.4，Q73）。
  emit: (_n, c) => ({outputs: {out: 'not(' + c.input('value') + ')'}})
});
