import { binaryNode, type CatalogRow } from '../node_sdk';

const catalog:CatalogRow={
  "definition": {
    "key": "add",
    "label": "Add",
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
    "descriptionKey": "help.add",
    "definitionUuid": "sgrape.builtin.add"
  },
  "emitter": {
    "id": "add",
    "version": 1
  },
  "browser": {
    "category": "math",
    "source": "glsl",
    "aliases": [
      "+",
      "加法"
    ],
    "glslName": "+",
    "secondaryCategories": [],
    "categoryPath": [
      "math",
      "arithmetic"
    ]
  }
};

export default binaryNode(catalog,'+');
