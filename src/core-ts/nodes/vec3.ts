import { literalNode, type CatalogRow } from '../node_sdk';

const catalog:CatalogRow={
  "definition": {
    "key": "vec3",
    "label": "Vector 3",
    "inputs": {},
    "outputs": {
      "out": "vec3"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {
      "value": [
        1,
        1,
        1
      ]
    },
    "descriptionKey": "help.vec3",
    "definitionUuid": "sgrape.builtin.vec3"
  },
  "emitter": {
    "id": "vec3",
    "version": 1
  },
  "browser": {
    "category": "data",
    "source": "editor",
    "aliases": [
      "constant",
      "vec3",
      "常數"
    ],
    "glslName": "vec3",
    "secondaryCategories": [],
    "categoryPath": [
      "data",
      "values"
    ]
  }
};

// Retired: opens old graphs, not offered (legacy functions_ui.js:76; Scalar／Vector make the same value).
// 已淘汰：能開舊圖、不在選單（舊產品同；同樣的值用 Scalar／Vector）。
export default {...literalNode(catalog,'vec3'),entries:()=>[]};
