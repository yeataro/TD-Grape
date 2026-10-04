import { unaryNode } from '../node_sdk';

export default unaryNode({
  "key": "ceil",
  "label": "Ceil",
  "descriptionKey": "help.ceil",
  "operator": "ceil",
  "port": "value",
  "browser": {
    "category": "math",
    "source": "glsl",
    "aliases": [
      "ceil",
      "ceiling",
      "round up",
      "ceil(A)"
    ],
    "glslName": "ceil",
    "secondaryCategories": [],
    "categoryPath": [
      "math",
      "range"
    ]
  }
});
