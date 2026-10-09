import type * as graph from '../core-ts/graph';
import type * as modules from '../core-ts/node_module';
import type * as values from '../core-ts/values';
import type { createCompiler } from '../core-ts/top_compiler';
import type { createEditorContract } from '../core-ts/editor_contract';
import type { Graph as GraphData, formatProblem } from '../core-ts/model';
import type * as capacity from '../core-ts/capacity';
import type * as structure from '../core-ts/structure';
import type * as ghosts from '../core-ts/ghosts';
import type * as declarations from '../core-ts/declarations';
import type * as modelTypes from '../core-ts/model';
import type * as tdValueTable from '../core-ts/td_values';
import type * as presetTable from '../core-ts/uniform_presets';
import type * as commonTable from '../core-ts/common_sources';
import { tr, TextError, type Message } from './text';

// Typed access to the SAME generated producer served to the legacy entry and TD.
// 只接入既有生成核心；型別引用不把另一份 registry／compiler 打進 React bundle。
export type Core = Pick<typeof graph, 'GraphDocument' | 'changesBetween'> & {
  registry: modules.Registry; values: typeof values; overLimit: typeof capacity.overLimit;
  structureProblems: typeof structure.structureProblems; offered: typeof structure.offered; removable: typeof structure.removable;
  formatProblem: typeof formatProblem; ghostsOf: typeof ghosts.ghostsOf;
  declarationKinds: typeof declarations.declarationKinds; declarationNameProblem: typeof declarations.declarationNameProblem;
  freeDeclarationName: typeof declarations.freeDeclarationName; defaultTextures: typeof declarations.defaultTextures;
  uniformPresets: typeof presetTable.uniformPresets; commonSources: typeof commonTable.commonSources;
  tdValues: typeof tdValueTable.tdValues; usableTdValue: (entry: tdValueTable.TdValue | undefined, target: string | undefined) => boolean;
};
export type { TdValue } from '../core-ts/td_values';
export type { NameProblem } from '../core-ts/declarations';
export type { Declaration } from '../core-ts/model';
export type { GhostKind } from '../core-ts/ghosts';
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
export class UnsupportedGraphError extends TextError {}

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
  // shared sources (Refactor.40: global constants; Refactor.41: TD built-in values)
  'declaration', 'td_value',
  // textures (Refactor.43)
  'texture_sample',
].map(key => 'sgrape.builtin.' + key);
// Declaration kinds this entry has taken over. Unknown kinds are kept as ghosts (Q44); known kinds
// not taken over yet (Uniform) still refuse, like known nodes outside the slice.
// 本入口已接管的宣告種類；不認得的保留（Ghost），認得但未接管的（Uniform）仍拒絕。
export const supportedKinds = ['constant', 'topInput', 'uniform'];
// The add menu (design-interview Q37 1-5, Refactor.50): the entries the node modules declare, for the
// nodes this entry has taken over; the core decides what may be added at all (a stage output never is,
// Q42). No node name is special-cased here. 新增選單：已接管的節點模組自己宣告的入口；能不能新增由核心決定。這裡不認任何節點名字。
export type MenuEntry = { uuid: string; key: string; label: string; literal?: boolean; params: modelTypes.ObjectValue };
export const creatableEntries: readonly MenuEntry[] = supportedDefinitions.flatMap(uuid => {
  const module = core.registry.get(uuid)!;
  if (!core.offered(module)) return [];
  return (module.entries?.() ?? [{ key: '', label: module.catalog.definition.label, params: {} }])
    .map(entry => ({ uuid, ...entry }));
});
export const creatableDefinitions = [...new Set(creatableEntries.map(entry => entry.uuid))];
export function requireSupported(graph: graph.GraphDocument['document']) {
  // Format first (Q44): a newer version is never written back, so no reset is offered for it.
  // 先看格式：比目前新的版本不寫回，所以不提供換成預設圖。
  const problem = core.formatProblem(graph);
  if (problem?.code === 'newer-version') throw new TextError(tr('open.newerVersion',
    'This graph was saved by a newer Grape. Update Grape before editing; to keep the newer data safe, nothing is written back.\n{detail}',
    { detail: problem.message }));
  if (problem?.code === 'not-grape-graph') throw new UnsupportedGraphError(tr('open.notGrapeGraph',
    'This graph is not in the new format (grape-graph). Old graphs will be handled by an importer; the new editor does not open them.\n{detail}',
    { detail: problem.message }));
  if (problem) throw new UnsupportedGraphError(tr('open.badGraph', 'The graph data is incomplete or malformed, so it was not opened.\n{detail}',
    { detail: problem.message }));
  const reasons = unsupportedReasons(graph);
  if (reasons.length) {
    const shown = reasons.length > 8 ? [...reasons.slice(0, 8), tr('open.reasonMore', '…and {count} more', { count: reasons.length - 8 })] : reasons;
    throw new UnsupportedGraphError(tr('open.unsupported',
      'This entry supports the common TOP nodes (no Uniforms, subgraphs or Frames yet). Nothing was edited or applied; these will come back in later rounds.\nNot supported: {reasons}',
      { reasons: shown }));
  }
}

