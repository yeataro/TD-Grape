import { numericCall } from '../node_sdk';

export default numericCall({
  "definition": {
    "key": "clamp",
    "label": "Clamp",
    "inputs": {
      "value": "T",
      "min": "T",
      "max": "T"
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
    "inputDefaults": {
      "max": 1
    },
    "descriptionKey": "help.clamp",
    "definitionUuid": "sgrape.builtin.clamp"
  },
  "emitter": {
    "id": "clamp",
    "version": 1,
    "call": {
      "operator": "clamp",
      "ports": [
        "value",
        "min",
        "max"
      ]
    }
  },
  "browser": {
    "category": "math",
    "source": "glsl",
    "aliases": [
      "clamp",
      "限制"
    ],
    "glslName": "clamp",
    "secondaryCategories": [],
    "categoryPath": [
      "math",
      "range"
    ]
  }
}, {
  "tuples": [
    {
      "value": "T",
      "min": "T",
      "max": "T"
    },
    {
      "value": "T",
      "min": "float",
      "max": "float"
    }
  ]
});
