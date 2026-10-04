import {
  type NodeModule,
  subgraphPorts,
  subgraphPresentation,
  numericInterface,
  requireSubgraph
} from '../node_sdk';

// The common compiler expands this structural module using its declared role
// and graph reference. Only ordinary value modules need an emit callback.
const definition: NodeModule = {
  catalog: {
    definition: {
      key: 'function_input',
      label: 'Subgraph Input',
      definitionUuid: 'sgrape.function.input',
      inputs: {},
      outputs: {},
      stages: ['vertex', 'pixel'],
      defaults: {},
      descriptionKey: 'help.functionPorts'
    },
    emitter: {
      id: 'function_input',
      version: 1
    },
    browser: {}
  },

  structural: true,
  role: 'subgraph-input',

  supports: (node, context) =>
    numericInterface(context.owner),

  ports: (node, context) =>
    subgraphPorts(requireSubgraph(context), 'input'),

  presentation: (node, context) =>
    subgraphPresentation(requireSubgraph(context), 'input'),

  validate: (node, context) => {
    requireSubgraph(context);
  }
};

export default definition;
