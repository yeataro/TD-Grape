import { vectorNode, type CatalogRow } from '../node_sdk';

const catalog:CatalogRow={
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

export default vectorNode(catalog);
