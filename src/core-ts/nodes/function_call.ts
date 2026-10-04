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
      key: 'function_call',
      label: 'Subgraph',
      definitionUuid: 'sgrape.function.call',
      inputs: {},
      outputs: {},
      stages: ['vertex', 'pixel'],
      defaults: {},
      descriptionKey: 'help.function'
    },
    emitter: {
      id: 'function_call',
      version: 1
    },
    browser: {}
  },

  structural: true,
  role: 'value',

  referencedGraph: node => String(node.params.functionId),
  reference: graphId => ({functionId: graphId}),

  supports: (node, context) =>
    numericInterface(context.subgraph?.(String(node.params.functionId))),

  ports: (node, context) =>
    subgraphPorts(requireSubgraph(context, String(node.params.functionId)), 'call'),

  presentation: (node, context) =>
    subgraphPresentation(requireSubgraph(context, String(node.params.functionId)), 'call'),

  validate: (node, context) => {
    requireSubgraph(context, String(node.params.functionId));
  }
};

export default definition;
