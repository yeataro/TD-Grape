import { numericCall } from '../node_sdk';

export default numericCall({
  "definition": {
    "key": "length",
    "label": "Length",
    "inputs": {
      "value": "T"
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
    "descriptionKey": "help.length",
    "definitionUuid": "sgrape.builtin.length"
  },
  "emitter": {
    "id": "length",
    "version": 1,
    "call": {
      "operator": "length",
      "ports": [
        "value"
      ]
    }
  },
  "browser": {
    "category": "vector",
    "source": "glsl",
    "aliases": [
      "length",
      "magnitude",
      "長度"
    ],
    "glslName": "length",
    "secondaryCategories": [],
    "categoryPath": [
      "vector"
    ]
  }
});
