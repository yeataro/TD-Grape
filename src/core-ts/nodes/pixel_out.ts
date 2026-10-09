import { outputNode, fixedPorts, values, type CatalogRow, type PortSpec } from '../node_sdk';

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

// Color Output takes any value and fills it to a colour (design-interview Q46): a single value
// (v, v, v, 1), vec2 (x, y, 0.5, 1), vec3 (r, g, b, 1), vec4 as it is; int and bool alike. The input
// follows what is wired in (`params.type`, set by `wire`); unset means vec4, as stored graphs were.
// Color Output 什麼都能接、自動補齊：輸入跟著接進來的型別；沒設定＝vec4（既有的圖照舊）。
const inputType = (n: { params: Record<string, unknown> }) => String(n.params.type ?? 'vec4');
const layouts = new Map<string, readonly PortSpec[]>();
const layout = (type: string) => {
  let ports = layouts.get(type);
  if (!ports) {
    const empty = values.family(type) === 'bool' ? values.fill(false, type) : values.fill(0, type);
    ports = fixedPorts([{ key: 'color', direction: 'input', type, default: type === 'vec4' ? [0, 0, 0, 1] : empty }]);
    layouts.set(type, ports);
  }
  return ports;
};
const fillToColor = (type: string, value: string) => {
  const count = values.count(type);
  if (type === 'vec4') return value; // exactly as before 與以前完全相同
  if (count === 1) return 'vec4(vec3(float(' + value + ')), 1.0)';
  if (count === 2) return 'vec4(vec2(' + value + '), 0.5, 1.0)';
  if (count === 3) return 'vec4(vec3(' + value + '), 1.0)';
  return 'vec4(' + value + ')';
};

export default outputNode(catalog, {
  ports: n => layout(inputType(n)),

  supports: (n, c) =>
    (!c.target || c.target === 'top') &&
    values.types.includes(inputType(n)) &&
    !flags.some(k => n.params[k]) &&
    !(n.params.bufferCount && n.params.bufferCount !== 1),

  validate: n => {
    if (n.params.bufferCount !== undefined && n.params.bufferCount !== 1)
      throw Error('TOP has one color output');

    for (const k of flags)
      if (n.params[k] !== undefined && typeof n.params[k] !== 'boolean')
        throw Error('Output finishing must be a boolean');
  },

  wire: (n, key, source) => {
    if (key !== 'color' || !values.types.includes(source)) throw Error('Color Output takes a value');
    n.params.type = source;
    return { node: n, replaceInputs: ['color'] };
  },

  emit: (n, c) => ({
    outputs: {},
    statements: [
      '    vec4 sg_color = ' + fillToColor(inputType(n), c.input('color')) + ';',
      '    fragColor = TDOutputSwizzle(sg_color);'
    ],
    names: ['sg_color'] // declared above, so the name leads back here (Refactor.63.4) 上面宣告的，名字帶回這裡
  })
});
