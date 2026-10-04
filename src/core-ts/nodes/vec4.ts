import { literalNode, type CatalogRow } from '../node_sdk';

const catalog:CatalogRow={
  "definition": {
    "key": "vec4",
    "label": "Vector 4",
    "inputs": {},
    "outputs": {
      "out": "vec4"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {
      "value": [
        0,
        0,
        0,
        0
      ]
    },
    "descriptionKey": "help.vec4",
    "definitionUuid": "sgrape.builtin.vec4"
  },
  "emitter": {
    "id": "vec4",
    "version": 1
  },
  "browser": {
    "category": "data",
    "source": "editor",
    "aliases": [
      "constant",
      "vec4",
      "常數",
      "四維向量"
    ],
    "glslName": "vec4",
    "secondaryCategories": [],
    "categoryPath": [
      "data",
      "values"
    ]
  }
};

export default literalNode(catalog,'vec4',true);
