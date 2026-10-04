import { staticNode, input, output } from '../node_sdk';

const catalog = {
  "definition": {
    "key": "rgba",
    "label": "Compose RGBA",
    "inputs": {
      "rgb": "vec3",
      "alpha": "float"
    },
    "outputs": {
      "out": "vec4"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {},
    "descriptionKey": "help.rgba",
    "definitionUuid": "sgrape.builtin.rgba"
  },
  "emitter": {
    "id": "rgba",
    "version": 1
  },
  "browser": {
    "category": "color",
    "source": "editor",
    "aliases": [
      "combine",
      "compose",
      "rgba",
      "組合"
    ],
    "glslName": "rgba",
    "secondaryCategories": [],
    "categoryPath": [
      "color",
      "construct"
    ]
  }
};

export default staticNode(catalog, {
  ports: () => [input('rgb', 'vec3'), input('alpha', 'float', 1), output('out', 'vec4')],
  emit: (_n, c) => ({outputs: {out: 'vec4(' + c.input('rgb') + ', ' + c.input('alpha') + ')'}})
});
