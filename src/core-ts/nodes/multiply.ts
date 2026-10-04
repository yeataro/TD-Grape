import { binaryNode, type CatalogRow } from '../node_sdk';

const catalog:CatalogRow={
  "definition": {
    "key": "multiply",
    "label": "Multiply",
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
      "type": "vec4"
    },
    "descriptionKey": "help.multiply",
    "definitionUuid": "sgrape.builtin.multiply"
  },
  "emitter": {
    "id": "multiply",
    "version": 1
  },
  "browser": {
    "category": "math",
    "source": "glsl",
    "aliases": [
      "*",
      "mul",
      "乘法"
    ],
    "glslName": "*",
    "secondaryCategories": [],
    "categoryPath": [
      "math",
      "arithmetic"
    ]
  }
};

export default binaryNode(catalog,'*');
