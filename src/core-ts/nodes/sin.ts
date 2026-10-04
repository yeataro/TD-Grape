import { unaryNode } from '../node_sdk';

export default unaryNode({
  "key": "sin",
  "label": "Sine",
  "descriptionKey": "help.sin",
  "operator": "sin",
  "port": "value",
  "browser": {
    "category": "math",
    "source": "glsl",
    "aliases": [
      "sin",
      "sine",
      "正弦"
    ],
    "glslName": "sin",
    "secondaryCategories": [],
    "categoryPath": [
      "math",
      "trigonometry"
    ]
  }
});
