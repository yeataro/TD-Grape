import { copy, type Graph, type Declaration, type Value } from './model';
import { types, literal, fill, type as numericType } from './numeric';
import { reshape } from './values';
import { identifierRules } from './identifier_rules';
import type { PortSpec } from './ports';
import { uniformPresets } from './uniform_presets';

/** Declarations (design-interview Q41, Q44, Q45): the graph's shared sources and global constants,
 * one list `declarations`, each entry with a `kind`. A kind module decides its fields, what a
 * reference to it gives (type, whether it is a constant expression) and its GLSL at file scope.
 * A declaration of a kind this build does not know is kept as stored and never read (Q44); the
 * nodes that refer to it are ghosts. Rules shared by every kind (Q41): names are unique among
 * declarations, follow GLSL naming, and are referred to only at the top level of a stage.
 * 宣告：圖裡的共用來源與全域常數，一張清單、每筆有 kind。kind 模組決定欄位、被引用時給什麼、檔案層級的 GLSL。
 * 不認得的 kind 原樣保留、不讀；引用它的節點是 Ghost。共用規則：名稱互不重複、照 GLSL 命名、只在 stage 最外層引用。 */
export interface DeclarationKind {
  readonly kind: string;
  /** source: the value comes from outside (TD); constant: the value lives in the graph (Q41). */
  readonly role: 'source' | 'constant';
  /** Display-only colour group of the nodes that refer to it (Q42); the core never reads it. */
  readonly colorGroup: string;
  readonly types: readonly string[];
  /** Whether a reference is a GLSL constant expression (usable where GLSL needs a constant). */
  readonly constant: boolean;
  /** The kind's own fields (decision 11) with their values for a new declaration; only these may be
   * changed besides name and type. 自己的欄位與新增時的初始值；除了名稱與型別，只有這些能改。 */
  initial(type: string): Record<string, Value>;
  /** Fields of its own without a default value: optional ones (a Uniform's `color`) or ones the
   * caller always gives (a built-in value's `entry`). 自己的、沒有預設值的欄位（選用的，或一定由呼叫者給的）。 */
  readonly optional?: readonly string[];
  /** How its own fields follow a new type. 改型別時自己的欄位怎麼跟著調整。 */
  retype?(declaration: Declaration, type: string): Record<string, Value>;
  validate(declaration: Declaration): void;
  /** Completes a new declaration from what the caller gave (e.g. a preset's name and type).
   * 從呼叫者給的內容補齊新宣告（例如預設 Uniform 的名字與型別）。 */
  prepare?(entry: DeclarationEntry): DeclarationEntry;
  /** Refuses changes the web editor must not make (Q59): throws when `after` changes a locked field.
   * 網頁端不能改的欄位：改了就丟錯。 */
  checkChange?(before: Declaration, after: Declaration): void;
  /** File-scope GLSL for a declaration that is used; none when TD declares it. */
  header?(declaration: Declaration): string;
  /** Every declaration of this kind goes to TD in list order, used or not, and a reference uses its
   * position among them (graph-structure decision 5: order is the list order, the GLSL index is
   * worked out by code generation). 這種宣告不論有沒有用都照清單順序交給 TD；引用時用它在同種宣告裡的位置。 */
  readonly ordered?: boolean;
  /** Every declaration of this kind goes to TD, used or not, in list order after the ordered kinds: its
   * TD row lives as long as the declaration (legacy sgrape_sources.configure took every declared
   * Uniform; found in TD 2026-10-09: unwiring must not delete the row and what drives it). The GLSL
   * still declares only used ones. 這種宣告不論有沒有用到都交給 TD：TD 上那一列跟著宣告存在（舊產品同；
   * 拔線不能刪掉那一列和它的驅動）。GLSL 仍只宣告用到的。 */
  readonly declared?: boolean;
  /** What a reference gives (output ports) and their GLSL; by default one `out` of the declaration's
   * type, written as its name. 引用時給哪些輸出與 GLSL；預設是一個 out，寫成宣告的名字。 */
  readonly outputs?: readonly PortSpec[];
  reference?(declaration: Declaration, position: number): Record<string, string>;
  /** The name people see, when it is not the declaration's own (a TOP texture input is named by its position,
   * as the legacy editor; human 2026-10-09). 給人看的名字，不是宣告自己的名字時才給（TOP 貼圖輸入照位置命名，同舊產品）。 */
  label?(declaration: Declaration, position: number): string;
}

