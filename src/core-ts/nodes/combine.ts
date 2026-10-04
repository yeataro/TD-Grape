import { vectorAssembly } from '../node_sdk';

const catalog = {
  "definition": {
    "key": "combine",
    "label": "Combine",
    "inputs": {
      "x": "float",
      "y": "float"
    },
    "outputs": {
      "out": "vec2"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {
      "type": "vec2",
      "groups": {},
      "components": [
        0,
        0,
        0,
        0
      ]
    },
    "descriptionKey": "help.combine",
    "definitionUuid": "sgrape.builtin.combine"
  },
  "emitter": {
    "id": "combine",
    "version": 1
  },
  "browser": {
    "category": "vector",
    "source": "glsl",
    "aliases": [
      "compose",
      "append",
      "append vector",
      "merge",
      "construct",
      "合併",
      "組合"
    ],
    "glslName": "vecN",
    "secondaryCategories": [],
    "categoryPath": [
      "vector"
    ]
  }
};

export default vectorAssembly(catalog, false);
