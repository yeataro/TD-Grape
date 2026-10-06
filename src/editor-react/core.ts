import type * as graph from '../core-ts/graph';
import type * as modules from '../core-ts/node_module';
import type * as values from '../core-ts/values';
import type { createCompiler } from '../core-ts/top_compiler';
import type { createEditorContract } from '../core-ts/editor_contract';

// Typed access to the SAME generated producer served to the legacy entry and TD.
// 只接入既有生成核心；型別引用不把另一份 registry／compiler 打進 React bundle。
export type Core = Pick<typeof graph, 'GraphDocument' | 'changesBetween'> & {
  registry: modules.Registry; values: typeof values;
};
declare global {
  var GrapeGraph: Core;
  var GrapeTopCompiler: ReturnType<typeof createCompiler>;
}
export const core = globalThis.GrapeGraph;
export const compiler = globalThis.GrapeTopCompiler;
export type { Graph, Node, Value, ObjectValue } from '../core-ts/model';
export type { Network, GraphDocument } from '../core-ts/graph';
export type { GraphChanges } from '../core-ts/changes';
export type { NodePresentation, NodeControl } from '../core-ts/node_module';
export type { PortSpec } from '../core-ts/ports';
export type Bootstrap = {
  catalogHash: string;
  typeContract: ReturnType<typeof createEditorContract>;
};

// Slice coverage, not a second node registry. Expand with verified product cases.
// 集中記錄本輪已接管能力；節點規則／選項仍只由真正的模組提供。
export const supportedDefinitions = ['float', 'color', 'add', 'pixel_out'].map(key => 'sgrape.builtin.' + key);
export function requireSupported(graph: graph.GraphDocument['document']) {
  const frames = graph.stages.pixel?.ui?.frames;
  if (graph.schemaVersion !== 1 || graph.target !== 'top' ||
      !Array.isArray(graph.declarations) || graph.declarations.length || graph.functions?.length || graph.topInputs?.length ||
      Object.keys(graph.stages).join() !== 'pixel' || (Array.isArray(frames) && frames.length > 0) || !compiler.supports(graph) ||
      graph.stages.pixel.nodes.some(node => !supportedDefinitions.includes(node.definitionUuid))) {
    throw Error('此入口目前支援 Float、Color RGBA、Add 與 Color Output 的常數 TOP 圖。未送出編輯或套用，請使用舊入口。');
  }
}

export const same = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
  const keys = Object.keys(x);
  return keys.length === Object.keys(y).length && keys.every(key => Object.hasOwn(y, key) && same(x[key], y[key]));
};
export const typeColor = (type: string) =>
  ({ '2': '#79b9eb', '3': '#75c7ac', '4': '#b7a0db' }[type.slice(-1)] ?? '#b8b5ae');