const numericValue = (declaration: Declaration) => {
  if (!types.includes(declaration.type)) throw Error('Unsupported declaration type');
  literal(declaration.value, numericType(declaration.type));
};
const numericFields = {
  initial: (type: string) => ({ value: fill(0, numericType(type)) }),
  retype: (d: Declaration, type: string) => ({ value: reshape(d.value ?? 0, type) }),
};
// Global constant (Q41): `const` at file scope; changing it changes the program, nothing in TD.
const constantKind: DeclarationKind = { kind: 'constant', role: 'constant', colorGroup: 'constant', types, constant: true, validate: numericValue,
  ...numericFields, header: (d: Declaration) => 'const ' + d.type + ' ' + d.name + ' = ' + literal(d.value, numericType(d.type)) + ';' };
// Uniform (Q41, Q55–Q61; uniform-d.md). `value` is the value it carries with the graph (Q57); in TD the
// GLSL OP parameter is the authority. `color: true` (Q51) marks a colour, vec3 and vec4 only, decided
// when it is created (Q59: switching would move it to another page and drop what drives it).
// `entry` points to a preset (uniform_presets.json, Q61): its name and type come from the preset and are
// locked in the web editor; otherwise it is an ordinary Uniform.
// Uniform：value 是跟著圖走的值；color 建立時決定、之後不能改；entry 指向預設 Uniform，名字與型別照表、網頁端鎖住。
const colorTypes = ['vec3', 'vec4'];
const presetTable = new Map(uniformPresets.map(preset => [preset.entry, preset]));
const uniformKind: DeclarationKind = { kind: 'uniform', role: 'source', colorGroup: 'uniform', types, constant: false,
  declared: true, optional: ['color', 'entry'],
  validate: d => {
    numericValue(d);
    if (d.color !== undefined && typeof d.color !== 'boolean') throw Error('Color must be true or false');
    if (d.color === true && !colorTypes.includes(d.type)) throw Error('Only vec3 and vec4 can be a colour');
    if (d.entry === undefined) return;
    const preset = presetTable.get(String(d.entry));
    if (!preset) throw Error('Unknown Uniform preset');
    if (d.name !== preset.name || d.type !== preset.type || d.color === true) throw Error('A preset Uniform keeps its own name and type');
  },
  initial: numericFields.initial,
  retype: numericFields.retype,
  prepare: entry => {
    if (entry.entry === undefined) return entry;
    const preset = presetTable.get(String(entry.entry));
    if (!preset) throw Error('Unknown Uniform preset');
    return { ...entry, name: preset.name, type: preset.type };
  },
  checkChange: (before, after) => {
    if ((before.color === true) !== (after.color === true)) throw Error('A Uniform is a colour or not from the moment it is created');
    if (before.entry !== after.entry) throw Error('A preset Uniform keeps its preset');
  },
  header: (d: Declaration) => 'uniform ' + d.type + ' ' + d.name + ';' };

/** Default images a TOP texture input shows when nothing is connected from outside (graph-structure
 * `defaultTexture`; human 2026-10-09: the Samples outputs, Grape first). `custom` is the TOP chosen
 * on the Grape OP's Samples. How TD provides them is TD's business (Q45).
 * 外面沒接東西時用的預設圖（人類 10-09：Samples 的出口，預設 Grape）；custom＝Samples 上自選的 TOP。 */
