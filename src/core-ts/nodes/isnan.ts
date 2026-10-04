import { typedNode, input, output, payload, values } from '../node_sdk';

const catalog = {
  "definition": {
    "key": "isnan",
    "label": "isnan",
    "inputs": {
      "value": "float"
    },
    "outputs": {
      "out": "bool"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {
      "type": "float"
    },
    "inputDefaults": {},
    "descriptionKey": "help.isnan",
    "definitionUuid": "sgrape.builtin.isnan",
    "targets": [
      "top",
      "mat"
    ]
  },
  "emitter": {
    "id": "isnan",
    "version": 1
  },
  "browser": {
    "category": "logic",
    "source": "glsl",
    "aliases": [
      "isnan"
    ],
    "glslName": "isnan",
    "secondaryCategories": [],
    "categoryPath": [
      "logic"
    ]
  }
};

const inputs = ['float', 'vec2', 'vec3', 'vec4'];
const outputs = ['bool', 'bvec2', 'bvec3', 'bvec4'];
export default typedNode(catalog, {
  types: inputs,
  ports: t => [input('value', t), output('out', values.shaped('bool', values.count(t)))],
  presentation: n => ({selector: {
    value: outputs[inputs.indexOf(String(n.params.type))]!, options: outputs,
    command: 'output', label: 'vector.outputType'
  }}),
  edit: (n, command, data) => {
    const index = outputs.indexOf(String(payload(data)));
    if (command !== 'output' || index < 0) throw Error('Invalid predicate output');
    const old = String(n.params.type); n.params.type = inputs[index]!;
    if (n.inputValues?.value !== undefined && old !== n.params.type)
      n.inputValues.value = values.reshape(n.inputValues.value, String(n.params.type));
    return n;
  },
  emit: (_n, c) => ({outputs: {out: 'isnan(' + c.input('value') + ')'}})
});
