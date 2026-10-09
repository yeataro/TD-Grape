import { typedNode, input, output, values, storedOr, componentLetters } from '../node_sdk';

const catalog = {
  "definition": {
    "key": "vector_split",
    "label": "Split",
    "inputs": {
      "value": "vec2"
    },
    "outputs": {
      "x": "float",
      "y": "float"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {
      "type": "vec2"
    },
    "descriptionKey": "help.vector_split",
    "definitionUuid": "sgrape.builtin.vector_split"
  },
  "emitter": {
    "id": "vector_split",
    "version": 1
  },
  "browser": {
    "category": "vector",
    "source": "glsl",
    "aliases": [
      "separate",
      "break",
      "components",
      "拆分",
      "分量",
      "UV"
    ],
    "glslName": "vector_split",
    "secondaryCategories": [],
    "categoryPath": [
      "vector"
    ]
  }
};

export default typedNode(catalog, {
  types: values.vectors,
  ports: t => [input('value', t), ...'xyzw'.slice(0, values.count(t)).split('').map(p => output(p, values.family(t)))],
  inheritsComponentNames: true,
  // Each output is one component, named and coloured as the node's names say (legacy graph_ui.js:1297).
  // 每個輸出是一個分量，名稱與顏色照節點的名稱樣式（照舊產品）。
  presentation: n => {
    const t = String(n.params.type), keys = 'xyzw'.slice(0, values.count(t)).split(''), letters = componentLetters(storedOr(n, 'xyzw'), keys.length);
    return {selectorLabel: 'vector.inputType', portLabels: {outputs: Object.fromEntries(keys.map((k, i) => [k, letters[i]!]))},
      components: {outputs: Object.fromEntries(keys.map((k, i) => [k, [i]]))}};
  },
  emit: (n, c) => ({outputs: Object.fromEntries('xyzw'.slice(0, values.count(String(n.params.type))).split('').map(p => [p, '(' + c.input('value') + ').' + p]))})
});
