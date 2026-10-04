import { staticNode, input, output } from '../node_sdk';

const catalog = {
  "definition": {
    "key": "split",
    "label": "Split RGBA",
    "inputs": {
      "color": "vec4"
    },
    "outputs": {
      "rgb": "vec3",
      "r": "float",
      "g": "float",
      "b": "float",
      "a": "float"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {},
    "descriptionKey": "help.split",
    "definitionUuid": "sgrape.builtin.split"
  },
  "emitter": {
    "id": "split",
    "version": 1
  },
  "browser": {
    "category": "color",
    "source": "editor",
    "aliases": [
      "split",
      "swizzle",
      "分量",
      "拆分"
    ],
    "glslName": "split",
    "secondaryCategories": [],
    "categoryPath": [
      "color",
      "construct"
    ]
  }
};

export default staticNode(catalog, {
  ports: () => [input('color', 'vec4'), output('rgb', 'vec3'), ...'rgba'.split('').map(p => output(p, 'float'))],
  emit: (_n, c) => ({outputs: Object.fromEntries(['rgb', ...'rgba'].map(p => [p, '(' + c.input('color') + ').' + p]))})
});
