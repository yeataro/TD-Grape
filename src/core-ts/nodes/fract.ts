import { unaryNode } from '../node_sdk';

export default unaryNode({
  "key": "fract",
  "label": "Fraction",
  "descriptionKey": "help.fract",
  "operator": "fract",
  "port": "value",
  "browser": {
    "category": "math",
    "source": "glsl",
    "aliases": [
      "fract",
      "fraction",
      "小數"
    ],
    "glslName": "fract",
    "secondaryCategories": [],
    "categoryPath": [
      "math",
      "range"
    ]
  }
});
