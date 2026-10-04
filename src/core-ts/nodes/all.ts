import { typedNode, input, output } from '../node_sdk';

const catalog = {
  "definition": {
    "key": "all",
    "label": "all",
    "inputs": {
      "value": "bvec2"
    },
    "outputs": {
      "out": "bool"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {
      "type": "bvec2"
    },
    "inputDefaults": {},
    "descriptionKey": "help.all",
    "definitionUuid": "sgrape.builtin.all",
    "targets": [
      "top",
      "mat"
    ]
  },
  "emitter": {
    "id": "all",
    "version": 1
  },
  "browser": {
    "category": "logic",
    "source": "glsl",
    "aliases": [
      "all"
    ],
    "glslName": "all",
    "secondaryCategories": [],
    "categoryPath": [
      "logic"
    ]
  }
};

export default typedNode(catalog, {
  types: ['bvec2', 'bvec3', 'bvec4'],
  ports: t => [input('value', t), output('out', 'bool')],
  presentation: () => ({selectorLabel: 'vector.inputType'}),
  emit: (_n, c) => ({outputs: {out: 'all(' + c.input('value') + ')'}})
});
