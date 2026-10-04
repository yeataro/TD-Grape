import { unaryNode } from '../node_sdk';

export default unaryNode({
  "key": "cos",
  "label": "Cosine",
  "descriptionKey": "help.cos",
  "operator": "cos",
  "port": "value",
  "browser": {
    "category": "math",
    "source": "glsl",
    "aliases": [
      "cos",
      "cosine",
      "餘弦"
    ],
    "glslName": "cos",
    "secondaryCategories": [],
    "categoryPath": [
      "math",
      "trigonometry"
    ]
  }
});
