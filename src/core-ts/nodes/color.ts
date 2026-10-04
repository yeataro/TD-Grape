import { literalNode, type CatalogRow } from '../node_sdk';

const catalog:CatalogRow={
  "definition": {
    "key": "color",
    "label": "Color RGBA",
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
        0.55,
        0.28,
        0.9,
        1
      ]
    },
    "descriptionKey": "help.color",
    "definitionUuid": "sgrape.builtin.color"
  },
  "emitter": {
    "id": "color",
    "version": 1
  },
  "browser": {
    "category": "color",
    "source": "editor",
    "aliases": [
      "constant",
      "rgba",
      "colour",
      "顏色",
      "色彩"
    ],
    "glslName": "color",
    "secondaryCategories": [],
    "categoryPath": [
      "color",
      "construct"
    ]
  }
};

export default literalNode(catalog,'vec4',false,{color:true});
