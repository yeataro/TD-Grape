import {
  type NodeModule,
  subgraphPorts,
  subgraphPresentation,
  validInterface,
  requireSubgraph
} from '../node_sdk';
import { CORE_CONFIG } from '../config';

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
    validInterface(context.owner),

  ports: (node, context) =>
    subgraphPorts(requireSubgraph(context), 'output'),

  // The spare grey port (basic design §3.5; legacy functions_ui.js:378-434): a wire dropped on it adds an interface port of the
  // wire's type. The command is the editor's interface edit, not a node command: the ports live on the definition.
  // 備用灰點（§3.5；照舊產品）：線放上來就新增一個那條線型別的接口。指令是編輯器的介面修改，不是節點指令：接口住在定義上。
  presentation: (node, context) => {
    const f = requireSubgraph(context);
    return { ...subgraphPresentation(f, 'output'),
      spare: { direction: 'input', key: '', type: '', command: 'interface', count: f.outputs.length, limit: CORE_CONFIG.subgraphPortsPerSide,
        label: 'subgraph.addOutput', limitLabel: 'subgraph.portLimit' } };
  },

  validate: (node, context) => {
    requireSubgraph(context);
  }
};

export default definition;
