import { outputNode, numericTypes, type CatalogRow } from '../node_sdk';

const catalog: CatalogRow = {
  "definition": {
    "key": "pixel_out",
    "label": "Color Output",
    "inputs": {
      "color": "vec4"
    },
    "outputs": {},
    "stages": [
      "pixel"
    ],
    "defaults": {},
    "descriptionKey": "help.pixel_out",
    "definitionUuid": "sgrape.builtin.pixel_out"
  },
  "emitter": {
    "id": "pixel_out",
    "version": 1
  },
  "browser": {
    "category": "shader",
    "source": "td",
    "aliases": [
      "output",
      "fragment",
      "輸出"
    ],
    "glslName": "pixel_out",
    "secondaryCategories": [],
    "categoryPath": [
      "shader",
      "stage"
    ]
  }
};

// TD TOP-specific capability and finishing belong to this node, not the SDK.
// MAT buffers and their optional finishing remain outside this migrated slice.
const flags = [
  'nativeFinishing',
  'convertColorSpace',
  'dither',
  'alphaTest'
];

export default outputNode(catalog, {
  ports: [
    {
      key: 'color',
      direction: 'input',
      type: 'vec4',
      default: [0, 0, 0, 1]
    }
  ],

  supports: (n, c) =>
    (!c.target || c.target === 'top') &&
    (n.params.type === undefined || numericTypes.includes(String(n.params.type))) &&
    !flags.some(k => n.params[k]) &&
    !(n.params.bufferCount && n.params.bufferCount !== 1),

  validate: n => {
    if (n.params.bufferCount !== undefined && n.params.bufferCount !== 1)
      throw Error('TOP has one color output');

    for (const k of flags)
      if (n.params[k] !== undefined && typeof n.params[k] !== 'boolean')
        throw Error('Output finishing must be a boolean');
  },

  emit: (_n, c) => ({
    outputs: {},
    statements: [
      '    vec4 sg_color = ' + c.input('color') + ';',
      '    fragColor = TDOutputSwizzle(sg_color);'
    ]
  })
});
