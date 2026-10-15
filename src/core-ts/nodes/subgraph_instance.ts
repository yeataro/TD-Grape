import {
  type NodeModule,
  subgraphPorts,
  subgraphPresentation,
  validInterface,
  requireSubgraph
} from '../node_sdk';

// The common compiler expands this structural module using its declared role
// and graph reference. Only ordinary value modules need an emit callback.
const definition: NodeModule = {
  catalog: {
    definition: {
      key: 'subgraph_instance',
      label: 'Subgraph',
      inputs: {},
      outputs: {},
      stages: ['vertex', 'pixel'],
      defaults: {},
      descriptionKey: 'help.subgraph_instance'
    },
    emitter: {
      id: 'subgraph_instance',
      version: 1
    },
    browser: {}
  },

  structural: true,
  role: 'value',

  referencedGraph: node => String(node.params.subgraphId),
  reference: graphId => ({subgraphId: graphId}),

  supports: (node, context) =>
    validInterface(context.subgraph?.(String(node.params.subgraphId))),

  ports: (node, context) =>
    subgraphPorts(requireSubgraph(context, String(node.params.subgraphId)), 'instance'),

  presentation: (node, context) =>
    subgraphPresentation(requireSubgraph(context, String(node.params.subgraphId)), 'instance'),

  validate: (node, context) => {
    requireSubgraph(context, String(node.params.subgraphId));
  }
};

export default definition;
