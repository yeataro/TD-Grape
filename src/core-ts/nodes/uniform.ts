import { uniformNode, type CatalogRow } from '../node_sdk';

const catalog:CatalogRow={
  "definition": {
    "key": "uniform",
    "label": "Uniform",
    "inputs": {},
    "outputs": {
      "out": "D"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {
      "declarationId": ""
    },
    "descriptionKey": "help.uniform",
    "definitionUuid": "sgrape.builtin.uniform"
  },
  "emitter": {
    "id": "uniform",
    "version": 1
  },
  "browser": {
    "category": "inputs",
    "source": "editor",
    "aliases": [
      "parameter",
      "參數",
      "公開"
    ],
    "glslName": "uniform",
    "secondaryCategories": [],
    "categoryPath": [
      "inputs",
      "uniforms"
    ]
  }
};

export default uniformNode(catalog);
