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
      key: 'function_output',
      label: 'Subgraph Output',
      definitionUuid: 'sgrape.function.output',
      inputs: {},
      outputs: {},
      stages: ['vertex', 'pixel'],
      defaults: {},
      descriptionKey: 'help.functionPorts'
    },
    emitter: {
      id: 'function_output',
      version: 1
    },
    browser: {}
  },

  structural: true,
  role: 'subgraph-output',

  supports: (node, context) =>
    numericInterface(context.owner),

  ports: (node, context) =>
    subgraphPorts(requireSubgraph(context), 'output'),

  presentation: (node, context) =>
    subgraphPresentation(requireSubgraph(context), 'output'),

  validate: (node, context) => {
    requireSubgraph(context);
  }
};

export default definition;
