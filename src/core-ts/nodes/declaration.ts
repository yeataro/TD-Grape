import { declarationNode, type CatalogRow } from '../node_sdk';

// The reference node (design-interview Q45, discuss-4.14 §10): points to one declaration; the
// canvas title shows that declaration's name. Created from the Sources panel, not the add menu.
// 引用宣告節點：指向一筆宣告；畫布標題顯示那一筆的名字。由共用來源面板建立，不在新增選單。
const catalog:CatalogRow={
  "definition": {
    "key": "declaration",
    "label": "Shared Source",
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
    "descriptionKey": "help.declaration",
    "definitionUuid": "sgrape.builtin.declaration"
  },
  "emitter": {
    "id": "declaration",
    "version": 1
  },
  "browser": {
    "category": "inputs",
    "source": "editor",
    "aliases": [
      "source",
      "constant",
      "declaration"
    ],
    "glslName": "declaration",
    "secondaryCategories": [],
    "categoryPath": [
      "inputs",
      "shared"
    ]
  }
};

export default declarationNode(catalog);
