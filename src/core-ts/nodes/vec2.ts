import { literalNode, type CatalogRow } from '../node_sdk';

const catalog:CatalogRow={
  "definition": {
    "key": "vec2",
    "label": "Vector 2",
    "inputs": {},
    "outputs": {
      "out": "vec2"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {
      "value": [
        0.5,
        0.5
      ]
    },
    "descriptionKey": "help.vec2",
    "definitionUuid": "sgrape.builtin.vec2"
  },
  "emitter": {
    "id": "vec2",
    "version": 1
  },
  "browser": {
    "category": "data",
    "source": "editor",
    "aliases": [
      "constant",
      "vec2",
      "常數"
    ],
    "glslName": "vec2",
    "secondaryCategories": [],
    "categoryPath": [
      "data",
      "values"
    ]
  }
};

export default literalNode(catalog,'vec2');
