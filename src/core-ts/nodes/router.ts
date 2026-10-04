import { typedNode, input, output, values } from '../node_sdk';

const catalog = {
  "definition": {
    "key": "router",
    "label": "Router",
    "inputs": {
      "value": "T"
    },
    "outputs": {
      "out": "T"
    },
    "stages": [
      "vertex",
      "pixel"
    ],
    "defaults": {
      "type": "float"
    },
    "descriptionKey": "help.router",
    "definitionUuid": "sgrape.builtin.router"
  },
  "emitter": {
    "id": "router",
    "version": 1
  },
  "browser": {
    "category": "editor",
    "source": "editor",
    "aliases": [
      "reroute",
      "knot",
      "routing",
      "整理接線",
      "轉接",
      "路由"
    ],
    "glslName": "",
    "secondaryCategories": [],
    "categoryPath": [
      "editor"
    ]
  }
};

export default typedNode(catalog, {
  types: values.types,
  ports: t => [input('value', t), output('out', t)],
  emit: (_n, c) => ({outputs: {out: c.input('value')}})
});
