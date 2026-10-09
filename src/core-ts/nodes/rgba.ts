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

// Its alpha input is the colour's fourth component (legacy graph_ui.js:1238). alpha 輸入是顏色的第四個分量（照舊產品）。
export default {...staticNode(catalog, {
  ports: () => [input('rgb', 'vec3'), input('alpha', 'float', 1), output('out', 'vec4')],
  emit: (_n, c) => ({outputs: {out: 'vec4(' + c.input('rgb') + ', ' + c.input('alpha') + ')'}})
}), componentNames: () => 'rgba' as const,
  presentation: () => ({components: {inputs: {alpha: [3]}}})};
