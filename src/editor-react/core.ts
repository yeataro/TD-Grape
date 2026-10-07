import type * as graph from '../core-ts/graph';
import type * as modules from '../core-ts/node_module';
import type * as values from '../core-ts/values';
import type { createCompiler } from '../core-ts/top_compiler';
import type { createEditorContract } from '../core-ts/editor_contract';
import type { Graph as GraphData } from '../core-ts/model';
import type * as capacity from '../core-ts/capacity';
import type * as structure from '../core-ts/structure';

// Typed access to the SAME generated producer served to the legacy entry and TD.
// 只接入既有生成核心；型別引用不把另一份 registry／compiler 打進 React bundle。
export type Core = Pick<typeof graph, 'GraphDocument' | 'changesBetween'> & {
  registry: modules.Registry; values: typeof values; overLimit: typeof capacity.overLimit;
  structureProblems: typeof structure.structureProblems; offered: typeof structure.offered; removable: typeof structure.removable;
};
export type { Measure } from '../core-ts/capacity';
export type { StructureProblem } from '../core-ts/structure';
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
  defaultDocument: { graph: graph.GraphDocument['document'] };
};

// The graph is valid but outside this slice; the only startup error that offers a reset.
// 圖本身有效但超出本輪範圍；只有這種開啟錯誤提供「載入預設圖」。
export class UnsupportedGraphError extends Error {}

// Slice coverage, not a second node registry. Expand with verified product cases.
// 集中記錄本輪已接管能力；節點規則／選項仍只由真正的模組提供。
export const supportedDefinitions = [
  // values and output
  'float', 'scalar', 'vector', 'color', 'vec2', 'vec3', 'vec4', 'pixel_out',
  // arithmetic and functions
  'add', 'subtract', 'multiply', 'divide', 'math', 'abs', 'sign', 'floor', 'ceil', 'round', 'trunc', 'fract',
  'sqrt', 'sin', 'cos', 'min', 'max', 'clamp', 'mix', 'smoothstep', 'dot', 'length', 'normalize',
  // comparison and logic
  'compare', 'equal', 'notEqual', 'lessThan', 'lessThanEqual', 'greaterThan', 'greaterThanEqual',
  'any', 'all', 'not', 'if', 'isnan', 'isinf',
  // vector and colour structure
  'split', 'vector_split', 'rgba', 'router', 'combine', 'replace', 'swizzle', 'convert',
].map(key => 'sgrape.builtin.' + key);
// Retired definitions still open old graphs but are not offered for new nodes, as in the
// legacy creator (TD-Grape-legacy src/editor/functions_ui.js availableEntries). The same
// value is made with Scalar／Vector (fixed entries to be discussed).
// 已淘汰的舊定義：能打開舊圖、不再新增（同舊產品新增清單）；同樣的值改用 Scalar／Vector 建立。
const retired = new Set(['float', 'vec2', 'vec3', 'vec4'].map(key => 'sgrape.builtin.' + key));
// The core decides what may be added (a stage output such as Color Output never is, Q42).
// 能不能新增由核心決定（Color Output 這類 stage 出口不提供）。
export const creatableDefinitions = supportedDefinitions.filter(uuid => !retired.has(uuid) && core.offered(core.registry.get(uuid)!));
export function requireSupported(graph: graph.GraphDocument['document']) {
  const reasons = unsupportedReasons(graph);
  if (reasons.length) {
    const shown = reasons.length > 8 ? [...reasons.slice(0, 8), `…另有 ${reasons.length - 8} 項`] : reasons;
    throw new UnsupportedGraphError('此入口目前支援 TOP 的常用節點（不含 Uniform、子圖、Frame 等）。未送出編輯或套用，請使用舊入口。\n' +
      '不支援的內容：\n' + shown.map(reason => '・' + reason).join('\n'));
  }
}

// Name what blocks the slice so the user knows where to look; never edits the graph.
// 列出擋下的具體項目（節點／宣告／子圖…），只描述、不修改圖。
function unsupportedReasons(graph: graph.GraphDocument['document']): string[] {
  if (graph.schemaVersion !== 1 || graph.target !== 'top') return [`圖格式：schema ${graph.schemaVersion}／target ${graph.target}`];
  const reasons: string[] = [];
  if (!Array.isArray(graph.declarations)) reasons.push('宣告清單格式不正確');
  else for (const declaration of graph.declarations) reasons.push(`${declaration.kind === 'uniform' ? 'Uniform' : declaration.kind} 宣告「${declaration.name}」`);
  if (graph.functions?.length) reasons.push(`子圖 ${graph.functions.length} 個`);
  if (graph.topInputs?.length) reasons.push(`TOP 輸入 ${graph.topInputs.length} 個`);
  for (const stage of Object.keys(graph.stages)) if (stage !== 'pixel') reasons.push(`${stage} 階段`);
  const pixel = graph.stages.pixel;
  if (!pixel) return [...reasons, '缺少 pixel 階段'];
  const frames = pixel.ui?.frames;
  if (Array.isArray(frames) && frames.length > 0) reasons.push(`框架（Frame）${frames.length} 個`);
  for (const node of pixel.nodes) if (!supportedDefinitions.includes(node.definitionUuid)) {
    reasons.push(`${node.definitionUuid.replace(/^sgrape\.builtin\./, '')} 節點${node.name ? `「${node.name}」` : ''}（${node.id}）`);
  }
  // Size is not "unsupported": an over-limit graph opens with a warning and only growth is blocked.
  // 大小不算「不支援」：超過上限的圖照樣打開並警告，只擋變大。
  if (!reasons.length && !compiler.supports(graph) && !core.overLimit(graph, core.registry).length
    && !core.structureProblems(graph, core.registry).length) reasons.push('前端 compiler 無法處理這張圖');
  return reasons;
}

// The graph's text form exists only in the editor: TD stores and returns it unchanged (Q38 2-1-b).
// 圖的文字形式只存在於編輯器；TD 原樣保存、原樣交回。
export const serializeDocument = (graph: GraphData) => JSON.stringify(graph);
export const parseDocument = (text: string): GraphData => JSON.parse(text);
export const same = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
  const keys = Object.keys(x);
  return keys.length === Object.keys(y).length && keys.every(key => Object.hasOwn(y, key) && same(x[key], y[key]));
};
export const typeColor = (type: string) =>
  ({ '2': '#79b9eb', '3': '#75c7ac', '4': '#b7a0db' }[type.slice(-1)] ?? '#b8b5ae');
