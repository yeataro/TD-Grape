import { typedNode, input, output, values } from '../node_sdk';

const catalog = {
  "definition": {
    "key": "notEqual",
    "label": "notEqual",
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
    "descriptionKey": "help.notEqual",
    "definitionUuid": "sgrape.builtin.notEqual",
    "targets": [
      "top",
      "mat"
    ]
  },
  "emitter": {
    "id": "notEqual",
    "version": 1
  },
  "browser": {
    "category": "logic",
    "source": "glsl",
    "aliases": [
      "notEqual"
    ],
    "glslName": "notEqual",
    "secondaryCategories": [],
    "categoryPath": [
      "logic"
    ]
  }
};

export default typedNode(catalog, {
  types: values.vectors,
  ports: t => [input('a', t), input('b', t), output('out', values.shaped('bool', values.count(t)))],
  presentation: () => ({selectorLabel: 'vector.inputType'}),
  emit: (_n, c) => ({outputs: {out: 'notEqual(' + c.input('a') + ', ' + c.input('b') + ')'}})
});
