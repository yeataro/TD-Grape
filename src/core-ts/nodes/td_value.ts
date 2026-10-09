import { tdValueNode, type CatalogRow } from '../node_sdk';

// TD built-in value (design-interview Q45 01, discuss-4.14 §10): the canvas title is the entry's
// own name (vUV.st, uTDOutputInfo.res.zw…). Created from the Sources panel, not the add menu.
// TD 內建值：畫布標題是那一筆自己的名字。由共用來源面板建立，不在新增選單。
const catalog:CatalogRow={
  "definition": {
    "key": "td_value",
    "label": "TD Built-in",
    "inputs": {},
    "outputs": {
      "out": "D"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {
      "entry": "vUVSt"
    },
    "descriptionKey": "help.td_value",
    "definitionUuid": "sgrape.builtin.td_value"
  },
  "emitter": {
    "id": "td_value",
    "version": 1
  },
  "browser": {
    "category": "inputs",
    "source": "editor",
    "aliases": [
      "builtin",
      "td",
      "uv",
      "resolution"
    ],
    "glslName": "td_value",
    "secondaryCategories": [],
    "categoryPath": [
      "inputs",
      "td"
    ]
  }
};

// Made from the Sources panel, which knows what it points to (Q45): not in the add menu.
// 由共用來源面板建立（面板知道它指向哪一筆），不在新增選單。
export default {...tdValueNode(catalog),entries:()=>[]};
