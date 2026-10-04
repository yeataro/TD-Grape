import { binaryNode, type CatalogRow } from '../node_sdk';

const catalog:CatalogRow={
  "definition": {
    "key": "divide",
    "label": "Divide",
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
    "inputDefaults": {
      "b": 1
    },
    "descriptionKey": "help.divide",
    "definitionUuid": "sgrape.builtin.divide"
  },
  "emitter": {
    "id": "divide",
    "version": 1
  },
  "browser": {
    "category": "math",
    "source": "glsl",
    "aliases": [
      "/",
      "div",
      "除法"
    ],
    "glslName": "/",
    "secondaryCategories": [],
    "categoryPath": [
      "math",
      "arithmetic"
    ]
  }
};

export default binaryNode(catalog,'/');
