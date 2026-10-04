import { unaryNode } from '../node_sdk';

export default unaryNode({
  "key": "round",
  "label": "Round",
  "descriptionKey": "help.round",
  "operator": "round",
  "port": "value",
  "browser": {
    "category": "math",
    "source": "glsl",
    "aliases": [
      "round",
      "nearest",
      "round(A)"
    ],
    "glslName": "round",
    "secondaryCategories": [],
    "categoryPath": [
      "math",
      "range"
    ]
  }
});
