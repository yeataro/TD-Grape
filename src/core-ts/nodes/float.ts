import { literalNode, type CatalogRow } from '../node_sdk';

const catalog:CatalogRow={
  "definition": {
    "key": "float",
    "label": "Float",
    "inputs": {},
    "outputs": {
      "out": "float"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {
      "value": 0.5
    },
    "descriptionKey": "help.float",
    "definitionUuid": "sgrape.builtin.float"
  },
  "emitter": {
    "id": "float",
    "version": 1
  },
  "browser": {
    "category": "data",
    "source": "editor",
    "aliases": [
      "constant",
      "scalar",
      "常數",
      "浮點"
    ],
    "glslName": "float",
    "secondaryCategories": [],
    "categoryPath": [
      "data",
      "values"
    ]
  }
};

export default literalNode(catalog,'float');
