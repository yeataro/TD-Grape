import { unaryNode } from '../node_sdk';

export default unaryNode({
  key:'abs', label:'Absolute', descriptionKey:'help.abs',
  operator:'abs', port:'value',
  browser:{"category": "math", "source": "glsl", "aliases": ["abs", "absolute", "絕對值"], "glslName": "abs", "secondaryCategories": [], "categoryPath": ["math", "arithmetic"]}
});
