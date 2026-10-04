import { typedNode, output, payload, values } from '../node_sdk';

const catalog = {
  "definition": {
    "key": "scalar",
    "label": "Scalar",
    "inputs": {},
    "outputs": {
      "out": "T"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {
      "type": "float",
      "value": 0
    },
    "descriptionKey": "help.scalar",
    "definitionUuid": "sgrape.builtin.scalar"
  },
  "emitter": {
    "id": "scalar",
    "version": 1
  },
  "browser": {
    "category": "data",
    "source": "editor",
    "aliases": [
      "float",
      "int",
      "uint",
      "bool",
      "integer",
      "unsigned",
      "boolean",
      "value",
      "double"
    ],
    "glslName": "scalar",
    "secondaryCategories": [],
    "categoryPath": [
      "data",
      "values"
    ]
  }
};

export default typedNode(catalog, {
  types: values.scalars,
  ports: t => [output('out', t)],
  configure: (n, t) => { n.params.value = values.reshape(n.params.value ?? 0, t); return n; },
  edit: (n, command, data) => {
    if (!['component', 'value'].includes(command)) throw Error('Unknown scalar command');
    const value = payload(data);
    values.literal(value, String(n.params.type));
    n.params.value = value;
    return n;
  },
  validate: n => { values.literal(n.params.value, String(n.params.type)); },
  presentation: n => ({ value: {
    value: n.params.value!, type: String(n.params.type),
    componentCommand: 'component', valueCommand: 'value', names: 'X'
  }}),
  emit: n => ({ outputs: {out: values.literal(n.params.value, String(n.params.type))} })
});
