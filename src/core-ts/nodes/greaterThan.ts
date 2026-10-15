import { typedNode, input, output, values } from '../node_sdk';

const catalog = {
  "definition": {
    "key": "greaterThan",
    "label": "greaterThan",
    "inputs": {
      "a": "vec2",
      "b": "vec2"
    },
    "outputs": {
      "out": "bvec2"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {
      "type": "vec2"
    },
    "inputDefaults": {},
    "descriptionKey": "help.greaterThan",
    "nodeType": "sgrape.builtin.greaterThan",
    "targets": [
      "top",
      "mat"
    ]
  },
  "emitter": {
    "id": "greaterThan",
    "version": 1
  },
  "browser": {
    "category": "logic",
    "source": "glsl",
    "aliases": [
      "greaterThan"
    ],
    "glslName": "greaterThan",
    "secondaryCategories": [],
    "categoryPath": [
      "logic"
    ]
  }
};

export default typedNode(catalog, {
  types: values.vectors.filter(t => values.family(t) !== 'bool'),
  ports: t => [input('a', t), input('b', t), output('out', values.shaped('bool', values.count(t)))],
  presentation: () => ({typeOf: 'input'}),
  emit: (_n, c) => ({outputs: {out: 'greaterThan(' + c.input('a') + ', ' + c.input('b') + ')'}})
});
