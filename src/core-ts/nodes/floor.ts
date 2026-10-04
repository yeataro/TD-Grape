import { unaryNode } from '../node_sdk';

export default unaryNode({
  "key": "floor",
  "label": "Floor",
  "descriptionKey": "help.floor",
  "operator": "floor",
  "port": "value",
  "browser": {
    "category": "math",
    "source": "glsl",
    "aliases": [
      "floor",
      "round down",
      "floor(A)"
    ],
    "glslName": "floor",
    "secondaryCategories": [],
    "categoryPath": [
      "math",
      "range"
    ]
  }
});
