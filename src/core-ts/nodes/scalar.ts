import { literalNode, type CatalogRow } from '../node_sdk';

const catalog:CatalogRow={
  "definition": {
    "key": "scalar",
    "label": "Scalar",
    "inputs": {},
    "outputs": {
      "out": "T"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {
      "type": "float",
      "value": 0
    },
    "descriptionKey": "help.scalar",
    "definitionUuid": "sgrape.builtin.scalar"
  },
  "emitter": {
    "id": "scalar",
    "version": 1
  },
  "browser": {
    "category": "data",
    "source": "editor",
    "aliases": [
      "float",
      "int",
      "uint",
      "bool",
      "integer",
      "unsigned",
      "boolean",
      "value",
      "double"
    ],
    "glslName": "scalar",
    "secondaryCategories": [],
    "categoryPath": [
      "data",
      "values"
    ]
  }
};

export default literalNode(catalog);
