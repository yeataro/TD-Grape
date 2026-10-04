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
  presentation: () => ({selectorLabel: 'vector.inputType'}),
  emit: (_n, c) => ({outputs: {out: 'not(' + c.input('value') + ')'}})
});
