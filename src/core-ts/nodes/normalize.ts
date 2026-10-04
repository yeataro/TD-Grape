import { numericCall } from '../node_sdk';

export default numericCall({
  "definition": {
    "key": "normalize",
    "label": "Normalize",
    "inputs": {
      "value": "T"
    },
    "outputs": {
      "out": "T"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {
      "type": "vec3"
    },
    "inputDefaults": {
      "value": 1
    },
    "descriptionKey": "help.normalize",
    "definitionUuid": "sgrape.builtin.normalize"
  },
  "emitter": {
    "id": "normalize",
    "version": 1,
    "call": {
      "operator": "normalize",
      "ports": [
        "value"
      ]
    }
  },
  "browser": {
    "category": "vector",
    "source": "glsl",
    "aliases": [
      "normalize",
      "unit",
      "正規化"
    ],
    "glslName": "normalize",
    "secondaryCategories": [],
    "categoryPath": [
      "vector"
    ]
  }
});
