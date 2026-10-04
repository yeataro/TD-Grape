import { numericCall } from '../node_sdk';

export default numericCall({
  "definition": {
    "key": "dot",
    "label": "Dot Product",
    "inputs": {
      "a": "T",
      "b": "T"
    },
    "outputs": {
      "out": "float"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {
      "type": "vec3"
    },
    "descriptionKey": "help.dot",
    "definitionUuid": "sgrape.builtin.dot"
  },
  "emitter": {
    "id": "dot",
    "version": 1,
    "call": {
      "operator": "dot",
      "ports": [
        "a",
        "b"
      ]
    }
  },
  "browser": {
    "category": "vector",
    "source": "glsl",
    "aliases": [
      "dot",
      "內積"
    ],
    "glslName": "dot",
    "secondaryCategories": [],
    "categoryPath": [
      "vector"
    ]
  }
});
