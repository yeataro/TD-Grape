import { unaryNode } from '../node_sdk';

export default unaryNode({
  "key": "sign",
  "label": "Sign",
  "descriptionKey": "help.sign",
  "operator": "sign",
  "port": "value",
  "browser": {
    "category": "math",
    "source": "glsl",
    "aliases": [
      "sign",
      "signum",
      "sign(A)"
    ],
    "glslName": "sign",
    "secondaryCategories": [],
    "categoryPath": [
      "math",
      "arithmetic"
    ]
  }
});
