import { numericCall } from '../node_sdk';

export default numericCall({
  "definition": {
    "key": "mix",
    "label": "Mix",
    "inputs": {
      "a": "T",
      "b": "T",
      "factor": "float"
    },
    "outputs": {
      "out": "T"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {
      "type": "vec4"
    },
    "descriptionKey": "help.mix",
    "definitionUuid": "sgrape.builtin.mix"
  },
  "emitter": {
    "id": "mix",
    "version": 1,
    "call": {
      "operator": "mix",
      "defaults": {"factor": 0.5},
      "ports": [
        "a",
        "b",
        "factor"
      ]
    }
  },
  "browser": {
    "category": "math",
    "source": "glsl",
    "aliases": [
      "lerp",
      "interpolate",
      "插值"
    ],
    "glslName": "mix",
    "secondaryCategories": [],
    "categoryPath": [
      "math",
      "interpolation"
    ]
  }
}, {alternatives:{factor:['float','T']}});
