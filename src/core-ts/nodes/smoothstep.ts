import { numericCall } from '../node_sdk';

export default numericCall({
  "definition": {
    "key": "smoothstep",
    "label": "Smoothstep",
    "inputs": {
      "edge0": "T",
      "edge1": "T",
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
      "type": "float"
    },
    "inputDefaults": {
      "edge1": 1
    },
    "descriptionKey": "help.smoothstep",
    "definitionUuid": "sgrape.builtin.smoothstep"
  },
  "emitter": {
    "id": "smoothstep",
    "version": 1,
    "call": {
      "operator": "smoothstep",
      "ports": [
        "edge0",
        "edge1",
        "value"
      ]
    }
  },
  "browser": {
    "category": "math",
    "source": "glsl",
    "aliases": [
      "smoothstep",
      "平滑"
    ],
    "glslName": "smoothstep",
    "secondaryCategories": [],
    "categoryPath": [
      "math",
      "interpolation"
    ]
  }
}, {
  "tuples": [
    {
      "edge0": "T",
      "edge1": "T",
      "value": "T"
    },
    {
      "edge0": "float",
      "edge1": "float",
      "value": "T"
    }
  ]
});
