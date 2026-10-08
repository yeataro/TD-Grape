import { fixedPorts, type CatalogRow, type NodeModule } from '../node_sdk';

// Texture 2D (Refactor.43; inventory 7.12: sampling is separate from the source): reads a texture
// at a coordinate. Unconnected coordinate: vUV.st, this pixel. Unconnected texture: opaque black
// (inventory 7.6), worked out by code generation and never stored in the graph.
// 取樣：以座標讀貼圖。座標沒接線＝vUV.st（這個像素）；貼圖沒接線＝不透明黑（產碼時決定，不存進圖）。
const catalog:CatalogRow={
  "definition": {
    "key": "texture_sample",
    "label": "Texture 2D",
    "inputs": {
      "sampler": "sampler2D",
      "uv": "vec2"
    },
    "outputs": {
      "out": "vec4"
    },
    "stages": [
      "pixel"
    ],
    "defaults": {},
    "descriptionKey": "help.texture_sample",
    "definitionUuid": "sgrape.builtin.texture_sample"
  },
  "emitter": {
    "id": "texture_sample",
    "version": 1
  },
  "browser": {
    "category": "texture",
    "source": "glsl",
    "aliases": [
      "sample",
      "texture",
      "lookup"
    ],
    "glslName": "texture",
    "secondaryCategories": [],
    "categoryPath": [
      "texture",
      "2d"
    ]
  }
};

const ports = fixedPorts([
  { key: 'sampler', direction: 'input', type: 'sampler2D' },
  { key: 'uv', direction: 'input', type: 'vec2', default: [0, 0], fallback: 'vUV.st' },
  { key: 'out', direction: 'output', type: 'vec4' },
]);

const textureSample: NodeModule = {
  catalog,
  role: 'value',
  supports: () => true,
  ports: () => ports,
  validate: () => {},
  emit: (_n, c) => ({
    outputs: {
      out: c.connected('sampler') ? 'texture(' + c.input('sampler') + ', ' + c.input('uv') + ')' : 'vec4(0.0, 0.0, 0.0, 1.0)',
    },
  }),
};
export default textureSample;