export const defaultTextures: readonly string[] = Object.freeze(['grape', 'banana', 'jellybeans', 'white', 'black', 'normal', 'custom']);
const textureOutputs: readonly PortSpec[] = Object.freeze([
  { key: 'out', direction: 'output' as const, type: 'sampler2D' },
  { key: 'size', direction: 'output' as const, type: 'vec2' },
  { key: 'pixelSize', direction: 'output' as const, type: 'vec2' },
].map(port => Object.freeze(port)));
// TOP texture input (graph-structure decision 5, Q44; texture-inputs.md): every one becomes an input
// of the Grape OP, in list order; the GLSL index is its position. TD declares sTD2DInputs, so no header.
// TOP 貼圖輸入：每一筆都成為 Grape OP 的輸入接口、照清單順序；GLSL 索引是它的位置。TD 自己宣告 sTD2DInputs。
const topInputKind: DeclarationKind = { kind: 'topInput', role: 'source', colorGroup: 'sampler', types: ['sampler2D'], constant: false,
  ordered: true, outputs: textureOutputs,
  initial: () => ({ defaultTexture: 'grape' }),
  validate: d => {
    if (d.type !== 'sampler2D') throw Error('Unsupported declaration type');
    if (!defaultTextures.includes(String(d.defaultTexture))) throw Error('Unknown default texture');
  },
  reference: (_d, i) => ({ out: 'sTD2DInputs[' + i + ']', size: 'uTD2DInfos[' + i + '].res.zw', pixelSize: 'uTD2DInfos[' + i + '].res.xy' }),
  // Named by position, its GLSL name, and not renamed (legacy inspector.js:2986; human 2026-10-09): deleting one
  // before it renumbers it, so the name always matches TD. 照位置命名＝它的 GLSL 名字、不能改（同舊產品）：刪掉前面的就改號，名字永遠對得上 TD。
  label: (_d, i) => 'sTD2DInputs[' + i + ']' };
export const declarationKinds: ReadonlyMap<string, DeclarationKind> =
  new Map([constantKind, uniformKind, topInputKind].map(module => [module.kind, Object.freeze(module)]));

/** Why a name cannot be used, or null. GLSL naming, not reserved, unique among declarations.
 * 名稱不能用的原因（沒有問題回傳 null）：GLSL 命名、非保留字、宣告之間不重複。 */
export type NameProblem = 'format' | 'reserved' | 'taken';
export function declarationNameProblem(graph: Graph, name: string, except?: string): NameProblem | null {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(name) || name.includes('__')) return 'format';
  if (/^(gl_|TD|sTD|uTD|sg_)/.test(name) || identifierRules.reservedNames.includes(name)) return 'reserved';
  if (graph.declarations.some(d => d.name === name && d.id !== except)) return 'taken';
  return null;
}
export class DeclarationError extends Error {
  constructor(readonly problem: NameProblem | 'kind' | 'type' | 'missing' | 'field', readonly subject?: string) {
    super('Declaration ' + problem + (subject ? ': ' + subject : '')); this.name = 'DeclarationError';
  }
}

const kindOf = (kind: string) => { const module = declarationKinds.get(kind); if (!module) throw new DeclarationError('kind'); return module; };
const requireName = (graph: Graph, name: string, except?: string) => {
  const problem = declarationNameProblem(graph, name, except); if (problem) throw new DeclarationError(problem, name);
};
/** The name people see for a declaration: its kind's label from its position among its kind, or its own name.
 * 宣告給人看的名字：種類有 label 就照它在同種宣告裡的位置給，否則用自己的名字。 */
export function declarationLabel(all: readonly Declaration[], declaration: Declaration): string {
  const kind = declarationKinds.get(declaration.kind);
  if (!kind?.label) return declaration.name;
  return kind.label(declaration, all.filter(d => d.kind === declaration.kind).findIndex(d => d.id === declaration.id));
}
/** A free name from a base, e.g. constant1, constant2. 從基底找一個沒被用的名字。 */
export function freeDeclarationName(graph: Graph, base: string): string {
  for (let i = 1; ; i++) if (!declarationNameProblem(graph, base + i)) return base + i;
}
/** A free name as the legacy editor gives one (legacy functions_ui.js uniqueInputName; human 2026-10-09): the base itself,
 * then base2, base3 — uValue, uColor, cValue. 照舊產品給名字：先用基底本身，再 base2、base3。 */
