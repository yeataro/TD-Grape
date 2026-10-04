import { numericCall } from '../node_sdk';

export default numericCall({
  "definition": {
    "key": "min",
    "label": "Minimum",
    "inputs": {
      "a": "T",
      "b": "T"
    },
    "outputs": {
      "out": "T"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {
      "type": "float"
    },
    "descriptionKey": "help.min",
    "definitionUuid": "sgrape.builtin.min"
  },
  "emitter": {
    "id": "min",
    "version": 1,
    "call": {
      "operator": "min",
      "ports": [
        "a",
        "b"
      ]
    }
  },
  "browser": {
    "category": "math",
    "source": "glsl",
    "aliases": [
      "min",
      "minimum",
      "最小"
    ],
    "glslName": "min",
    "secondaryCategories": [],
    "categoryPath": [
      "math",
      "range"
    ]
  }
}, {
  "alternatives": {
    "b": [
      "T",
      "float"
    ]
  }
});
