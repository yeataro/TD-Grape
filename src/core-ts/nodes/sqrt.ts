import { unaryNode } from '../node_sdk';

export default unaryNode({
  "key": "sqrt",
  "label": "Sqrt",
  "descriptionKey": "help.sqrt",
  "operator": "sqrt",
  "port": "value",
  "browser": {
    "category": "math",
    "source": "glsl",
    "aliases": [
      "sqrt",
      "square root",
      "sqrt(A)"
    ],
    "glslName": "sqrt",
    "secondaryCategories": [],
    "categoryPath": [
      "math",
      "exponential"
    ]
  }
});
