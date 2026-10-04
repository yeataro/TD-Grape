import { typedNode, input, output, values } from '../node_sdk';

const catalog = {
  "definition": {
    "key": "equal",
    "label": "equal",
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
    "descriptionKey": "help.equal",
    "definitionUuid": "sgrape.builtin.equal",
    "targets": [
      "top",
      "mat"
    ]
  },
  "emitter": {
    "id": "equal",
    "version": 1
  },
  "browser": {
    "category": "logic",
    "source": "glsl",
    "aliases": [
      "equal"
    ],
    "glslName": "equal",
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
  emit: (_n, c) => ({outputs: {out: 'equal(' + c.input('a') + ', ' + c.input('b') + ')'}})
});
