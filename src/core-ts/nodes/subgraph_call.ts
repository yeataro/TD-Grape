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
      key: 'subgraph_call',
      label: 'Subgraph',
      inputs: {},
      outputs: {},
      stages: ['vertex', 'pixel'],
      defaults: {},
      descriptionKey: 'help.function'
    },
    emitter: {
      id: 'subgraph_call',
      version: 1
    },
    browser: {}
  },

  structural: true,
  role: 'value',

  referencedGraph: node => String(node.params.subgraphId),
  reference: graphId => ({subgraphId: graphId}),

  supports: (node, context) =>
    numericInterface(context.subgraph?.(String(node.params.subgraphId))),

  ports: (node, context) =>
    subgraphPorts(requireSubgraph(context, String(node.params.subgraphId)), 'call'),

  presentation: (node, context) =>
    subgraphPresentation(requireSubgraph(context, String(node.params.subgraphId)), 'call'),

  validate: (node, context) => {
    requireSubgraph(context, String(node.params.subgraphId));
  }
};

export default definition;
