import { typedNode, output, payload, values, storedOr, componentLetters } from '../node_sdk';

const catalog = {
  "definition": {
    "key": "vector",
    "label": "Vector",
    "inputs": {},
    "outputs": {
      "out": "vec2"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {
      "type": "vec2",
      "components": [
        0,
        0,
        0,
        0
      ]
    },
    "descriptionKey": "help.vector",
    "definitionUuid": "sgrape.builtin.vector"
  },
  "emitter": {
    "id": "vector",
    "version": 1
  },
  "browser": {
    "category": "vector",
    "source": "glsl",
    "aliases": [
      "vec2",
      "vec3",
      "vec4",
      "vector2",
      "vector3",
      "vector4",
      "value",
      "components",
      "dvec2",
      "dvec3",
      "dvec4"
    ],
    "glslName": "vecN",
    "secondaryCategories": [],
    "categoryPath": [
      "vector"
    ]
  }
};

// Drawn as a constant (legacy graph_ui.js:143). 畫成常數色（照舊產品）。
export default {...typedNode(catalog, {
  types: values.vectors,
  inheritsComponentNames: true,
  fixed: t => ({ components: values.reshape([0, 0, 0, 0], values.shaped(values.family(t), 4)) }),
  ports: t => [output('out', t)],
  configure: (n, t) => { n.params.components = values.reshape(n.params.components ?? [0,0,0,0], values.shaped(values.family(t),4)); return n; },
  validate: n => { values.literal(n.params.components, values.shaped(values.family(String(n.params.type)),4)); },
  edit: (n, command, data) => {
    const t = String(n.params.type), old = n.params.components as (number|boolean)[];
    if (command === 'value') {
      const value = payload(data); values.literal(value, t);
      n.params.components = [...value as (number|boolean)[], ...old.slice(values.count(t))];
    } else if (command === 'component' && data && typeof data === 'object' && !Array.isArray(data)) {
      const index = Number(data.index), value = payload(data);
      if (!Number.isInteger(index) || index < 0 || index >= values.count(t)) throw Error('Invalid component');
      values.literal(value, values.family(t)); old[index] = value as number|boolean;
    } else throw Error('Invalid vector command');
    return n;
  },
  presentation: n => ({value: {
    value: (n.params.components as (number|boolean)[]).slice(0,values.count(String(n.params.type))),
    type: String(n.params.type), componentCommand: 'component', valueCommand: 'value',
    names: componentLetters(storedOr(n, 'xyzw'), values.count(String(n.params.type))), expandable: true
  }}),
  emit: n => ({outputs: {out: values.literal((n.params.components as (number|boolean)[]).slice(0,values.count(String(n.params.type))),String(n.params.type))},constant:true})
}), colorGroup: 'constant'};
