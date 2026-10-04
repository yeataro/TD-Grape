import { numericCall } from '../node_sdk';

export default numericCall({
  "definition": {
    "key": "max",
    "label": "Maximum",
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
    "descriptionKey": "help.max",
    "definitionUuid": "sgrape.builtin.max"
  },
  "emitter": {
    "id": "max",
    "version": 1,
    "call": {
      "operator": "max",
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
      "max",
      "maximum",
      "最大"
    ],
    "glslName": "max",
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
