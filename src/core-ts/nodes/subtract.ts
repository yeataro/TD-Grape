import { binaryNode, type CatalogRow } from '../node_sdk';

const catalog:CatalogRow={
  "definition": {
    "key": "subtract",
    "label": "Subtract",
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
    "descriptionKey": "help.subtract",
    "definitionUuid": "sgrape.builtin.subtract"
  },
  "emitter": {
    "id": "subtract",
    "version": 1
  },
  "browser": {
    "category": "math",
    "source": "glsl",
    "aliases": [
      "-",
      "sub",
      "減法"
    ],
    "glslName": "-",
    "secondaryCategories": [],
    "categoryPath": [
      "math",
      "arithmetic"
    ]
  }
};

export default binaryNode(catalog,'-');
