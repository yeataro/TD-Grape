import { typedNode, input, output, values } from '../node_sdk';

const catalog = {
  "definition": {
    "key": "lessThanEqual",
    "label": "lessThanEqual",
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
    "descriptionKey": "help.lessThanEqual",
    "definitionUuid": "sgrape.builtin.lessThanEqual",
    "targets": [
      "top",
      "mat"
    ]
  },
  "emitter": {
    "id": "lessThanEqual",
    "version": 1
  },
  "browser": {
    "category": "logic",
    "source": "glsl",
    "aliases": [
      "lessThanEqual"
    ],
    "glslName": "lessThanEqual",
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
  emit: (_n, c) => ({outputs: {out: 'lessThanEqual(' + c.input('a') + ', ' + c.input('b') + ')'}})
});