export function freeLegacyName(graph: Graph, base: string): string {
  if (!declarationNameProblem(graph, base)) return base;
  for (let i = 2; ; i++) if (!declarationNameProblem(graph, base + i)) return base + i;
}

export type DeclarationPatch = { name?: string; type?: string; [field: string]: Value | undefined };
export type DeclarationEntry = { id: string; kind: string; name: string; type: string; [field: string]: Value | undefined };
// Only the kind's own fields can be set (decision 11). 只能設定 kind 自己的欄位。
function setOwnFields(module: DeclarationKind, declaration: Declaration, fields: DeclarationPatch) {
  const own = [...Object.keys(module.initial(declaration.type)), ...(module.optional ?? [])];
  for (const [field, value] of Object.entries(fields)) if (!['id', 'kind', 'name', 'type'].includes(field) && value !== undefined) {
    if (!own.includes(field)) throw new DeclarationError('field', field);
    declaration[field] = copy(value);
  }
}

/** Commands, used inside GraphDocument.change() on its editable candidate document.
 * 指令：在 GraphDocument.change() 的可編輯候選文件上使用。 */
export function addDeclaration(graph: Graph, given: DeclarationEntry): Declaration {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(given.id) || graph.declarations.some(d => d.id === given.id)) throw Error('Invalid or duplicate declaration ID');
  const module = kindOf(given.kind), entry = module.prepare ? module.prepare(given) : given;
  if (!module.types.includes(entry.type)) throw new DeclarationError('type');
  requireName(graph, entry.name);
  const declaration: Declaration = { id: entry.id, kind: entry.kind, name: entry.name, type: entry.type, ...module.initial(entry.type) };
  setOwnFields(module, declaration, entry);
  module.validate(declaration);
  graph.declarations.push(declaration);
  return declaration;
}
/** Rename, retype or change the kind's own fields (value, defaultTexture…). A new type reshapes the
 * old value (Q37 1-3: wires that no longer fit become ghost wires, nothing is unplugged).
 * 改名、改型別、改 kind 自己的欄位；改型別時沿用舊值的分量。 */
export function changeDeclaration(graph: Graph, id: string, patch: DeclarationPatch): Declaration {
  const declaration = graph.declarations.find(d => d.id === id); if (!declaration) throw new DeclarationError('missing');
  const module = kindOf(declaration.kind);
  const next: Declaration = { ...copy(declaration) };
  if (patch.name !== undefined && patch.name !== declaration.name) { requireName(graph, patch.name, id); next.name = patch.name; }
  if (patch.type !== undefined && patch.type !== declaration.type) {
    if (!module.types.includes(patch.type)) throw new DeclarationError('type');
    next.type = patch.type; Object.assign(next, module.retype?.(declaration, patch.type));
  }
  setOwnFields(module, next, patch);
  module.checkChange?.(declaration, next);
  module.validate(next);
  Object.assign(declaration, next);
  return declaration;
}
/** Removing a declaration on purpose also removes the nodes that refer to it and their wires, in
 * the same step (one Undo). Ghosts are for what is missing by accident, not for deliberate removals.
 * 刻意刪除宣告時，引用它的節點與線一起刪（同一步、一次 Undo）；Ghost 是給「意外不見」的，不是給刻意刪除。 */
export function removeDeclaration(graph: Graph, id: string, refersTo: (nodeType: string, params: Readonly<Record<string, Value>>) => string | undefined): void {
  if (!graph.declarations.some(d => d.id === id)) throw new DeclarationError('missing');
  graph.declarations = graph.declarations.filter(d => d.id !== id);
  for (const network of Object.values(graph.stages)) {
    const gone = new Set(network.nodes.filter(n => refersTo(n.nodeType, n.params) === id).map(n => n.id));
    if (!gone.size) continue;
    network.nodes = network.nodes.filter(n => !gone.has(n.id));
    network.edges = network.edges.filter(e => !gone.has(e.from[0]) && !gone.has(e.to[0]));
  }
}
