import { vectorAssembly } from '../node_sdk';

const catalog = {
  "definition": {
    "key": "replace",
    "label": "Replace",
    "inputs": {
      "value": "vec2",
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
    "descriptionKey": "help.replace",
    "definitionUuid": "sgrape.builtin.replace"
  },
  "emitter": {
    "id": "replace",
    "version": 1
  },
  "browser": {
    "category": "vector",
    "source": "glsl",
    "aliases": [
      "replace",
      "override",
      "components",
      "replace components"
    ],
    "glslName": "vecN",
    "secondaryCategories": [],
    "categoryPath": [
      "vector"
    ]
  }
};

export default vectorAssembly(catalog, true);
