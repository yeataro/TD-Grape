import { unaryNode } from '../node_sdk';

export default unaryNode({
  "key": "trunc",
  "label": "Truncate",
  "descriptionKey": "help.trunc",
  "operator": "trunc",
  "port": "value",
  "browser": {
    "category": "math",
    "source": "glsl",
    "aliases": [
      "trunc",
      "truncate",
      "toward zero",
      "int(A)"
    ],
    "glslName": "trunc",
    "secondaryCategories": [],
    "categoryPath": [
      "math",
      "range"
    ]
  }
});
