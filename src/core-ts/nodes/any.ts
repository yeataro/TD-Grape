import { typedNode, input, output } from '../node_sdk';

const catalog = {
  "definition": {
    "key": "any",
    "label": "any",
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
    "descriptionKey": "help.any",
    "definitionUuid": "sgrape.builtin.any",
    "targets": [
      "top",
      "mat"
    ]
  },
  "emitter": {
    "id": "any",
    "version": 1
  },
  "browser": {
    "category": "logic",
    "source": "glsl",
    "aliases": [
      "any"
    ],
    "glslName": "any",
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
  emit: (_n, c) => ({outputs: {out: 'any(' + c.input('value') + ')'}})
});