// Name what blocks the slice so the user knows where to look; never edits the graph.
// 列出擋下的具體項目（節點／宣告／子圖…），只描述、不修改圖。
function unsupportedReasons(graph: graph.GraphDocument['document']): Message[] {
  if (graph.target !== 'top') return [tr('open.reasonTarget', 'target {target}', { target: String(graph.target) })];
  const reasons: Message[] = [];
  if (!Array.isArray(graph.declarations)) reasons.push(tr('open.reasonDeclarations', 'the declaration list is malformed'));
  else for (const declaration of graph.declarations) if (core.declarationKinds.has(declaration.kind) && !supportedKinds.includes(declaration.kind))
    reasons.push(tr('open.reasonDeclaration', '{kind} declaration “{name}”',
      { kind: declaration.kind === 'uniform' ? 'Uniform' : String(declaration.kind), name: String(declaration.name) }));
  if (graph.subgraphs?.length) reasons.push(tr('open.reasonSubgraphs', '{count} subgraphs', { count: graph.subgraphs.length }));
  for (const stage of Object.keys(graph.stages)) if (stage !== 'pixel') reasons.push(tr('open.reasonStage', '{stage} stage', { stage }));
  const pixel = graph.stages.pixel;
  if (!pixel) return [...reasons, tr('open.reasonNoPixel', 'no pixel stage')];
  const frames = pixel.ui?.frames;
  if (Array.isArray(frames) && frames.length > 0) reasons.push(tr('open.reasonFrames', '{count} Frames', { count: frames.length }));
  // A node type this build does not know at all is a ghost, not a reason to refuse (Q37 1-1). Known
  // types outside this entry's slice still refuse: as ghosts they would silently leave TD's program.
  // 完全不認得的節點是 Ghost，不拒絕；認得但本入口還沒接管的仍拒絕——當成 Ghost 會悄悄從 TD 的程式消失。
  for (const node of pixel.nodes) if (core.registry.get(node.nodeType) && !supportedDefinitions.includes(node.nodeType)) {
    const type = node.nodeType.replace(/^sgrape\.builtin\./, '');
    reasons.push(node.name ? tr('open.reasonNamedNode', '{type} node “{name}” ({id})', { type, name: node.name, id: node.id })
      : tr('open.reasonNode', '{type} node ({id})', { type, id: node.id }));
  }
  // Size is not "unsupported": an over-limit graph opens with a warning and only growth is blocked.
  // 大小不算「不支援」：超過上限的圖照樣打開並警告，只擋變大。
  if (!reasons.length && !compiler.supports(graph) && !core.overLimit(graph, core.registry).length
    && !core.structureProblems(graph, core.registry).length) reasons.push(tr('open.reasonCompiler', 'the frontend compiler cannot handle this graph'));
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
// Textures keep the legacy umber (style.css 0.8.276). 貼圖沿用舊產品的褐色。
export const typeColor = (type: string) => type === 'sampler2D' ? '#c2a47a' :
  ({ '2': '#79b9eb', '3': '#75c7ac', '4': '#b7a0db' }[type.slice(-1)] ?? '#b8b5ae');
