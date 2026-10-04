import { typedNode, input, output, values } from '../node_sdk';

const catalog = {
  "definition": {
    "key": "greaterThanEqual",
    "label": "greaterThanEqual",
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
    "descriptionKey": "help.greaterThanEqual",
    "definitionUuid": "sgrape.builtin.greaterThanEqual",
    "targets": [
      "top",
      "mat"
    ]
  },
  "emitter": {
    "id": "greaterThanEqual",
    "version": 1
  },
  "browser": {
    "category": "logic",
    "source": "glsl",
    "aliases": [
      "greaterThanEqual"
    ],
    "glslName": "greaterThanEqual",
    "secondaryCategories": [],
    "categoryPath": [
      "logic"
    ]
  }
};

export default typedNode(catalog, {
  types: values.vectors.filter(t => values.family(t) !== 'bool'),
  ports: t => [input('a', t), input('b', t), output('out', values.shaped('bool', values.count(t)))],
  presentation: () => ({selectorLabel: 'vector.inputType'}),
  emit: (_n, c) => ({outputs: {out: 'greaterThanEqual(' + c.input('a') + ', ' + c.input('b') + ')'}})
});
