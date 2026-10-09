import { core, creatableEntries, type Declaration } from './core';
import type { NewNode, WireEnd } from './editor';
import { tr, type Message } from './text';

// What can be added to the graph, for both entries (Refactor.54; the Add Node panel and the floating Create node
// read this one list, floating-panels.md 8 and 23). Nodes are the entries their modules declare (R.50, Q37 1-5),
// sorted by the browser data the modules already carry from the legacy catalog (category, path, source,
// aliases); sources are only what exists today (declared sources, preset Uniforms, TD built-in values).
// 可以加到圖上的東西，兩個入口共用這一份。節點＝模組自己宣告的入口，分類用模組本來就帶的舊產品分類資料；
// 來源只放現在有的（已宣告的來源、預設 Uniform、TD 內建值）。

/** Where a choice comes from, as the legacy tag (legacy locales browser.source.*). 來源標籤，同舊產品。 */
export type ChoiceSource = 'editor' | 'glsl' | 'td' | 'shader';
export type AddChoice = Readonly<{
  id: string; label: string; source: ChoiceSource;
  /** Category keys from the top, e.g. ['color', 'construct']. 分類代號，由上而下。 */
  path: readonly string[];
  /** The legacy key the wire-drop order uses (legacy graph_ui.js:1196). 拉線排序用的舊產品代號。 */
  key: string; aliases: readonly string[]; spec: NewNode;
}>;

// Category names, as the legacy browser (legacy locales browser.category.*), written out per Q34. The top ones
// are listed in the legacy order (human 2026-10-09 screenshots), which is also the tree's order.
// 分類名稱，照舊產品；依 Q34 每個都寫出來。頂層照舊產品的順序列，這也是樹的順序。
const TOP: Record<string, Message> = {
  source: tr('category.source', 'Source'), math: tr('category.math', 'Math'), vector: tr('category.vector', 'Vector'),
  matrix: tr('category.matrix', 'Matrix'), logic: tr('category.logic', 'Logic'), color: tr('category.color', 'Color'),
  coordinate: tr('category.coordinate', 'Coordinate'), texture: tr('category.texture', 'Texture'), data: tr('category.data', 'Data'),
  shader: tr('category.shader', 'Shader'), editor: tr('category.editor', 'Editor'), uncategorized: tr('category.uncategorized', 'Uncategorized'),
};
const SUB: Record<string, Message> = {
  arithmetic: tr('category.arithmetic', 'Arithmetic'), exponential: tr('category.exponential', 'Exponential'),
  interpolation: tr('category.interpolation', 'Interpolation'), range: tr('category.range', 'Range'),
  trigonometry: tr('category.trigonometry', 'Trigonometry'), construct: tr('category.construct', 'Construct'),
  values: tr('category.values', 'Values'), stage: tr('category.stage', 'Stage & Output'), '2d': tr('category.twoD', '2D'),
  uniforms: tr('category.uniforms', 'Uniforms'), graphConstants: tr('category.graphConstants', 'Graph Constants'),
  textureInputs: tr('category.textureInputs', 'Texture Inputs'), commonSources: tr('category.commonSources', 'Common Sources'),
  tdBuiltIn: tr('category.tdBuiltIn', 'TD Built In'),
};
const ORDER = Object.keys(TOP);
export const categoryLabel = (key: string): Message => TOP[key] ?? SUB[key] ?? tr('category.other', '{name}', { name: key });
export const sourceLabel: Record<ChoiceSource, Message> = {
  editor: tr('choice.editor', 'Editor'), glsl: tr('choice.glsl', 'GLSL'), td: tr('choice.td', 'TouchDesigner'), shader: tr('choice.shader', 'This Shader') };
const strings = (value: unknown) => Array.isArray(value) ? value.map(String) : [];

/** The list for the graph being edited. 正在編輯的圖的清單。 */
export function addChoices(declarations: readonly Declaration[], text: (key: string) => string): AddChoice[] {
  const nodes = creatableEntries.map((entry): AddChoice => {
    const module = core.registry.get(entry.uuid)!, browser = module.catalog.browser;
    const top = String(browser.category ?? 'uncategorized'), path = strings(browser.categoryPath);
    return { id: entry.uuid + ':' + entry.key, label: entry.literal ? entry.label : text(entry.label),
      source: (['editor', 'glsl', 'td'].includes(String(browser.source)) ? browser.source : 'editor') as ChoiceSource,
      // The legacy "inputs" nodes live under Source. 舊產品的 inputs 類節點放在 Source 底下。
      path: top === 'inputs' ? ['source'] : path.length ? path : [top],
      key: entry.key || module.catalog.definition.key, aliases: strings(browser.aliases), spec: { nodeType: entry.uuid, params: entry.params } };
  });
  const kinds: Record<string, string> = { uniform: 'uniforms', constant: 'graphConstants', topInput: 'textureInputs' };
  const declared = declarations.filter(item => item.kind in kinds && !item.entry).map((item): AddChoice => ({
    id: 'declaration:' + item.id, label: item.name, source: 'shader', path: ['source', kinds[item.kind]!], key: 'declaration', aliases: [item.kind],
    spec: { nodeType: 'sgrape.builtin.declaration', params: { declarationId: item.id } } }));
  const presets = core.uniformPresets.map((preset): AddChoice => ({
    id: 'preset:' + preset.entry, label: preset.name, source: 'td', path: ['source', 'commonSources'], key: 'declaration', aliases: [preset.entry],
    spec: { preset: preset.entry } }));
  const builtins = core.tdValues.filter(entry => core.usableTdValue(entry, 'top')).map((entry): AddChoice => ({
    id: 'tdValue:' + entry.id, label: entry.name, source: 'td', path: ['source', 'tdBuiltIn'], key: 'td_value', aliases: [entry.expression],
    spec: { nodeType: 'sgrape.builtin.td_value', params: { entry: entry.id } } }));
  return [...declared, ...presets, ...builtins, ...nodes];
}

/** The top categories present, in the legacy order. 有東西的頂層分類，照舊產品順序。 */
export const topCategories = (choices: readonly AddChoice[]) =>
  [...new Set(choices.map(choice => choice.path[0]!))].sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));

/** Name, alias or key; names starting with the query first. 名稱、別名或代號；名稱開頭相符的排前面。 */
export function searchChoices(choices: readonly AddChoice[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [...choices];
  const hit = (choice: AddChoice) => [choice.label, choice.key, ...choice.aliases].some(word => word.toLowerCase().includes(q));
  return choices.filter(hit).sort((a, b) => Number(!a.label.toLowerCase().startsWith(q)) - Number(!b.label.toLowerCase().startsWith(q)));
}

// The legacy order when nothing is typed and a wire is being dropped (legacy graph_ui.js:1196–1202): what people
// usually reach for first, by the wire's type and end. A preference of this screen, written with node keys.
// 拉線放開、還沒打字時的常用順序（照舊產品）：依線的型別與哪一端。這是畫面的偏好，用節點代號寫。
const components = (type: string) => /^(b|i|u|d)?vec([234])$/.exec(type)?.[2] ?? (/^(float|int|uint|bool|double)$/.test(type) ? '1' : '0');
export function wireOrder(type: string, side: WireEnd['side']): readonly string[] {
  const count = Number(components(type));
  if (side === 'output') return count > 1 ? ['vector_split', 'split', 'replace', 'swizzle', 'combine', 'multiply', 'add', 'mix'] : ['multiply', 'add', 'replace', 'combine', 'mix'];
  return count > 1 ? ['vector', 'combine', type, 'swizzle'] : ['float', 'vector', 'add', 'multiply'];
}
