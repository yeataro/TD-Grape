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
      key: 'subgraph_output',
      label: 'Subgraph Output',
      inputs: {},
      outputs: {},
      stages: ['vertex', 'pixel'],
      defaults: {},
      descriptionKey: 'help.functionPorts'
    },
    emitter: {
      id: 'subgraph_output',
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
