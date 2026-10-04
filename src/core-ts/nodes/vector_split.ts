import { typedNode, input, output, values } from '../node_sdk';

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
  presentation: () => ({selectorLabel: 'vector.inputType'}),
  emit: (n, c) => ({outputs: Object.fromEntries('xyzw'.slice(0, values.count(String(n.params.type))).split('').map(p => [p, '(' + c.input('value') + ').' + p]))})
});
